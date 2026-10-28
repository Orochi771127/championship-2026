-- ============================================================================
-- 網線拍檔：錦標賽 — 線上功能一鍵建置（Supabase / Postgres）
-- 001_championship_online.sql  (2026-10-28, OWNER_APPROVED_ADAPTATION)
--
-- 在 Supabase Dashboard → SQL Editor 貼上整份檔案後按 Run。
-- 可重複執行（idempotent）：所有物件都用 if not exists / create or replace。
--
-- 建立 4 張表 + RLS 安全鎖 + 一組 SECURITY DEFINER RPC：
--   public.tamer_profiles     馴獸師名片（好友碼、階級、王牌、AI 防守隊伍）
--   public.tamer_cloud_saves  雲端存檔信封（只有本人能讀寫；跨裝置引繼碼也在這）
--   public.friendships        好友申請／好友
--   public.pvp_matches        密碼對戰房間、通訊對戰配對、戰鬥種子與勝負
--
-- 安全邊界（請誠實看待）：
--   * RLS 保證任何前端（含 F12）都改不了「別人的」資料列。
--   * 遊戲本體仍是 client-authoritative：玩家可以竄改自己的存檔與隊伍碼。
--     這份 SQL 不是反作弊系統；對戰勝負由雙方各自回報，不一致時記為 disputed。
--   * 匿名遊客（signInAnonymously）也是 authenticated 角色，所有政策都以
--     auth.uid() 判斷本人，不用 auth.role()。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. 共用工具：pgcrypto（存檔雜湊校驗）與 Crockford base32 好友碼 TM-XXXX-XXXX
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create or replace function public.championship_random_tamer_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  chars text := '';
  i int;
begin
  for i in 1..8 loop
    chars := chars || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return 'TM-' || substr(chars, 1, 4) || '-' || substr(chars, 5, 4);
end;
$$;

create or replace function public.championship_is_tamer_code(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_code ~ '^TM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$';
$$;

create or replace function public.championship_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. 馴獸師名片
-- ---------------------------------------------------------------------------
create table if not exists public.tamer_profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  tamer_code         text not null unique,
  tamer_name         text not null default '' check (char_length(tamer_name) <= 24),
  rank_title         text not null default '' check (char_length(rank_title) <= 32),
  ace_partner_json   jsonb not null default '{}'::jsonb check (pg_column_size(ace_partner_json) <= 4096),
  defense_team_json  jsonb not null default '{}'::jsonb check (pg_column_size(defense_team_json) <= 65536),
  is_anonymous       boolean not null default true,
  last_seen_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint tamer_profiles_code_format check (public.championship_is_tamer_code(tamer_code))
);
create index if not exists tamer_profiles_last_seen_idx on public.tamer_profiles (last_seen_at desc);
create index if not exists tamer_profiles_defense_idx on public.tamer_profiles (last_seen_at desc) where defense_team_json <> '{}'::jsonb;
drop trigger if exists tamer_profiles_touch on public.tamer_profiles;
create trigger tamer_profiles_touch before update on public.tamer_profiles
  for each row execute function public.championship_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. 雲端存檔信封（2026-09-29 帳號與雲端存檔規劃的信封格式）
-- ---------------------------------------------------------------------------
create table if not exists public.tamer_cloud_saves (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  server_revision    integer not null default 0,
  content_sha256     text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  game_revision      integer not null default 0,
  save_schema        text not null default '' check (char_length(save_schema) <= 64),
  summary_json       jsonb not null default '{}'::jsonb check (pg_column_size(summary_json) <= 2048),
  payload            text not null check (octet_length(payload) <= 262144),  -- 256 KB；遊戲存檔上限 64 KB
  device_label       text not null default '' check (char_length(device_label) <= 64),
  transfer_code_hash text,
  transfer_expires_at timestamptz,
  updated_at         timestamptz not null default now()
);
drop trigger if exists tamer_cloud_saves_touch on public.tamer_cloud_saves;
create trigger tamer_cloud_saves_touch before update on public.tamer_cloud_saves
  for each row execute function public.championship_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. 好友
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users (id) on delete cascade,
  addressee_id  uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
