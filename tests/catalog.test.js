import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { openDatabase } from "../server/db.js";
import { catalogAdditions } from "../server/catalog.js";
import { scoreLayouts } from "../server/score-readers.js";
import { existsSync, readFileSync } from "node:fs";

test("every enabled catalog addition has native multiplayer seats, an approved score reader and real captures", () => {
  const captures = JSON.parse(
    readFileSync(
      new URL("./fixtures/catalog-score-memory.json", import.meta.url),
    ),
  );
  for (const game of catalogAdditions.filter((g) => g.enabled)) {
    assert.ok(game.max_players >= 2 && game.max_players <= 4, game.id);
    assert.ok(scoreLayouts[game.id], game.id);
    assert.equal(
      scoreLayouts[game.id].readers.length,
      game.max_players,
      game.id,
    );
    assert.ok(
      captures.some(
        (c) => c.game === game.id && c.expected.some((s) => s.value > 0),
      ),
      game.id,
    );
    assert.ok(
      existsSync(new URL(`../public/games/${game.id}.png`, import.meta.url)),
      game.id,
    );
  }
  assert.ok(
    !catalogAdditions.some((g) =>
      ["frogwld", "spaceinv", "supgoal", "twcup98"].includes(g.id),
    ),
  );
});

test("FBNeo expansion activates staged games once and preserves history and later admin choices", async () => {
  await mkdir(resolve(".cache/tests"), { recursive: true });
  const directory = await mkdtemp(resolve(".cache/tests/catalog-fbneo-"));
  let db;
  try {
    db = openDatabase(directory);
    db.exec(`DELETE FROM settings WHERE key='catalog.fbneo-expansion-v1';
      UPDATE games SET enabled=0 WHERE id IN ('avsp','gijoe','orunners','columns');
      INSERT INTO users(id,username,password,created_at) VALUES('expansion-owner','ExpansionOwner','fixture',1);
      INSERT INTO rooms VALUES('expansion-room','Existing room','avsp','expansion-owner','public',1,0);
      INSERT INTO plays VALUES('expansion-play','expansion-owner','avsp','expansion-room',1);`);
    db.close();
    db = openDatabase(directory);
    for (const id of ["avsp", "gijoe", "orunners"])
      assert.equal(
        db.prepare("SELECT enabled FROM games WHERE id=?").get(id).enabled,
        1,
        id,
      );
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='columns'").get().enabled,
      0,
    );
    assert.equal(
      db.prepare("SELECT max_players FROM games WHERE id='gijoe'").get()
        .max_players,
      4,
    );
    assert.match(
      db.prepare("SELECT rules FROM games WHERE id='orunners'").get().rules,
      /recorrido/,
    );
    assert.equal(
      db.prepare("SELECT closed FROM rooms WHERE id='expansion-room'").get()
        .closed,
      0,
    );
    assert.equal(
      db.prepare("SELECT game_id FROM plays WHERE id='expansion-play'").get()
        .game_id,
      "avsp",
    );
    db.exec(
      "UPDATE games SET enabled=0,rules='Administrator rule' WHERE id='orunners'",
    );
    db.close();
    db = openDatabase(directory);
    assert.deepEqual(
      {
        ...db
          .prepare("SELECT enabled,rules FROM games WHERE id='orunners'")
          .get(),
      },
      { enabled: 0, rules: "Administrator rule" },
    );
  } finally {
    db?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("final MAME migration enables staged games once, retires Tecmo and preserves history and later choices", async () => {
  await mkdir(resolve(".cache/tests"), { recursive: true });
  const directory = await mkdtemp(resolve(".cache/tests/catalog-final-"));
  let db;
  try {
    db = openDatabase(directory);
    db.exec(`
      DELETE FROM settings WHERE key='catalog.mame-final-v1';
      UPDATE games SET enabled=0 WHERE id IN ('88games','shinobi','salmndr2','columns');
      INSERT INTO games SELECT 'twcup98','Tecmo World Cup 98',year,maker,genre,max_players,rom,bios,ra_id,1,created_at,rules FROM games WHERE id='88games';
      INSERT INTO users(id,username,password,created_at) VALUES('staged-owner','StagedOwner','fixture',1);
      INSERT INTO rooms VALUES('old-room','Old room','88games','staged-owner','public',1,0);
      INSERT INTO rooms VALUES('tecmo-room','Tecmo room','twcup98','staged-owner','public',1,0);
      INSERT INTO plays VALUES('old-play','staged-owner','88games','old-room',1);
    `);
    db.close();
    db = openDatabase(directory);
    for (const id of ["88games", "shinobi", "salmndr2"])
      assert.equal(
        db.prepare("SELECT enabled FROM games WHERE id=?").get(id).enabled,
        1,
        id,
      );
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='columns'").get().enabled,
      0,
    );
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='twcup98'").get().enabled,
      0,
    );
    assert.equal(
      db.prepare("SELECT closed FROM rooms WHERE id='tecmo-room'").get().closed,
      1,
    );
    assert.equal(
      db.prepare("SELECT closed FROM rooms WHERE id='old-room'").get().closed,
      0,
    );
    assert.equal(
      db.prepare("SELECT game_id FROM plays WHERE id='old-play'").get().game_id,
      "88games",
    );
    db.exec("UPDATE games SET enabled=0 WHERE id='shinobi'");
    db.close();
    db = openDatabase(directory);
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='shinobi'").get().enabled,
      0,
    );
  } finally {
    db?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Columns replaces legacy Tetris once while preserving history and later admin choices", async () => {
  await mkdir(resolve(".cache/tests"), { recursive: true });
  const directory = await mkdtemp(resolve(".cache/tests/catalog-"));
  let db;
  try {
    db = openDatabase(directory);
    const columns = db.prepare("SELECT * FROM games WHERE id='columns'").get();
    assert.equal(columns.max_players, 2);
    assert.equal(columns.rom, "columns.zip");
    assert.equal(columns.maker, "Sega");
    assert.equal(columns.enabled, 1);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM games WHERE enabled=1").get().n,
      5 + catalogAdditions.filter((g) => g.enabled).length,
    );
    db.exec(`
      DELETE FROM settings WHERE key='catalog.columns-v1';
      INSERT INTO games SELECT 'tetris','Tetris',1988,'Sega','Puzle',2,'tetris.zip',NULL,NULL,1,1,'Legacy rules' FROM games WHERE id='columns';
      INSERT INTO users(id,username,password,created_at) VALUES('owner','Owner','fixture',1);
      INSERT INTO rooms VALUES('legacy-room','Legacy room','tetris','owner','public',1,0);
      INSERT INTO rooms VALUES('columns-room','Columns room','columns','owner','public',1,0);
      INSERT INTO plays VALUES('legacy-play','owner','tetris','legacy-room',1);
    `);
    db.close();
    db = openDatabase(directory);
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='tetris'").get().enabled,
      0,
    );
    assert.equal(
      db.prepare("SELECT closed FROM rooms WHERE id='legacy-room'").get()
        .closed,
      1,
    );
    assert.equal(
      db.prepare("SELECT closed FROM rooms WHERE id='columns-room'").get()
        .closed,
      0,
    );
    assert.equal(
      db.prepare("SELECT game_id FROM plays WHERE id='legacy-play'").get()
        .game_id,
      "tetris",
    );
    assert.equal(
      db.prepare("SELECT username FROM users WHERE id='owner'").get().username,
      "Owner",
    );
    db.exec(
      "UPDATE games SET enabled=0 WHERE id='columns'; UPDATE games SET enabled=1 WHERE id='tetris'",
    );
    db.close();
    db = openDatabase(directory);
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='columns'").get().enabled,
      0,
    );
    assert.equal(
      db.prepare("SELECT enabled FROM games WHERE id='tetris'").get().enabled,
      1,
    );
  } finally {
    db?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
