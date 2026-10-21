import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { catalogAdditions } from "./catalog.js";

export function openDatabase(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "arcade.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at INTEGER NOT NULL, controls TEXT NOT NULL DEFAULT '{}', ra_name TEXT, ra_secret TEXT, ra_cache TEXT, ra_synced INTEGER);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,answer TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY,title TEXT NOT NULL,year INTEGER NOT NULL,maker TEXT NOT NULL,genre TEXT NOT NULL,max_players INTEGER NOT NULL CHECK(max_players BETWEEN 1 AND 4),rom TEXT NOT NULL,bios TEXT,ra_id INTEGER,enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,rules TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS friends(sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,PRIMARY KEY(sender,recipient),CHECK(sender<>recipient));
    CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,game_id TEXT NOT NULL REFERENCES games(id),owner_id TEXT NOT NULL REFERENCES users(id),visibility TEXT NOT NULL CHECK(visibility IN ('public','friends','invite')),created_at INTEGER NOT NULL,closed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS members(room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),slot INTEGER CHECK(slot BETWEEN 1 AND 4),joined_at INTEGER NOT NULL,PRIMARY KEY(room_id,user_id));
    CREATE UNIQUE INDEX IF NOT EXISTS unique_slot ON members(room_id,slot) WHERE slot IS NOT NULL;
    CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),creator TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,used_by TEXT REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),room_id TEXT REFERENCES rooms(id),game_id TEXT REFERENCES games(id),created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL REFERENCES rooms(id),user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,image_id TEXT REFERENCES uploads(id),created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS plays(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL REFERENCES games(id),room_id TEXT NOT NULL REFERENCES rooms(id),created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS scores(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL REFERENCES games(id),value INTEGER NOT NULL CHECK(value>=0),image_id TEXT NOT NULL REFERENCES uploads(id),note TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at INTEGER NOT NULL,reviewer TEXT REFERENCES users(id));
    CREATE INDEX IF NOT EXISTS message_room ON messages(room_id,id);
    CREATE INDEX IF NOT EXISTS play_date ON plays(created_at);
    CREATE INDEX IF NOT EXISTS score_game ON scores(game_id,status,value);
    CREATE TABLE IF NOT EXISTS game_runs(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id),game_id TEXT NOT NULL REFERENCES games(id),started_at INTEGER NOT NULL,ended_at INTEGER,rules TEXT NOT NULL,core_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS run_players(run_id TEXT NOT NULL REFERENCES game_runs(id),slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 4),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(run_id,slot),UNIQUE(run_id,user_id));
    CREATE TABLE IF NOT EXISTS automatic_scores(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,slot INTEGER NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL REFERENCES games(id),value INTEGER NOT NULL CHECK(value>=0),initials TEXT,created_at INTEGER NOT NULL,completed INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(run_id,slot) REFERENCES run_players(run_id,slot),UNIQUE(run_id,slot));
    CREATE INDEX IF NOT EXISTS automatic_score_game ON automatic_scores(game_id,value);
    CREATE INDEX IF NOT EXISTS automatic_score_user ON automatic_scores(user_id,created_at);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS medal_events(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,event_key TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,kind,event_key));
    CREATE TABLE IF NOT EXISTS user_medals(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,medal_id TEXT NOT NULL,earned_at INTEGER NOT NULL,goal INTEGER NOT NULL,progress INTEGER NOT NULL,PRIMARY KEY(user_id,medal_id));
    INSERT OR IGNORE INTO settings VALUES('registration','open');
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT NOT NULL,target TEXT,created_at INTEGER NOT NULL);
  `);
  if (
    !db
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((c) => c.name === "suspended")
  )
    db.exec(
      "ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0",
    );
  if (
    !db
      .prepare("PRAGMA table_info(uploads)")
      .all()
      .some((c) => c.name === "bytes")
  )
    db.exec("ALTER TABLE uploads ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0");
  if (
    !db
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((c) => c.name === "theme")
  )
    db.exec(
      "ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light','dark','system'))",
    );
  if (
    !db
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((c) => c.name === "gamepad_controls")
  )
    db.exec(
      "ALTER TABLE users ADD COLUMN gamepad_controls TEXT NOT NULL DEFAULT '{}'",
    );
  const games = [
    ["columns", "Columns", 1990, "Sega", "Puzle", 2, "columns.zip", null],
    ["contra", "Contra", 1987, "Konami", "Acción", 2, "contra.zip", null],
    [
      "mslug",
      "Metal Slug",
      1996,
      "Nazca",
      "Acción",
      2,
      "mslug.zip",
      "neogeo.zip",
    ],
    [
      "mslug2",
      "Metal Slug 2",
      1998,
      "SNK",
      "Acción",
      2,
      "mslug2.zip",
      "neogeo.zip",
    ],
    [
      "1941",
      "1941: Counter Attack",
      1990,
      "Capcom",
      "Disparos",
      2,
      "1941.zip",
      null,
    ],
  ];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO games(id,title,year,maker,genre,max_players,rom,bios,created_at,rules) VALUES(?,?,?,?,?,?,?,?,?,?)",
  );
  for (const g of games)
    insert.run(
      ...g,
      Date.now(),
      "Motor del servidor. Un crédito y un inicio por jugador, sin continuaciones, trucos ni estados guardados.",
    );
  const add = db.prepare(
    "INSERT OR IGNORE INTO games(id,title,year,maker,genre,max_players,rom,bios,enabled,created_at,rules) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
  );
  for (const g of catalogAdditions)
    add.run(
      g.id,
      g.title,
      g.year,
      g.maker,
      g.genre,
      g.max_players,
      g.rom,
      g.bios,
      g.enabled ? 1 : 0,
      Date.now(),
      g.rules ||
        "Motor del servidor. Un crédito por jugador, sin continuaciones, trucos ni estados guardados.",
    );
  // Promote the three previously staged games once. Later administrator choices
  // survive restarts, just as they do for the rest of the catalog.
  if (
    !db
      .prepare("SELECT 1 FROM settings WHERE key='catalog.mame-final-v1'")
      .get()
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const promote = db.prepare("UPDATE games SET enabled=1 WHERE id=?");
      for (const id of ["88games", "shinobi", "salmndr2"]) promote.run(id);
      db.prepare("UPDATE games SET enabled=0 WHERE id='twcup98'").run();
      db.prepare(
        "UPDATE rooms SET closed=1 WHERE game_id='twcup98' AND closed=0",
      ).run();
      db.prepare(
        "INSERT INTO settings(key,value) VALUES('catalog.mame-final-v1','done')",
      ).run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  // Activate the approved FBNeo expansion once, including databases where these
  // rows were staged as hidden. Subsequent administrator choices survive restarts.
  if (
    !db
      .prepare("SELECT 1 FROM settings WHERE key='catalog.fbneo-expansion-v1'")
      .get()
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const ids = new Set([
        "3wonders",
        "avsp",
        "cclimber",
        "cclimbr2",
        "demonwld",
        "frogger",
        "gijoe",
        "gradius",
        "joemac",
        "kickoff",
        "kof98",
        "maglord",
        "mercs",
        "mwalk",
        "narc",
        "orunners",
      ]);
      const promote = db.prepare(
        "UPDATE games SET enabled=1,rules=? WHERE id=?",
      );
      for (const game of catalogAdditions.filter((g) => ids.has(g.id)))
        promote.run(
          game.rules ||
            "Motor del servidor. Un crédito por jugador, sin continuaciones, trucos ni estados guardados.",
          game.id,
        );
      db.prepare(
        "INSERT INTO settings(key,value) VALUES('catalog.fbneo-expansion-v1','done')",
      ).run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  // Retire the previous puzzle once, preserving its scores and participation history.
  // Later catalog edits by the administrator must survive subsequent restarts.
  if (
    !db.prepare("SELECT 1 FROM settings WHERE key='catalog.columns-v1'").get()
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE games SET enabled=0 WHERE id='tetris'").run();
      db.prepare(
        "UPDATE rooms SET closed=1 WHERE game_id='tetris' AND closed=0",
      ).run();
      db.prepare(
        "INSERT INTO settings(key,value) VALUES('catalog.columns-v1','done')",
      ).run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  db.prepare("UPDATE games SET rules=? WHERE rules=?").run(
    "Motor del servidor. Un crédito y un inicio por jugador, sin continuaciones, trucos ni estados guardados.",
    "Configuración original. Sin trucos ni estados guardados. Indica créditos y dificultad al enviar la captura.",
  );
  if (!db.prepare("SELECT 1 FROM settings WHERE key='medals.local-v1'").get()) {
    db.exec("BEGIN IMMEDIATE");
    try {
      // Keep the legacy columns for compatibility with old databases/backups,
      // but retire stored integration credentials and cached external data.
      db.exec(
        "UPDATE users SET ra_name=NULL,ra_secret=NULL,ra_cache=NULL,ra_synced=NULL; UPDATE games SET ra_id=NULL; INSERT INTO settings VALUES('medals.local-v1','1')",
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return db;
}