drop trigger if exists friendships_touch on public.friendships;
create trigger friendships_touch before update on public.friendships
  for each row execute function public.championship_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. 連線對戰（房號、配對、種子、雙方回報）
-- ---------------------------------------------------------------------------
create table if not exists public.pvp_matches (
  id            uuid primary key default gen_random_uuid(),
  room_code     text check (room_code ~ '^[0-9]{4,6}$'),
  mode          text not null check (mode in ('room', 'ladder', 'spar')),
  host_id       uuid not null references auth.users (id) on delete cascade,
  guest_id      uuid references auth.users (id) on delete set null,
  status        text not null default 'open'
                check (status in ('open', 'joined', 'ready', 'playing', 'finished', 'expired', 'disputed', 'cancelled')),
  seed          bigint not null,
  invite_code   text check (octet_length(invite_code) <= 50000),
  reply_code    text check (octet_length(reply_code) <= 50000),
  host_ready    boolean not null default false,
  guest_ready   boolean not null default false,
  host_result   jsonb check (pg_column_size(host_result) <= 4096),
  guest_result  jsonb check (pg_column_size(guest_result) <= 4096),
  winner_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '10 minutes'
);
-- 同一個房號在「活著的房間」裡只能有一個；結束後可以重複使用。
create unique index if not exists pvp_matches_open_room_code_idx
  on public.pvp_matches (room_code) where status in ('open', 'joined', 'ready', 'playing');
create index if not exists pvp_matches_host_idx on public.pvp_matches (host_id, status);
create index if not exists pvp_matches_guest_idx on public.pvp_matches (guest_id, status);
drop trigger if exists pvp_matches_touch on public.pvp_matches;
create trigger pvp_matches_touch before update on public.pvp_matches
  for each row execute function public.championship_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS 安全鎖：每張表都開啟；只有本人（auth.uid() = user_id）能改自己的列
-- ---------------------------------------------------------------------------
alter table public.tamer_profiles    enable row level security;
alter table public.tamer_cloud_saves enable row level security;
alter table public.friendships       enable row level security;
alter table public.pvp_matches       enable row level security;

-- 名片：本人可讀寫自己的列；已成為好友的人可讀名片。其他人只能透過 RPC（限定欄位）查碼。
drop policy if exists "tamer_profiles: owner select" on public.tamer_profiles;
create policy "tamer_profiles: owner select" on public.tamer_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "tamer_profiles: friends select" on public.tamer_profiles;
create policy "tamer_profiles: friends select" on public.tamer_profiles
  for select to authenticated using (exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = public.tamer_profiles.user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = public.tamer_profiles.user_id))));
drop policy if exists "tamer_profiles: owner insert" on public.tamer_profiles;
create policy "tamer_profiles: owner insert" on public.tamer_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "tamer_profiles: owner update" on public.tamer_profiles;
create policy "tamer_profiles: owner update" on public.tamer_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "tamer_profiles: owner delete" on public.tamer_profiles;
create policy "tamer_profiles: owner delete" on public.tamer_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 雲端存檔：只有本人。沒有任何「好友可讀」例外。
drop policy if exists "tamer_cloud_saves: owner all" on public.tamer_cloud_saves;
create policy "tamer_cloud_saves: owner all" on public.tamer_cloud_saves
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 好友：只有當事人看得到；申請由發起人建立；只有被邀請方能接受；任一方可刪除。
drop policy if exists "friendships: participants select" on public.friendships;
create policy "friendships: participants select" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
drop policy if exists "friendships: requester insert" on public.friendships;
create policy "friendships: requester insert" on public.friendships
  for insert to authenticated with check ((select auth.uid()) = requester_id and status = 'pending');
-- Accepting goes through respond_friend_request only. A direct UPDATE policy would let an
-- addressee rewrite requester_id and forge a friendship with someone who never asked.
drop policy if exists "friendships: addressee accepts" on public.friendships;
drop policy if exists "friendships: participants delete" on public.friendships;
create policy "friendships: participants delete" on public.friendships
  for delete to authenticated using ((select auth.uid()) in (requester_id, addressee_id));

