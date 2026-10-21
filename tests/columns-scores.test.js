import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GameRuntime } from "../server/game-runtime.js";
import { readScores, scoreLayouts } from "../server/score-readers.js";

const captures = JSON.parse(
  readFileSync(
    new URL("./fixtures/columns-score-memory.json", import.meta.url),
  ),
);
const layout = scoreLayouts.columns;
// Native RAM captures: selection -> play -> jewel flags (0x07) -> game over
// (0x86). The binary and BCD score fields both contain 89 in the last two.
const transitions = JSON.parse(
  readFileSync(
    new URL("./fixtures/columns-state-transitions.json", import.meta.url),
  ),
);
function memory(capture) {
  const ram = Buffer.alloc(layout.size);
  for (const { offset, hex } of capture.regions)
    ram.set(Buffer.from(hex, "hex"), offset);
  return ram;
}

test("Columns reads both recorded scores and distinguishes selection, play and each game over", () => {
  for (const capture of captures)
    assert.deepEqual(
      readScores({ id: "columns" }, memory(capture)),
      capture.expected,
      capture.name,
    );
  const ram = memory(captures.find((c) => c.name === "p1-4"));
  ram[0xc817] = 0xff;
  assert.deepEqual(
    readScores({ id: "columns" }, ram).map((s) => s.slot),
    [2],
  );
  const mismatch = memory(captures.find((c) => c.name === "p1-4"));
  mismatch[0xc812] ^= 1;
  assert.deepEqual(
    readScores({ id: "columns" }, mismatch).map((s) => s.slot),
    [2],
  );
  assert.deepEqual(readScores({ id: "columns" }, ram.subarray(1)), []);
});

test("Columns keeps gameplay flags active and excludes terminal flags for both slots", () => {
  for (const capture of transitions)
    assert.deepEqual(
      readScores({ id: "columns" }, memory(capture)),
      capture.expected,
      capture.name,
    );
  const states = [
    [0x01, true],
    [0x07, true],
    [0x11, true],
    [0x19, true],
    [0x21, true],
    [0x00, false],
    [0x41, false],
    [0x47, false],
    [0x81, false],
    [0x86, false],
    [0xe0, false],
  ];
  for (const [flags, expected] of states) {
    const ram = memory(transitions[1]);
    ram[0xc829] = flags;
    ram[0xc999] = flags;
    assert.deepEqual(
      readScores({ id: "columns" }, ram).map((s) => s.active),
      [expected, expected],
      "participation flags 0x" + flags.toString(16),
    );
  }
});

test("Columns accepts controls after native jewel transitions and saves only the real game over", async () => {
  const savedWindow = globalThis.window,
    events = [],
    delivered = [];
  const runtime = new GameRuntime({
    root: ".",
    romDir: ".",
    origin: () => "",
    onEvent() {},
    onStop() {},
    readScores,
    onScore: (_entry, player, completed) =>
      events.push({ value: player.peak, completed }),
  });
  runtime.deliver = async (_id, name, payload) =>
    delivered.push({ name, ...payload });
  const player = {
    userId: "mobile",
    slot: 1,
    start: true,
    armed: false,
    seenActive: false,
    peak: 0,
    finished: false,
  };
  const entry = {
    ready: true,
    createdAt: Date.now(),
    lastOccupied: Date.now(),
    memoryRegion: { pointer: 16, size: layout.size },
    players: new Map([[1, player]]),
    page: { evaluate: async (fn, args) => fn(args) },
  };
  runtime.rooms.set("columns", entry);
  try {
    for (const capture of transitions) {
      const heap = new Uint8Array(layout.size + 16);
      heap.set(memory(capture), 16);
      globalThis.window = { EJS_emulator: { Module: { HEAPU8: heap } } };
      await runtime.sample("columns", entry, { id: "columns" });
      if (capture.name === "playing-with-jewel-flags") {
        assert.equal(player.finished, false);
        assert.equal(player.peak, 89);
        assert.equal(
          events.some((e) => e.completed),
          false,
        );
        assert.doesNotThrow(() => runtime.input("columns", "mobile", 1, 8, 1));
        assert.doesNotThrow(() => runtime.input("columns", "mobile", 1, 8, 0));
        assert.equal(
          delivered.some((e) => e.name === "game:release"),
          false,
        );
      }
    }
    await runtime.sample("columns", entry, { id: "columns" });
    assert.deepEqual(
      events.filter((e) => e.completed),
      [{ value: 89, completed: true }],
    );
    assert.deepEqual(delivered, [
      { name: "game:input", slot: 1, index: 8, value: 1 },
      { name: "game:input", slot: 1, index: 8, value: 0 },
      { name: "game:release", slot: 1 },
    ]);
    assert.throws(
      () => runtime.input("columns", "mobile", 1, 8, 1),
      /participación ha terminado/,
    );
  } finally {
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
  }
});

test("Columns sparse sampling accepts its larger RAM and finalizes separate players with a nonzero starting score", async () => {
  const savedWindow = globalThis.window;
  const events = [],
    released = [];
  const runtime = new GameRuntime({
    root: ".",
    romDir: ".",
    origin: () => "",
    onEvent() {},
    onStop() {},
    readScores,
    onScore: (_entry, player, completed) =>
      events.push({ slot: player.slot, value: player.peak, completed }),
  });
  runtime.deliver = async (_rid, name, payload) =>
    released.push({ name, ...payload });
  const entry = {
    ready: true,
    createdAt: Date.now(),
    lastOccupied: Date.now(),
    memoryRegion: { pointer: 16, size: layout.size },
    players: new Map(
      [1, 2].map((slot) => [
        slot,
        {
          userId: "player-" + slot,
          slot,
          start: true,
          armed: false,
          seenActive: false,
          peak: 0,
          finished: false,
        },
      ]),
    ),
    page: { evaluate: async (fn, args) => fn(args) },
  };
  runtime.rooms.set("columns", entry);
  try {
    for (const capture of captures) {
      // Skip intermediate frames: the last points must survive a game-over
      // transition between two polls, independently for each participant.
      if (["p1-4", "p1-5"].includes(capture.name)) continue;
      const heap = new Uint8Array(layout.size + 16);
      heap.set(memory(capture), 16);
      globalThis.window = { EJS_emulator: { Module: { HEAPU8: heap } } };
      await runtime.sample("columns", entry, { id: "columns" });
      if (["attract", "selection"].includes(capture.name))
        assert.equal(events.length, 0);
      if (capture.name === "p1-6") {
        assert.equal(entry.players.get(1).finished, true);
        assert.equal(entry.players.get(2).finished, false);
      }
    }
    assert.deepEqual(
      events.filter((e) => e.completed),
      [
        { slot: 1, value: 20390, completed: true },
        { slot: 2, value: 20000, completed: true },
      ],
    );
    assert.deepEqual(released, [
      { name: "game:release", slot: 1 },
      { name: "game:release", slot: 2 },
    ]);
    assert.equal(
      layout.ranges.reduce((n, [, length]) => n + length, 0),
      20,
    );
  } finally {
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
  }
});
