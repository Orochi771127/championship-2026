// Online (Owner 2026-10-28): static checks on the one-shot Supabase migration
// and the setup guide, so the security shape cannot drift silently.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const sql = fs.readFileSync("supabase/migrations/001_championship_online.sql", "utf8");
const guide = fs.readFileSync("docs/SUPABASE_3MIN_SETUP_ZH_TW.md", "utf8");
const socialGuide = fs.readFileSync("docs/SOCIAL_AND_MULTIPLAYER_SETUP_ZH_TW.md", "utf8");
// 2026-10-29: the fifth table is the first-bind gift ledger, readable and writable by RPCs only.
const TABLES = ["tamer_profiles", "tamer_cloud_saves", "friendships", "pvp_matches", "bind_reward_claims"];

test("the migration creates exactly the five tables, idempotently, and turns RLS on for each", () => {
  for (const table of TABLES) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table} \\(`), table);
    assert.match(sql, new RegExp(`alter table public\\.${table}\\s+enable row level security;`), `${table} RLS`);
  }
  assert.equal((sql.match(/create table if not exists public\./g) ?? []).length, 5);
  assert.doesNotMatch(sql, /drop table/i);
});

test("2026-10-29: the first-bind gift is server-decided, once per account, and its flags cannot be written by a client", () => {
  // The ledger has RLS on, no policy at all, and no grant: only definer RPCs reach it.
  assert.doesNotMatch(sql, /create policy "[^"]+" on public\.bind_reward_claims/);
  assert.match(sql, /revoke all on public\.bind_reward_claims from anon, authenticated;/);
  // Profile rows (bind_reward_claimed, transfer attempts) change through RPCs only.
  assert.match(sql, /revoke insert, update, delete on public\.tamer_profiles from authenticated;/);
  assert.doesNotMatch(sql, /grant [^;]*\b(insert|update)\b[^;]*on public\.tamer_profiles/);
  assert.match(sql, /add column if not exists bind_reward_claimed boolean not null default false/);
  const claim = /create or replace function public\.claim_bind_reward[\s\S]*?\$\$;/.exec(sql)[0];
  assert.match(claim, /from auth\.users u where u\.id = v_uid/, "anonymous guests are refused by auth.users, not a client flag");
  assert.match(claim, /from auth\.identities i/);
  assert.match(claim, /on conflict \(user_id\) do nothing/);
  assert.match(claim, /'BIND_REWARD_ALREADY_CLAIMED'/);
  assert.match(claim, /v_claim\.save_ref = p_save_ref/, "the same save may ask again after a crash, another save may not");
  assert.match(sql, /'public\.claim_bind_reward\(text\)', 'public\.get_bind_reward_status\(\)'/);
  // delete_my_online_data keeps the ledger.
  assert.doesNotMatch(/create or replace function public\.delete_my_online_data[\s\S]*?\$\$;/.exec(sql)[0], /bind_reward_claims/);
});

test("2026-10-29: transfer codes are six cryptographically random characters, 15 minutes, with a guess limit", () => {
  const create = /create or replace function public\.create_transfer_code[\s\S]*?\$\$;/.exec(sql)[0];
  const redeem = /create or replace function public\.redeem_transfer_code[\s\S]*?\$\$;/.exec(sql)[0];
  assert.match(create, /extensions\.gen_random_bytes\(6\)/); assert.doesNotMatch(create, /random\(\)/);
  assert.match(create, /interval '15 minutes'/); assert.match(create, /substr\(v_code, 1, 3\) \|\| '-' \|\| substr\(v_code, 4, 3\)/);
  assert.match(redeem, /'TRANSFER_THROTTLED'/); assert.match(redeem, /transfer_redeem_failures >= 5/); assert.match(redeem, /interval '10 minutes'/);
  assert.match(redeem, /'\^\[0-9A-HJKMNP-TV-Z\]\{6\}\$'/);
});

test("2026-10-29: the room channel authorizes Broadcast and Presence for the two players only", () => {
  assert.equal((sql.match(/realtime\.messages\.extension in \('broadcast', 'presence'\)/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /alter table realtime\.messages/i, "realtime.messages already has RLS; altering it aborts the migration");
});

test("the social guide names the exact lines, the providers' consoles and the redirect allow-list", () => {
  for (const pattern of [/online-service\.v1\.json/, /第 3 行/, /第 4 行/, /第 6 行/, /socialLinksConfig\.js/, /第 17～20 行/, /001_championship_online\.sql/, /sb_secret_/,
    /Google Cloud Console/, /Meta for Developers/, /Discord Developer Portal/, /auth\/v1\/callback/, /championship-2026\/\*\*/, /Allow manual linking/, /Allow anonymous sign-ins/]) {
    assert.match(socialGuide, pattern, String(pattern));
  }
});

test("every policy is scoped to authenticated with an auth.uid() predicate, and anon has nothing", () => {
  const policies = sql.match(/create policy "[^"]+" on public\.\w+[\s\S]*?;/g) ?? [];
  assert.ok(policies.length >= 10);
  for (const policy of policies) {
    assert.match(policy, /to authenticated/, policy.slice(0, 60));
    assert.match(policy, /auth\.uid\(\)/, policy.slice(0, 60));
    assert.doesNotMatch(policy, /auth\.role\(\)/);
    if (/for update/.test(policy)) assert.match(policy, /with check/, "update policies need WITH CHECK");
  }
  assert.doesNotMatch(sql, /to anon\b/);
  assert.match(sql, /revoke all on public\.tamer_profiles, public\.tamer_cloud_saves, public\.friendships, public\.pvp_matches from anon;/);
  assert.match(sql, /tamer_cloud_saves: owner all[\s\S]*?for all to authenticated using \(\(select auth\.uid\(\)\) = user_id\) with check \(\(select auth\.uid\(\)\) = user_id\)/);
});

test("definer functions pin an empty search_path, check the caller, and are revoked from public/anon", () => {
  const definers = sql.match(/create or replace function public\.\w+[\s\S]*?\$\$;/g).filter(fn => /security definer/.test(fn));
  assert.ok(definers.length >= 20);
  for (const fn of definers) {
    assert.match(fn, /set search_path = ''/, fn.slice(0, 60));
    assert.match(fn, /auth\.uid\(\)/, fn.slice(0, 60));
    assert.doesNotMatch(fn, /\buser_metadata\b|raw_user_meta_data/, "metadata never decides authorization");
  }
  assert.match(sql, /revoke all on function %s from public, anon/);
  assert.match(sql, /grant execute on function %s to authenticated, service_role/);
  // Every definer function appears in the grant loop.
  const names = definers.map(fn => /function public\.(\w+)/.exec(fn)[1]);
  for (const name of names) assert.match(sql, new RegExp(`'public\\.${name}\\(`), `${name} in grant loop`);
});