-- 對戰：只有房主與挑戰者看得到；狀態變更一律走 RPC（下方），沒有直接 update 政策。
drop policy if exists "pvp_matches: participants select" on public.pvp_matches;
create policy "pvp_matches: participants select" on public.pvp_matches
  for select to authenticated using ((select auth.uid()) in (host_id, guest_id));
-- Rooms are created and changed only through the RPCs below (no direct INSERT/UPDATE).
drop policy if exists "pvp_matches: host insert" on public.pvp_matches;

-- Data API 曝光（2026-04-28 起新表不再自動曝光）：讓登入玩家能走 RLS 讀自己的列。
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tamer_profiles, public.tamer_cloud_saves to authenticated;
grant select, insert, delete on public.friendships to authenticated;
revoke update on public.friendships from authenticated;
grant select on public.pvp_matches to authenticated;
revoke insert, update, delete on public.pvp_matches from authenticated;
revoke all on public.tamer_profiles, public.tamer_cloud_saves, public.friendships, public.pvp_matches from anon;

-- ---------------------------------------------------------------------------
-- 6. RPC（SECURITY DEFINER，search_path 鎖空，每個都先檢查 auth.uid()）
--    這些函式是遊戲前端唯一用來「改別人也看得到的狀態」的入口。
-- ---------------------------------------------------------------------------
create or replace function public.championship_current_uid()
returns uuid
language sql
stable
set search_path = ''
as $$ select auth.uid(); $$;

-- 6a. 建立／更新自己的名片。p_preferred_code 可帶遊戲本機算出的 TM 碼，若未被占用就沿用。
create or replace function public.ensure_tamer_profile(
  p_tamer_name text default '',
  p_rank_title text default '',
  p_preferred_code text default null,
  p_ace_partner jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_row public.tamer_profiles;
  v_anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true);
  v_try int := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_row from public.tamer_profiles where user_id = v_uid;
  if not found then
    if p_preferred_code is not null and public.championship_is_tamer_code(p_preferred_code)
       and not exists (select 1 from public.tamer_profiles where tamer_code = p_preferred_code) then
      v_code := p_preferred_code;
    else
      loop
        v_code := public.championship_random_tamer_code();
        exit when not exists (select 1 from public.tamer_profiles where tamer_code = v_code);
        v_try := v_try + 1;
        if v_try > 20 then raise exception 'TAMER_CODE_EXHAUSTED'; end if;
      end loop;
    end if;
    insert into public.tamer_profiles (user_id, tamer_code, tamer_name, rank_title, ace_partner_json, is_anonymous)
    values (v_uid, v_code, left(coalesce(p_tamer_name, ''), 24), left(coalesce(p_rank_title, ''), 32), coalesce(p_ace_partner, '{}'::jsonb), v_anon)
    returning * into v_row;
  else
    update public.tamer_profiles
      set tamer_name = left(coalesce(nullif(p_tamer_name, ''), tamer_name), 24),
          rank_title = left(coalesce(nullif(p_rank_title, ''), rank_title), 32),
          ace_partner_json = coalesce(p_ace_partner, ace_partner_json),
          is_anonymous = v_anon,
          last_seen_at = now()
      where user_id = v_uid
      returning * into v_row;
  end if;
  return jsonb_build_object('userId', v_row.user_id, 'tamerCode', v_row.tamer_code, 'tamerName', v_row.tamer_name,
    'rankTitle', v_row.rank_title, 'acePartner', v_row.ace_partner_json, 'isAnonymous', v_row.is_anonymous,
    'hasDefenseTeam', v_row.defense_team_json <> '{}'::jsonb, 'lastSeenAt', v_row.last_seen_at);
end;
$$;

-- 6b. 用好友碼查名片（限定欄位；不回傳防守隊伍，也不回傳 uid 以外的隱私）。
create or replace function public.find_tamer_by_code(p_code text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('userId', t.user_id, 'tamerCode', t.tamer_code, 'tamerName', t.tamer_name,
      'rankTitle', t.rank_title, 'acePartner', t.ace_partner_json, 'lastSeenAt', t.last_seen_at,
      'hasDefenseTeam', t.defense_team_json <> '{}'::jsonb)
    from public.tamer_profiles t where t.tamer_code = upper(trim(p_code)) and t.user_id <> auth.uid()
  ) end;
$$;

