import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL migracija: RLS, privatni bucket i atomsko čuvanje bez izgubljenih izmena", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
    );
    await pg.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610210001_school.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await pg.query<{ public: boolean }>(
          "select public from storage.buckets",
        )
      ).rows[0].public,
      false,
    );
    await pg.exec("set role authenticated");
    await assert.rejects(pg.query("select * from public.school_state"));
    await assert.rejects(pg.query("select public.save_school_state(0,'{}')"));
    await pg.exec("reset role;set role service_role");
    const results = await Promise.all([
      pg.query<{ saved: boolean }>(
        "select public.save_school_state(0,'{\"reservation\":1}') as saved",
      ),
      pg.query<{ saved: boolean }>(
        "select public.save_school_state(0,'{\"reservation\":2}') as saved",
      ),
    ]);
    assert.deepEqual(results.map((r) => r.rows[0].saved).sort(), [false, true]);
    assert.equal(
      (
        await pg.query<{ revision: number }>(
          "select revision::int from school_state",
        )
      ).rows[0].revision,
      1,
    );
  } finally {
    await pg.close();
  }
});
