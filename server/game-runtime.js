import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { scoreLayouts } from "./score-readers.js";

async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("El motor no responde.")),
          5000,
        );
        timer.unref();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Only Node calls this API. No client token or HTTP endpoint can publish a result.
export class GameRuntime {
  constructor({
    root,
    romDir,
    origin,
    onEvent,
    onStop,
    onBegin = () => {},
    onPlayer = () => {},
    onScore = () => {},
    readScores = () => [],
    hasPlayers = () => true,
    maxRooms = 2,
  }) {
    Object.assign(this, {
      root,
      romDir,
      origin,
      onEvent,
      onStop,
      onBegin,
      onPlayer,
      onScore,
      readScores,
      hasPlayers,
      maxRooms,
    });
    this.rooms = new Map();
  }
  status(roomId) {
    const room = this.rooms.get(roomId);
    return {
      ready: !!room?.ready && !room.stopped,
      starting: !!room && !room.ready,
      runId: room?.runId,
    };
  }
  async ensure(room, game) {
    if (this.rooms.has(room.id)) {
      if (this.rooms.get(room.id).stopped)
        throw new Error(
          "La partida anterior está finalizando. Espera unos segundos y vuelve a conectar.",
        );
      return this.rooms.get(room.id).starting;
    }
    if (this.rooms.size >= this.maxRooms)
      throw new Error(
        "El servidor tiene todas sus partidas ocupadas. Inténtalo cuando quede una libre.",
      );
    const entry = {
      runId: randomUUID(),
      ready: false,
      stopped: false,
      players: new Map(),
      lastOccupied: Date.now(),
      createdAt: Date.now(),
    };
    this.rooms.set(room.id, entry);
    entry.starting = this.start(room, game, entry).catch(async (error) => {
      await this.stop(
        room.id,
        "No se pudo iniciar el motor del servidor. Consulta Administración.",
      );
      console.error("Motor de partida:", error.message.slice(0, 300));
      throw new Error(
        "No se pudo iniciar el motor del servidor. Consulta Administración.",
      );
    });
    return entry.starting;
  }
  async start(room, game, entry) {
    // Set the cache before importing Playwright (it resolves browser locations on import).
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(
      this.root,
      ".cache/server-browsers",
    );
    const { chromium } = await import("playwright");
    if (!existsSync(chromium.executablePath()))
      throw new Error("Falta Chromium: npm run server:install");
    const browser = await chromium.launch({
      headless: true,
      channel: "chromium",
      chromiumSandbox: true,
      args: [
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--enable-unsafe-swiftshader",
      ],
      ignoreDefaultArgs:
        process.env.ARCADE_TEST_MUTE_AUDIO === "1" ? [] : ["--mute-audio"],
    });
    entry.browser = browser;
    if (entry.stopped) return browser.close();
    const context = await browser.newContext({
      viewport: { width: 640, height: 480 },
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    const origin = this.origin();
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith("/_worker/")) {
        const allowed = [game.rom, game.bios].filter(Boolean);
        const filename = url.pathname.slice("/_worker/".length);
        if (!allowed.includes(filename)) return route.abort();
        return route.fulfill({
          path: join(this.romDir, filename),
          contentType: "application/zip",
        });
      }
      if (
        !["/play.html", "/favicon.svg"].includes(url.pathname) &&
        !url.pathname.startsWith("/assets/") &&
        !url.pathname.startsWith("/emulator/")
      )
        return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    entry.page = page;
    page.on("console", (message) => {
      const match = message
        .text()
        .match(/System RAM set to (0x[0-9a-f]+), size is (\d+)/i);
      if (match)
        entry.memoryRegion = {
          pointer: parseInt(match[1], 16),
          size: Number(match[2]),
        };
    });
    await page.exposeFunction("arcadeWorkerEvent", async (name, payload) => {
      if (entry.stopped || this.rooms.get(room.id) !== entry)
        return { ok: false };
      if (name === "game:ready") entry.loaded = true;
      if (name === "game:signal")
        await this.onEvent(room.id, entry, name, payload);
      return { ok: true };
    });
    await page.addInitScript(
      (config) => {
        window.__arcadeWorker = config;
      },
      {
        roomId: room.id,
        game,
        host: true,
        slot: 0,
        controls: {},
        romUrl: "/_worker/" + game.rom,
        biosUrl: game.bios ? "/_worker/" + game.bios : null,
      },
    );
    browser.on("disconnected", () => {
      if (!entry.stopped)
        this.stop(room.id, "La partida del servidor se ha interrumpido.");
    });
    await page.goto(origin + "/play.html", { waitUntil: "load" });
    await page.waitForFunction(
      () =>
        window.EJS_emulator?.started &&
        typeof window.arcadeWorkerDeliver === "function",
      null,
      { timeout: 60000 },
    );
    await page.waitForFunction(
      (minimum) =>
        window.EJS_emulator?.gameManager?.functions.getFrameNum() > minimum,
      game.bootFrames || 1200,
      { timeout: Math.max(90000, (game.bootFrames || 1200) * 25) },
    );
    await this.bootSequence(page, game.bootSequence);
    if (entry.stopped) return;
    this.onBegin(room.id, entry, game);
    entry.ready = true;
    await this.onEvent(room.id, entry, "game:ready", {});
    entry.timer = setInterval(
      () =>
        this.sample(room.id, entry, game).catch(() =>
          this.stop(
            room.id,
            "No se pudo leer el estado del motor. La partida se ha detenido.",
          ).catch(() => {}),
        ),
      500,
    );
    entry.timer.unref();
  }
  async deliver(roomId, name, payload) {
    const entry = this.rooms.get(roomId);
    if (!entry?.ready || entry.stopped) return;
    if ((name === "game:gone" || name === "game:release") && payload.slot) {
      entry.inputQueue = entry.inputQueue?.filter(
        (input) => input.slot !== payload.slot,
      );
    }
    if (name === "game:input") {
      entry.inputQueue ||= [];
      if (entry.inputQueue.length >= 512) {
        await this.stop(
          roomId,
          "El motor no está procesando los controles. Vuelve a preparar la partida.",
        );
        return;
      }
      entry.inputQueue.push(payload);
      if (!entry.inputFlushing) {
        entry.inputFlushing = true;
        setImmediate(() =>
          this.flushInputs(roomId, entry).catch(() =>
            this.stop(
              roomId,
              "Se ha interrumpido el envío de controles al motor.",
            ).catch(() => {}),
          ),
        ).unref();
      }
      return;
    }
    await bounded(
      entry.page.evaluate(
        ({ name, payload }) => window.arcadeWorkerDeliver(name, payload),
        { name, payload },
      ),
    );
  }
  async flushInputs(roomId, entry) {
    try {
      while (
        !entry.stopped &&
        this.rooms.get(roomId) === entry &&
        entry.inputQueue.length
      ) {
        const inputs = entry.inputQueue.splice(0);
        await bounded(
          entry.page.evaluate(
            (batch) => window.arcadeWorkerDeliver("game:inputs", batch),
            inputs,
          ),
        );
      }
    } finally {
      entry.inputFlushing = false;
    }
  }
  async bootSequence(page, steps = []) {
    // Hardware initialization runs before accounts, credits and score sampling exist.
    const advance = async (count) => {
      if (!count) return;
      const frame = await page.evaluate(() =>
        window.EJS_emulator.gameManager.functions.getFrameNum(),
      );
      await page.waitForFunction(
        ({ frame, count }) =>
          window.EJS_emulator.gameManager.functions.getFrameNum() >=
          frame + count,
        { frame, count },
        { timeout: Math.max(60000, count * 40) },
      );
    };
    for (const step of steps) {
      const { slot, index, holdFrames, settleFrames } = step;
      if (step.reset) {
        await page.evaluate(() =>
          window.EJS_emulator.gameManager.functions.restart(),
        );
        await advance(settleFrames);
        continue;
      }
      const buttons = step.buttons || [{ slot, index }];
      for (const value of [1, 0]) {
        await page.evaluate(
          ({ buttons, value }) => {
            for (const button of buttons)
              window.arcadeWorkerDeliver("game:input", { ...button, value });
          },
          { buttons, value },
        );
        await advance(value ? holdFrames : settleFrames);
      }
    }
  }
  input(roomId, userId, slot, index, value) {
    const entry = this.rooms.get(roomId);
    if (!entry?.ready || entry.stopped)
      throw new Error("El servidor todavía está iniciando el juego.");
    let player = entry.players.get(slot);
    if (player && player.userId !== userId)
      throw new Error(
        "Este puesto conserva una partida anterior. El anfitrión debe iniciar una nueva partida.",
      );
    if (player?.finished)
      throw new Error(
        "Tu participación ha terminado. El anfitrión puede preparar una nueva partida.",
      );
    if (!player) {
      if (!value || index !== 2) return;
      player = {
        userId,
        slot,
        coin: false,
        start: false,
        armed: false,
        seenActive: false,
        peak: 0,
        finished: false,
      };
      entry.players.set(slot, player);
      this.onPlayer(entry, player);
    }
    if (index === 2 || index === 3) {
      if (!value) return;
      const key = index === 2 ? "coin" : "start";
      if (player[key] && (key === "coin" || player.seenActive))
        throw new Error(
          "Esta partida admite un crédito y un inicio por jugador. Para volver a jugar, inicia una nueva partida.",
        );
      player[key] = true;
      if (index === 3 && (entry.gameId === "tetris" || entry.startTogether)) {
        const players = [...entry.players.values()];
        if (
          players.length === 2 &&
          players.every((p) => p.coin) &&
          players.every((p) => !p.seenActive)
        ) {
          for (const p of players) p.start = true;
          this.deliver(roomId, "game:input", {
            slot: 2,
            index,
            value: 1,
          }).catch(() => {});
          setTimeout(
            () =>
              this.deliver(roomId, "game:input", {
                slot: 2,
                index,
                value: 0,
              }).catch(() => {}),
            100,
          ).unref();
          return;
        }
      }
      const port = index === 2 && entry.coinSlot ? entry.coinSlot : slot;
      const now = Date.now();
      const delay =
        index === 2 && entry.coinSlot
          ? Math.max(0, (entry.nextCoinAt || 0) - now)
          : 0;
      if (index === 2 && entry.coinSlot) entry.nextCoinAt = now + delay + 250;
      const pulse = () => {
        this.deliver(roomId, "game:input", {
          slot: port,
          index,
          value: 1,
        }).catch(() => {});
        setTimeout(
          () =>
            this.deliver(roomId, "game:input", {
              slot: port,
              index,
              value: 0,
            }).catch(() => {}),
          100,
        ).unref();
      };
      if (delay) setTimeout(pulse, delay).unref();
      else pulse();
    } else
      this.deliver(roomId, "game:input", { slot, index, value }).catch(
        () => {},
      );
  }
  async sample(roomId, entry, game) {
    if (entry.stopped || entry.sampling) return;
    if (this.hasPlayers(roomId)) entry.lastOccupied = Date.now();
    if (
      Date.now() - entry.lastOccupied > 60000 ||
      Date.now() - entry.createdAt > 2 * 60 * 60 * 1000
    )
      return this.stop(
        roomId,
        "La partida ha finalizado por inactividad o duración máxima.",
      );
    const layout = scoreLayouts[game.id];
    if (
      !entry.players.size ||
      !layout ||
      (layout.source !== "state" &&
        (!entry.memoryRegion || entry.memoryRegion.size !== layout.size))
    )
      return;
    entry.sampling = true;
    try {
      const data = await bounded(
        entry.page.evaluate(
          ({ pointer, size, ranges, source }) => {
            const emulator = window.EJS_emulator;
            const heap =
              source === "state"
                ? emulator.gameManager.getState()
                : emulator.Module.HEAPU8;
            if (source === "state" && heap.length !== size)
              throw Error("Estado del motor no válido");
            if (
              pointer < 0 ||
              size < 1 ||
              size > 2097152 ||
              pointer + size > heap.length
            )
              throw Error("RAM no válida");
            return ranges.map(([offset, length]) => {
              if (offset < 0 || offset + length > size)
                throw Error("Región de puntuación no válida");
              return Array.from(
                heap.subarray(pointer + offset, pointer + offset + length),
              );
            });
          },
          {
            pointer: layout.source === "state" ? 0 : entry.memoryRegion.pointer,
            size: layout.size,
            ranges: layout.ranges,
            source: layout.source,
          },
        ),
      );
      if (entry.stopped) return;
      const ram = Buffer.alloc(layout.size);
      layout.ranges.forEach(([offset], index) => ram.set(data[index], offset));
      for (const result of this.readScores(game, ram)) {
        const player = entry.players.get(result.slot);
        if (!player?.start || player.finished) continue;
        if (result.active && (result.value === 0 || layout.armOnActive))
          player.armed = true;
        if (!player.armed) continue;
        if (result.active) {
          player.seenActive = true;
          player.peak = Math.max(player.peak, result.value);
          this.onScore(entry, player, false, result.initials);
        } else if (player.seenActive) {
          // Include the last points only when this game's RAM retains its score
          // after participation ends; other games clear or reuse that field.
          if (layout.finalScoreOnInactive)
            player.peak = Math.max(player.peak, result.value);
          player.finished = true;
          this.onScore(entry, player, true, result.initials);
          this.deliver(roomId, "game:release", { slot: player.slot }).catch(
            () => {},
          );
        }
      }
    } finally {
      entry.sampling = false;
    }
  }
  depart(roomId, userId, slot) {
    const entry = this.rooms.get(roomId),
      player = entry?.players.get(slot);
    if (player?.userId === userId && !player.finished) {
      if (player.armed && player.seenActive) this.onScore(entry, player, true);
      player.finished = true;
    }
    this.deliver(roomId, "game:gone", { userId, slot }).catch(() => {});
  }
  async stop(roomId, reason = "Partida finalizada.") {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    if (entry.stopped) return entry.stopping;
    entry.stopped = true;
    clearInterval(entry.timer);
    entry.stopping = (async () => {
      try {
        for (const player of entry.players.values())
          if (player.armed && player.seenActive && !player.finished)
            this.onScore(entry, player, true);
      } finally {
        await entry.browser?.close().catch(() => {});
        if (this.rooms.get(roomId) === entry) this.rooms.delete(roomId);
        this.onStop(roomId, reason, entry);
      }
    })();
    return entry.stopping;
  }
  async close() {
    await Promise.all([...this.rooms.keys()].map((id) => this.stop(id)));
  }
}