-- 6c. 送出好友申請（對方已經先邀請你 → 直接成為好友）。
create or replace function public.send_friend_request(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
  v_existing public.friendships;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select user_id into v_other from public.tamer_profiles where tamer_code = upper(trim(p_code));
  if v_other is null then return jsonb_build_object('ok', false, 'reason', 'TAMER_NOT_FOUND'); end if;
  if v_other = v_uid then return jsonb_build_object('ok', false, 'reason', 'CANNOT_FRIEND_SELF'); end if;
  select * into v_existing from public.friendships
    where least(requester_id, addressee_id) = least(v_uid, v_other) and greatest(requester_id, addressee_id) = greatest(v_uid, v_other);
  if found then
    if v_existing.status = 'accepted' then return jsonb_build_object('ok', true, 'status', 'accepted', 'friendshipId', v_existing.id); end if;
    if v_existing.addressee_id = v_uid then
      update public.friendships set status = 'accepted' where id = v_existing.id;
      return jsonb_build_object('ok', true, 'status', 'accepted', 'friendshipId', v_existing.id);
    end if;
    return jsonb_build_object('ok', true, 'status', 'pending', 'friendshipId', v_existing.id);
  end if;
  if (select count(*) from public.friendships where requester_id = v_uid and status = 'pending') >= 50 then
    return jsonb_build_object('ok', false, 'reason', 'TOO_MANY_PENDING');
  end if;
  insert into public.friendships (requester_id, addressee_id) values (v_uid, v_other) returning * into v_existing;
  return jsonb_build_object('ok', true, 'status', 'pending', 'friendshipId', v_existing.id);
end;
$$;

-- 6d. 回覆好友申請（只有被邀請方能接受；拒絕＝刪除）。
create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_row from public.friendships where id = p_friendship_id and addressee_id = v_uid and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'reason', 'REQUEST_NOT_FOUND'); end if;
  if p_accept then
    update public.friendships set status = 'accepted' where id = v_row.id;
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;
  delete from public.friendships where id = v_row.id;
  return jsonb_build_object('ok', true, 'status', 'declined');
end;
$$;

create or replace function public.remove_friend(p_friendship_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_count int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  delete from public.friendships where id = p_friendship_id and v_uid in (requester_id, addressee_id);
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', v_count > 0);
end;
$$;

-- 6e. 我的好友名單＋待處理申請（含對方名片摘要與是否有防守隊伍）。
create or replace function public.list_friend_cards()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(card order by card ->> 'status', card ->> 'lastSeenAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'friendshipId', f.id, 'status', f.status,
      'direction', case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
      'userId', t.user_id, 'tamerCode', t.tamer_code, 'tamerName', t.tamer_name, 'rankTitle', t.rank_title,
      'acePartner', t.ace_partner_json, 'lastSeenAt', t.last_seen_at, 'hasDefenseTeam', t.defense_team_json <> '{}'::jsonb
    ) as card
    from public.friendships f
    join public.tamer_profiles t on t.user_id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    where auth.uid() is not null and auth.uid() in (f.requester_id, f.addressee_id)
  ) cards;
$$;

-- 6f. 防守隊伍：存自己的（遊戲的密碼對戰隊伍碼 + 成員摘要）；讀好友的；天梯隨機抽對手。
create or replace function public.set_defense_team(p_team jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_team is not null and (p_team ->> 'passwordCode') is null then
    return jsonb_build_object('ok', false, 'reason', 'PASSWORD_CODE_REQUIRED');
  end if;
  update public.tamer_profiles set defense_team_json = coalesce(p_team, '{}'::jsonb), last_seen_at = now() where user_id = v_uid;
  if not found then return jsonb_build_object('ok', false, 'reason', 'PROFILE_REQUIRED'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_friend_defense_team(p_user_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    when not exists (select 1 from public.friendships f where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(auth.uid(), p_user_id)
      and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_user_id)) then null
    else (select jsonb_build_object('userId', t.user_id, 'tamerCode', t.tamer_code, 'tamerName', t.tamer_name,
            'rankTitle', t.rank_title, 'defenseTeam', t.defense_team_json)
          from public.tamer_profiles t where t.user_id = p_user_id and t.defense_team_json <> '{}'::jsonb)
  end;
$$;

create or replace function public.pick_ladder_opponents(p_limit int default 5)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('userId', t.user_id, 'tamerCode', t.tamer_code, 'tamerName', t.tamer_name,
    'rankTitle', t.rank_title, 'acePartner', t.ace_partner_json, 'lastSeenAt', t.last_seen_at, 'defenseTeam', t.defense_team_json)), '[]'::jsonb)
  from (
    select * from public.tamer_profiles t
    where auth.uid() is not null and t.user_id <> auth.uid() and t.defense_team_json <> '{}'::jsonb
      and t.last_seen_at > now() - interval '90 days'
    order by random()
    limit greatest(1, least(coalesce(p_limit, 5), 10))
  ) t;
