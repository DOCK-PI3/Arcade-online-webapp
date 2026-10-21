import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { io as clientSocket } from "socket.io-client";
import sharp from "sharp";
import { list as tarList } from "tar";
import { createArcade } from "../server/index.js";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { emulatorIntegrity } from "../server/integrity.js";
import { createHash } from "node:crypto";
import { GameRuntime } from "../server/game-runtime.js";
import { readScores, scoreLayouts } from "../server/score-readers.js";
import { readFile } from "node:fs/promises";
const execFile = promisify(execFileCallback);
process.env.ARCADE_TEST_MUTE_AUDIO = "1";

let arcade, base, directory, admin, bob, carol, lastBackup;
const clients = [];
class Client {
  cookie = "";
  csrf = "";
  user = null;
  async request(path, method = "GET", body, headers = {}) {
    const multipart = body instanceof FormData;
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.csrf ? { "X-CSRF-Token": this.csrf } : {}),
        ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    });
    if (response.headers.get("set-cookie"))
      this.cookie = response.headers.get("set-cookie").split(";")[0];
    const type = response.headers.get("content-type");
    const data = type?.includes("json")
      ? await response.json()
      : await response.arrayBuffer();
    return { status: response.status, data, headers: response.headers };
  }
  async register(username) {
    const ch = await this.request("/auth/challenge");
    const values = ch.data.question.match(/\d+/g).map(Number);
    const r = await this.request("/auth/register", "POST", {
      username,
      password: "Contraseña segura de prueba 123",
      challengeId: ch.data.id,
      answer: String(values[0] + values[1]),
      setupCode: "test-setup",
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    this.csrf = r.data.csrf;
    this.user = r.data.user;
    return this;
  }
  async socket() {
    const socket = clientSocket(base, {
      extraHeaders: { Cookie: this.cookie },
      auth: { csrf: this.csrf },
      reconnection: false,
      forceNew: true,
    });
    clients.push(socket);
    await new Promise((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
    return socket;
  }
}
const emit = (s, event, payload = {}) =>
  new Promise((r, j) =>
    s
      .timeout(3000)
      .emit(event, payload, (err, data) => (err ? j(err) : r(data))),
  );
before(async () => {
  await mkdir(resolve(".cache/tests"), { recursive: true });
  directory = await mkdtemp(resolve(".cache/tests/run-"));
  arcade = createArcade({
    dataDir: directory,
    setupCode: "test-setup",
    disableRateLimits: true,
    runtime: false,
  });
  await new Promise((r) => arcade.http.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + arcade.http.address().port;
  admin = await new Client().register("AdminTest");
  bob = await new Client().register("BobTest");
  carol = await new Client().register("CarolTest");
});
after(async () => {
  for (const c of clients) c.disconnect();
  await arcade.close();
  assert.ok(
    directory.startsWith(resolve(".cache/tests") + "\\") ||
      directory.startsWith(resolve(".cache/tests") + "/"),
  );
  await rm(directory, { recursive: true, force: true });
});

test("first administrator, protected passwords, cookies and persistent authentication", async () => {
  assert.equal(admin.user.role, "admin");
  assert.equal(bob.user.role, "member");
  const stored = arcade.db
    .prepare("SELECT password FROM users WHERE id=?")
    .get(admin.user.id).password;
  assert.ok(!stored.includes("Contraseña"));
  assert.equal((await bob.request("/auth/me")).data.user.username, "BobTest");
  const r = await new Client().request("/auth/login", "POST", {
    username: "BobTest",
    password: "Contraseña segura de prueba 123",
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  const parallel = new DatabaseSync(join(directory, "arcade.sqlite"));
  assert.equal(parallel.prepare("SELECT COUNT(*) n FROM users").get().n, 3);
  parallel.close();
});

test("medal collection is authenticated, account-scoped and cannot be forged by a client", async () => {
  const owner = await new Client().register("MedalOwner"),
    other = await new Client().register("MedalOther");
  assert.equal((await new Client().request("/profile/medals")).status, 401);
  const initial = (await owner.request("/profile/medals")).data;
  assert.equal(initial.generalCount, 50);
  assert.equal(initial.catalogSize, 46);
  assert.equal(initial.total, 96);
  assert.equal(initial.earned, 0);
  const room = (
    await owner.request("/rooms", "POST", {
      gameId: "columns",
      name: "Vitrina privada",
      visibility: "public",
    })
  ).data;
  const earned = (await owner.request("/profile/medals")).data;
  assert.ok(earned.medals.find((m) => m.id === "rooms-1").earnedAt);
  assert.equal(
    (await other.request("/profile/medals?userId=" + owner.user.id)).data
      .earned,
    0,
  );
  assert.ok(
    (
      await other.request("/profile/medals", "POST", {
        medalId: "champion-columns",
        userId: owner.user.id,
        progress: 100,
      })
    ).status >= 400,
  );
  assert.equal((await other.request("/profile/medals")).data.earned, 0);
  await owner.request("/rooms/" + room.id + "/leave", "POST");
});

test("validated UI actions award private medal notifications and room visits remain unique", async () => {
  const owner = await new Client().register("MedalHost"),
    guest = await new Client().register("MedalGuest");
  const a = await owner.socket(),
    b = await guest.socket(),
    ownerEvents = [],
    guestEvents = [];
  a.on("medals:earned", (items) => ownerEvents.push(...items));
  b.on("medals:earned", (items) => guestEvents.push(...items));
  const room = (
    await owner.request("/rooms", "POST", {
      gameId: "columns",
      name: "Medallas en sala",
      visibility: "public",
    })
  ).data;
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(ownerEvents.some((m) => m.id === "rooms-1"));
  assert.deepEqual(guestEvents, []);
  for (let n = 0; n < 2; n++) {
    await guest.request("/rooms/" + room.id + "/join", "POST", {});
    await guest.request("/rooms/" + room.id + "/messages", "POST", {
      body: "Hola al salón",
    });
    await guest.request("/rooms/" + room.id + "/leave", "POST", {});
  }
  let data = (await guest.request("/profile/medals")).data;
  assert.equal(data.medals.find((m) => m.id === "visits-5").progress, 1);
  assert.ok(data.medals.find((m) => m.id === "chatRooms-1").earnedAt);
  await guest.request("/games/columns/scores");
  await guest.request("/games/columns/scores");
  data = (await guest.request("/profile/medals")).data;
  assert.equal(data.medals.find((m) => m.id === "boards-all").progress, 1);
  assert.equal(
    (await guest.request("/profile/theme", "PUT", { theme: "invalid" })).status,
    400,
  );
  assert.equal(data.medals.find((m) => m.id === "theme-1").earnedAt, null);
  await guest.request("/profile/theme", "PUT", { theme: "dark" });
  assert.ok(
    (await guest.request("/profile/medals")).data.medals.find(
      (m) => m.id === "theme-1",
    ).earnedAt,
  );
  await owner.request("/rooms/" + room.id + "/leave", "POST");
});

test("external achievement endpoints are retired and champion images work for newly added games", async () => {
  const user = await new Client().register("MedalRetired");
  for (const method of ["GET", "PUT", "DELETE"])
    assert.equal(
      (
        await user.request(
          "/profile/retroachievements",
          method,
          method === "PUT"
            ? { username: "Old", apiKey: "unused-private-secret" }
            : undefined,
        )
      ).status,
      410,
    );
  const me = await user.request("/auth/me");
  assert.ok(!Object.hasOwn(me.data.user, "raConnected"));
  assert.ok(!Object.hasOwn(me.data.user, "raName"));
  assert.ok(
    !me.headers
      .get("content-security-policy")
      .includes("retroachievements.org"),
  );
  assert.equal(
    arcade.db
      .prepare("SELECT ra_secret FROM users WHERE id=?")
      .get(user.user.id).ra_secret,
    null,
  );
  const response = await admin.request("/admin/games/medal-future", "PUT", {
    title: "Juego nuevo",
    year: 1999,
    maker: "Prueba",
    genre: "Acción",
    max_players: 2,
    rom: "future.zip",
    enabled: true,
    rules: "Prueba local",
  });
  assert.equal(response.status, 200);
  const collection = (await user.request("/profile/medals")).data;
  assert.equal(collection.total, 97);
  const future = collection.medals.find(
    (m) => m.id === "champion-medal-future",
  );
  assert.ok(future);
  const image = await user.request("/medals/champion/medal-future.svg");
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/svg\+xml/);
  const svg = Buffer.from(image.data).toString();
  assert.ok(svg.includes("MEDAL-FUTURE"));
  assert.ok(!svg.includes("<script>"));
  await admin.request("/admin/games/medal-future", "PUT", {
    title: "Juego nuevo",
    year: 1999,
    maker: "Prueba",
    genre: "Acción",
    max_players: 2,
    rom: "future.zip",
    enabled: false,
    rules: "Prueba local",
  });
});
test("antispam challenge expires, is one-use, honeypot rejects and setup code is not exposed", async () => {
  const c = new Client(),
    ch = (await c.request("/auth/challenge")).data;
  const nums = ch.question.match(/\d+/g).map(Number),
    b = {
      username: "ReplayTest",
      password: "Una contraseña suficientemente larga",
      challengeId: ch.id,
      answer: String(nums[0] + nums[1]),
      website: "spam.example",
    };
  assert.equal((await c.request("/auth/register", "POST", b)).status, 400);
  b.website = "";
  b.answer = "incorrecta";
  assert.equal((await c.request("/auth/register", "POST", b)).status, 400);
  b.answer = String(nums[0] + nums[1]);
  assert.equal((await c.request("/auth/register", "POST", b)).status, 400);
  assert.ok(
    !JSON.stringify((await c.request("/auth/me")).data).includes("test-setup"),
  );
});
test("CSRF, cross-origin requests and administrator routes are protected", async () => {
  assert.equal(
    (
      await bob.request(
        "/rooms",
        "POST",
        { gameId: "columns", name: "Sin token", visibility: "public" },
        { "X-CSRF-Token": "wrong" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await bob.request(
        "/rooms",
        "POST",
        { gameId: "columns", name: "Otro origen", visibility: "public" },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal((await bob.request("/admin/status")).status, 403);
  assert.equal((await new Client().request("/admin/status")).status, 401);
});
test("public rooms, atomic slot limits, chat-only users and private ROM protection", async () => {
  const r = (
    await admin.request("/rooms", "POST", {
      gameId: "columns",
      name: "Sala de prueba",
      visibility: "public",
    })
  ).data;
  assert.equal(r.members[0].slot, 1);
  assert.equal(
    (await bob.request("/rooms/" + r.id + "/join", "POST")).status,
    200,
  );
  await carol.request("/rooms/" + r.id + "/join", "POST");
  const seats = await Promise.all([
    bob.request("/rooms/" + r.id + "/seat", "POST", { play: true }),
    carol.request("/rooms/" + r.id + "/seat", "POST", { play: true }),
  ]);
  assert.deepEqual(seats.map((x) => x.status).sort(), [200, 409]);
  const full = (await admin.request("/rooms/" + r.id)).data;
  assert.equal(full.members.filter((m) => m.slot).length, 2);
  assert.equal(full.members.length, 3);
  const spectator =
    full.members.find((m) => m.slot === null).id === bob.user.id ? bob : carol;
  assert.equal(
    (await spectator.request("/rooms/" + r.id + "/emulator")).status,
    403,
  );
  assert.equal(
    (await spectator.request("/rooms/" + r.id + "/rom")).status,
    403,
  );
  assert.equal(
    (
      await spectator.request("/rooms/" + r.id + "/messages", "POST", {
        body: "Hola <script>alert(1)</script> https://youtu.be/dQw4w9WgXcQ",
      })
    ).status,
    201,
  );
  const messages = (await spectator.request("/rooms/" + r.id + "/messages"))
    .data;
  assert.ok(messages[0].body.includes("<script>"));
  const s = await spectator.socket();
  assert.equal((await emit(s, "room:watch", { roomId: r.id })).ok, true);
  assert.equal((await emit(s, "game:join", { roomId: r.id })).ok, false);
  assert.equal((await emit(s, "game:input", { index: 0, value: 1 })).ok, false);
});
test("invitation rooms are hidden and invitation links are revocable and single-use", async () => {
  const room = (
    await admin.request("/rooms", "POST", {
      gameId: "contra",
      name: "Solo invitados",
      visibility: "invite",
    })
  ).data;
  assert.equal((await bob.request("/rooms/" + room.id)).status, 403);
  assert.ok(
    !(await bob.request("/home")).data.rooms.some((r) => r.id === room.id),
  );
  const unauthorized = await bob.socket();
  assert.equal(
    (await emit(unauthorized, "room:watch", { roomId: room.id })).ok,
    false,
  );
  const inv = (await admin.request("/rooms/" + room.id + "/invites", "POST"))
    .data;
  await admin.request("/rooms/" + room.id + "/invites/" + inv.id, "DELETE");
  assert.equal(
    (
      await bob.request("/rooms/" + room.id + "/join", "POST", {
        invitation: inv.token,
      })
    ).status,
    403,
  );
  const valid = (await admin.request("/rooms/" + room.id + "/invites", "POST"))
    .data;
  assert.equal(
    (
      await bob.request("/rooms/" + room.id + "/join", "POST", {
        invitation: valid.token,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await carol.request("/rooms/" + room.id + "/join", "POST", {
        invitation: valid.token,
      })
    ).status,
    403,
  );
  await admin.request("/rooms/" + room.id + "/leave", "POST");
});
test("mutual friendship grants entry, pending friendship does not", async () => {
  await admin.request("/friends", "POST", { userId: bob.user.id });
  const room = (
    await admin.request("/rooms", "POST", {
      gameId: "contra",
      name: "Entre amigos",
      visibility: "friends",
    })
  ).data;
  assert.equal(
    (await bob.request("/rooms/" + room.id + "/join", "POST")).status,
    403,
  );
  assert.equal(
    (await bob.request("/friends/" + admin.user.id + "/accept", "POST")).status,
    200,
  );
  assert.equal(
    (await bob.request("/rooms/" + room.id + "/join", "POST")).status,
    200,
  );
  assert.equal(
    (await carol.request("/rooms/" + room.id + "/join", "POST")).status,
    403,
  );
  await admin.request("/rooms/" + room.id + "/leave", "POST");
});
test("images are restricted to room chat and manual score submissions are retired", async () => {
  const room = (
    await bob.request("/rooms", "POST", {
      gameId: "columns",
      name: "Imágenes de chat",
      visibility: "public",
    })
  ).data;
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#2459ce" },
  })
    .png()
    .toBuffer();
  const form = () => {
    const f = new FormData();
    f.append("image", new Blob([image], { type: "image/png" }), "image.png");
    return f;
  };
  assert.equal(
    (await bob.request("/images?game=columns", "POST", form())).status,
    400,
  );
  const uploaded = await bob.request("/images?room=" + room.id, "POST", form());
  assert.equal(uploaded.status, 201);
  assert.equal(
    (await carol.request("/images/" + uploaded.data.id)).status,
    403,
  );
  await carol.request("/rooms/" + room.id + "/join", "POST");
  assert.equal(
    (await carol.request("/images/" + uploaded.data.id)).status,
    200,
  );
  assert.equal(
    (
      await bob.request("/games/columns/scores", "POST", {
        value: 999999,
        imageId: uploaded.data.id,
        note: "fake",
      })
    ).status,
    410,
  );
  assert.equal(
    (
      await bob.request("/admin/scores/fake/review", "POST", {
        status: "approved",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.request("/admin/scores/fake/review", "POST", {
        status: "approved",
      })
    ).status,
    410,
  );
  const malicious = new FormData();
  malicious.append(
    "image",
    new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ],
      { type: "image/svg+xml" },
    ),
    "bad.svg",
  );
  assert.equal(
    (await bob.request("/images?room=" + room.id, "POST", malicious)).status,
    400,
  );
  await bob.request("/rooms/" + room.id + "/leave", "POST");
});

test("administration can pause registration, close private rooms and preserves an active administrator", async () => {
  assert.equal(
    (await admin.request("/admin/settings", "PUT", { registration: "closed" }))
      .status,
    200,
  );
  assert.equal(
    (await new Client().request("/auth/register", "POST", {})).status,
    403,
  );
  await admin.request("/admin/settings", "PUT", { registration: "open" });
  assert.equal(
    (
      await admin.request("/admin/users/" + admin.user.id + "/role", "POST", {
        role: "member",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await admin.request(
        "/admin/users/" + admin.user.id + "/suspension",
        "POST",
        { suspended: true },
      )
    ).status,
    409,
  );
});
test("backup includes consistent database, encryption key and uploads, without ROMs", async () => {
  const backup = await admin.request("/admin/backups", "POST");
  assert.equal(backup.status, 201, JSON.stringify(backup.data));
  lastBackup = backup.data.filename;
  const entries = [];
  await tarList({
    file: join(directory, "backups", backup.data.filename),
    onReadEntry: (e) => {
      entries.push(e.path);
      e.resume();
    },
  });
  assert.ok(entries.some((x) => x.endsWith(".sqlite")));
  assert.ok(entries.some((x) => x.endsWith("encryption-key")));
  assert.ok(entries.some((x) => x.endsWith(".webp")));
  assert.ok(!entries.some((x) => x.includes("/roms/")));
  assert.equal(
    (await bob.request("/admin/backups/" + backup.data.filename)).status,
    403,
  );
  assert.equal(
    (await admin.request("/admin/backups/" + backup.data.filename)).status,
    200,
  );
});
test("restoration checks database integrity, clears sessions and never overwrites an existing directory", async () => {
  const destination = join(directory, "restored");
  const backup = join(directory, "backups", lastBackup);
  await execFile(process.execPath, [
    "scripts/restore-backup.mjs",
    backup,
    destination,
  ]);
  const restored = new DatabaseSync(join(destination, "arcade.sqlite"));
  assert.equal(restored.prepare("PRAGMA quick_check").get().quick_check, "ok");
  assert.equal(restored.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
  assert.ok(restored.prepare("SELECT COUNT(*) n FROM users").get().n >= 3);
  restored.close();
  await assert.rejects(() =>
    execFile(process.execPath, [
      "scripts/restore-backup.mjs",
      backup,
      destination,
    ]),
  );
});
test("four-player capacity and input authorization use server assigned slots", async () => {
  const peers = await Promise.all(
    ["QuadA", "QuadB", "QuadC", "QuadD"].map((name) =>
      new Client().register(name),
    ),
  );
  const definition = {
    title: "Fixture de cuatro puestos",
    year: 1990,
    maker: "Test",
    genre: "Test",
    max_players: 4,
    rom: "quad.zip",
    rules: "Fixture de autorización, no se ejecuta el núcleo.",
  };
  assert.equal(
    (await admin.request("/admin/games/quad", "PUT", definition)).status,
    200,
  );
  await writeFile(join(directory, "roms/quad.zip"), "authorization fixture");
  const room = (
    await admin.request("/rooms", "POST", {
      gameId: "quad",
      name: "Cuatro puestos",
      visibility: "public",
    })
  ).data;
  for (const peer of peers)
    await peer.request("/rooms/" + room.id + "/join", "POST");
  for (const peer of peers.slice(0, 3))
    assert.equal(
      (
        await peer.request("/rooms/" + room.id + "/seat", "POST", {
          play: true,
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await peers[3].request("/rooms/" + room.id + "/seat", "POST", {
        play: true,
      })
    ).status,
    409,
  );
  const host = await admin.socket(),
    guest = await peers[0].socket();
  assert.equal((await emit(host, "game:join", { roomId: room.id })).ok, true);
  assert.equal((await emit(host, "game:ready")).ok, true);
  assert.equal((await emit(guest, "game:join", { roomId: room.id })).slot, 2);
  const received = new Promise((r) => host.once("game:input", r));
  assert.equal(
    (await emit(guest, "game:input", { index: 8, value: 1, slot: 4 })).ok,
    true,
  );
  assert.deepEqual(await received, { slot: 2, index: 8, value: 1 });
  assert.equal(
    (await emit(guest, "game:input", { index: 99, value: 1 })).ok,
    false,
  );
  await peers[0].request("/rooms/" + room.id + "/seat", "POST", {
    play: false,
  });
  assert.equal(
    (await emit(guest, "game:input", { index: 8, value: 1 })).ok,
    false,
  );
  assert.equal(
    (
      await admin.request("/admin/games/quad", "PUT", {
        ...definition,
        enabled: false,
      })
    ).status,
    409,
  );
  await admin.request("/rooms/" + room.id + "/leave", "POST");
});
test("integrity checker detects modified emulator files", async () => {
  const mock = join(directory, "integrity");
  await mkdir(join(mock, "config"), { recursive: true });
  await mkdir(join(mock, "public/emulator"), { recursive: true });
  const buffer = Buffer.from("pinned");
  const digest = createHash("sha256").update(buffer).digest("hex");
  await writeFile(
    join(mock, "config/emulator-lock.json"),
    JSON.stringify({
      version: "fixture",
      files: [{ path: "test.js", sha256: digest }],
    }),
  );
  await writeFile(join(mock, "public/emulator/test.js"), buffer);
  assert.equal(emulatorIntegrity(mock).ok, true);
  await writeFile(join(mock, "public/emulator/test.js"), "changed");
  assert.equal(emulatorIntegrity(mock).ok, false);
});
test("suspension revokes existing sessions and websocket access immediately", async () => {
  const c = await new Client().register("SuspendedTest");
  const s = await c.socket();
  assert.equal(
    (
      await admin.request("/admin/users/" + c.user.id + "/suspension", "POST", {
        suspended: true,
      })
    ).status,
    200,
  );
  assert.equal((await c.request("/friends")).status, 401);
  assert.equal(
    (
      await c.request("/auth/login", "POST", {
        username: "SuspendedTest",
        password: "Contraseña segura de prueba 123",
      })
    ).status,
    401,
  );
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(s.connected, false);
});
test("logout revokes the session and requires a fresh websocket handshake", async () => {
  const c = await new Client().register("LogoutTest");
  const s = await c.socket();
  assert.equal((await c.request("/auth/logout", "POST")).status, 200);
  assert.equal((await c.request("/friends")).status, 401);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(s.connected, false);
});
test("password changes require the current password and revoke other sessions", async () => {
  const c = await new Client().register("PasswordTest"),
    other = new Client();
  const login = await other.request("/auth/login", "POST", {
    username: "PasswordTest",
    password: "Contraseña segura de prueba 123",
  });
  other.csrf = login.data.csrf;
  assert.equal(
    (
      await c.request("/profile/password", "PUT", {
        current: "incorrecta",
        password: "Nueva contraseña segura 123",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await c.request("/profile/password", "PUT", {
        current: "Contraseña segura de prueba 123",
        password: "Nueva contraseña segura 123",
      })
    ).status,
    200,
  );
  assert.equal((await c.request("/friends")).status, 200);
  assert.equal((await other.request("/friends")).status, 401);
  assert.equal(
    (
      await other.request("/auth/login", "POST", {
        username: "PasswordTest",
        password: "Contraseña segura de prueba 123",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await other.request("/auth/login", "POST", {
        username: "PasswordTest",
        password: "Nueva contraseña segura 123",
      })
    ).status,
    200,
  );
});

test("personal overview isolates accounts, deduplicates participation and includes approved best scores only", async () => {
  const owner = await new Client().register("ProfileTest");
  const other = await new Client().register("OtherProfileTest");
  assert.equal((await new Client().request("/profile/overview")).status, 401);
  const empty = (await owner.request("/profile/overview")).data;
  assert.equal(empty.games, 0);
  assert.deepEqual(empty.submissions, { pending: 0, approved: 0, rejected: 0 });
  const created = await owner.request("/rooms", "POST", {
    gameId: "columns",
    name: "Actividad personal",
    visibility: "public",
  });
  assert.equal(created.status, 201);
  const room = created.data;
  const now = Date.now();
  const play = arcade.db.prepare("INSERT INTO plays VALUES(?,?,?,?,?)");
  play.run("profile-play-1", owner.user.id, "columns", room.id, now);
  play.run("profile-play-2", owner.user.id, "columns", room.id, now + 1);
  play.run("other-profile-play", other.user.id, "contra", room.id, now + 2);
  arcade.db
    .prepare(
      "INSERT INTO uploads(id,user_id,game_id,created_at) VALUES(?,?,?,?)",
    )
    .run("profile-image", owner.user.id, "columns", now);
  const score = arcade.db.prepare(
    "INSERT INTO scores(id,user_id,game_id,value,image_id,note,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
  );
  for (const [id, value, status] of [
    ["first", 100, "approved"],
    ["best", 200, "approved"],
    ["pending", 999, "pending"],
    ["rejected", 888, "rejected"],
  ])
    score.run(
      "profile-" + id,
      owner.user.id,
      "columns",
      value,
      "profile-image",
      "fixture",
      status,
      now,
    );
  for (const [id, value, completed] of [
    ["auto-first", 100, 1],
    ["auto-best", 200, 1],
    ["auto-live", 999, 0],
  ]) {
    arcade.db
      .prepare(
        "INSERT INTO game_runs(id,room_id,game_id,started_at,rules,core_hash) VALUES(?,?,?,?,?,?)",
      )
      .run(id, room.id, "columns", now, "fixture", "fixture-core");
    arcade.db
      .prepare("INSERT INTO run_players VALUES(?,?,?)")
      .run(id, 1, owner.user.id);
    arcade.db
      .prepare(
        "INSERT INTO automatic_scores(id,run_id,slot,user_id,game_id,value,created_at,completed) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(id, id, 1, owner.user.id, "columns", value, now, completed);
  }
  const result = await owner.request(
    "/profile/overview?userId=" + other.user.id,
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.games, 1);
  assert.equal(result.data.participations, 1);
  assert.equal(result.data.friends, 0);
  assert.deepEqual(result.data.submissions, {
    pending: 1,
    approved: 2,
    rejected: 0,
  });
  assert.deepEqual(result.data.bestScores, [
    { gameId: "columns", title: "Columns", value: 200 },
  ]);
  assert.equal(result.data.recentActivity.length, 1);
  assert.equal(result.data.recentActivity[0].gameId, "columns");
  const isolated = (await other.request("/profile/overview")).data;
  assert.equal(isolated.bestScores.length, 0);
  assert.equal(isolated.recentActivity[0].gameId, "contra");
});

test("appearance belongs to the authenticated account and persists across login", async () => {
  const a = await new Client().register("ThemeUser"),
    b = await new Client().register("ThemeOther");
  assert.equal(a.user.theme, "light");
  assert.equal(
    (
      await a.request("/profile/theme", "PUT", {
        theme: "dark",
        userId: b.user.id,
      })
    ).status,
    200,
  );
  assert.equal((await a.request("/auth/me")).data.user.theme, "dark");
  assert.equal((await b.request("/auth/me")).data.user.theme, "light");
  assert.equal(
    (await a.request("/profile/theme", "PUT", { theme: "<script>" })).status,
    400,
  );
  assert.equal(
    (await new Client().request("/profile/theme", "PUT", { theme: "dark" }))
      .status,
    401,
  );
  const fresh = new Client();
  assert.equal(
    (
      await fresh.request("/auth/login", "POST", {
        username: "ThemeUser",
        password: "Contraseña segura de prueba 123",
      })
    ).data.user.theme,
    "dark",
  );
});

test("server runtime limits credits, repeated starts, seat identity and concurrent rooms", async () => {
  const delivered = [];
  const rt = new GameRuntime({
    root: ".",
    romDir: ".",
    origin: () => base,
    onEvent: () => {},
    onStop: () => {},
    maxRooms: 1,
  });
  rt.deliver = async (rid, name, payload) => {
    delivered.push({ rid, name, payload });
  };
  rt.rooms.set("one", { ready: true, players: new Map(), runId: "one" });
  rt.input("one", "alice", 1, 2, 1);
  rt.input("one", "alice", 1, 3, 1);
  assert.throws(() => rt.input("one", "alice", 1, 2, 1), /un crédito/);
  // Some arcade intros ignore Start. Retrying is allowed until real play begins.
  assert.doesNotThrow(() => rt.input("one", "alice", 1, 3, 1));
  rt.rooms.get("one").players.get(1).seenActive = true;
  assert.throws(() => rt.input("one", "alice", 1, 3, 1), /un crédito/);
  assert.throws(() => rt.input("one", "bob", 1, 4, 1), /puesto conserva/);
  rt.input("one", "alice", 1, 4, 1);
  assert.equal(delivered.at(-1).payload.slot, 1);
  await assert.rejects(rt.ensure({ id: "two" }, {}), /ocupadas/);
});

test("score readers match recorded RAM examples and reject invalid layout or BCD", async () => {
  const fixtures = JSON.parse(
    await readFile(
      new URL("./fixtures/score-memory.json", import.meta.url),
      "utf8",
    ),
  );
  for (const fixture of fixtures) {
    const layout = scoreLayouts[fixture.game];
    const full = Buffer.alloc(layout.size);
    for (const region of fixture.regions)
      full.set(Buffer.from(region.hex, "hex"), region.offset);
    const sparse = Buffer.alloc(layout.size);
    for (const [offset, length] of layout.ranges)
      sparse.set(full.subarray(offset, offset + length), offset);
    assert.deepEqual(
      readScores({ id: fixture.game }, sparse),
      readScores({ id: fixture.game }, full),
      fixture.game + " sparse sampling",
    );
    assert.ok(layout.ranges.reduce((n, [, length]) => n + length, 0) < 32);
  }
  for (const fixture of fixtures) {
    const ram = Buffer.alloc(scoreLayouts[fixture.game].size);
    for (const region of fixture.regions)
      Buffer.from(region.hex, "hex").copy(ram, region.offset);
    const scores = readScores({ id: fixture.game }, ram);
    for (const [slot, value] of fixture.expected)
      assert.equal(
        scores.find((s) => s.slot === slot)?.value,
        value,
        fixture.game + " slot " + slot,
      );
    assert.deepEqual(readScores({ id: fixture.game }, ram.subarray(1)), []);
    if (fixture.game === "contra") {
      ram[0x7c] = 255;
      assert.equal(
        readScores({ id: "contra" }, ram).find((s) => s.slot === 1),
        undefined,
      );
    }
  }
  assert.deepEqual(readScores({ id: "unknown" }, Buffer.alloc(65536)), []);
});

test("server hosted games deny client hosting, ROM downloads, forged ports and score uploads", async () => {
  const originalBase = base;
  const dir = join(directory, "authoritative");
  const delivered = [];
  const mock = {
    rooms: new Map(),
    maxRooms: 1,
    status: () => ({ ready: true }),
    ensure: async () => {},
    deliver: async (rid, name, payload) =>
      delivered.push({ rid, name, payload }),
    input: (rid, userId, slot, index, value) =>
      delivered.push({ rid, userId, slot, index, value }),
    close: async () => {},
    stop: async () => {},
  };
  const service = createArcade({
    dataDir: dir,
    setupCode: "test-setup",
    disableRateLimits: true,
    runtime: mock,
  });
  await writeFile(join(dir, "roms/columns.zip"), "fixture");
  await new Promise((r) => service.http.listen(0, "127.0.0.1", r));
  try {
    base = "http://127.0.0.1:" + service.http.address().port;
    const c = await new Client().register("ServerHost");
    const room = (
      await c.request("/rooms", "POST", {
        gameId: "columns",
        name: "Servidor",
        visibility: "public",
      })
    ).data;
    const config = await c.request("/rooms/" + room.id + "/emulator");
    assert.equal(config.data.host, false);
    assert.equal(config.data.serverHosted, true);
    assert.equal(
      (await c.request("/rooms/" + room.id + "/rom/columns.zip")).status,
      403,
    );
    const socket = await c.socket();
    assert.equal(
      (await emit(socket, "game:join", { roomId: room.id })).hostId,
      "server",
    );
    assert.equal((await emit(socket, "game:ready")).ok, false);
    assert.equal(
      (
        await emit(socket, "game:signal", {
          target: c.user.id,
          signal: { description: { type: "offer", sdp: "fake" } },
        })
      ).ok,
      false,
    );
    assert.equal(
      (await emit(socket, "game:input", { slot: 4, index: 8, value: 1 })).ok,
      true,
    );
    assert.equal(delivered.at(-1).slot, 1);
    for (const index of [16, 23, 24, 30])
      assert.equal(
        (await emit(socket, "game:input", { index, value: 1 })).ok,
        false,
      );
    assert.equal(
      (await c.request("/games/columns/scores", "POST", { value: 999999999 }))
        .status,
      410,
    );
    await emit(socket, "game:leave");
    for (const [id, allowed, denied] of [
      ["orunners", 16, 23],
      ["cclimber", 23, 16],
    ]) {
      await writeFile(join(dir, `roms/${id}.zip`), "fixture");
      const special = (
        await c.request("/rooms", "POST", {
          gameId: id,
          name: id,
          visibility: "public",
        })
      ).data;
      assert.equal(
        (await emit(socket, "game:join", { roomId: special.id })).ok,
        true,
      );
      assert.equal(
        (
          await emit(socket, "game:input", {
            slot: 4,
            index: allowed,
            value: 1,
          })
        ).ok,
        true,
      );
      assert.equal(delivered.at(-1).slot, 1);
      assert.equal(delivered.at(-1).index, allowed);
      assert.equal(
        (await emit(socket, "game:input", { index: allowed, value: 32767 })).ok,
        false,
      );
      assert.equal(
        (await emit(socket, "game:input", { index: denied, value: 1 })).ok,
        false,
      );
      assert.equal(
        (await emit(socket, "game:input", { index: 24, value: 1 })).ok,
        false,
      );
      await emit(socket, "game:leave");
    }
    socket.disconnect();
  } finally {
    base = originalBase;
    await service.close();
  }
});

test("gamepad preferences are validated, private and persisted by account", async () => {
  const player = await new Client().register("PadProfile");
  const mapping = {
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    a: 3,
    b: 1,
    c: 2,
    d: 0,
    coin: 8,
    start: 9,
  };
  assert.equal(
    (await player.request("/profile/gamepad", "PUT", mapping)).status,
    200,
  );
  assert.deepEqual(
    (await player.request("/auth/me")).data.user.gamepadControls,
    mapping,
  );
  assert.notDeepEqual(
    (await admin.request("/auth/me")).data.user.gamepadControls,
    mapping,
  );
  assert.equal(
    (await player.request("/profile/gamepad", "PUT", { ...mapping, a: 99 }))
      .status,
    400,
  );
  assert.equal(
    (await player.request("/profile/gamepad", "PUT", { ...mapping, a: 1 }))
      .status,
    400,
  );
  assert.equal(
    (await new Client().request("/profile/gamepad", "PUT", mapping)).status,
    401,
  );
});

test("only administrators can configure local addresses and validated public domains", async () => {
  const viewer = await new Client().register("NetworkViewer");
  assert.equal((await viewer.request("/admin/network")).status, 403);
  const info = await admin.request("/admin/network");
  assert.equal(info.status, 200);
  if (!info.data.addresses.length) return;
  const value = {
    mode: "lan",
    lanIp: info.data.addresses[0],
    httpsPort: 443,
    domain: "",
  };
  assert.equal(
    (await admin.request("/admin/network", "PUT", value)).status,
    200,
  );
  assert.equal(
    (await viewer.request("/admin/network", "PUT", value)).status,
    403,
  );
  for (const bad of [
    { ...value, lanIp: "8.8.8.8" },
    { ...value, httpsPort: 3000 },
    { ...value, mode: "internet", domain: "https://example.com/x" },
    { ...value, mode: "internet", domain: "x.com\nadmin off" },
    { ...value, mode: "internet", domain: "" },
  ])
    assert.equal(
      (await admin.request("/admin/network", "PUT", bad)).status,
      400,
    );
  assert.equal(
    (
      await admin.request("/admin/network", "PUT", {
        ...value,
        mode: "internet",
        domain: "arcade.example.com",
      })
    ).status,
    200,
  );
  assert.equal(
    (await admin.request("/admin/network", "PUT", value)).status,
    200,
  );
});

test("trusted HTTPS proxy uses secure cookies and secure WebSocket policy", async () => {
  const prior = arcade.app.get("trust proxy");
  arcade.app.set("trust proxy", "loopback");
  try {
    const c = await new Client().register("TlsProxyUser");
    const login = await c.request(
      "/auth/login",
      "POST",
      { username: "TlsProxyUser", password: "Contraseña segura de prueba 123" },
      { "X-Forwarded-Proto": "https" },
    );
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /; Secure/);
    // The shared HTTPS/WebSocket policy must be testable in a source-only clone,
    // before the user has generated dist/play.html.
    const response = await fetch(base + "/api/health", {
      headers: { "X-Forwarded-Proto": "https" },
    });
    assert.match(
      response.headers.get("content-security-policy"),
      /wss:\/\/127\.0\.0\.1:/,
    );
  } finally {
    arcade.app.set("trust proxy", prior);
  }
});