test("saves are hash-checked, revision-guarded and size-capped; rooms expire; results are reported by both sides", () => {
  assert.match(sql, /encode\(extensions\.digest\(p_payload, 'sha256'\), 'hex'\) <> p_content_sha256/);
  assert.match(sql, /'CONFLICT'/);
  assert.match(sql, /octet_length\(payload\) <= 262144/);
  assert.match(sql, /room_code ~ '\^\[0-9\]\{4,6\}\$'/);
  assert.match(sql, /expires_at\s+timestamptz not null default now\(\) \+ interval '10 minutes'/);
  assert.match(sql, /status = 'disputed'/);
  assert.match(sql, /transfer_code_hash/);
  assert.match(sql, /on realtime\.messages/);
});

test("the setup guide tells the Owner the exact file and lines for the URL and key", () => {
  assert.match(guide, /online-service\.v1\.json/);
  assert.match(guide, /第 3 行/); assert.match(guide, /第 4 行/);
  assert.match(guide, /sb_secret_/);
  assert.match(guide, /001_championship_online\.sql/);
});

test("review findings: friendships cannot be rewritten, rooms are RPC-only, saves need a known revision, playing rooms expire", () => {
  assert.doesNotMatch(sql, /create policy "friendships: addressee accepts"/);
  assert.match(sql, /revoke update on public\.friendships from authenticated;/);
  assert.doesNotMatch(sql, /create policy "pvp_matches: host insert"/);
  assert.match(sql, /revoke insert, update, delete on public\.pvp_matches from authenticated;/);
  assert.match(sql, /p_force boolean default false/);
  assert.match(sql, /not coalesce\(p_force, false\) and \(p_expected_revision is null or v_row\.server_revision <> p_expected_revision\)/);
  assert.match(sql, /status in \('open', 'joined', 'ready', 'playing'\) and expires_at < now\(\)/);
  assert.match(sql, /now\(\) \+ interval '30 minutes'/);
  assert.match(sql, /public\.upload_cloud_save\(text, text, int, jsonb, text, int, boolean\)/);
});
