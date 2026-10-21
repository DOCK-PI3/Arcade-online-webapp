import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../server/db.js";
import { createMedals } from "../server/medals.js";
import { generalMedals, championMedal } from "../config/medals.js";
import { medalSvg } from "../server/medal-art.js";

function fixture(fn) {
  const dir = mkdtempSync(resolve(".cache/tests/medals-"));
  let db = openDatabase(dir);
  for (const [id, name] of [
    ["amy", "Amy"],
    ["zed", "Zed"],
    ["other", "Other"],
  ])
    db.prepare(
      "INSERT INTO users(id,username,password,created_at) VALUES(?,?,?,?)",
    ).run(id, name, "fixture-password", Date.now());
  db.prepare("INSERT INTO rooms VALUES(?,?,?,?,?,?,0)").run(
    "room",
    "Medal test",
    "columns",
    "amy",
    "public",
    Date.now(),
  );
  const medals = createMedals(db);
  let serial = 0;
  function score(
    user = "amy",
    value = 100,
    { completed = 1, game = "columns", run, slot = 1, at } = {},
  ) {
    const id = "score-" + ++serial,
      time = at ?? Date.now() + serial;
    run ||= "run-" + serial;
    db.prepare(
      "INSERT OR IGNORE INTO game_runs(id,room_id,game_id,started_at,rules,core_hash) VALUES(?,?,?,?,?,?)",
    ).run(run, "room", game, time, "{}", "fixture");
    db.prepare("INSERT INTO run_players VALUES(?,?,?)").run(run, slot, user);
    db.prepare(
      "INSERT INTO automatic_scores(id,run_id,slot,user_id,game_id,value,created_at,completed) VALUES(?,?,?,?,?,?,?,?)",
    ).run(id, run, slot, user, game, value, time, completed);
    return { id, run };
  }
  try {
    fn({
      db,
      medals,
      score,
      dir,
      reopen() {
        db.close();
        db = openDatabase(dir);
        return db;
      },
    });
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
const medal = (snapshot, id) => snapshot.medals.find((m) => m.id === id);

test("medals define 50 distinct general challenges, required milestones and local vector art", () => {
  assert.equal(generalMedals.length, 50);
  assert.equal(new Set(generalMedals.map((m) => m.id)).size, 50);
  for (const n of [1, 20, 50, 100])
    assert.ok(generalMedals.some((m) => m.id === "scores-" + n));
  for (const id of ["plays-1", "catalog-half", "catalog-all"])
    assert.ok(generalMedals.some((m) => m.id === id));
  for (const m of generalMedals) {
    assert.ok(m.title && m.description);
    assert.match(
      readFileSync(new URL("../public" + m.image, import.meta.url), "utf8"),
      /^<svg/,
    );
  }
  const columns = medalSvg(championMedal({ id: "columns", title: "Columns" }));
  const contra = medalSvg(championMedal({ id: "contra", title: "Contra" }));
  assert.notEqual(columns, contra);
  assert.ok(columns.includes("COLUMNS"));
  assert.ok(
    !medalSvg(
      championMedal({ id: "safe", title: "<script>alert(1)</script>" }),
    ).includes("<script>"),
  );
});

test("connection and credit are not play; automatic scores arm play and finalize submissions exactly once", () =>
  fixture(({ db, medals, score }) => {
    db.prepare("INSERT INTO plays VALUES(?,?,?,?,?)").run(
      "connection",
      "amy",
      "columns",
      "room",
      Date.now(),
    );
    let data = medals.snapshot("amy");
    assert.equal(data.total, 96);
    assert.equal(data.catalogSize, 46);
    assert.equal(medal(data, "plays-1").earnedAt, null);
    const pending = score("amy", 12, { completed: 0 });
    data = medals.snapshot("amy");
    assert.ok(medal(data, "plays-1").earnedAt);
    assert.equal(medal(data, "scores-1").earnedAt, null);
    assert.equal(medal(data, "champion-columns").earnedAt, null);
    db.prepare(
      "UPDATE automatic_scores SET value=100,completed=1 WHERE id=?",
    ).run(pending.id);
    data = medals.snapshot("amy");
    assert.ok(medal(data, "scores-1").earnedAt);
    assert.ok(medal(data, "champion-columns").earnedAt);
    const earned = medal(data, "scores-1").earnedAt,
      rows = db
        .prepare("SELECT COUNT(*) n FROM user_medals WHERE user_id=?")
        .get("amy").n;
    db.prepare("UPDATE automatic_scores SET value=150 WHERE id=?").run(
      pending.id,
    );
    data = medals.snapshot("amy");
    assert.equal(medal(data, "scores-1").earnedAt, earned);
    assert.equal(medal(data, "scores-20").progress, 1);
    assert.equal(
      db
        .prepare("SELECT COUNT(*) n FROM user_medals WHERE user_id=?")
        .get("amy").n,
      rows,
    );
    assert.equal(medal(medals.snapshot("other"), "scores-1").earnedAt, null);
  }));

test("score milestones unlock precisely at 1, 20, 50 and 100 completed results", () =>
  fixture(({ medals, score }) => {
    for (let i = 1; i <= 100; i++) {
      score("amy", i);
      if ([1, 19, 20, 49, 50, 99, 100].includes(i)) {
        const data = medals.snapshot("amy");
        for (const target of [1, 20, 50, 100])
          assert.equal(
            !!medal(data, "scores-" + target).earnedAt,
            i >= target,
            `${i} scores, milestone ${target}`,
          );
      }
    }
  }));

test("initial history backfill preserves current champions before they next open their collection", () =>
  fixture(({ db, medals, score }) => {
    score("zed", 100);
    medals.backfill();
    assert.ok(
      db
        .prepare(
          "SELECT 1 FROM user_medals WHERE user_id='zed' AND medal_id='champion-columns'",
        )
        .get(),
    );
    score("amy", 200);
    medals.backfill();
    assert.ok(medal(medals.snapshot("zed"), "champion-columns").earnedAt);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM user_medals WHERE user_id='zed' AND medal_id='champion-columns'",
        )
        .get().n,
      1,
    );
  }));