$$;

-- 6g. 密碼對戰房間：房主帶著通訊邀請碼開房 → 挑戰者用 4~6 碼房號加入 → 交回覆碼 → 雙方 ready → 各自回報結果。
create or replace function public.create_pvp_room(p_invite_code text, p_code_length int default 4, p_mode text default 'room')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_len int := greatest(4, least(coalesce(p_code_length, 4), 6));
  v_code text;
  v_row public.pvp_matches;
  v_try int := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_invite_code is null or octet_length(p_invite_code) > 50000 then return jsonb_build_object('ok', false, 'reason', 'INVITE_CODE_REQUIRED'); end if;
  -- 過期房自動收掉；每人最多 3 個活房
  update public.pvp_matches set status = 'expired' where host_id = v_uid and status in ('open', 'joined', 'ready', 'playing') and expires_at < now();
  if (select count(*) from public.pvp_matches where host_id = v_uid and status in ('open', 'joined', 'ready', 'playing')) >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'TOO_MANY_OPEN_ROOMS');
  end if;
  loop
    v_code := lpad(floor(random() * power(10, v_len))::bigint::text, v_len, '0');
    exit when not exists (select 1 from public.pvp_matches where room_code = v_code and status in ('open', 'joined', 'ready', 'playing'));
    v_try := v_try + 1;
    if v_try > 30 then return jsonb_build_object('ok', false, 'reason', 'ROOM_CODES_BUSY'); end if;
  end loop;
  insert into public.pvp_matches (room_code, mode, host_id, seed, invite_code)
    values (v_code, case when p_mode in ('room', 'ladder', 'spar') then p_mode else 'room' end, v_uid,
            floor(random() * 2147483647)::bigint, p_invite_code)
    returning * into v_row;
  return jsonb_build_object('ok', true, 'matchId', v_row.id, 'roomCode', v_row.room_code, 'seed', v_row.seed,
    'status', v_row.status, 'expiresAt', v_row.expires_at);
end;
$$;

create or replace function public.join_pvp_room(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.pvp_matches;
  v_host public.tamer_profiles;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_row from public.pvp_matches
    where room_code = trim(p_room_code) and status = 'open' and expires_at > now() for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'ROOM_NOT_FOUND'); end if;
  if v_row.host_id = v_uid then return jsonb_build_object('ok', false, 'reason', 'CANNOT_JOIN_OWN_ROOM'); end if;
  update public.pvp_matches set guest_id = v_uid, status = 'joined', expires_at = now() + interval '10 minutes'
    where id = v_row.id returning * into v_row;
  select * into v_host from public.tamer_profiles where user_id = v_row.host_id;
  return jsonb_build_object('ok', true, 'matchId', v_row.id, 'roomCode', v_row.room_code, 'seed', v_row.seed,
    'status', v_row.status, 'inviteCode', v_row.invite_code, 'expiresAt', v_row.expires_at,
    'host', jsonb_build_object('tamerCode', v_host.tamer_code, 'tamerName', v_host.tamer_name, 'rankTitle', v_host.rank_title));
end;
$$;

