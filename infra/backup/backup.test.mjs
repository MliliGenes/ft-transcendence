import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "nook-backup-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const log = join(dir, "docker.log");
  // Mimic a database container with non-default names; execute the command
  // inside that environment so quoting and runtime-variable expansion are tested.
  writeFileSync(join(bin, "docker"), `#!/usr/bin/env python3
import sys, os, subprocess, json
args=sys.argv[1:]
with open(os.environ["DOCKER_TEST_LOG"], "a") as out: out.write(json.dumps(args)+"\\n")
if args[0] != "compose": sys.exit(3)
i=args.index("exec"); service=args[i+2]; command=args[i+3:]
if service == "minio":
    sys.stdin.buffer.read() if "xzf" in command else sys.stdout.write("test-attachment-archive")
    sys.exit(0)
env={**os.environ, "POSTGRES_USER": "custom_"+service, "POSTGRES_DB": "renamed_"+service}
sys.exit(subprocess.run(command,env=env).returncode)
`, { mode: 0o755 });
  writeFileSync(join(bin, "pg_dump"), '#!/bin/sh\nprintf "%s\\n" "$*"\n', { mode: 0o755 });
  writeFileSync(join(bin, "psql"), '#!/bin/sh\ncat >/dev/null\nprintf "0\\n"\n', { mode: 0o755 });
  return { dir, log, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BACKUP_ROOT: join(dir, "snapshots"), DOCKER_TEST_LOG: log } };
}

function run(script, env, args = []) {
  return spawnSync("bash", [join(root, "infra/backup", script), ...args], { env, encoding: "utf8", timeout: 10000 });
}

test("complete snapshot uses running database names and covers all three databases plus MinIO", (t) => {
  const { dir, log, env } = fixture(t);
  const backup = run("backup.sh", env);
  assert.equal(backup.status, 0, backup.stdout + backup.stderr);
  const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(calls.map((a) => a[a.indexOf("exec") + 2]), ["user-db", "chat-db", "game-db", "minio"]);
  const match = backup.stdout.match(/Target directory: (.+)/);
  assert.ok(match);
  const snapshot = match[1];
  for (const service of ["user-db", "chat-db", "game-db"]) {
    const sql = gunzipSync(readFileSync(join(snapshot, `${service}.sql.gz`))).toString();
    assert.ok(sql.includes(`custom_${service}`));
    assert.ok(sql.includes(`renamed_${service}`));
  }
  assert.ok(existsSync(join(snapshot, "minio-attachments.tar.gz")));
  assert.ok(existsSync(join(snapshot, "SHA256SUMS")));
  const restore = run("restore.sh", { ...env, ALLOW_LIVE_RESTORE: "1" }, [snapshot]);
  assert.equal(restore.status, 0, restore.stdout + restore.stderr);
  const all = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  const restores = all.filter((a) => a.join(" ").includes("exec psql"));
  assert.equal(restores.length, 3);
  assert.ok(restores.every((a) => a.join(" ").includes("ON_ERROR_STOP=1")));
});

test("live restore refuses to touch Docker without an explicit maintenance opt-in", (t) => {
  const { dir, log, env } = fixture(t);
  const result = run("restore.sh", env, [dir]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /ALLOW_LIVE_RESTORE/);
  assert.equal(existsSync(log), false);
});

test("snapshot rejects zero retention before Docker or pruning can run", (t) => {
  const { log, env } = fixture(t);
  const result = run("backup.sh", { ...env, RETENTION_COUNT: "0" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /RETENTION_COUNT/);
  assert.equal(existsSync(log), false);
});

test("retention preserves spaced roots and unrelated sibling directories", (t) => {
  const { dir, env } = fixture(t);
  const root = join(dir, "snapshots with space");
  const old = join(root, "nook_backup_20000101_000000Z");
  const sibling = join(dir, "snapshots");
  mkdirSync(old, { recursive: true });
  mkdirSync(sibling);
  writeFileSync(join(sibling, "sentinel"), "keep");
  const result = run("backup.sh", { ...env, BACKUP_ROOT: root, RETENTION_COUNT: "1" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(sibling, "sentinel"), "utf8"), "keep");
  assert.equal(existsSync(old), false);
  const current = result.stdout.match(/Target directory: (.+)/)[1];
  assert.ok(existsSync(join(current, "SHA256SUMS")));
});