test("first-place medals follow public tie ordering, exclude unfinished results and survive being overtaken", () =>
  fixture(({ db, medals, score, reopen }) => {
    score("zed", 100);
    assert.ok(medal(medals.snapshot("zed"), "champion-columns").earnedAt);
    score("amy", 99);
    assert.equal(
      medal(medals.snapshot("amy"), "champion-columns").earnedAt,
      null,
    );
    const tied = score("amy", 100);
    assert.ok(medal(medals.snapshot("amy"), "champion-columns").earnedAt);
    assert.ok(medal(medals.snapshot("zed"), "champion-columns").earnedAt);
    score("other", 999, { completed: 0 });
    assert.equal(
      medal(medals.snapshot("other"), "champion-columns").earnedAt,
      null,
    );
    score("other", 200);
    assert.ok(medal(medals.snapshot("other"), "champion-columns").earnedAt);
    const earned = medal(medals.snapshot("amy"), "champion-columns").earnedAt;
    db.prepare("UPDATE games SET enabled=0 WHERE id=?").run("columns");
    const retired = medal(medals.snapshot("amy"), "champion-columns");
    assert.equal(retired.earnedAt, earned);
    assert.equal(retired.retired, true);
    const next = createMedals(reopen());
    assert.equal(
      medal(next.snapshot("amy"), "champion-columns").earnedAt,
      earned,
    );
  }));

test("catalog challenges use active games and freeze earned goals when the catalog grows", () =>
  fixture(({ db, medals, score }) => {
    db.exec(
      "UPDATE games SET enabled=0; UPDATE games SET enabled=1 WHERE id IN ('columns','contra','mslug')",
    );
    score("amy", 1, { game: "columns" });
    score("amy", 1, { game: "contra" });
    let data = medals.snapshot("amy");
    assert.equal(data.total, 53);
    assert.equal(medal(data, "catalog-half").goal, 2);
    assert.ok(medal(data, "catalog-half").earnedAt);
    assert.equal(medal(data, "catalog-all").earnedAt, null);
    score("amy", 1, { game: "mslug" });
    data = medals.snapshot("amy");
    assert.ok(medal(data, "catalog-all").earnedAt);
    assert.equal(medal(data, "catalog-all").goal, 3);
    db.prepare("UPDATE games SET enabled=1 WHERE id=?").run("mslug2");
    data = medals.snapshot("amy");
    assert.equal(data.total, 54);
    assert.ok(medal(data, "champion-mslug2"));
    assert.equal(medal(data, "catalog-all").goal, 3);
    assert.ok(medal(data, "catalog-all").earnedAt);
    db.exec("UPDATE games SET enabled=0");
    assert.equal(medal(medals.snapshot("other"), "catalog-all").earnedAt, null);
  }));