create or replace function public.submit_pvp_reply(p_match_id uuid, p_reply_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.pvp_matches;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_reply_code is null or octet_length(p_reply_code) > 50000 then return jsonb_build_object('ok', false, 'reason', 'REPLY_CODE_REQUIRED'); end if;
  update public.pvp_matches set reply_code = p_reply_code, status = 'ready', guest_ready = true, expires_at = now() + interval '10 minutes'
    where id = p_match_id and guest_id = v_uid and status in ('joined', 'ready') returning * into v_row;
  if not found then return jsonb_build_object('ok', false, 'reason', 'MATCH_NOT_JOINABLE'); end if;
  return jsonb_build_object('ok', true, 'matchId', v_row.id, 'status', v_row.status);
end;
$$;

create or replace function public.set_pvp_ready(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.pvp_matches;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_row from public.pvp_matches where id = p_match_id and v_uid in (host_id, guest_id) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'MATCH_NOT_FOUND'); end if;
  if v_row.reply_code is null then return jsonb_build_object('ok', false, 'reason', 'REPLY_PENDING'); end if;
  if v_row.host_id = v_uid then v_row.host_ready := true; else v_row.guest_ready := true; end if;
  update public.pvp_matches set host_ready = v_row.host_ready, guest_ready = v_row.guest_ready,
    status = case when v_row.host_ready and v_row.guest_ready then 'playing' else 'ready' end,
    -- A running match holds its slot for at most 30 minutes; both sides report results, but a lost client must not lock the host out.
    expires_at = case when v_row.host_ready and v_row.guest_ready then now() + interval '30 minutes' else expires_at end
    where id = v_row.id returning * into v_row;
  return jsonb_build_object('ok', true, 'status', v_row.status, 'hostReady', v_row.host_ready, 'guestReady', v_row.guest_ready);
end;
$$;

create or replace function public.get_pvp_match(p_match_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('matchId', m.id, 'roomCode', m.room_code, 'mode', m.mode, 'status', m.status, 'seed', m.seed,
      'hostId', m.host_id, 'guestId', m.guest_id, 'inviteCode', m.invite_code, 'replyCode', m.reply_code,
      'hostReady', m.host_ready, 'guestReady', m.guest_ready, 'winnerId', m.winner_id, 'expiresAt', m.expires_at,
      'hostResult', m.host_result, 'guestResult', m.guest_result)
    from public.pvp_matches m where m.id = p_match_id and auth.uid() in (m.host_id, m.guest_id)
  ) end;
$$;

-- 雙方各自回報；兩邊一致 → finished，不一致 → disputed（沒有伺服器裁判，誠實標記）。
create or replace function public.report_pvp_result(p_match_id uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.pvp_matches; v_winner uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_row from public.pvp_matches where id = p_match_id and v_uid in (host_id, guest_id) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'MATCH_NOT_FOUND'); end if;
  if v_row.host_id = v_uid then v_row.host_result := p_result; else v_row.guest_result := p_result; end if;
  if v_row.host_result is not null and v_row.guest_result is not null then
    if (v_row.host_result ->> 'winnerId') is not distinct from (v_row.guest_result ->> 'winnerId') then
      v_winner := nullif(v_row.host_result ->> 'winnerId', '')::uuid;
      update public.pvp_matches set host_result = v_row.host_result, guest_result = v_row.guest_result, winner_id = v_winner, status = 'finished'
        where id = v_row.id returning * into v_row;
    else
      update public.pvp_matches set host_result = v_row.host_result, guest_result = v_row.guest_result, status = 'disputed'
        where id = v_row.id returning * into v_row;
    end if;
  else
    update public.pvp_matches set host_result = v_row.host_result, guest_result = v_row.guest_result where id = v_row.id returning * into v_row;
  end if;
  return jsonb_build_object('ok', true, 'status', v_row.status, 'winnerId', v_row.winner_id);
end;
$$;

create or replace function public.cancel_pvp_room(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_count int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  update public.pvp_matches set status = 'cancelled' where id = p_match_id and v_uid in (host_id, guest_id) and status in ('open', 'joined', 'ready');
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', v_count > 0);
end;
$$;

-- 6h. 雲端存檔：If-Match 式修訂號；修訂不符回 CONFLICT 並附上雲端摘要，前端走「並列選擇」畫面，不自動合併。
drop function if exists public.upload_cloud_save(text, text, int, jsonb, text, int);
create or replace function public.upload_cloud_save(
  p_payload text, p_content_sha256 text, p_game_revision int, p_summary jsonb, p_device_label text, p_expected_revision int, p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.tamer_cloud_saves;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_payload is null or octet_length(p_payload) > 262144 then return jsonb_build_object('ok', false, 'reason', 'PAYLOAD_TOO_LARGE'); end if;
  if p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'reason', 'SHA256_REQUIRED'); end if;
  if encode(extensions.digest(p_payload, 'sha256'), 'hex') <> p_content_sha256 then return jsonb_build_object('ok', false, 'reason', 'SHA256_MISMATCH'); end if;
  select * into v_row from public.tamer_cloud_saves where user_id = v_uid for update;
  -- An existing cloud save is only replaced when the caller knows its revision (If-Match) or says so
  -- explicitly (p_force). An unknown baseline (new device, reload) is a conflict, never a silent overwrite.
  if found and not coalesce(p_force, false) and (p_expected_revision is null or v_row.server_revision <> p_expected_revision) then
    return jsonb_build_object('ok', false, 'reason', 'CONFLICT', 'serverRevision', v_row.server_revision, 'contentSha256', v_row.content_sha256,
      'summary', v_row.summary_json, 'deviceLabel', v_row.device_label, 'updatedAt', v_row.updated_at);
  end if;
  if found then
    update public.tamer_cloud_saves set server_revision = v_row.server_revision + 1, content_sha256 = p_content_sha256,
      game_revision = coalesce(p_game_revision, 0), summary_json = coalesce(p_summary, '{}'::jsonb), payload = p_payload,
      device_label = left(coalesce(p_device_label, ''), 64)
      where user_id = v_uid returning * into v_row;
  else
    insert into public.tamer_cloud_saves (user_id, server_revision, content_sha256, game_revision, summary_json, payload, device_label)
      values (v_uid, 1, p_content_sha256, coalesce(p_game_revision, 0), coalesce(p_summary, '{}'::jsonb), p_payload, left(coalesce(p_device_label, ''), 64))
      returning * into v_row;
  end if;
  return jsonb_build_object('ok', true, 'serverRevision', v_row.server_revision, 'contentSha256', v_row.content_sha256, 'updatedAt', v_row.updated_at);
end;
$$;

create or replace function public.download_cloud_save()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('ok', true, 'serverRevision', s.server_revision, 'contentSha256', s.content_sha256, 'gameRevision', s.game_revision,
      'summary', s.summary_json, 'payload', s.payload, 'deviceLabel', s.device_label, 'updatedAt', s.updated_at)
    from public.tamer_cloud_saves s where s.user_id = auth.uid()
  ) end;
$$;

-- 6i. 跨裝置引繼碼：一次性、24 小時、只存雜湊；兌換端把「存檔內容」複製成自己的雲端存檔（不是把帳號搬過去）。
create or replace function public.create_transfer_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code text := '';
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.tamer_cloud_saves where user_id = v_uid) then return jsonb_build_object('ok', false, 'reason', 'BACKUP_REQUIRED'); end if;
  for i in 1..8 loop v_code := v_code || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
  update public.tamer_cloud_saves
    set transfer_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex'), transfer_expires_at = now() + interval '24 hours'
    where user_id = v_uid;
  return jsonb_build_object('ok', true, 'transferCode', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4), 'expiresAt', now() + interval '24 hours');
