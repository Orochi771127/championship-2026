// Online (Owner 2026-10-28): static checks on the one-shot Supabase migration
// and the setup guide, so the security shape cannot drift silently.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const sql = fs.readFileSync("supabase/migrations/001_championship_online.sql", "utf8");
const guide = fs.readFileSync("docs/SUPABASE_3MIN_SETUP_ZH_TW.md", "utf8");
const TABLES = ["tamer_profiles", "tamer_cloud_saves", "friendships", "pvp_matches"];

test("the migration creates exactly the four tables, idempotently, and turns RLS on for each", () => {
  for (const table of TABLES) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table} \\(`), table);
    assert.match(sql, new RegExp(`alter table public\\.${table}\\s+enable row level security;`), `${table} RLS`);
  }
  assert.equal((sql.match(/create table if not exists public\./g) ?? []).length, 4);
  assert.doesNotMatch(sql, /drop table/i);
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
