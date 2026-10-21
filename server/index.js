import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { createServer } from "node:http";
import { randomInt, randomUUID, createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { openDatabase } from "./db.js";
import { createBackup, listBackups } from "./backups.js";
import { emulatorIntegrity } from "./integrity.js";
import { createMedals } from "./medals.js";
import { medalSvg } from "./medal-art.js";
import { championMedal } from "../config/medals.js";
import { GameRuntime } from "./game-runtime.js";
import { scoreLayouts, readScores } from "./score-readers.js";
import { gameProfile } from "./catalog.js";
import {
  localAddresses,
  networkSettings,
  validateNetwork,
  networkUrl,
} from "./network.js";
import { totalmem, freemem, cpus } from "node:os";
import {
  token,
  hash,
  secretFile,
  passwordHash,
  passwordMatches,
  readCookie,
} from "./security.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86400000;
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
function text(value, min = 1, max = 80) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `Introduce un texto de ${min} a ${max} caracteres.`);
  return value.trim();
}
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(400, "El número indicado no es válido.");
  return value;
}

export function createArcade(options = {}) {
  const dataDir = resolve(
    options.dataDir || process.env.DATA_DIR || join(root, "data"),
  );
  const db = openDatabase(dataDir);
  const setupCode = options.setupCode || secretFile(dataDir, "setup-code");
  // Preserve the backup format used by existing installations.
  secretFile(dataDir, "encryption-key");
  const medals = createMedals(db);
  medals.backfill();
  const uploadDir = join(dataDir, "uploads"),
    romDir = join(dataDir, "roms");
  mkdirSync(uploadDir, { recursive: true });
  mkdirSync(romDir, { recursive: true });
  const app = express();
  const http = createServer(app);
  const io = new Server(http, {
    maxHttpBufferSize: 65536,
    serveClient: false,
    allowRequest: (req, cb) => cb(null, originAllowed(req) && !!session(req)),
  });
  function notifyMedals(userId) {
    const earned = medals.award(userId);
    if (earned.length)
      io.to(`user:${userId}`).emit(
        "medals:earned",
        earned.map(({ id, title, image }) => ({ id, title, image })),
      );
  }
  const integrity = emulatorIntegrity(root);
  const gameSockets = new Map();
  const coreHash = createHash("sha256")
    .update(readFileSync(join(root, "config/emulator-lock.json")))
    .digest("hex");
  const approvedRom = (g) => {
    const layout = scoreLayouts[g.id];
    if (!layout || !existsSync(join(romDir, g.rom))) return false;
    if (
      createHash("sha256")
        .update(readFileSync(join(romDir, g.rom)))
        .digest("hex") !== layout.sha256
    )
      return false;
    return (
      !g.bios ||
      (existsSync(join(romDir, g.bios)) &&
        createHash("sha256")
          .update(readFileSync(join(romDir, g.bios)))
          .digest("hex") ===
          (layout.biosSha256 ||
            "00692b80cf7ad6bdddcc436d065c5e2453ca272632aae1d791f672eb280dd457"))
    );
  };
  const scoreAvailability = new Map(
    all("SELECT * FROM games").map((g) => [g.id, approvedRom(g)]),
  );
  const runtime =
    options.runtime === false
      ? null
      : options.runtime ||
        new GameRuntime({
          root,
          romDir,
          origin: () => `http://127.0.0.1:${http.address().port}`,
          maxRooms: Math.max(
            1,
            Math.min(8, Number(process.env.MAX_SERVER_GAMES) || 2),
          ),
          hasPlayers: (rid) =>
            [...gameSockets.keys()].some((key) => key.startsWith(rid + ":")),
          readScores: (game, ram) => readScores(game, ram),
          onBegin: (rid, entry, game) => {
            entry.scoringEnabled = approvedRom(game);
            entry.gameId = game.id;
            entry.startTogether = !!game.startTogether;
            entry.coinSlot = game.coinSlot;
            run(
              "INSERT INTO game_runs(id,room_id,game_id,started_at,rules,core_hash) VALUES(?,?,?,?,?,?)",
              entry.runId,
              rid,
              game.id,
              Date.now(),
              JSON.stringify({
                creditsPerPlayer: 1,
                continues: false,
                layout: scoreLayouts[game.id]?.version || null,
                romHash: scoreLayouts[game.id]?.sha256 || null,
                catalogRules: game.rules,
              }),
              coreHash,
            );
          },
          onPlayer: (entry, player) =>
            run(
              "INSERT INTO run_players VALUES(?,?,?)",
              entry.runId,
              player.slot,
              player.userId,
            ),
          onScore: (entry, player, completed, initials) => {
            const firstScore = player.lastPersisted === undefined;
            if (
              player.lastPersisted === player.peak &&
              (!completed || player.persistedCompleted)
            )
              return;
            if (
              !entry.scoringEnabled ||
              !q(
                "SELECT 1 FROM users WHERE id=? AND suspended=0",
                player.userId,
              )
            )
              return;
            run(
              "INSERT INTO automatic_scores(id,run_id,slot,user_id,game_id,value,initials,created_at,completed) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(run_id,slot) DO UPDATE SET value=MAX(automatic_scores.value,excluded.value),completed=MAX(automatic_scores.completed,excluded.completed),initials=COALESCE(excluded.initials,automatic_scores.initials)",
              randomUUID(),
              entry.runId,
              player.slot,
              player.userId,
              entry.gameId,
              player.peak,
              initials || null,
              Date.now(),
              completed ? 1 : 0,
            );
            player.lastPersisted = player.peak;
            player.persistedCompleted = completed;
            if (firstScore || completed) {
              for (const participant of all(
                "SELECT user_id FROM run_players WHERE run_id=?",
                entry.runId,
              ))
                notifyMedals(participant.user_id);
            }
          },
          onEvent: async (rid, entry, name, payload) => {
            if (name === "game:ready") {
              for (const [key, guest] of gameSockets)
                if (key.startsWith(rid + ":"))
                  await runtime.deliver(rid, "game:peer", {
                    userId: key.slice(rid.length + 1),
                    slot: guest.slot,
                  });
              emitRooms(rid);
            } else if (name === "game:signal") {
              const guest = gameSockets.get(`${rid}:${String(payload.target)}`);
              if (
                guest &&
                member(rid, payload.target)?.slot &&
                !q("SELECT closed FROM rooms WHERE id=?", rid)?.closed
              )
                io.to(guest.socketId).emit("game:signal", {
                  from: "server",
                  slot: 0,
                  signal: payload.signal,
                });
            }
          },
          onStop: (rid, reason, entry) => {
            run(
              "UPDATE game_runs SET ended_at=? WHERE id=? AND ended_at IS NULL",
              Date.now(),
              entry.runId,
            );
            io.to(`room:${rid}`).emit("game:error", { error: reason });
            for (const [key, guest] of gameSockets)
              if (key.startsWith(rid + ":")) {
                io.to(guest.socketId).emit("game:stop", { reason });
                gameSockets.delete(key);
              }
            emitRooms(rid);
          },
        });
  let backingUp = false,
    uploadsInFlight = 0;
  function q(sql, ...args) {
    return db.prepare(sql).get(...args);
  }
  function all(sql, ...args) {
    return db.prepare(sql).all(...args);
  }
  function run(sql, ...args) {
    return db.prepare(sql).run(...args);
  }
  const audit = (actor, action, target = null) =>
    run(
      "INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)",
      actor,
      action,
      target,
      Date.now(),
    );
  const session = (req) => {
    const raw = readCookie(req);
    if (!/^[a-f0-9]{64}$/.test(raw)) return null;
    return q(
      "SELECT s.id session_id,s.csrf,s.expires,u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.id=? AND s.expires>? AND u.suspended=0",
      hash(raw),
      Date.now(),
    );
  };
  const publicUser = (u) =>
    u
      ? {
          id: u.id,
          username: u.username,
          role: u.role,
          theme: u.theme || "light",
          controls: JSON.parse(u.controls),
          gamepadControls: JSON.parse(u.gamepad_controls || "{}"),
        }
      : null;
  function originAllowed(req) {
    if (!req.headers.origin) return true;
    try {
      const o = new URL(req.headers.origin);
      if (process.env.ARCADE_NETWORK_MANAGED === "1") {
        const network = networkSettings(db);
        return [
          "http://127.0.0.1:3000",
          "http://localhost:3000",
          networkUrl(network),
          ...(network.mode === "internet" ? [networkUrl(network, true)] : []),
        ].includes(o.origin);
      }
      const allowed = (process.env.APP_ORIGIN || "").split(",").filter(Boolean);
      return allowed.length
        ? allowed.includes(o.origin)
        : o.host === req.headers.host;
    } catch {
      return false;
    }
  }
  const requireUser = (req, res, next) => {
    req.user = session(req);
    if (!req.user)
      return res.status(401).json({ error: "Inicia sesión para continuar." });
    next();
  };
  const admin = (req, res, next) => {
    if (req.user.role !== "admin")
      return res
        .status(403)
        .json({ error: "Solo el administrador puede hacerlo." });
    next();
  };
  const limiter = (limit, windowMs = 60000) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Demasiados intentos. Espera antes de volver a intentarlo.",
      },
      skip: () => !!options.disableRateLimits,
    });
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      originAgentCluster: false,
      strictTransportSecurity:
        process.env.COOKIE_SECURE === "1" ? undefined : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // This pinned Emscripten core uses cwrap/new Function. Limit that permission to the game document.
          scriptSrc: [
            "'self'",
            "'wasm-unsafe-eval'",
            "blob:",
            (req) =>
              req.path === "/play.html"
                ? "'unsafe-eval'"
                : "'wasm-unsafe-eval'",
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: [
            "'self'",
            "blob:",
            (req) =>
              `${req.secure || process.env.COOKIE_SECURE === "1" ? "wss" : "ws"}://${req.headers.host}`,
          ],
          mediaSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
          frameSrc: [
            "'self'",
            "https://www.youtube-nocookie.com",
            "https://player.vimeo.com",
          ],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "24kb" }));
  app.use((req, res, next) => {
    req.body ||= {};
    next();
  });
  app.use("/api", limiter(240));
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !originAllowed(req))
      return res
        .status(403)
        .json({ error: "Origen de la petición no permitido." });
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !["/auth/login", "/auth/register"].includes(req.path)
    ) {
      const u = session(req);
      if (u && req.headers["x-csrf-token"] !== u.csrf)
        return res
          .status(403)
          .json({ error: "La sesión ha cambiado. Recarga la página." });
    }
    next();
  });
  const cookie = (res, raw, clear = false) =>
    res.cookie("arcade_sid", raw, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "1" || !!res.req.secure,
      maxAge: clear ? 0 : 7 * DAY,
      path: "/",
    });
  function login(res, user) {
    const raw = token(),
      csrf = token();
    run(
      "INSERT INTO sessions VALUES(?,?,?,?)",
      hash(raw),
      user.id,
      csrf,
      Date.now() + 7 * DAY,
    );
    cookie(res, raw);
    return { user: publicUser(user), csrf };
  }
  function gameInfo(g) {
    const { ra_id: _retired, ...details } = g;
    return {
      ...details,
      ...gameProfile(g.id),
      ready:
        existsSync(join(romDir, g.rom)) &&
        (!g.bios || existsSync(join(romDir, g.bios))),
      emulatorReady: integrity.ok,
      serverHosted: !!runtime,
      scoreSupported: !!scoreAvailability.get(g.id),
      missing: [g.rom, g.bios].filter((f) => f && !existsSync(join(romDir, f))),
    };
  }
  const game = (id) => {
    const g = q("SELECT * FROM games WHERE id=? AND enabled=1", id);
    if (!g) fail(404, "Juego no encontrado.");
    return g;
  };
  const member = (rid, uid) =>
    q("SELECT * FROM members WHERE room_id=? AND user_id=?", rid, uid);
  const isFriend = (a, b) =>
    !!q(
      "SELECT 1 FROM friends WHERE status='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))",
      a,
      b,
      b,
      a,
    );
  function roomFor(id, u, membership = false) {
    const r = q("SELECT * FROM rooms WHERE id=? AND closed=0", id);
    if (!r) fail(404, "Sala no encontrada.");
    if (
      !member(id, u.id) &&
      r.owner_id !== u.id &&
      (membership ||
        !(
          r.visibility === "public" ||
          (r.visibility === "friends" && isFriend(r.owner_id, u.id))
        ))
    )
      fail(403, "Necesitas acceso a esta sala.");
    return r;
  }
  function roomInfo(r) {
    const members = all(
      "SELECT m.user_id id,m.slot,u.username FROM members m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY m.slot IS NULL,m.slot,m.joined_at",
      r.id,
    );
    return {
      ...r,
      game: gameInfo(game(r.game_id)),
      owner: q("SELECT username FROM users WHERE id=?", r.owner_id).username,
      members,
      live: runtime
        ? runtime.status(r.id).ready
        : !!gameSockets.get(`${r.id}:${r.owner_id}`)?.ready,
      serverHosted: !!runtime,
    };
  }
  const emitRooms = (rid) => {
    io.to(`room:${rid}`).emit("room:changed");
    io.emit("lobby:changed");
  };
  function revokeGame(rid, uid) {
    const entry = gameSockets.get(`${rid}:${uid}`);
    if (entry) {
      if (runtime) {
        if (runtime.depart) runtime.depart(rid, uid, entry.slot);
        else
          runtime
            .deliver(rid, "game:gone", { userId: uid, slot: entry.slot })
            .catch(() => {});
      }
      io.to(`room:${rid}`).emit("game:gone", { userId: uid });
      io.sockets.sockets.get(entry.socketId)?.emit("game:stop");
      gameSockets.delete(`${rid}:${uid}`);
    }
  }
  function purgeSession(sid) {
    for (const s of io.sockets.sockets.values())
      if (s.data.sessionId === sid) s.disconnect(true);
  }
  function closeRoom(rid, actor) {
    run("UPDATE rooms SET closed=1 WHERE id=?", rid);
    runtime?.stop(rid).catch(() => {});
    for (const m of all("SELECT user_id FROM members WHERE room_id=?", rid))
      revokeGame(rid, m.user_id);
    io.to(`room:${rid}`).emit("room:closed");
    io.in(`room:${rid}`).socketsLeave(`room:${rid}`);
    audit(actor, "room.close", rid);
    emitRooms(rid);
  }

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/auth/me", (req, res) => {
    const u = session(req);
    res.json({
      user: publicUser(u),
      csrf: u?.csrf || null,
      setupRequired: !q("SELECT 1 FROM users LIMIT 1"),
      registrationOpen:
        q("SELECT value FROM settings WHERE key='registration'").value ===
        "open",
    });
  });
  app.get("/api/auth/challenge", limiter(30), (req, res) => {
    run("DELETE FROM challenges WHERE expires<?", Date.now());
    const id = token(),
      a = randomInt(2, 12),
      b = randomInt(1, 10);
    run(
      "INSERT INTO challenges VALUES(?,?,?)",
      id,
      hash(String(a + b)),
      Date.now() + 5 * 60000,
    );
    res.json({ id, question: `¿Cuánto es ${a} + ${b}?` });
  });
  app.post("/api/auth/register", limiter(5, 60 * 60000), async (req, res) => {
    if (
      q("SELECT value FROM settings WHERE key='registration'").value !== "open"
    )
      fail(403, "El administrador ha pausado los nuevos registros.");
    const b = req.body || {};
    if (b.website) fail(400, "No se pudo completar el registro.");
    const username = text(b.username, 3, 24);
    if (!/^[\p{L}\p{N}_-]+$/u.test(username))
      fail(400, "El nombre solo admite letras, números, guiones y guion bajo.");
    const password = text(b.password, 12, 200);
    const challenge = q(
      "SELECT * FROM challenges WHERE id=?",
      String(b.challengeId || ""),
    );
    if (challenge) run("DELETE FROM challenges WHERE id=?", challenge.id);
    if (
      !challenge ||
      challenge.expires < Date.now() ||
      challenge.answer !== hash(String(b.answer || "").trim())
    )
      fail(400, "Resuelve una nueva comprobación antispam.");
    if (!q("SELECT 1 FROM users LIMIT 1") && b.setupCode !== setupCode)
      fail(
        403,
        "Introduce el código de instalación que aparece en la consola del servidor.",
      );
    if (q("SELECT 1 FROM users WHERE username=?", username))
      fail(409, "Ese nombre ya está registrado.");
    const passwordStored = await passwordHash(password);
    // Check again after the asynchronous password derivation; only one first administrator.
    const first = !q("SELECT 1 FROM users LIMIT 1");
    if (first && b.setupCode !== setupCode)
      fail(403, "Código de instalación incorrecto.");
    const id = randomUUID();
    run(
      "INSERT INTO users(id,username,password,role,created_at) VALUES(?,?,?,?,?)",
      id,
      username,
      passwordStored,
      first ? "admin" : "member",
      Date.now(),
    );
    audit(id, "account.register", id);
    res.status(201).json(login(res, q("SELECT * FROM users WHERE id=?", id)));
  });
  app.post("/api/auth/login", limiter(12, 15 * 60000), async (req, res) => {
    const username = text(req.body?.username, 1, 24),
      password = text(req.body?.password, 1, 200);
    const u = q("SELECT * FROM users WHERE username=?", username);
    const matches = await passwordMatches(
      password,
      u?.password || "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!u || !matches || u.suspended)
      fail(401, "Usuario o contraseña incorrectos.");
    res.json(login(res, u));
  });
  app.post("/api/auth/logout", requireUser, (req, res) => {
    run("DELETE FROM sessions WHERE id=?", req.user.session_id);
    purgeSession(req.user.session_id);
    cookie(res, "", true);
    res.json({ ok: true });
  });
  app.get("/api/home", (req, res) => {
    const u = session(req);
    const rooms = all(
      "SELECT * FROM rooms WHERE closed=0 ORDER BY created_at DESC",
    )
      .filter(
        (r) =>
          u &&
          (r.visibility === "public" ||
            member(r.id, u.id) ||
            (r.visibility === "friends" && isFriend(r.owner_id, u.id))),
      )
      .map(roomInfo);
    res.json({
      games: all(
        "SELECT * FROM games WHERE enabled=1 ORDER BY created_at DESC,id",
      ).map(gameInfo),
      rooms,
      recent: all(
        "SELECT g.id gameId,g.title,u.username,p.created_at FROM plays p JOIN games g ON g.id=p.game_id JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 5",
      ),
      stats: {
        users: q("SELECT COUNT(*) n FROM users").n,
        rooms: rooms.length,
        plays: q("SELECT COUNT(*) n FROM plays").n,
      },
    });
  });
  app.get("/api/users", requireUser, (req, res) => {
    const search = String(req.query.q || "")
      .trim()
      .slice(0, 24);
    res.json(
      all(
        "SELECT id,username FROM users WHERE id<>? AND username LIKE ? LIMIT 20",
        req.user.id,
        `%${search}%`,
      ),
    );
  });
  app.get("/api/friends", requireUser, (req, res) =>
    res.json(
      all(
        "SELECT f.sender,f.recipient,f.status,u.id,u.username FROM friends f JOIN users u ON u.id=CASE WHEN f.sender=? THEN f.recipient ELSE f.sender END WHERE f.sender=? OR f.recipient=?",
        req.user.id,
        req.user.id,
        req.user.id,
      ),
    ),
  );
  app.post("/api/friends", requireUser, limiter(10), (req, res) => {
    const other = text(req.body.userId, 1, 64);
    if (other === req.user.id || !q("SELECT 1 FROM users WHERE id=?", other))
      fail(400, "Selecciona otro usuario.");
    if (
      q(
        "SELECT 1 FROM friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
        req.user.id,
        other,
        other,
        req.user.id,
      )
    )
      fail(409, "Ya existe una solicitud entre estas cuentas.");
    run(
      "INSERT INTO friends VALUES(?,?,?,?)",
      req.user.id,
      other,
      "pending",
      Date.now(),
    );
    res.status(201).json({ ok: true });
  });
  app.post("/api/friends/:id/accept", requireUser, (req, res) => {
    if (
      !run(
        "UPDATE friends SET status='accepted' WHERE sender=? AND recipient=? AND status='pending'",
        req.params.id,
        req.user.id,
      ).changes
    )
      fail(404, "Solicitud no encontrada.");
    notifyMedals(req.user.id);
    notifyMedals(req.params.id);
    res.json({ ok: true });
  });
  app.delete("/api/friends/:id", requireUser, (req, res) => {
    run(
      "DELETE FROM friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
      req.user.id,
      req.params.id,
      req.params.id,
      req.user.id,
    );
    res.json({ ok: true });
  });

  app.post("/api/rooms", requireUser, limiter(8), (req, res) => {
    const g = game(String(req.body.gameId));
    const name = text(req.body.name, 3, 64),
      visibility = text(req.body.visibility);
    if (!["public", "friends", "invite"].includes(visibility))
      fail(400, "Privacidad no válida.");
    if (
      q(
        "SELECT COUNT(*) n FROM rooms WHERE owner_id=? AND closed=0",
        req.user.id,
      ).n >= 3
    )
      fail(409, "Puedes mantener hasta tres salas abiertas.");
    const id = randomUUID();
    db.exec("BEGIN IMMEDIATE");
    try {
      run(
        "INSERT INTO rooms VALUES(?,?,?,?,?,?,0)",
        id,
        name,
        g.id,
        req.user.id,
        visibility,
        Date.now(),
      );
      run("INSERT INTO members VALUES(?,?,1,?)", id, req.user.id, Date.now());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    io.emit("lobby:changed");
    notifyMedals(req.user.id);
    res.status(201).json(roomInfo(q("SELECT * FROM rooms WHERE id=?", id)));
  });
  app.get("/api/rooms/:id", requireUser, (req, res) =>
    res.json(roomInfo(roomFor(req.params.id, req.user))),
  );
  app.post(
    "/api/rooms/:id/restart",
    requireUser,
    limiter(2),
    async (req, res) => {
      const r = roomFor(req.params.id, req.user, true);
      if (r.owner_id !== req.user.id)
        fail(403, "Solo el anfitrión puede iniciar una nueva partida.");
      if (!runtime) fail(409, "No está activo el motor del servidor.");
      await runtime.stop(r.id, "El anfitrión ha preparado una nueva partida.");
      io.to(`room:${r.id}`).emit("game:reset");
      audit(req.user.id, "game.restart", r.id);
      res.json({ ok: true });
    },
  );
  app.post("/api/rooms/:id/join", requireUser, (req, res) => {
    const rid = req.params.id;
    const raw = String(req.body.invitation || "");
    const inv =
      raw &&
      q(
        "SELECT * FROM invites WHERE id=? AND room_id=? AND revoked=0 AND expires>? AND used_by IS NULL",
        hash(raw),
        rid,
        Date.now(),
      );
    let r;
    if (inv) {
      r = q("SELECT * FROM rooms WHERE id=? AND closed=0", rid);
      if (!r) fail(404, "Sala no encontrada.");
    } else r = roomFor(rid, req.user);
    if (!member(rid, req.user.id)) {
      if (q("SELECT COUNT(*) n FROM members WHERE room_id=?", rid).n >= 64)
        fail(409, "Esta sala ha alcanzado su límite de miembros.");
      run(
        "INSERT INTO members VALUES(?,?,NULL,?)",
        rid,
        req.user.id,
        Date.now(),
      );
      if (inv)
        run("UPDATE invites SET used_by=? WHERE id=?", req.user.id, inv.id);
    }
    if (r.owner_id !== req.user.id) medals.record(req.user.id, "visits", rid);
    notifyMedals(req.user.id);
    emitRooms(rid);
    res.json(roomInfo(r));
  });
  app.post("/api/rooms/:id/seat", requireUser, (req, res) => {
    const r = roomFor(req.params.id, req.user, true);
    if (req.user.id === r.owner_id && req.body.play === false)
      fail(
        409,
        "El anfitrión conserva el primer puesto. Cierra la sala para salir.",
      );
    const m = member(r.id, req.user.id);
    if (!m) fail(403, "Entra primero a la sala.");
    if (req.body.play === false) {
      revokeGame(r.id, req.user.id);
      run(
        "UPDATE members SET slot=NULL WHERE room_id=? AND user_id=?",
        r.id,
        req.user.id,
      );
    } else if (!m.slot) {
      const occupied = all(
        "SELECT slot FROM members WHERE room_id=? AND slot IS NOT NULL",
        r.id,
      ).map((x) => x.slot);
      const slot = Array.from(
        { length: game(r.game_id).max_players },
        (_, i) => i + 1,
      ).find((i) => !occupied.includes(i));
      if (!slot) fail(409, "La partida está llena. Puedes seguir en el chat.");
      run(
        "UPDATE members SET slot=? WHERE room_id=? AND user_id=?",
        slot,
        r.id,
        req.user.id,
      );
    }
    emitRooms(r.id);
    res.json(roomInfo(r));
  });
  app.post("/api/rooms/:id/leave", requireUser, (req, res) => {
    const r = roomFor(req.params.id, req.user, true);
    if (r.owner_id === req.user.id) {
      closeRoom(r.id, req.user.id);
    } else {
      revokeGame(r.id, req.user.id);
      run(
        "DELETE FROM members WHERE room_id=? AND user_id=?",
        r.id,
        req.user.id,
      );
      for (const s of io.sockets.sockets.values())
        if (s.data.userId === req.user.id) s.leave(`room:${r.id}`);
    }
    emitRooms(r.id);
    res.json({ ok: true });
  });
  app.post("/api/rooms/:id/invites", requireUser, limiter(20), (req, res) => {
    const r = roomFor(req.params.id, req.user, true);
    if (r.owner_id !== req.user.id)
      fail(403, "Solo el anfitrión puede invitar.");
    const raw = token(),
      id = hash(raw);
    run(
      "INSERT INTO invites(id,room_id,creator,expires) VALUES(?,?,?,?)",
      id,
      r.id,
      req.user.id,
      Date.now() + 2 * DAY,
    );
    res.status(201).json({ id, token: raw, expires: Date.now() + 2 * DAY });
  });
  app.delete("/api/rooms/:id/invites/:invite", requireUser, (req, res) => {
    const r = roomFor(req.params.id, req.user, true);
    if (r.owner_id !== req.user.id)
      fail(403, "Solo el anfitrión puede revocar invitaciones.");
    run(
      "UPDATE invites SET revoked=1 WHERE id=? AND room_id=?",
      req.params.invite,
      r.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/rooms/:id/messages", requireUser, (req, res) => {
    roomFor(req.params.id, req.user, true);
    res.json(
      all(
        "SELECT m.id,m.body,m.image_id imageId,m.created_at,u.username,u.id userId FROM messages m JOIN users u ON u.id=m.user_id WHERE room_id=? ORDER BY m.id DESC LIMIT 100",
        req.params.id,
      ).reverse(),
    );
  });
  app.post("/api/rooms/:id/messages", requireUser, limiter(20), (req, res) => {
    const r = roomFor(req.params.id, req.user, true),
      body = text(req.body.body || "", 0, 2000),
      image = req.body.imageId || null;
    if (!body && !image) fail(400, "Escribe un mensaje o adjunta una imagen.");
    if (
      image &&
      !q(
        "SELECT 1 FROM uploads WHERE id=? AND user_id=? AND room_id=?",
        String(image),
        req.user.id,
        r.id,
      )
    )
      fail(400, "Imagen no válida para esta sala.");
    const result = run(
      "INSERT INTO messages(room_id,user_id,body,image_id,created_at) VALUES(?,?,?,?,?)",
      r.id,
      req.user.id,
      body,
      image,
      Date.now(),
    );
    const message = q(
      "SELECT m.id,m.body,m.image_id imageId,m.created_at,u.username,u.id userId FROM messages m JOIN users u ON u.id=m.user_id WHERE m.id=?",
      result.lastInsertRowid,
    );
    io.to(`room:${r.id}`).emit("chat:message", message);
    medals.record(req.user.id, "chatRooms", r.id);
    if (image) medals.record(req.user.id, "imageRooms", r.id);
    notifyMedals(req.user.id);
    res.status(201).json(message);
  });
  app.delete("/api/rooms/:id/messages/:message", requireUser, (req, res) => {
    const r = roomFor(req.params.id, req.user, true);
    if (req.user.role !== "admin" && r.owner_id !== req.user.id)
      fail(403, "Solo los moderadores pueden borrar mensajes.");
    run(
      "DELETE FROM messages WHERE id=? AND room_id=?",
      req.params.message,
      r.id,
    );
    audit(req.user.id, "message.delete", req.params.message);
    io.to(`room:${r.id}`).emit("chat:refresh");
    res.json({ ok: true });
  });
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 },
  }).single("image");
  const reserveUpload = (req, res, next) => {
    if (uploadsInFlight >= 4)
      return next(
        new HttpError(
          429,
          "Hay varias imágenes procesándose. Inténtalo en unos segundos.",
        ),
      );
    uploadsInFlight++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        uploadsInFlight--;
      }
    };
    req.releaseUpload = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!req.processingImage) release();
    });
    next();
  };
  app.post(
    "/api/images",
    requireUser,
    limiter(10),
    (req, res, next) => {
      if (req.query.room) roomFor(String(req.query.room), req.user, true);
      else fail(400, "Las imágenes solo se admiten en el chat de una sala.");
      next();
    },
    reserveUpload,
    imageUpload,
    async (req, res) => {
      req.processingImage = true;
      try {
        if (!req.file) fail(400, "Selecciona una imagen PNG, JPEG o WebP.");
        if (
          q(
            "SELECT COUNT(*) n FROM uploads WHERE user_id=? AND created_at>?",
            req.user.id,
            Date.now() - DAY,
          ).n >= 50
        )
          fail(429, "Has alcanzado el límite diario de imágenes.");
        let buffer;
        try {
          const image = sharp(req.file.buffer, {
            limitInputPixels: 16000000,
            animated: false,
          });
          const meta = await image.metadata();
          if (!["jpeg", "png", "webp"].includes(meta.format))
            fail(400, "Solo se admiten imágenes PNG, JPEG o WebP.");
          buffer = await image
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();
        } catch (e) {
          if (e.status) throw e;
          fail(
            400,
            "No se pudo leer la imagen. Usa PNG, JPEG o WebP de hasta 4 MB.",
          );
        }
        if (
          q("SELECT COALESCE(SUM(bytes),0) n FROM uploads").n + buffer.length >
          Number(process.env.UPLOAD_QUOTA_MB || 2048) * 1024 * 1024
        )
          fail(
            507,
            "El almacenamiento de imágenes está lleno. Avisa al administrador.",
          );
        const id = randomUUID();
        writeFileSync(join(uploadDir, id + ".webp"), buffer);
        run(
          "INSERT INTO uploads(id,user_id,room_id,game_id,created_at,bytes) VALUES(?,?,?,?,?,?)",
          id,
          req.user.id,
          req.query.room ? String(req.query.room) : null,
          null,
          Date.now(),
          buffer.length,
        );
        res.status(201).json({ id, url: "/api/images/" + id });
      } finally {
        req.releaseUpload();
      }
    },
  );
  app.get("/api/images/:id", requireUser, (req, res) => {
    const f = q("SELECT * FROM uploads WHERE id=?", req.params.id);
    if (!f) fail(404, "Imagen no encontrada.");
    if (f.room_id && req.user.role !== "admin")
      roomFor(f.room_id, req.user, true);
    else if (
      !f.room_id &&
      req.user.id !== f.user_id &&
      req.user.role !== "admin" &&
      !q("SELECT 1 FROM scores WHERE image_id=? AND status='approved'", f.id)
    )
      fail(403, "No puedes ver esta captura.");
    res
      .type("webp")
      .sendFile(join(uploadDir, f.id + ".webp"), { dotfiles: "allow" });
  });

  app.get("/api/games/:id/scores", (req, res) => {
    const g = game(req.params.id);
    const viewer = session(req);
    if (viewer) {
      medals.record(viewer.id, "boards", g.id);
      notifyMedals(viewer.id);
    }
    res.json({
      game: gameInfo(g),
      scores: all(
        "SELECT u.username,u.id userId,MAX(s.value) value,COUNT(*) submissions FROM automatic_scores s JOIN users u ON s.user_id=u.id WHERE s.game_id=? AND s.completed=1 GROUP BY u.id ORDER BY value DESC,u.username LIMIT 100",
        g.id,
      ),
    });
  });
  app.get("/api/scores/mine", requireUser, (req, res) =>
    res.json(
      all(
        "SELECT s.*,g.title,CASE WHEN s.completed=1 THEN 'approved' ELSE 'pending' END status FROM automatic_scores s JOIN games g ON g.id=s.game_id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 100",
        req.user.id,
      ),
    ),
  );
  app.post("/api/games/:id/scores", requireUser, (req, res) => {
    fail(
      410,
      "El envío manual está retirado. Los resultados los registra el motor del servidor.",
    );
  });
  app.get("/api/admin/scores", requireUser, admin, (req, res) => res.json([]));
  app.post("/api/admin/scores/:id/review", requireUser, admin, (req, res) =>
    fail(410, "La revisión manual está retirada."),
  );
  app.get("/api/admin/games", requireUser, admin, (req, res) =>
    res.json(all("SELECT * FROM games ORDER BY created_at DESC").map(gameInfo)),
  );
  app.put("/api/admin/games/:id", requireUser, admin, (req, res) => {
    const id = text(req.params.id, 1, 32);
    if (!/^[a-z0-9_-]+$/.test(id)) fail(400, "Identificador no válido.");
    const b = req.body,
      title = text(b.title, 1, 80),
      rom = text(b.rom, 1, 80),
      bios = b.bios ? text(b.bios, 1, 80) : null;
    if (
      !/^[a-zA-Z0-9_-]+\.zip$/.test(rom) ||
      (bios && !/^[a-zA-Z0-9_-]+\.zip$/.test(bios))
    )
      fail(400, "Usa nombres ZIP sin carpetas.");
    const max = integer(b.max_players, 1, 4),
      year = integer(b.year, 1970, 2100);
    const previous = q("SELECT * FROM games WHERE id=?", id);
    if (
      previous &&
      (previous.max_players !== max ||
        previous.rom !== rom ||
        previous.bios !== bios ||
        b.enabled === false) &&
      q("SELECT 1 FROM rooms WHERE game_id=? AND closed=0", id)
    )
      fail(
        409,
        "Cierra las salas de este juego antes de cambiar archivos o puestos.",
      );
    run(
      "INSERT INTO games VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,year=excluded.year,maker=excluded.maker,genre=excluded.genre,max_players=excluded.max_players,rom=excluded.rom,bios=excluded.bios,ra_id=excluded.ra_id,enabled=excluded.enabled,rules=excluded.rules",
      id,
      title,
      year,
      text(b.maker, 1, 60),
      text(b.genre, 1, 40),
      max,
      rom,
      bios,
      null,
      b.enabled === false ? 0 : 1,
      Date.now(),
      text(b.rules, 1, 1000),
    );
    audit(req.user.id, "game.update", id);
    res.json({ ok: true });
  });

  app.get("/api/admin/network", requireUser, admin, (req, res) => {
    let runtime = null;
    try {
      runtime = JSON.parse(
        readFileSync(join(dataDir, "network-runtime.json"), "utf8"),
      );
      if (Date.now() - runtime.updatedAt > 15000) runtime.running = false;
    } catch {}
    const settings = networkSettings(db);
    res.json({
      settings,
      addresses: localAddresses(),
      url: networkUrl(settings),
      publicUrl: settings.domain ? networkUrl(settings, true) : null,
      setupUrl: `http://${settings.lanIp}:3000`,
      runtime,
    });
  });
  app.put("/api/admin/network", requireUser, admin, (req, res) => {
    let settings;
    try {
      settings = validateNetwork(req.body);
    } catch (error) {
      fail(400, error.message);
    }
    run(
      "INSERT INTO settings(key,value) VALUES('network',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      JSON.stringify(settings),
    );
    audit(req.user.id, "network.update", settings.mode);
    res.json({ ok: true, settings });
  });
  app.get("/api/admin/status", requireUser, admin, async (req, res) =>
    res.json({
      node: process.version,
      uptime: Math.floor(process.uptime()),
      databaseBytes: statSync(join(dataDir, "arcade.sqlite")).size,
      uploadBytes: q("SELECT COALESCE(SUM(bytes),0) n FROM uploads").n,
      uploadQuotaMB: Number(process.env.UPLOAD_QUOTA_MB || 2048),
      memory: {
        total: totalmem(),
        free: freemem(),
        process: process.memoryUsage().rss,
      },
      cpu: cpus()[0]?.model || "No disponible",
      counts: {
        users: q("SELECT COUNT(*) n FROM users").n,
        sessions: q(
          "SELECT COUNT(*) n FROM sessions WHERE expires>?",
          Date.now(),
        ).n,
        rooms: q("SELECT COUNT(*) n FROM rooms WHERE closed=0").n,
        connections: io.engine.clientsCount,
        pendingScores: q(
          "SELECT COUNT(*) n FROM automatic_scores WHERE completed=0",
        ).n,
      },
      registration: q("SELECT value FROM settings WHERE key='registration'")
        .value,
      backups: await listBackups(dataDir),
      secureCookies: process.env.COOKIE_SECURE === "1" || !!req.secure,
      integrity,
      gameEngine: {
        mode: runtime ? "server" : "test",
        active: runtime?.rooms?.size || 0,
        limit: runtime?.maxRooms || 0,
      },
    }),
  );
  app.get("/api/admin/users", requireUser, admin, (req, res) =>
    res.json(
      all(
        "SELECT id,username,role,suspended,created_at FROM users ORDER BY created_at DESC LIMIT 500",
      ),
    ),
  );
  app.post(
    "/api/admin/users/:id/suspension",
    requireUser,
    admin,
    (req, res) => {
      const target = q("SELECT * FROM users WHERE id=?", req.params.id);
      if (!target) fail(404, "Usuario no encontrado.");
      if (target.id === req.user.id)
        fail(409, "No puedes suspender tu propia cuenta.");
      if (typeof req.body.suspended !== "boolean")
        fail(400, "Estado no válido.");
      if (
        target.role === "admin" &&
        req.body.suspended &&
        q("SELECT COUNT(*) n FROM users WHERE role='admin' AND suspended=0")
          .n <= 1
      )
        fail(409, "Debe quedar un administrador activo.");
      run(
        "UPDATE users SET suspended=? WHERE id=?",
        req.body.suspended ? 1 : 0,
        target.id,
      );
      if (req.body.suspended) {
        for (const s of all(
          "SELECT id FROM sessions WHERE user_id=?",
          target.id,
        ))
          purgeSession(s.id);
        run("DELETE FROM sessions WHERE user_id=?", target.id);
        for (const r of all(
          "SELECT id FROM rooms WHERE owner_id=? AND closed=0",
          target.id,
        ))
          closeRoom(r.id, req.user.id);
        for (const m of all(
          "SELECT room_id FROM members WHERE user_id=?",
          target.id,
        )) {
          revokeGame(m.room_id, target.id);
          run(
            "DELETE FROM members WHERE room_id=? AND user_id=?",
            m.room_id,
            target.id,
          );
          emitRooms(m.room_id);
        }
      }
      audit(
        req.user.id,
        req.body.suspended ? "user.suspend" : "user.restore",
        target.id,
      );
      res.json({ ok: true });
    },
  );
  app.post("/api/admin/users/:id/role", requireUser, admin, (req, res) => {
    const role = req.body.role;
    if (!["admin", "member"].includes(role)) fail(400, "Rol no válido.");
    const target = q("SELECT * FROM users WHERE id=?", req.params.id);
    if (!target) fail(404, "Usuario no encontrado.");
    if (
      target.role === "admin" &&
      role === "member" &&
      !target.suspended &&
      q("SELECT COUNT(*) n FROM users WHERE role='admin' AND suspended=0").n <=
        1
    )
      fail(409, "Debe quedar un administrador activo.");
    run("UPDATE users SET role=? WHERE id=?", role, target.id);
    audit(req.user.id, "user.role." + role, target.id);
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/users/:id/revoke-sessions",
    requireUser,
    admin,
    (req, res) => {
      for (const s of all(
        "SELECT id FROM sessions WHERE user_id=?",
        req.params.id,
      ))
        purgeSession(s.id);
      run("DELETE FROM sessions WHERE user_id=?", req.params.id);
      audit(req.user.id, "user.revoke-sessions", req.params.id);
      res.json({ ok: true });
    },
  );
  app.put("/api/admin/settings", requireUser, admin, (req, res) => {
    if (!["open", "closed"].includes(req.body.registration))
      fail(400, "Configuración no válida.");
    run(
      "UPDATE settings SET value=? WHERE key='registration'",
      req.body.registration,
    );
    audit(req.user.id, "registration." + req.body.registration);
    res.json({ ok: true });
  });
  app.get("/api/admin/rooms", requireUser, admin, (req, res) =>
    res.json(
      all("SELECT * FROM rooms WHERE closed=0 ORDER BY created_at DESC").map(
        roomInfo,
      ),
    ),
  );
  app.post("/api/admin/rooms/:id/close", requireUser, admin, (req, res) => {
    if (!q("SELECT 1 FROM rooms WHERE id=? AND closed=0", req.params.id))
      fail(404, "Sala no encontrada.");
    closeRoom(req.params.id, req.user.id);
    res.json({ ok: true });
  });
  app.get("/api/admin/messages", requireUser, admin, (req, res) =>
    res.json(
      all(
        "SELECT m.id,m.room_id,m.body,m.image_id imageId,m.created_at,u.username,r.name roomName FROM messages m JOIN users u ON m.user_id=u.id JOIN rooms r ON r.id=m.room_id ORDER BY m.id DESC LIMIT 100",
      ),
    ),
  );
  app.delete("/api/admin/messages/:id", requireUser, admin, (req, res) => {
    const message = q("SELECT * FROM messages WHERE id=?", req.params.id);
    if (!message) fail(404, "Mensaje no encontrado.");
    run("DELETE FROM messages WHERE id=?", message.id);
    audit(req.user.id, "message.delete", String(message.id));
    io.to(`room:${message.room_id}`).emit("chat:refresh");
    res.json({ ok: true });
  });
  app.get("/api/admin/audit", requireUser, admin, (req, res) =>
    res.json(
      all(
        "SELECT a.*,u.username FROM audit a LEFT JOIN users u ON a.actor=u.id ORDER BY a.id DESC LIMIT 100",
      ),
    ),
  );
  app.post(
    "/api/admin/backups",
    requireUser,
    admin,
    limiter(2, 60000),
    async (req, res) => {
      if (backingUp) fail(409, "Ya hay una copia de seguridad en curso.");
      backingUp = true;
      try {
        const result = await createBackup(db, dataDir);
        audit(req.user.id, "backup.create", result.filename);
        res.status(201).json(result);
      } catch (e) {
        fail(
          500,
          e.message ===
            "Se conservan hasta 10 copias. Retira alguna desde el servidor antes de crear otra."
            ? e.message
            : "No se pudo crear la copia. Revisa el espacio disponible y los permisos.",
        );
      } finally {
        backingUp = false;
      }
    },
  );
  app.get("/api/admin/backups/:filename", requireUser, admin, (req, res) => {
    const name = req.params.filename;
    if (
      !/^arcade-[\dTZ-]+\.tar\.gz$/.test(name) ||
      !existsSync(join(dataDir, "backups", name))
    )
      fail(404, "Copia no encontrada.");
    audit(req.user.id, "backup.download", name);
    res.download(join(dataDir, "backups", name), name, { dotfiles: "allow" });
  });
  app.put(
    "/api/profile/password",
    requireUser,
    limiter(5, 15 * 60000),
    async (req, res) => {
      const current = text(req.body.current, 1, 200),
        password = text(req.body.password, 12, 200);
      if (!(await passwordMatches(current, req.user.password)))
        fail(403, "La contraseña actual no es correcta.");
      const stored = await passwordHash(password);
      run("UPDATE users SET password=? WHERE id=?", stored, req.user.id);
      const others = all(
        "SELECT id FROM sessions WHERE user_id=? AND id<>?",
        req.user.id,
        req.user.session_id,
      );
      for (const s of others) {
        run("DELETE FROM sessions WHERE id=?", s.id);
        purgeSession(s.id);
      }
      audit(req.user.id, "account.password", req.user.id);
      res.json({ ok: true });
    },
  );
  app.get("/api/profile/overview", requireUser, (req, res) => {
    const uid = req.user.id;
    const activity = q(
      "SELECT COUNT(DISTINCT game_id) games,COUNT(DISTINCT room_id) participations FROM plays WHERE user_id=?",
      uid,
    );
    const totals = { pending: 0, approved: 0, rejected: 0 };
    for (const row of all(
      "SELECT CASE WHEN completed=1 THEN 'approved' ELSE 'pending' END status,COUNT(*) n FROM automatic_scores WHERE user_id=? GROUP BY completed",
      uid,
    ))
      totals[row.status] = row.n;
    res.json({
      memberSince: req.user.created_at,
      games: activity.games,
      participations: activity.participations,
      friends: q(
        "SELECT COUNT(*) n FROM friends WHERE status='accepted' AND (sender=? OR recipient=?)",
        uid,
        uid,
      ).n,
      submissions: totals,
      bestScores: all(
        "SELECT g.id gameId,g.title,MAX(s.value) value FROM automatic_scores s JOIN games g ON g.id=s.game_id WHERE s.user_id=? AND s.completed=1 GROUP BY g.id ORDER BY g.title LIMIT 100",
        uid,
      ).map((score) => ({
        ...score,
        scoreUnit: gameProfile(score.gameId).scoreUnit,
      })),
      recentActivity: all(
        "SELECT g.id gameId,g.title,MAX(p.created_at) lastPlayed FROM plays p JOIN games g ON g.id=p.game_id WHERE p.user_id=? GROUP BY p.room_id,g.id ORDER BY lastPlayed DESC LIMIT 5",
        uid,
      ),
    });
  });
  app.put("/api/profile/theme", requireUser, (req, res) => {
    if (!["light", "dark", "system"].includes(req.body.theme))
      fail(400, "Tema no válido.");
    run("UPDATE users SET theme=? WHERE id=?", req.body.theme, req.user.id);
    medals.record(req.user.id, "theme", "saved");
    notifyMedals(req.user.id);
    res.json({ theme: req.body.theme });
  });
  app.put("/api/profile/gamepad", requireUser, (req, res) => {
    const keys = [
        "up",
        "down",
        "left",
        "right",
        "a",
        "b",
        "c",
        "d",
        "coin",
        "start",
      ],
      buttons = {};
    for (const key of keys) buttons[key] = integer(req.body[key], 0, 31);
    if (new Set(Object.values(buttons)).size !== keys.length)
      fail(400, "Asigna un botón diferente a cada acción.");
    run(
      "UPDATE users SET gamepad_controls=? WHERE id=?",
      JSON.stringify(buttons),
      req.user.id,
    );
    notifyMedals(req.user.id);
    res.json({ gamepadControls: buttons });
  });
  app.put("/api/profile/controls", requireUser, (req, res) => {
    const allowed = [
      "up",
      "down",
      "left",
      "right",
      "a",
      "b",
      "c",
      "d",
      "coin",
      "start",
    ];
    const controls = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined)
        controls[key] = text(req.body[key], 1, 30);
    }
    if (
      new Set(Object.values(controls)).size !== Object.values(controls).length
    )
      fail(400, "Asigna una tecla diferente a cada acción.");
    run(
      "UPDATE users SET controls=? WHERE id=?",
      JSON.stringify(controls),
      req.user.id,
    );
    notifyMedals(req.user.id);
    res.json({ controls });
  });
  app.all("/api/profile/retroachievements", requireUser, (_req, res) =>
    res.status(410).json({
      error:
        "La integración anterior se ha retirado. Tus medallas están en tu perfil.",
    }),
  );
  app.get("/api/profile/medals", requireUser, (req, res) =>
    res.json(medals.snapshot(req.user.id)),
  );
  app.get("/api/medals/champion/:id.svg", (req, res) => {
    const g = q("SELECT id,title FROM games WHERE id=?", req.params.id);
    if (!g) fail(404, "Juego no encontrado.");
    res
      .type("image/svg+xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(medalSvg(championMedal(g)));
  });

  app.get("/api/rooms/:id/emulator", requireUser, (req, res) => {
    const r = roomFor(req.params.id, req.user, true),
      m = member(r.id, req.user.id);
    if (!m?.slot)
      fail(403, "Los miembros del chat no pueden acceder a los controles.");
    const g = gameInfo(game(r.game_id));
    if (!g.ready || !g.emulatorReady)
      fail(
        409,
        "Faltan archivos del juego o del emulador. Consulta el catálogo de administración.",
      );
    res.json({
      roomId: r.id,
      game: g,
      host: !runtime && r.owner_id === req.user.id,
      serverHosted: !!runtime,
      slot: m.slot,
      romUrl: `/api/rooms/${r.id}/rom/${g.rom}`,
      biosUrl: g.bios ? `/api/rooms/${r.id}/bios/${g.bios}` : null,
      controls: JSON.parse(req.user.controls),
      gamepadControls: JSON.parse(req.user.gamepad_controls || "{}"),
    });
  });
  for (const kind of ["rom", "bios"])
    app.get(
      [`/api/rooms/:id/${kind}`, `/api/rooms/:id/${kind}/:filename`],
      requireUser,
      (req, res) => {
        if (runtime) fail(403, "Los juegos se ejecutan en el servidor.");
        const r = roomFor(req.params.id, req.user, true);
        if (!member(r.id, req.user.id)?.slot)
          fail(403, "Se necesita un puesto de jugador.");
        const filename = game(r.game_id)[kind];
        if (
          !filename ||
          (req.params.filename && req.params.filename !== filename) ||
          !existsSync(join(romDir, filename))
        )
          fail(404, "Archivo no encontrado.");
        res.set("Cache-Control", "private, no-store");
        res.sendFile(join(romDir, filename), { dotfiles: "allow" });
      },
    );

  io.use((socket, next) => {
    const u = session(socket.request);
    if (!u || socket.handshake.auth?.csrf !== u.csrf)
      return next(new Error("Inicia sesión de nuevo."));
    if (
      [...io.sockets.sockets.values()].filter((s) => s.data.userId === u.id)
        .length >= 6
    )
      return next(
        new Error("Cierra alguna pestaña de la comunidad antes de abrir otra."),
      );
    socket.data.userId = u.id;
    socket.data.sessionId = u.session_id;
    next();
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
    let budget = { count: 0, start: Date.now() };
    socket.use((packet, next) => {
      if (!session(socket.request)) {
        socket.disconnect(true);
        return next(new Error("Sesión caducada."));
      }
      if (Date.now() - budget.start > 1000)
        budget = { count: 0, start: Date.now() };
      if (++budget.count > 300)
        return next(new Error("Demasiadas peticiones."));
      next();
    });
    const user = () => session(socket.request);
    const handler = (name, fn) =>
      socket.on(name, (payload = {}, ack = () => {}) => {
        try {
          ack({ ok: true, ...fn(payload) });
        } catch (e) {
          ack({
            ok: false,
            error: e.status ? e.message : "No se pudo completar la operación.",
          });
        }
      });
    handler("room:watch", ({ roomId }) => {
      const r = roomFor(String(roomId), user(), true);
      socket.join(`room:${r.id}`);
      return {};
    });
    handler("room:unwatch", ({ roomId }) => {
      socket.leave(`room:${String(roomId)}`);
      return {};
    });
    handler("game:join", ({ roomId }) => {
      const u = user(),
        r = roomFor(String(roomId), u, true),
        m = member(r.id, u.id),
        g = gameInfo(game(r.game_id));
      if (!m?.slot) fail(403, "No tienes un puesto de jugador.");
      if (!g.ready || !g.emulatorReady) fail(409, "Faltan archivos del juego.");
      if (socket.data.gameRoom && socket.data.gameRoom !== r.id)
        fail(409, "Cierra la otra partida antes de abrir esta.");
      const key = `${r.id}:${u.id}`,
        old = gameSockets.get(key);
      if (old && old.socketId !== socket.id)
        fail(409, "Ya tienes esta partida abierta en otra pestaña.");
      socket.data.gameRoom = r.id;
      gameSockets.set(key, { socketId: socket.id, slot: m.slot, ready: false });
      run(
        "INSERT INTO plays VALUES(?,?,?,?,?)",
        randomUUID(),
        u.id,
        r.game_id,
        r.id,
        Date.now(),
      );
      io.emit("lobby:changed");
      const host = gameSockets.get(`${r.id}:${r.owner_id}`);
      if (runtime) {
        if (runtime.status(r.id).ready)
          runtime
            .deliver(r.id, "game:peer", { userId: u.id, slot: m.slot })
            .catch(() => {});
        else
          runtime
            .ensure(r, g)
            .catch((e) =>
              io.to(socket.id).emit("game:error", { error: e.message }),
            );
        return {
          host: false,
          hostId: "server",
          hostReady: runtime.status(r.id).ready,
          slot: m.slot,
        };
      }
      if (u.id !== r.owner_id && host?.ready)
        io.to(host.socketId).emit("game:peer", { userId: u.id, slot: m.slot });
      return {
        host: u.id === r.owner_id,
        hostId: r.owner_id,
        hostReady: !!host?.ready,
        slot: m.slot,
      };
    });
    handler("game:ready", () => {
      if (runtime)
        fail(403, "Solo el motor del servidor inicia la transmisión.");
      const u = user(),
        rid = socket.data.gameRoom;
      if (!rid) fail(400, "No hay partida.");
      const r = roomFor(rid, u, true);
      if (r.owner_id !== u.id)
        fail(403, "Solo el anfitrión puede iniciar la transmisión.");
      const entry = gameSockets.get(`${rid}:${u.id}`);
      if (!entry || entry.socketId !== socket.id)
        fail(403, "Partida no válida.");
      entry.ready = true;
      for (const [key, guest] of gameSockets)
        if (key.startsWith(rid + ":") && key !== `${rid}:${u.id}`)
          socket.emit("game:peer", {
            userId: key.slice(rid.length + 1),
            slot: guest.slot,
          });
      emitRooms(rid);
      return {};
    });
    handler("game:signal", ({ target, signal }) => {
      const u = user(),
        rid = socket.data.gameRoom;
      if (!rid) fail(403, "No hay partida.");
      const r = roomFor(rid, u, true);
      if (runtime) {
        const source = gameSockets.get(`${rid}:${u.id}`);
        if (
          target !== "server" ||
          !member(rid, u.id)?.slot ||
          source?.socketId !== socket.id
        )
          fail(403, "Señal no permitida.");
        if (!signal || JSON.stringify(signal).length > 24000)
          fail(400, "Señal no válida.");
        runtime
          .deliver(rid, "game:signal", {
            from: u.id,
            slot: member(rid, u.id).slot,
            signal,
          })
          .catch(() => {});
        return {};
      }
      if (!member(rid, u.id)?.slot || !member(rid, String(target))?.slot)
        fail(403, "Puesto no válido.");
      if (r.owner_id !== u.id && r.owner_id !== target)
        fail(403, "Señal no permitida.");
      const entry = gameSockets.get(`${rid}:${target}`),
        source = gameSockets.get(`${rid}:${u.id}`);
      if (!entry || source?.socketId !== socket.id)
        fail(409, "El otro jugador aún no está conectado.");
      if (!signal || JSON.stringify(signal).length > 24000)
        fail(400, "Señal no válida.");
      io.to(entry.socketId).emit("game:signal", {
        from: u.id,
        slot: member(rid, u.id).slot,
        signal,
      });
      return {};
    });
    handler("game:input", ({ index, value }) => {
      const inputBudget = socket.data.inputBudget;
      if (!inputBudget || Date.now() - inputBudget.time >= 1000)
        socket.data.inputBudget = { time: Date.now(), count: 1 };
      else if (++inputBudget.count > 120)
        fail(429, "Demasiados controles por segundo.");
      const u = user(),
        rid = socket.data.gameRoom;
      if (!rid) fail(403, "No hay partida.");
      const r = roomFor(rid, u, true),
        m = member(rid, u.id),
        entry = gameSockets.get(`${rid}:${u.id}`);
      if (!m?.slot || entry?.socketId !== socket.id)
        fail(403, "No tienes controles.");
      integer(index, 0, 23);
      if (index >= 16 && !gameProfile(r.game_id).analogInputs?.includes(index))
        fail(400, "Ese eje no está disponible en este juego.");
      integer(value, 0, 1);
      if (runtime) {
        try {
          runtime.input(rid, u.id, m.slot, index, value);
        } catch (e) {
          fail(409, e.message);
        }
        return {};
      }
      const host = gameSockets.get(`${rid}:${r.owner_id}`);
      if (host?.ready)
        io.to(host.socketId).emit("game:input", { slot: m.slot, index, value });
      return {};
    });
    handler("game:leave", () => {
      const rid = socket.data.gameRoom;
      if (rid) {
        revokeGame(rid, socket.data.userId);
        socket.data.gameRoom = null;
        emitRooms(rid);
      }
      return {};
    });
    socket.on("disconnect", () => {
      const rid = socket.data.gameRoom;
      if (
        rid &&
        gameSockets.get(`${rid}:${socket.data.userId}`)?.socketId === socket.id
      ) {
        revokeGame(rid, socket.data.userId);
        emitRooms(rid);
      }
    });
  });
  app.use(
    "/emulator",
    express.static(join(root, "public/emulator"), { index: false }),
  );
  app.use(express.static(join(root, "public"), { index: false }));
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Ruta no encontrada." }),
  );
  if (existsSync(join(root, "dist/index.html"))) {
    app.use(express.static(join(root, "dist")));
    app.get("/{*path}", (req, res) =>
      res.sendFile(join(root, "dist/index.html")),
    );
  }
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError)
      return res
        .status(400)
        .json({ error: "La imagen debe ocupar como máximo 4 MB." });
    if (err?.type === "entity.parse.failed")
      return res.status(400).json({ error: "Petición no válida." });
    if (
      err.code?.startsWith("SQLITE_CONSTRAINT") ||
      String(err.message).includes("UNIQUE constraint")
    )
      return res.status(409).json({
        error: "Este registro ya existe o el puesto ya está ocupado.",
      });
    if (!err.status) console.error("Error interno:", err.code || err.name);
    res.status(err.status || 500).json({
      error: err.status ? err.message : "No se pudo completar la operación.",
    });
  });
  const cleanup = setInterval(() => {
    run("DELETE FROM sessions WHERE expires<?", Date.now());
    run("DELETE FROM challenges WHERE expires<?", Date.now());
    for (const s of io.sockets.sockets.values())
      if (!session(s.request)) s.disconnect(true);
  }, 60000);
  cleanup.unref();
  return {
    app,
    http,
    io,
    db,
    dataDir,
    setupCode,
    runtime,
    close: async () => {
      clearInterval(cleanup);
      await runtime?.close();
      const closed = new Promise((resolve) => io.close(resolve));
      http.closeAllConnections();
      await closed;
      if (http.listening) await new Promise((resolve) => http.close(resolve));
      db.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const arcade = createArcade();
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "127.0.0.1";
  arcade.http.listen(port, host, () => {
    console.log(`Salón Arcade: http://${host}:${port}`);
    if (!arcade.db.prepare("SELECT 1 FROM users LIMIT 1").get())
      console.log(`Código para crear el administrador: ${arcade.setupCode}`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    arcade
      .close()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Error al cerrar el servidor:", error.message);
        process.exit(1);
      });
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);
  process.on("message", (message) => {
    if (message?.type === "shutdown") shutdown();
  });
}
