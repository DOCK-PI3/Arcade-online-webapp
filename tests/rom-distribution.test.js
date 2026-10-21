import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  mkdir,
  mkdtemp,
  rm,
  readdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { romRequirements } from "../scripts/rom-requirements.mjs";

test("published ROM metadata covers all 46 active readers and both BIOS without local paths", async () => {
  const expected = romRequirements(),
    json = JSON.parse(await readFile("config/rom-requirements.json", "utf8"));
  assert.deepEqual(json, expected);
  assert.equal(json.games.length, 46);
  assert.equal(json.bios.length, 2);
  const all = [...json.games, ...json.bios];
  assert.equal(new Set(all.map((g) => g.archive)).size, 48);
  assert.ok(all.every((g) => /^[a-f0-9]{64}$/.test(g.sha256)));
  assert.ok(!JSON.stringify(json).includes("mabe8"));
  assert.ok(!all.some((g) => g.archive === "tetris.zip"));
  for (const game of json.games.filter((g) => g.bios))
    assert.ok(
      json.bios.some(
        (b) => b.archive === game.bios && b.requiredBy.includes(game.id),
      ),
    );
});

test("ROM checker distinguishes missing and incompatible files and never writes into the directory", async () => {
  await mkdir(".cache/tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/tests/rom-check-"));
  try {
    function check() {
      const r = spawnSync(
        process.execPath,
        ["scripts/check-roms.mjs", dir, "--json"],
        { encoding: "utf8" },
      );
      assert.equal(r.status, 1, r.stderr);
      return JSON.parse(r.stdout);
    }
    const empty = check();
    assert.equal(empty.required, 48);
    assert.ok(empty.results.every((r) => r.status === "missing"));
    assert.deepEqual(await readdir(dir), []);
    await writeFile(
      join(dir, "columns.zip"),
      "incompatible fixture, not a ROM",
    );
    const invalid = check();
    assert.equal(
      invalid.results.find((r) => r.archive === "columns.zip").status,
      "incompatible",
    );
    assert.deepEqual(await readdir(dir), ["columns.zip"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the direct importer refuses to replace an installed BIOS with an unapproved ZIP", async () => {
  await mkdir(".cache/tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/tests/bios-import-"));
  try {
    const source = join(dir, "source"),
      data = join(dir, "data"),
      roms = join(data, "roms");
    await mkdir(source);
    await mkdir(roms, { recursive: true });
    await writeFile(join(roms, "neogeo.zip"), "previous BIOS fixture");
    await writeFile(
      join(source, "neogeo.zip"),
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from("unapproved fixture"),
      ]),
    );
    const result = spawnSync(
      process.execPath,
      ["scripts/import-roms.mjs", source],
      { encoding: "utf8", env: { ...process.env, DATA_DIR: data } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /neogeo.zip: no se sustituye/);
    assert.equal(
      await readFile(join(roms, "neogeo.zip"), "utf8"),
      "previous BIOS fixture",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const hasGit =
  spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
test(
  "Git ignores ROMs, data, credentials, downloaded dependencies and builds but keeps source metadata",
  { skip: !hasGit },
  async () => {
    await mkdir(".cache/tests", { recursive: true });
    const dir = await mkdtemp(resolve(".cache/tests/git-exclusions-"));
    try {
      await copyFile(".gitignore", join(dir, ".gitignore"));
      const init = spawnSync("git", ["init", "-q", dir], { encoding: "utf8" });
      assert.equal(init.status, 0, init.stderr);
      const ignored = [
        "roms/columns.zip",
        "elsewhere/NEOGEO.ZIP",
        "extra/roms.7z",
        "extra/game.chd",
        "data/arcade.sqlite",
        "data/setup-code",
        "node_modules/module/index.js",
        "dist/index.html",
        ".cache/test.js",
        "output/proof.json",
        "public/emulator/loader.js",
        ".env",
        ".env.production",
        "backup/arcade.sqlite-wal",
        "backup/game.state",
        "backup/game.ram",
        "tls/server.key",
        "tls/root.crt",
        "setup-code",
        "encryption-key",
      ];
      const included = [
        ".env.example",
        "src/main.jsx",
        "server/index.js",
        "config/catalog-romsets.json",
        "config/rom-requirements.json",
        "docs/ROMS_COMPATIBLES.csv",
        "public/medals/champion-orunners.svg",
        "package-lock.json",
        "scripts/check-roms.mjs",
      ];
      const result = spawnSync(
        "git",
        [
          "-C",
          dir,
          "-c",
          "core.ignorecase=false",
          "check-ignore",
          "--no-index",
          "--stdin",
        ],
        {
          input: [...ignored, ...included].join("\n") + "\n",
          encoding: "utf8",
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(
        new Set(result.stdout.trim().split(/\r?\n/)),
        new Set(ignored),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
