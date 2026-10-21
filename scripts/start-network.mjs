import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { X509Certificate } from "node:crypto";
import { createServer } from "node:net";
import { openDatabase } from "../server/db.js";
import {
  networkSettings,
  networkUrl,
  validateNetwork,
} from "../server/network.js";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const data = resolve(process.env.DATA_DIR || "data"),
  proxy = join(root, ".cache/caddy/caddy.exe");
const proxyEnv = { ...process.env, APPDATA: join(root, ".cache/caddy-user") };
if (!existsSync(proxy)) throw Error("Primero ejecuta npm run network:install.");
const db = openDatabase(data);
let settings = validateNetwork(networkSettings(db));
for (const [host, port] of [
  ["127.0.0.1", 3000],
  ["127.0.0.1", 2020],
  [settings.lanIp, settings.httpsPort],
  [settings.lanIp, 3000],
]) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `El puerto ${host}:${port} ya está ocupado. Cierra la instancia anterior antes de abrir Iniciar-red.cmd.`,
        ),
      ),
    );
    probe.listen({ host, port, exclusive: true }, () => probe.close(resolve));
  });
}
const publicDir = join(root, ".cache/network-public"),
  storage = join(data, "network-pki"),
  config = join(root, ".cache/Caddyfile.network");
await mkdir(publicDir, { recursive: true });
await mkdir(storage, { recursive: true });
const path = (p) => JSON.stringify(p.replaceAll("\\", "/"));
async function configure(s) {
  const lan = networkUrl(s);
  await writeFile(
    config,
    `{\n admin 127.0.0.1:2020\n skip_install_trust\n auto_https disable_redirects\n storage file_system {\n root ${path(storage)}\n }\n servers {\n protocols h1 h2\n }\n}\n${lan} {\n bind ${s.lanIp}\n tls internal\n reverse_proxy 127.0.0.1:3000\n}\nhttp://${s.lanIp}:3000 {\n bind ${s.lanIp}\n root * ${path(publicDir)}\n file_server\n}\n${s.mode === "internet" ? `https://${s.domain}${s.httpsPort === 443 ? "" : ":" + s.httpsPort} {\n bind ${s.lanIp}\n reverse_proxy 127.0.0.1:3000\n}\n` : ""}`,
  );
  const html = `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectar al Salón Arcade</title><style>body{font:18px system-ui;line-height:1.6;max-width:760px;margin:40px auto;padding:20px;background:#edf2f5;color:#172d3a}a{color:#2459ce}code{overflow-wrap:anywhere}</style><h1>Conectar al Salón Arcade</h1><p>Dirección del servidor: <a href="${lan}">${lan}</a></p><h2>Preparar Android una vez</h2><ol><li><a href="/arcade-root.crt" download>Descargar el certificado local</a>.</li><li>En Ajustes busca «Instalar certificado». Elige <strong>Certificado de CA</strong> (normalmente en Seguridad → Cifrado y credenciales → Instalar un certificado). Selecciona el archivo descargado y confirma la confianza. Los nombres cambian según el fabricante.</li><li>Cierra y vuelve a abrir Chrome. Entra en <a href="${lan}">${lan}</a> y comprueba que no muestra una advertencia de certificado.</li></ol><p>Este certificado permite confiar en la autoridad local de tu servidor. Instálalo solo en tus dispositivos para esta comunidad y no compartas ninguna clave privada.</p><p><a href="/fingerprint.txt">Ver huella SHA-256 del certificado</a>. También se muestra en la consola y en Administración → Red y acceso para compararla.</p><p>En iPhone: instala el perfil descargado y activa su confianza en Ajustes → General → Información → Ajustes de confianza de certificados.</p><p>Esta página de preparación usa HTTP y no solicita cuentas ni contraseñas. Inicia sesión únicamente en la dirección HTTPS.</p></html>`;
  await writeFile(join(publicDir, "index.html"), html);
}
await configure(settings);
const backend = spawn(process.execPath, ["server/index.js"], {
  cwd: root,
  stdio: ["inherit", "inherit", "inherit", "ipc"],
  windowsHide: true,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: "3000",
    TRUST_PROXY: "1",
    ARCADE_NETWORK_MANAGED: "1",
  },
});
const caddy = spawn(
  proxy,
  ["run", "--config", config, "--adapter", "caddyfile"],
  { cwd: root, stdio: "inherit", windowsHide: true, env: proxyEnv },
);
let closing = false,
  busy = false,
  timer;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  try {
    execFileSync(proxy, ["stop", "--address", "127.0.0.1:2020"], {
      windowsHide: true,
      env: proxyEnv,
      stdio: "ignore",
      timeout: 5000,
    });
  } catch {
    caddy.kill("SIGTERM");
  }
  if (backend.connected) backend.send({ type: "shutdown" });
  else backend.kill("SIGTERM");
  db.close();
  await writeFile(
    join(data, "network-runtime.json"),
    JSON.stringify({ running: false }),
  );
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => close());
backend.on("exit", (code) => {
  if (!closing) close(code || 1);
});
caddy.on("exit", (code) => {
  if (!closing) close(code || 1);
});
for (const child of [backend, caddy])
  child.on("error", (error) => {
    console.error(error.message);
    close(1);
  });
async function publish() {
  const certificate = await readFile(
    join(storage, "pki/authorities/local/root.crt"),
  );
  await copyFile(
    join(storage, "pki/authorities/local/root.crt"),
    join(publicDir, "arcade-root.crt"),
  );
  const fingerprint = new X509Certificate(certificate).fingerprint256;
  await writeFile(
    join(publicDir, "fingerprint.txt"),
    "Salón Arcade · SHA-256\n" + fingerprint + "\n",
  );
  await writeFile(
    join(data, "network-runtime.json"),
    JSON.stringify({
      running: true,
      pid: process.pid,
      settings,
      fingerprint,
      updatedAt: Date.now(),
    }),
  );
  return fingerprint;
}
timer = setInterval(async () => {
  if (busy || closing) return;
  busy = true;
  try {
    const next = validateNetwork(networkSettings(db));
    if (JSON.stringify(next) !== JSON.stringify(settings)) {
      await configure(next);
      execFileSync(
        proxy,
        [
          "reload",
          "--address",
          "127.0.0.1:2020",
          "--config",
          config,
          "--adapter",
          "caddyfile",
        ],
        { stdio: "inherit", windowsHide: true, env: proxyEnv },
      );
      settings = next;
      console.log("Acceso actualizado: " + networkUrl(settings));
    }
    const fingerprint = await publish();
    if (!process.env.ARCADE_LAN_READY) {
      console.log(
        "LAN: " +
          networkUrl(settings) +
          "\nPreparar móvil: http://" +
          settings.lanIp +
          ":3000\nHuella CA: " +
          fingerprint,
      );
      process.env.ARCADE_LAN_READY = "1";
    }
  } catch (error) {
    console.error("Red: " + error.message.slice(0, 200));
  } finally {
    busy = false;
  }
}, 3000);
