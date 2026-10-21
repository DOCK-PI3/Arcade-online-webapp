import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Server,
  Database,
  Download,
  RefreshCw,
  Trash2,
  LogOut,
  Lock,
} from "lucide-react";
import { api, post } from "./api.js";
import { AdminNetwork } from "./admin-network.jsx";
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + " MB";
const date = (value) => new Date(value).toLocaleString("es-ES");
export function AdminControl({ action, refreshGames, children }) {
  const [status, setStatus] = useState(null),
    [users, setUsers] = useState([]),
    [rooms, setRooms] = useState([]),
    [audit, setAudit] = useState([]),
    [messages, setMessages] = useState([]),
    [tab, setTab] = useState("server"),
    [working, setWorking] = useState(false);
  const load = async () => {
    const [s, u, r, a, m] = await Promise.all([
      api("/admin/status"),
      api("/admin/users"),
      api("/admin/rooms"),
      api("/admin/audit"),
      api("/admin/messages"),
    ]);
    setStatus(s);
    setUsers(u);
    setRooms(r);
    setAudit(a);
    setMessages(m);
  };
  useEffect(() => {
    action(load);
  }, []);
  const doAction = (fn, message) =>
    action(async () => {
      await fn();
      await load();
    }, message);
  return (
    <section className="admin-control">
      <div className="section-heading">
        <h2>
          <Shield size={23} /> Control del servidor
        </h2>
        <button
          className="button secondary small"
          onClick={() => action(() => Promise.all([load(), refreshGames()]))}
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
      <div className="admin-tabs">
        {[
          ["server", "Servidor"],
          ["network", "Red y acceso"],
          ["games", "Juegos"],
          ["users", "Usuarios"],
          ["rooms", "Salas"],
          ["messages", "Moderación"],
          ["audit", "Actividad administrativa"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "selected" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "games" && children}
      {tab === "network" && <AdminNetwork action={action} />}
      {tab === "server" && status && (
        <>
          <div className="info-note">
            Integridad del emulador:{" "}
            <strong>
              {status.integrity?.ok
                ? "Verificada por SHA-256"
                : "Hay archivos ausentes o modificados"}
            </strong>
            . {status.integrity?.files} archivos de la versión{" "}
            {status.integrity?.version}.{" "}
            {!status.integrity?.ok && status.integrity?.errors.join("; ")}
          </div>
          <div className="server-stats">
            <div>
              <span>Usuarios</span>
              <strong>{status.counts.users}</strong>
            </div>
            <div>
              <span>Sesiones activas</span>
              <strong>{status.counts.sessions}</strong>
            </div>
            <div>
              <span>Salas abiertas</span>
              <strong>{status.counts.rooms}</strong>
            </div>
            <div>
              <span>Conexiones</span>
              <strong>{status.counts.connections}</strong>
            </div>
          </div>
          <div className="profile-grid">
            <div className="settings-panel">
              <h3>
                <Server size={17} /> Salud y configuración
              </h3>
              <dl className="server-details">
                <div>
                  <dt>Tiempo en marcha</dt>
                  <dd>{Math.floor(status.uptime / 60)} minutos</dd>
                </div>
                <div>
                  <dt>Node.js</dt>
                  <dd>{status.node}</dd>
                </div>
                <div>
                  <dt>CPU</dt>
                  <dd>{status.cpu}</dd>
                </div>
                <div>
                  <dt>Motor de partidas</dt>
                  <dd>
                    Servidor · {status.gameEngine?.active || 0}/
                    {status.gameEngine?.limit || 0} partidas
                  </dd>
                </div>
                <div>
                  <dt>Memoria del proceso</dt>
                  <dd>{mb(status.memory.process)}</dd>
                </div>
                <div>
                  <dt>RAM disponible</dt>
                  <dd>{mb(status.memory.free)}</dd>
                </div>
                <div>
                  <dt>Base de datos</dt>
                  <dd>{mb(status.databaseBytes)}</dd>
                </div>
                <div>
                  <dt>Imágenes / cuota</dt>
                  <dd>
                    {mb(status.uploadBytes)} / {status.uploadQuotaMB} MB
                  </dd>
                </div>
                <div>
                  <dt>Cookies para HTTPS</dt>
                  <dd>
                    {status.secureCookies
                      ? "Activadas"
                      : "Modo desarrollo local"}
                  </dd>
                </div>
              </dl>
              <label className="registration-switch">
                Nuevos registros
                <select
                  value={status.registration}
                  onChange={(e) =>
                    doAction(
                      () =>
                        api("/admin/settings", {
                          method: "PUT",
                          body: { registration: e.target.value },
                        }),
                      "Configuración actualizada.",
                    )
                  }
                >
                  <option value="open">Abiertos con protección antispam</option>
                  <option value="closed">Pausados</option>
                </select>
              </label>
            </div>
            <div className="settings-panel">
              <h3>
                <Database size={17} /> Copias de seguridad
              </h3>
              <p>
                Incluyen cuentas, mensajes, puntuaciones, imágenes y la clave de
                cifrado. Guarda las descargas en un lugar privado. Las ROMs y el
                emulador se conservan por separado.
              </p>
              <button
                className="button"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  await doAction(
                    () => post("/admin/backups"),
                    "Copia de seguridad creada.",
                  );
                  setWorking(false);
                }}
              >
                <Database size={16} />
                {working ? "Creando copia…" : "Crear copia ahora"}
              </button>
              <div className="backup-list">
                {status.backups.length ? (
                  status.backups.map((b) => (
                    <div key={b.filename}>
                      <div>
                        <strong>{date(b.createdAt)}</strong>
                        <small>{mb(b.bytes)}</small>
                      </div>
                      <a
                        className="button secondary small"
                        href={"/api/admin/backups/" + b.filename}
                      >
                        <Download size={15} /> Descargar
                      </a>
                    </div>
                  ))
                ) : (
                  <p>Todavía no hay copias de seguridad.</p>
                )}
              </div>
              <p className="form-note">
                Se conservan hasta 10 copias. Consulta la guía para restaurarlas
                y programar copias externas.
              </p>
            </div>
          </div>
        </>
      )}
      {tab === "users" && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.username}</strong>
                    <small>{date(u.created_at)}</small>
                  </td>
                  <td>
                    <select
                      aria-label={"Rol de " + u.username}
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        if (
                          confirm(
                            "¿Cambiar el rol de " +
                              u.username +
                              " a " +
                              role +
                              "?",
                          )
                        )
                          doAction(
                            () =>
                              post("/admin/users/" + u.id + "/role", { role }),
                            "Rol actualizado.",
                          );
                      }}
                    >
                      <option value="member">Miembro</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <span
                      className={
                        "status " + (u.suspended ? "rejected" : "approved")
                      }
                    >
                      {u.suspended ? "Suspendido" : "Activo"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="button secondary small"
                        onClick={() => {
                          if (
                            confirm(
                              (u.suspended ? "Restaurar" : "Suspender") +
                                " la cuenta de " +
                                u.username +
                                "?",
                            )
                          )
                            doAction(
                              () =>
                                post("/admin/users/" + u.id + "/suspension", {
                                  suspended: !u.suspended,
                                }),
                              "Estado de la cuenta actualizado.",
                            );
                        }}
                      >
                        {u.suspended ? "Restaurar" : "Suspender"}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={"Revocar sesiones de " + u.username}
                        title="Cerrar todas sus sesiones"
                        onClick={() => {
                          if (
                            confirm(
                              "¿Cerrar todas las sesiones de " +
                                u.username +
                                "?",
                            )
                          )
                            doAction(
                              () =>
                                post(
                                  "/admin/users/" + u.id + "/revoke-sessions",
                                ),
                              "Sesiones revocadas.",
                            );
                        }}
                      >
                        <LogOut size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "rooms" && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sala</th>
                <th>Juego</th>
                <th>Anfitrión</th>
                <th>Acceso</th>
                <th>Miembros</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.game.title}</td>
                  <td>{r.owner}</td>
                  <td>
                    {
                      {
                        public: "Pública",
                        friends: "Amigos",
                        invite: "Invitación",
                      }[r.visibility]
                    }
                  </td>
                  <td>{r.members.length}</td>
                  <td>
                    <button
                      className="text-button danger"
                      onClick={() => {
                        if (
                          confirm(
                            "¿Cerrar la sala " +
                              r.name +
                              " y finalizar su partida?",
                          )
                        )
                          doAction(
                            () => post("/admin/rooms/" + r.id + "/close"),
                            "Sala cerrada.",
                          );
                      }}
                    >
                      Cerrar sala
                    </button>
                  </td>
                </tr>
              ))}
              {!rooms.length && (
                <tr>
                  <td colSpan={6}>No hay salas abiertas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "messages" && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sala / Autor</th>
                <th>Mensaje</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.username}</strong>
                    <small>{m.roomName}</small>
                  </td>
                  <td className="moderation-body">
                    {m.body}
                    {m.imageId && (
                      <a
                        href={"/api/images/" + m.imageId}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {" "}
                        Ver imagen
                      </a>
                    )}
                  </td>
                  <td>{date(m.created_at)}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label="Eliminar mensaje"
                      onClick={() =>
                        doAction(
                          () =>
                            api("/admin/messages/" + m.id, {
                              method: "DELETE",
                            }),
                          "Mensaje eliminado.",
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
              {!messages.length && (
                <tr>
                  <td colSpan={4}>No hay mensajes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "audit" && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cuenta</th>
                <th>Acción</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{date(a.created_at)}</td>
                  <td>{a.username || "Sistema"}</td>
                  <td>{a.action}</td>
                  <td className="audit-target">{a.target || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
