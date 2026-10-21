import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { GameRuntime } from "../server/game-runtime.js";
import { gameProfile } from "../server/catalog.js";

function harness(id) {
  const events = [];
  const runtime = new GameRuntime({
    root: ".",
    romDir: ".",
    origin: () => "",
    onEvent() {},
    onStop() {},
  });
  const entry = {
    gameId: id,
    ...gameProfile(id),
    ready: true,
    players: new Map(),
  };
  runtime.rooms.set("room", entry);
  runtime.deliver = async (_room, name, payload) =>
    events.push({ name, ...payload });
  return { runtime, entry, events };
}
test("alternating games start both credited seats together and retry the paired start during intros", () => {
  const { runtime, entry, events } = harness("1942");
  runtime.input("room", "one", 1, 2, 1);
  runtime.input("room", "two", 2, 2, 1);
  runtime.input("room", "one", 1, 3, 1);
  assert.equal(entry.players.get(1).start, true);
  assert.equal(entry.players.get(2).start, true);
  runtime.input("room", "one", 1, 3, 1);
  assert.deepEqual(
    events.filter((e) => e.index === 3 && e.value).map((e) => e.slot),
    [2, 2],
  );
  entry.players.get(1).seenActive = true;
  assert.throws(() => runtime.input("room", "one", 1, 3, 1), /un crédito/);
});
test("1945 credits use its shared native coin port without merging player identities", async () => {
  const { runtime, entry, events } = harness("1945kiii");
  runtime.input("room", "one", 1, 2, 1);
  runtime.input("room", "two", 2, 2, 1);
  await delay(390);
  assert.deepEqual(
    events.filter((e) => e.index === 2).map((e) => [e.slot, e.value]),
    [
      [1, 1],
      [1, 0],
      [1, 1],
      [1, 0],
    ],
  );
  assert.equal(entry.players.get(1).userId, "one");
  assert.equal(entry.players.get(2).userId, "two");
  assert.throws(() => runtime.input("room", "two", 2, 2, 1), /un crédito/);
});

test("hardware initialization releases Start and settles before any account can spend a credit", async () => {
  const { runtime, entry } = harness("rthun2");
  const previous = globalThis.window;
  const inputs = [];
  let frame = 1201;
  globalThis.window = {
    EJS_emulator: { gameManager: { functions: { getFrameNum: () => frame } } },
    arcadeWorkerDeliver: (_event, input) => inputs.push({ ...input, frame }),
  };
  try {
    await runtime.bootSequence(
      {
        evaluate: async (fn, args) => fn(args),
        waitForFunction: async (fn, args) => {
          frame = args.frame + args.count;
          assert.ok(fn(args));
        },
      },
      gameProfile("rthun2").bootSequence,
    );
    assert.deepEqual(inputs, [
      { slot: 1, index: 3, value: 1, frame: 1201 },
      { slot: 1, index: 3, value: 0, frame: 1216 },
    ]);
    assert.equal(frame, 5416);
    assert.equal(entry.players.size, 0);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test("cabinet initialization resets hardware and releases every button of a service-menu chord", async () => {
  const { runtime, entry } = harness("avsp");
  const previous = globalThis.window,
    inputs = [];
  let frame = 5000,
    resets = 0;
  globalThis.window = {
    EJS_emulator: {
      gameManager: {
        functions: {
          getFrameNum: () => frame,
          restart: () => {
            resets++;
            frame = 0;
          },
        },
      },
    },
    arcadeWorkerDeliver: (_event, input) => inputs.push({ ...input, frame }),
  };
  try {
    await runtime.bootSequence(
      {
        evaluate: async (fn, args) => fn(args),
        waitForFunction: async (fn, args) => {
          frame = args.frame + args.count;
          assert.ok(fn(args));
        },
      },
      [
        { reset: true, settleFrames: 1200 },
        {
          buttons: [
            { slot: 1, index: 3 },
            { slot: 2, index: 3 },
          ],
          holdFrames: 12,
          settleFrames: 30,
        },
      ],
    );
    assert.equal(resets, 1);
    assert.deepEqual(inputs, [
      { slot: 1, index: 3, value: 1, frame: 1200 },
      { slot: 2, index: 3, value: 1, frame: 1200 },
      { slot: 1, index: 3, value: 0, frame: 1212 },
      { slot: 2, index: 3, value: 0, frame: 1212 },
    ]);
    assert.equal(frame, 1242);
    assert.equal(entry.players.size, 0);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