test("shared runs count different players and preserve each player identity", () =>
  fixture(({ medals, score }) => {
    const first = score("amy", 10);
    score("amy", 20);
    assert.equal(medal(medals.snapshot("amy"), "shared-1").earnedAt, null);
    score("zed", 5, { run: first.run, slot: 2 });
    assert.ok(medal(medals.snapshot("amy"), "shared-1").earnedAt);
    assert.ok(medal(medals.snapshot("zed"), "shared-1").earnedAt);
    assert.equal(medal(medals.snapshot("other"), "shared-1").earnedAt, null);
  }));

test("days use Canary local dates, repeat scores cannot inflate a day and personal records need a previous best", () =>
  fixture(({ medals, score }) => {
    score("amy", 100, { at: Date.parse("2026-07-01T22:30:00Z") });
    assert.equal(medal(medals.snapshot("amy"), "records-1").earnedAt, null);
    score("amy", 90, { at: Date.parse("2026-07-01T22:40:00Z") });
    assert.equal(medal(medals.snapshot("amy"), "records-1").earnedAt, null);
    score("amy", 101, { at: Date.parse("2026-07-01T23:30:00Z") });
    const data = medals.snapshot("amy");
    assert.ok(medal(data, "records-1").earnedAt);
    assert.equal(medal(data, "days-7").progress, 2);
  }));

test("social actions and earned medals survive deletion, retries and a database restart", () =>
  fixture(({ db, medals, reopen }) => {
    db.prepare("INSERT INTO friends VALUES(?,?,?,?)").run(
      "amy",
      "zed",
      "accepted",
      Date.now(),
    );
    db.prepare(
      "INSERT INTO messages(room_id,user_id,body,created_at) VALUES(?,?,?,?)",
    ).run("room", "amy", "Hola", Date.now());
    const initial = medals.snapshot("amy");
    assert.ok(medal(initial, "friends-1").earnedAt);
    assert.ok(medal(initial, "chatRooms-1").earnedAt);
    db.exec("DELETE FROM friends; DELETE FROM messages");
    for (let i = 0; i < 5; i++) medals.record("amy", "chatRooms", "room");
    const next = createMedals(reopen()).snapshot("amy");
    assert.ok(medal(next, "friends-1").earnedAt);
    assert.equal(medal(next, "chatRooms-5").progress, 1);
  }));

test("retiring external achievements clears only obsolete connection data once and preserves medals and history", () =>
  fixture(({ db, medals, score, reopen }) => {
    score();
    medals.snapshot("amy");
    const before = db.prepare("SELECT COUNT(*) n FROM user_medals").get().n;
    db.exec(
      "UPDATE users SET ra_name='old',ra_secret='obsolete-secret',ra_cache='{}',ra_synced=1; DELETE FROM settings WHERE key='medals.local-v1'",
    );
    const next = reopen();
    assert.deepEqual(
      {
        ...next
          .prepare(
            "SELECT ra_name,ra_secret,ra_cache,ra_synced FROM users LIMIT 1",
          )
          .get(),
      },
      { ra_name: null, ra_secret: null, ra_cache: null, ra_synced: null },
    );
    assert.equal(
      next.prepare("SELECT COUNT(*) n FROM automatic_scores").get().n,
      1,
    );
    assert.equal(
      next.prepare("SELECT COUNT(*) n FROM user_medals").get().n,
      before,
    );
    assert.equal(next.prepare("SELECT COUNT(*) n FROM users").get().n, 3);
  }));
