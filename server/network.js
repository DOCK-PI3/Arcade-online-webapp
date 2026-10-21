import { networkInterfaces } from "node:os";
import { isIP } from "node:net";
export function localAddresses() {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flat()
        .filter(
          (a) =>
            a.family === "IPv4" &&
            !a.internal &&
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address),
        )
        .map((a) => a.address),
    ),
  ];
}
export function networkSettings(db) {
  const raw = db
    .prepare("SELECT value FROM settings WHERE key='network'")
    .get()?.value;
  return raw
    ? JSON.parse(raw)
    : {
        mode: "lan",
        lanIp: localAddresses()[0] || "127.0.0.1",
        httpsPort: 443,
        domain: "",
      };
}
export function validateNetwork(value) {
  const { mode, lanIp, httpsPort } = value;
  const domain = String(value.domain || "")
    .trim()
    .toLowerCase();
  if (
    !["lan", "internet"].includes(mode) ||
    isIP(lanIp) !== 4 ||
    !localAddresses().includes(lanIp)
  )
    throw Error("Selecciona una IP local de este servidor.");
  if (
    !Number.isInteger(httpsPort) ||
    httpsPort < 1 ||
    httpsPort > 65535 ||
    [80, 3000, 2020].includes(httpsPort)
  )
    throw Error("El puerto HTTPS no es válido o está reservado.");
  if (
    domain &&
    (domain.length > 253 ||
      isIP(domain) ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        domain,
      ))
  )
    throw Error(
      "Introduce solo el dominio o subdominio, sin https://, rutas ni puertos.",
    );
  if (mode === "internet" && !domain)
    throw Error("Indica un dominio o subdominio para Internet.");
  return { mode, lanIp, httpsPort, domain };
}
export const networkUrl = (settings, internet = false) =>
  `https://${internet ? settings.domain : settings.lanIp}${settings.httpsPort === 443 ? "" : ":" + settings.httpsPort}`;
