import React, { useState, useEffect } from "react";
import { api } from "./api.js";
export function AdminNetwork({ action }) {
  const [info, setInfo] = useState(null),
    [settings, setSettings] = useState(null);
  const load = async () => {
    const result = await api("/admin/network");
    setInfo(result);
    setSettings(result.settings);
  };
  useEffect(() => {
    action(load);
    const timer = setInterval(
      () =>
        api("/admin/network")
          .then(setInfo)
          .catch(() => {}),
      5000,
    );
    return () => clearInterval(timer);
  }, []);
  if (!settings) return <p>Cargando configuración de acceso…</p>;
  return (
    <section className="settings-panel network-panel">
      <h3>Red y acceso</h3>
      <p>
        Elige la IP de este equipo y la dirección que compartirás. El acceso
        local se mantiene también al preparar un dominio de Internet.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          action(async () => {
            await api("/admin/network", { method: "PUT", body: settings });
            await load();
          }, "Configuración guardada. El iniciador de red la aplica en unos segundos; si está detenido, abre Iniciar-red.cmd.");
        }}
      >
        <div className="form-columns">
          <label>
            Tipo de acceso
            <select
              value={settings.mode}
              onChange={(e) =>
                setSettings({ ...settings, mode: e.target.value })
              }
            >
              <option value="lan">Solo red local</option>
              <option value="internet">Red local y dominio de Internet</option>
            </select>
          </label>
          <label>
            IP local del servidor
            <select
              value={settings.lanIp}
              onChange={(e) =>
                setSettings({ ...settings, lanIp: e.target.value })
              }
            >
              {info.addresses.map((ip) => (
                <option key={ip}>{ip}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-columns">
          <label>
            Puerto HTTPS
            <input
              type="number"
              min="1"
              max="65535"
              required
              value={settings.httpsPort}
              onChange={(e) =>
                setSettings({ ...settings, httpsPort: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Dominio o subdominio
            <input
              value={settings.domain}
              placeholder="tusalon.duckdns.org"
              required={settings.mode === "internet"}
              onChange={(e) =>
                setSettings({ ...settings, domain: e.target.value })
              }
            />
          </label>
        </div>
        <button className="button" type="submit">
          Guardar configuración de red
        </button>
      </form>
      <dl className="server-details">
        <div>
          <dt>Acceso local</dt>
          <dd>
            <a href={info.url} target="_blank" rel="noreferrer">
              {info.url}
            </a>
          </dd>
        </div>
        <div>
          <dt>Preparar móviles</dt>
          <dd>
            <a href={info.setupUrl} target="_blank" rel="noreferrer">
              {info.setupUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt>Proxy HTTPS</dt>
          <dd>
            {info.runtime?.running
              ? "En ejecución"
              : "Detenido o no iniciado con Iniciar-red.cmd"}
          </dd>
        </div>
        {info.publicUrl && (
          <div>
            <dt>Dirección pública configurada</dt>
            <dd>{info.publicUrl}</dd>
          </div>
        )}
      </dl>
      {info.runtime?.fingerprint && (
        <p className="form-note">
          Huella SHA-256 del certificado local:{" "}
          <code style={{ overflowWrap: "anywhere" }}>
            {info.runtime.fingerprint}
          </code>
        </p>
      )}
      <div className="info-note">
        Para usar la LAN en Windows, abre <strong>Iniciar-red.cmd</strong>. La
        primera vez ejecuta <strong>Permitir-red-local.cmd</strong> con permisos
        de administrador y prepara el certificado en el móvil desde el enlace
        anterior. Si cambias el puerto, debes ajustar también la regla del
        firewall.
      </div>
      {settings.mode === "internet" && (
        <div className="info-note">
          Un dominio o subdominio gratuito puede apuntar a tu IP pública. Debes
          configurarlo en tu proveedor DNS y dirigir los puertos 80/443 del
          router al servidor para obtener el certificado público. Guardar esta
          opción no cambia el router ni abre el firewall a Internet. Las
          partidas entre redes necesitan además validar STUN/TURN; el modo
          externo todavía está pendiente de esa integración y sus pruebas.
        </div>
      )}
      <p className="form-note">
        En Android instala el certificado de CA desde Ajustes → Seguridad →
        Cifrado y credenciales → Instalar certificado. Instala solo el
        certificado de tu servidor y comprueba la huella mostrada aquí. No basta
        con aceptar una advertencia HTTPS.
      </p>
    </section>
  );
}
