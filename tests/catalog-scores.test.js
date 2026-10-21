import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readScores, scoreLayouts } from "../server/score-readers.js";
import { GameRuntime } from "../server/game-runtime.js";

const captures = JSON.parse(
  readFileSync(
    new URL("./fixtures/catalog-score-memory.json", import.meta.url),
  ),
);
function memory(capture) {
  const ram = Buffer.alloc(scoreLayouts[capture.game].size);
  for (const { offset, hex } of capture.regions)
    ram.set(Buffer.from(hex, "hex"), offset);
  return ram;
}

async function replayNative(id, stages, inspect) {
  const previous = globalThis.window,
    completed = [];
  const runtime = new GameRuntime({
    root: ".",
    romDir: ".",
    origin: () => "",
    onEvent() {},
    onStop() {},
    readScores,
    onScore: (_entry, player, done) => {
      if (done) completed.push({ slot: player.slot, value: player.peak });
    },
  });
  runtime.deliver = async () => {};
  const layout = scoreLayouts[id],
    entry = {
      ready: true,
      createdAt: Date.now(),
      lastOccupied: Date.now(),
      memoryRegion: { pointer: 0, size: layout.size },
      players: new Map(
        layout.readers.map((_, index) => [
          index + 1,
          {
            slot: index + 1,
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
  runtime.rooms.set(id, entry);
  try {
    for (const stage of stages) {
      const capture = captures.find(
        (c) =>
          c.game === id &&
          c.source === `FBNeo native RAM capture ${id}-${stage}`,
      );
      assert.ok(capture, `${id} ${stage}`);
      globalThis.window = {
        EJS_emulator: { Module: { HEAPU8: memory(capture) } },
      };
      await runtime.sample(id, entry, { id });
      inspect(stage, entry, completed);
    }
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test("OutRunners separates both road counters, excludes car selection and cannot score its later demo", async () => {
  await replayNative(
    "orunners",
    [
      "attract",
      "start",
      "drivepoints",
      "brakeconfirmed",
      "drivebot-70",
      "drivebot-105",
      "drivebot-210",
    ],
    (stage, entry, done) => {
      if (["attract", "start"].includes(stage))
        assert.ok([...entry.players.values()].every((p) => !p.armed));
      if (stage === "brakeconfirmed")
        assert.deepEqual(
          [...entry.players.values()].map((p) => p.peak),
          [450, 379],
        );
      if (["drivebot-105", "drivebot-210"].includes(stage))
        assert.deepEqual(done, [
          { slot: 1, value: 1908 },
          { slot: 2, value: 1906 },
        ]);
    },
  );
});

test("OutRunners records a solo race on either cabinet without arming the unoccupied screen", async () => {
  for (const [prefix, slot, first, second] of [
    ["solo", 1, 276, 1262],
    ["solo2", 2, 264, 1252],
  ]) {
    await replayNative(
      "orunners",
      [`${prefix}-selection`, `${prefix}-driving`, `${prefix}-stage2`],
      (stage, entry, done) => {
        const player = entry.players.get(slot),
          unused = entry.players.get(3 - slot);
        assert.equal(
          unused.armed,
          false,
          "the other cabinet has no human race",
        );
        assert.equal(unused.peak, 0);
        assert.equal(
          done.length,
          0,
          "entering stage 1 must not finish the race",
        );
        if (stage.endsWith("selection")) assert.equal(player.armed, false);
        else {
          assert.equal(player.seenActive, true);
          assert.equal(player.finished, false);
          assert.equal(player.peak, stage.endsWith("driving") ? first : second);
        }
      },
    );
  }
});

test("KOF98 retains each native peak across round resets and only releases the defeated team", async () => {
  await replayNative(
    "kof98",
    ["fightzero", "fight0", "fight1", "fight2"],
    (stage, entry, done) => {
      if (stage === "fight1") {
        assert.equal(entry.players.get(1).peak, 7200);
        assert.equal(done.length, 0);
      }
      if (stage === "fight2") {
        assert.equal(entry.players.get(1).finished, false);
        assert.deepEqual(done, [{ slot: 2, value: 900 }]);
      }
    },
  );
});

test("GI Joe observes all four independent human ports and finalizes four scores once", async () => {
  await replayNative(
    "gijoe",
    ["v3-attract", "v3-start", "v3-score", "v3-end", "v3-attract"],
    (stage, entry, done) => {
      if (stage === "v3-score") {
        assert.deepEqual(
          [...entry.players.values()].map((p) => p.peak),
          [3, 9, 7, 8],
        );
        assert.equal(done.length, 0);
      }
      if (stage === "v3-end")
        assert.deepEqual(done, [
          { slot: 1, value: 3 },
          { slot: 2, value: 9 },
          { slot: 3, value: 7 },
          { slot: 4, value: 8 },
        ]);
    },
  );
});

test("Frogger's last frog and Crazy Climber's parked score survive changes of turn", async () => {
  await replayNative(
    "frogger",
    ["start", "v2-score", "v2-end"],
    (stage, entry, done) => {
      if (stage === "v2-end") {
        assert.deepEqual(done, [{ slot: 1, value: 20 }]);
        assert.equal(entry.players.get(2).finished, false);
        assert.equal(entry.players.get(2).peak, 10);
      }
    },
  );
  await replayNative(
    "cclimber",
    ["climbstart", "climbpoints"],
    (stage, entry, done) => {
      if (stage === "climbpoints") {
        assert.equal(done.length, 0);
        assert.deepEqual(
          [...entry.players.values()].map((p) => p.peak),
          [1600, 0],
        );
      }
    },
  );
});

test("Kick Off never attributes the computer's goal to a human second seat", async () => {
  await replayNative("kickoff", ["start", "end"], (stage, entry) => {
    if (stage === "end") {
      assert.equal(entry.players.get(2).armed, false);
      assert.equal(entry.players.get(2).peak, 0);
    }
  });
  await replayNative(
    "kickoff",
    ["v3-start", "football-goal", "soccer-bot"],
    (stage, entry, done) => {
      if (stage === "soccer-bot")
        assert.deepEqual(done, [
          { slot: 1, value: 0 },
          { slot: 2, value: 1 },
        ]);
    },
  );
});

test("1944 samples only the approved sparse regions from the private core state", async () => {
  const previous = globalThis.window;
  const events = [];
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
  runtime.deliver = async () => {};
  const entry = {
    ready: true,
    createdAt: Date.now(),
    lastOccupied: Date.now(),
    players: new Map(
      [1, 2].map((slot) => [
        slot,
        {
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
  runtime.rooms.set("state", entry);
  try {
    for (const capture of captures.filter((c) => c.game === "1944")) {
      globalThis.window = {
        EJS_emulator: { gameManager: { getState: () => memory(capture) } },
      };
      await runtime.sample("state", entry, { id: "1944" });
    }
    assert.deepEqual(
      events.filter((e) => e.completed),
      [
        { slot: 2, value: 10280, completed: true },
        { slot: 1, value: 29520, completed: true },
      ],
    );
    globalThis.window = {
      EJS_emulator: { gameManager: { getState: () => new Uint8Array(1) } },
    };
    await assert.rejects(
      runtime.sample("state", entry, { id: "1944" }),
      /Estado del motor no válido/,
    );
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
for (const id of new Set(captures.map((c) => c.game))) {
  test(`${id}: recorded arcade scores, independent players and participation states`, () => {
    for (const capture of captures.filter((c) => c.game === id)) {
      assert.deepEqual(
        readScores({ id }, memory(capture)),
        capture.expected,
        capture.stage,
      );
    }
    const capture = captures.find(
      (c) =>
        c.game === id && (c.stage === "score" || c.stage.endsWith("-score")),
    );
    const layout = scoreLayouts[id];
    assert.deepEqual(readScores({ id }, memory(capture).subarray(1)), []);
    assert.match(layout.sha256, /^[a-f0-9]{64}$/);
    assert.ok(layout.ranges.reduce((n, [, count]) => n + count, 0) < 100);
    // Corrupt one player's BCD/digit data: it must never affect the other seat.
    function fields(score) {
      if (score.sum) return score.sum.flatMap(fields);
      if (score.select)
        return [...fields(score.select.then), ...fields(score.select.else)];
      return [score];
    }
    for (const field of fields(layout.readers[0].score)) {
      if (!["bcd", "digits"].includes(field.type)) continue;
      const ram = memory(capture);
      ram[field.offset ^ (field.swap || 0)] = 0xff;
      const actual = readScores({ id }, ram);
      // Turn-based games swap the current and parked banks. Check whichever
      // participant owns this bank in the genuine capture, including 3/4P.
      const removed = capture.expected.filter(
        (player) => !actual.some((s) => s.slot === player.slot),
      );
      assert.equal(removed.length, 1);
      assert.deepEqual(
        actual,
        capture.expected.filter((s) => s.slot !== removed[0].slot),
      );
    }
  });
}

test("Shinobi's swapped score banks isolate corruption on either player's turn", () => {
  for (const [stage, offsets] of [
    ["score", [0x1741, 0x17a1]],
    ["calibration-both-scores", [0x17a1, 0x1741]],
  ]) {
    const capture = captures.find(
      (c) => c.game === "shinobi" && c.stage === stage,
    );
    for (const [index, offset] of offsets.entries()) {
      const ram = memory(capture);
      ram[offset] = 0xff;
      assert.deepEqual(
        readScores({ id: "shinobi" }, ram),
        [capture.expected[1 - index]],
        stage,
      );
    }
  }
});

test("last lives and separate game overs preserve each participant's own peak", async () => {
  const previous = globalThis.window;
  try {
    for (const [id, completed] of [
      [
        "darius",
        [
          { slot: 1, value: 23500 },
          { slot: 2, value: 1520 },
        ],
      ],
      ["tmnt2po", [{ slot: 1, value: 3 }]],
      [
        "twinbee",
        [
          { slot: 1, value: 650 },
          { slot: 2, value: 3100 },
        ],
      ],
      [
        "rthun2",
        [
          { slot: 1, value: 400 },
          { slot: 2, value: 2000 },
        ],
      ],
      [
        "shinobi",
        [
          { slot: 1, value: 100 },
          { slot: 2, value: 0 },
        ],
      ],
      [
        "salmndr2",
        [
          { slot: 1, value: 2700 },
          { slot: 2, value: 3700 },
        ],
      ],
      [
        "88games",
        [
          { slot: 1, value: 1856 },
          { slot: 2, value: 1856 },
        ],
      ],
    ]) {
      const events = [];
      const runtime = new GameRuntime({
        root: ".",
        romDir: ".",
        origin: () => "",
        onEvent() {},
        onStop() {},
        readScores,
        onScore: (_entry, player, done) => {
          if (done) events.push({ slot: player.slot, value: player.peak });
        },
      });
      runtime.deliver = async () => {};
      const entry = {
        ready: true,
        createdAt: Date.now(),
        lastOccupied: Date.now(),
        memoryRegion: { pointer: 0, size: scoreLayouts[id].size },
        players: new Map(
          [1, 2].map((slot) => [
            slot,
            {
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
      runtime.rooms.set(id, entry);
      for (const capture of captures.filter(
        (c) =>
          c.game === id &&
          (id === "rthun2"
            ? c.stage.startsWith("calibration-")
            : c.stage !== "before" && !c.stage.startsWith("calibration-")),
      )) {
        globalThis.window = {
          EJS_emulator: {
            Module: { HEAPU8: memory(capture) },
            gameManager: { getState: () => memory(capture) },
          },
        };
        await runtime.sample(id, entry, { id });
      }
      assert.deepEqual(events, completed, id);
      if (id === "tmnt2po") {
        assert.equal(entry.players.get(2).finished, false);
        assert.equal(entry.players.get(2).peak, 16);
      }
    }
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