end;
$$;

create or replace function public.redeem_transfer_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := upper(replace(replace(trim(p_code), '-', ''), ' ', ''));
  v_src public.tamer_cloud_saves;
  v_row public.tamer_cloud_saves;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_src from public.tamer_cloud_saves
    where transfer_code_hash = encode(extensions.digest(v_clean, 'sha256'), 'hex') and transfer_expires_at > now() for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'TRANSFER_CODE_INVALID'); end if;
  if v_src.user_id = v_uid then return jsonb_build_object('ok', false, 'reason', 'SAME_ACCOUNT'); end if;
  update public.tamer_cloud_saves set transfer_code_hash = null, transfer_expires_at = null where user_id = v_src.user_id;
  insert into public.tamer_cloud_saves (user_id, server_revision, content_sha256, game_revision, summary_json, payload, device_label)
    values (v_uid, 1, v_src.content_sha256, v_src.game_revision, v_src.summary_json, v_src.payload, 'transfer')
    on conflict (user_id) do update set server_revision = public.tamer_cloud_saves.server_revision + 1,
      content_sha256 = excluded.content_sha256, game_revision = excluded.game_revision, summary_json = excluded.summary_json,
      payload = excluded.payload, device_label = 'transfer'
    returning * into v_row;
  return jsonb_build_object('ok', true, 'serverRevision', v_row.server_revision, 'contentSha256', v_row.content_sha256, 'gameRevision', v_row.game_revision,
    'summary', v_row.summary_json, 'payload', v_row.payload, 'updatedAt', v_row.updated_at);
end;
$$;

-- 6j. 刪除我的所有線上資料（名片、存檔、好友、對戰）。帳號本身由 Auth 另外刪除。
create or replace function public.delete_my_online_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  delete from public.pvp_matches where host_id = v_uid or guest_id = v_uid;
  delete from public.friendships where requester_id = v_uid or addressee_id = v_uid;
  delete from public.tamer_cloud_saves where user_id = v_uid;
  delete from public.tamer_profiles where user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 函式權限：SECURITY DEFINER 預設對 PUBLIC 可執行 → 全部收回，只給登入玩家（含匿名遊客）。
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.championship_random_tamer_code()', 'public.championship_is_tamer_code(text)', 'public.championship_current_uid()',
    'public.ensure_tamer_profile(text, text, text, jsonb)', 'public.find_tamer_by_code(text)',
    'public.send_friend_request(text)', 'public.respond_friend_request(uuid, boolean)', 'public.remove_friend(uuid)', 'public.list_friend_cards()',
    'public.set_defense_team(jsonb)', 'public.get_friend_defense_team(uuid)', 'public.pick_ladder_opponents(int)',
    'public.create_pvp_room(text, int, text)', 'public.join_pvp_room(text)', 'public.submit_pvp_reply(uuid, text)', 'public.set_pvp_ready(uuid)',
    'public.get_pvp_match(uuid)', 'public.report_pvp_result(uuid, jsonb)', 'public.cancel_pvp_room(uuid)',
    'public.upload_cloud_save(text, text, int, jsonb, text, int, boolean)', 'public.download_cloud_save()',
    'public.create_transfer_code()', 'public.redeem_transfer_code(text)', 'public.delete_my_online_data()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Realtime Broadcast 私有頻道 pvp:<matchId>：只有該房間的房主與挑戰者能收發。
--    （realtime schema 自 2026-07 起鎖定 DDL，但 RLS 政策仍可建立。）
-- ---------------------------------------------------------------------------
do $$
begin
  execute 'drop policy if exists "pvp participants can receive" on realtime.messages';
  execute 'drop policy if exists "pvp participants can broadcast" on realtime.messages';
  execute $p$
    create policy "pvp participants can receive" on realtime.messages
      for select to authenticated
      using (realtime.messages.extension = 'broadcast' and exists (
        select 1 from public.pvp_matches m
        where ('pvp:' || m.id::text) = realtime.topic() and (select auth.uid()) in (m.host_id, m.guest_id)))
  $p$;
  execute $p$
    create policy "pvp participants can broadcast" on realtime.messages
      for insert to authenticated
      with check (realtime.messages.extension = 'broadcast' and exists (
        select 1 from public.pvp_matches m
        where ('pvp:' || m.id::text) = realtime.topic() and (select auth.uid()) in (m.host_id, m.guest_id)))
  $p$;
exception when others then
  raise notice 'Realtime policies skipped (%). Rooms still work through RPC polling.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 9. 選用：定期清掉過期房間與 30 天以上的匿名遊客（需要 pg_cron；沒開就略過）。
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('championship-expire-rooms', '*/10 * * * *',
      $job$ update public.pvp_matches set status = 'expired' where status in ('open','joined','ready','playing') and expires_at < now() $job$);
  end if;
exception when others then
  raise notice 'pg_cron schedule skipped (%).', sqlerrm;
end $$;

-- 完成。回到遊戲專案把 Project URL 與 publishable/anon key 填進
-- src/data/championship/online-service.v1.json 即可（見 docs/SUPABASE_3MIN_SETUP_ZH_TW.md）。
