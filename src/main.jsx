import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  Gamepad2,
  Users,
  Trophy,
  MessageCircle,
  Settings,
  Search,
  Plus,
  ChevronRight,
  Shield,
  LogOut,
  X,
  Send,
  Image as ImageIcon,
  Lock,
  Globe,
  UserPlus,
  Check,
  Clock,
  Play,
  Keyboard,
  ExternalLink,
  Trash2,
  Copy,
  Menu,
} from "lucide-react";
import { api, post, setCsrf, upload } from "./api.js";
import { defaultControls, controlLabels, keyName } from "./shared-controls.js";
import "./style.css";
import "./admin.css";
import "./themes.css";
import { AdminControl } from "./admin-control.jsx";
import { GamepadSettings } from "./gamepad-settings.jsx";
import { AccountSecurity } from "./account-security.jsx";
import catalogAdditions from "../config/catalog-additions.json";
import { ProfileOverview } from "./profile-overview.jsx";
import { MedalsPanel } from "./medals.jsx";
import "./medals.css";

const navigate = (path) => {
  location.hash = "/" + path;
};
const current = () => {
  try {
    return decodeURIComponent(location.hash.replace(/^#\/?/, "") || "home");
  } catch {
    return "home";
  }
};
const number = (n) => Number(n || 0).toLocaleString("es-ES");
const time = (t) =>
  new Date(t).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const privacy = {
  public: "Pública",
  friends: "Amigos",
  invite: "Por invitación",
};
const PrivacyIcon = ({ value }) =>
  value === "public" ? (
    <Globe size={14} />
  ) : value === "friends" ? (
    <Users size={14} />
  ) : (
    <Lock size={14} />
  );

function GameArt({ id }) {
  const captures = {
    ...Object.fromEntries(catalogAdditions.map((g) => [g.id, g.title])),
    columns: "Columns",
    tetris: "Tetris",
    contra: "Contra",
    mslug: "Metal Slug",
    mslug2: "Metal Slug 2",
    1941: "1941: Counter Attack",
  };
  if (captures[id])
    return (
      <img
        className="game-art game-screenshot"
        src={`/games/${id}.png`}
        alt={`Captura real de ${captures[id]}`}
        loading="lazy"
      />
    );
  const blocks = [
    [0, 0, "#f6ce53"],
    [1, 0, "#f6ce53"],
    [0, 1, "#f6ce53"],
    [1, 1, "#f6ce53"],
    [3, 2, "#7bb8de"],
    [3, 3, "#7bb8de"],
    [3, 4, "#7bb8de"],
    [3, 5, "#7bb8de"],
    [6, 3, "#ee8b73"],
    [6, 4, "#ee8b73"],
    [7, 4, "#ee8b73"],
    [8, 4, "#ee8b73"],
    [1, 5, "#b9d9b8"],
    [1, 6, "#b9d9b8"],
    [2, 6, "#b9d9b8"],
    [3, 6, "#b9d9b8"],
  ];
  return (
    <svg
      className={"game-art art-" + id}
      viewBox="0 0 300 190"
      role="img"
      aria-label={
        "Ilustración de " +
        (id === "tetris"
          ? "bloques"
          : id === "1941"
            ? "aviones"
            : "acción arcade")
      }
    >
      <defs>
        <pattern
          id={"grid-" + id}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M20 0H0V20"
            fill="none"
            stroke="currentColor"
            strokeWidth=".6"
            opacity=".15"
          />
        </pattern>
      </defs>
      <rect width="300" height="190" fill="currentColor" />
      <rect
        width="300"
        height="190"
        fill={"url(#grid-" + id + ")"}
        className="grid-fill"
      />
      {id === "tetris" ? (
        <g transform="translate(49 20)">
          {blocks.map(([x, y, c], i) => (
            <g key={i}>
              <rect
                x={x * 21}
                y={y * 21}
                width="19"
                height="19"
                rx="2"
                fill={c}
              />
              <path
                d={`M${x * 21 + 3} ${y * 21 + 16}v-13h13`}
                stroke="#fff"
                opacity=".3"
                fill="none"
              />
            </g>
          ))}
        </g>
      ) : id === "1941" ? (
        <g fill="#f6ce53">
          <path d="M150 24l9 44 53 38v12l-53-17-2 35 17 13v9l-24-6-24 6v-9l17-13-2-35-53 17v-12l53-38z" />
          <g fill="#b1cfde" opacity=".7">
            <path d="M65 35l5 17 19 12v5l-20-5-4 18-4-18-20 5v-5l19-12z" />
            <path d="M236 120l5 17 19 12v5l-20-5-4 18-4-18-20 5v-5l19-12z" />
          </g>
          <path d="M147 8h6v10h-6zm0 156h6v20h-6z" />
        </g>
      ) : (
        <g>
          <path
            d="M0 158l31-28 31 9 27-38 29 12 30-29 31 11 19-25 38 32 31-7 33 17v78H0z"
            fill="#ffffff"
            opacity=".09"
          />
          {id === "contra" ? (
            <g fill="#f6ce53" transform="translate(112 30)">
              <path d="M26 7h22v21H26zM20 29h33v44H20zM0 36h21v13H0zm51 3h35v11H51zM24 72h14v42H24zm14 0h15l19 33-12 7-21-28zM17 109h25v9H17zM81 33h28v9H81z" />
              <path d="M0 124h85v3H0z" opacity=".5" />
            </g>
          ) : (
            <g transform="translate(45 45)">
              <path d="M23 65h154l17 28-16 30H22L5 93z" fill="#273d37" />
              <path d="M29 58h136l16 21H15z" fill="#b7cab4" />
              <path d="M57 27h72l26 34H44z" fill="#e2e2be" />
              <path d="M100 29V9h12v20zm16 7h87v11h-87z" fill="#f6ce53" />
              <rect x="58" y="39" width="37" height="14" fill="#324940" />
              {[35, 65, 95, 125, 155].map((x) => (
                <circle key={x} cx={x} cy="94" r="14" fill="#94a386" />
              ))}
              <path d="M19 134h175" stroke="#f6ce53" strokeWidth="3" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
function Cabinet() {
  return (
    <svg viewBox="0 0 290 320" aria-hidden="true" className="cabinet">
      <path
        d="M72 27h137l16 34-15 105 23 51-10 78H65l-9-78 22-51L63 61z"
        fill="#f6ce53"
      />
      <path d="M71 28h138l13 27H65z" fill="#fff2b2" />
      <rect x="82" y="64" width="120" height="104" rx="9" fill="#172d3a" />
      <rect x="91" y="73" width="102" height="85" rx="5" fill="#527cb3" />
      <path
        d="M111 103h17v17h-17zm17 17h17v17h-17zm17-17h17v17h-17z"
        fill="#f6ce53"
      />
      <path d="M79 176h128l18 38H61z" fill="#eab633" />
      <path d="M101 198v-16" stroke="#172d3a" strokeWidth="5" />
      <circle cx="101" cy="182" r="8" fill="#dc6654" />
      <circle cx="157" cy="196" r="6" fill="#2459ce" />
      <circle cx="180" cy="196" r="6" fill="#dc6654" />
      <path d="M68 221h151l-7 65H75z" fill="#24437e" />
      <rect x="122" y="235" width="40" height="22" rx="3" fill="#172d3a" />
      <rect x="131" y="240" width="4" height="12" fill="#d0dce4" />
      <path d="M50 301h190" stroke="#8babef" strokeWidth="3" />
    </svg>
  );
}

function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    node?.querySelector("input,button,select")?.focus();
    const handle = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [
          ...node.querySelectorAll("button,input,select,textarea,a[href]"),
        ].filter((e) => !e.disabled);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Empty({ icon: Icon = Gamepad2, title, children }) {
  return (
    <div className="empty">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function ErrorLine({ children }) {
  return children ? (
    <p className="error" role="alert">
      {children}
    </p>
  ) : null;
}
function App() {
  const [route, setRoute] = useState(current),
    [me, setMe] = useState(null),
    [csrfState, setCsrfState] = useState(null),
    [setup, setSetup] = useState(false),
    [initialized, setInitialized] = useState(false);
  const [home, setHome] = useState({
      games: [],
      rooms: [],
      recent: [],
      stats: {},
    }),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [search, setSearch] = useState(""),
    [socket, setSocket] = useState(null),
    [busy, setBusy] = useState(false),
    [player, setPlayer] = useState(false);
  const refreshHome = () =>
    api("/home")
      .then(setHome)
      .catch((e) => setError(e.message));
  async function refreshMe() {
    const result = await api("/auth/me");
    setMe(result.user);
    setCsrf(result.csrf);
    setCsrfState(result.csrf);
    setSetup(result.setupRequired);
    setInitialized(true);
    return result;
  }
  useEffect(() => {
    const preference = me?.theme || "light";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        preference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preference;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [me?.theme, me?.id]);
  useEffect(() => {
    refreshMe().catch((e) => setError(e.message));
    refreshHome();
    const change = () => {
      setRoute(current());
      setError("");
      setPlayer(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    refreshHome();
    if (!me || !csrfState) {
      setSocket(null);
      return;
    }
    const s = io({ auth: { csrf: csrfState } });
    setSocket(s);
    s.on("lobby:changed", refreshHome);
    s.on("medals:earned", (earned) => {
      setToast(
        earned.length === 1
          ? "Medalla conseguida: " + earned[0].title
          : "Has conseguido " +
              earned.length +
              " medallas. Míralas en tu perfil.",
      );
      window.dispatchEvent(new Event("arcade:medals"));
    });
    s.on("connect_error", () =>
      setError(
        "No se pudo conectar con las salas en tiempo real. Recarga si tu sesión ha caducado.",
      ),
    );
    return () => s.disconnect();
  }, [me?.id, csrfState]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  async function action(fn, message) {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      if (message) setToast(message);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const authNeeded = () => {
    if (!me) {
      setModal("auth");
      return true;
    }
    return false;
  };
  function createRoom(g) {
    if (authNeeded()) return;
    setSelected(g || home.games[0]);
    setModal("room");
  }
  async function enterRoom(id, invitation) {
    if (authNeeded()) return;
    await action(async () => {
      await post(`/rooms/${id}/join`, { invitation });
      navigate("room/" + id);
    });
  }
  useEffect(() => {
    if (route.startsWith("invite/") && me) {
      const [, id, invitation] = route.split("/");
      enterRoom(id, invitation);
    }
  }, [route, me?.id]);
  const nav = [
    ["home", "Inicio", Gamepad2],
    ["rooms", "Salas", Users],
    ["scores", "Marcadores", Trophy],
  ];
  const page = route.split("/")[0];
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content").focus();
        }}
      >
        Saltar al contenido
      </a>
      <header>
        <div className="header-inner">
          <a className="brand" href="#/home">
            <img src="/favicon.svg" alt="" />
            <span>
              Salón<span className="brand-light">Arcade</span>
            </span>
          </a>
          <nav aria-label="Navegación principal">
            {nav.map(([path, label, Icon]) => (
              <a
                key={path}
                href={"#/" + path}
                className={page === path ? "active" : ""}
              >
                <Icon size={17} />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="account-nav">
            {me ? (
              <>
                <button
                  className="profile-button"
                  onClick={() => navigate("profile")}
                >
                  <span className="avatar">
                    {me.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span>{me.username}</span>
                </button>
                <button
                  className="icon-button logout"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  onClick={() =>
                    action(async () => {
                      await post("/auth/logout");
                      await refreshMe();
                      navigate("home");
                    })
                  }
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button className="button small" onClick={() => setModal("auth")}>
                Entrar <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {error && (
          <div className="global-error">
            <ErrorLine>{error}</ErrorLine>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Cerrar aviso"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!initialized ? (
          <div className="loading">Preparando el salón…</div>
        ) : page === "home" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="local-tag">
                  <span /> Tu comunidad, tu salón
                </div>
                <h1>
                  Las buenas partidas
                  <br />
                  se juegan en compañía.
                </h1>
                <p>
                  Elige una recreativa, abre una sala y comparte la próxima
                  partida. Todo desde tu navegador.
                </p>
                <div className="hero-actions">
                  <button
                    className="button yellow"
                    onClick={() => createRoom()}
                  >
                    <Plus size={18} /> Crear una sala
                  </button>
                  <a className="hero-link" href="#/rooms">
                    Explorar las salas <ChevronRight size={17} />
                  </a>
                </div>
                <div className="hero-foot">
                  <span>
                    <Gamepad2 size={16} /> Hasta 4 jugadores según el juego
                  </span>
                  <span>
                    <MessageCircle size={16} /> Chat en cada sala
                  </span>
                </div>
              </div>
              <div className="hero-side">
                {me ? (
                  <div className="welcome">
                    <span className="avatar large">
                      {me.username[0].toUpperCase()}
                    </span>
                    <h2>
                      Tu ficha está lista,
                      <br />
                      {me.username}.
                    </h2>
                    <p>
                      Encuentra a tus amigos y prepara la siguiente partida.
                    </p>
                    <button
                      className="button yellow"
                      onClick={() => navigate("friends")}
                    >
                      <UserPlus size={17} /> Ver mis amigos
                    </button>
                  </div>
                ) : (
                  <div className="hero-login">
                    <Cabinet />
                    <div>
                      <h2>¿Te apuntas?</h2>
                      <p>
                        Entra con tu cuenta o crea una para unirte al salón.
                      </p>
                      <button
                        className="button light"
                        onClick={() => setModal("auth")}
                      >
                        Iniciar sesión <ChevronRight size={16} />
                      </button>
                      <button
                        className="text-button light-text"
                        onClick={() => setModal("register")}
                      >
                        Crear una cuenta
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Las recreativas del salón</h2>
                  <p>Una selección pequeña. Muchas partidas por delante.</p>
                </div>
                <span className="count">{home.games.length} juegos</span>
              </div>
              <div className="game-grid">
                {home.games.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    onPlay={() => createRoom(g)}
                    onScores={() => navigate("scores/" + g.id)}
                  />
                ))}
              </div>
            </section>
            <div className="home-columns">
              <section className="section">
                <div className="section-heading">
                  <h2>Salas abiertas</h2>
                  <a href="#/rooms">
                    Ver todas <ChevronRight size={16} />
                  </a>
                </div>
                {home.rooms.length ? (
                  <div className="room-list">
                    {home.rooms.slice(0, 4).map((r) => (
                      <RoomCard
                        key={r.id}
                        room={r}
                        onEnter={() => enterRoom(r.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Users}
                    title={
                      me
                        ? "Hay sitio para la primera partida"
                        : "Las salas te esperan"
                    }
                  >
                    {me
                      ? "Abre una sala y avisa a tus amigos."
                      : "Inicia sesión para descubrir las salas de la comunidad."}
                  </Empty>
                )}
              </section>
              <section className="section activity-section">
                <div className="section-heading">
                  <h2>Últimas partidas</h2>
                  <Clock size={19} />
                </div>
                {home.recent.length ? (
                  <ul className="activity">
                    {home.recent.map((p, i) => (
                      <li key={i}>
                        <span className="avatar subtle">{p.username[0]}</span>
                        <div>
                          <strong>{p.username}</strong>
                          <span>{p.title}</span>
                        </div>
                        <time>{time(p.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon={Clock} title="El historial empieza contigo">
                    Las partidas aparecerán aquí cuando alguien empiece a jugar.
                  </Empty>
                )}
                <div className="latest-added">
                  <h3>Últimos juegos añadidos</h3>
                  {home.games.slice(0, 3).map((g) => (
                    <div key={g.id}>
                      <span>{g.title}</span>
                      <small>
                        {new Date(g.created_at).toLocaleDateString("es-ES")}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : page === "rooms" ? (
          <section className="section">
            <div className="page-heading">
              <div>
                <h1>Encuentra tu partida</h1>
                <p>
                  Únete para jugar o quédate a charlar cuando los puestos estén
                  llenos.
                </p>
              </div>
              <button className="button" onClick={() => createRoom()}>
                <Plus size={18} /> Crear sala
              </button>
            </div>
            <label className="search">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar sala o juego"
              />
            </label>
            {!me ? (
              <Empty icon={Lock} title="Entra en la comunidad">
                <button className="button" onClick={() => setModal("auth")}>
                  Iniciar sesión
                </button>
              </Empty>
            ) : home.rooms.filter((r) =>
                (r.name + r.game.title)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ).length ? (
              <div className="room-grid">
                {home.rooms
                  .filter((r) =>
                    (r.name + r.game.title)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((r) => (
                    <RoomCard
                      key={r.id}
                      room={r}
                      onEnter={() => enterRoom(r.id)}
                    />
                  ))}
              </div>
            ) : (
              <Empty icon={Users} title="Todavía no hay salas para mostrar">
                Crea una sala pública, busca a tus amigos o entra con una
                invitación.
              </Empty>
            )}
          </section>
        ) : page === "room" ? (
          me ? (
            <RoomView
              id={route.split("/")[1]}
              me={me}
              socket={socket}
              action={action}
              toast={setToast}
              busy={busy}
              player={player}
              setPlayer={setPlayer}
            />
          ) : (
            <LoginRequired onLogin={() => setModal("auth")} />
          )
        ) : page === "scores" ? (
          <Scores
            games={home.games}
            gameId={route.split("/")[1]}
            me={me}
            action={action}
            toast={setToast}
            onAuth={() => setModal("auth")}
          />
        ) : page === "profile" ? (
          me ? (
            <Profile
              tab={route.split("/")[1]}
              me={me}
              refreshMe={refreshMe}
              action={action}
              toast={setToast}
            />
          ) : (
            <LoginRequired onLogin={() => setModal("auth")} />
          )
        ) : page === "friends" ? (
          me ? (
            <Friends me={me} action={action} />
          ) : (
            <LoginRequired onLogin={() => setModal("auth")} />
          )
        ) : page === "admin" ? (
          me?.role === "admin" ? (
            <Admin
              games={home.games}
              action={action}
              refreshHome={refreshHome}
            />
          ) : (
            <Empty
              icon={Shield}
              title="Se necesita una cuenta de administrador"
            />
          )
        ) : page === "invite" ? (
          <Empty icon={Lock} title="Invitación a una sala">
            {me ? (
              "Comprobando la invitación…"
            ) : (
              <button className="button" onClick={() => setModal("auth")}>
                Inicia sesión para aceptar
              </button>
            )}
          </Empty>
        ) : (
          <Empty title="Página no encontrada">
            <a href="#/home">Volver al inicio</a>
          </Empty>
        )}
      </main>
      <footer>
        <a className="footer-brand" href="#/home">
          Salón Arcade
        </a>
        <span>Otra ficha. Otra partida.</span>
        <div>
          {me && <a href="#/friends">Amigos</a>}
          {me?.role === "admin" && <a href="#/admin">Administración</a>}
          <span className="network-status">
            <span /> Servidor de la comunidad
          </span>
        </div>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
      {(modal === "auth" || modal === "register") && (
        <Dialog
          title={
            modal === "register" ? "Crear una cuenta" : "Bienvenido al salón"
          }
          onClose={() => setModal(null)}
        >
          <Auth
            initialRegister={modal === "register"}
            setup={setup}
            onDone={async () => {
              await refreshMe();
              refreshHome();
              setModal(null);
            }}
          />
        </Dialog>
      )}
      {modal === "room" && (
        <Dialog title="Prepara tu sala" onClose={() => setModal(null)}>
          <RoomForm
            games={home.games}
            selected={selected}
            onSubmit={async (body) => {
              const r = await action(() => post("/rooms", body));
              if (r) {
                setModal(null);
                navigate("room/" + r.id);
                refreshHome();
              }
            }}
          />
        </Dialog>
      )}
    </>
  );
}
function LoginRequired({ onLogin }) {
  return (
    <Empty icon={Lock} title="Inicia sesión para continuar">
      <button className="button" onClick={onLogin}>
        Iniciar sesión
      </button>
    </Empty>
  );
}
function GameCard({ game: g, onPlay, onScores }) {
  return (
    <article className="game-card">
      <button
        className="art-button"
        onClick={onPlay}
        aria-label={"Crear sala de " + g.title}
      >
        <GameArt id={g.id} />
        <span className="players-label">
          <Users size={13} />
          {g.max_players}
          {g.playMode === "alternating" ? " · por turnos" : ""}
        </span>
      </button>
      <div className="game-card-info">
        <span className="game-maker">
          {g.maker} / {g.year}
        </span>
        <h3>{g.title}</h3>
        <div className="game-meta">
          <span>{g.genre}</span>
          <span
            className={
              "availability " + (g.ready && g.emulatorReady ? "ready" : "")
            }
          >
            {g.ready && g.emulatorReady
              ? "Listo para probar"
              : "Preparando juego"}
          </span>
        </div>
        <div className="game-actions">
          <button onClick={onPlay}>
            Abrir sala <Plus size={15} />
          </button>
          <button onClick={onScores} aria-label={"Ver marcador de " + g.title}>
            <Trophy size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
function RoomCard({ room: r, onEnter }) {
  const players = r.members.filter((m) => m.slot).length;
  return (
    <article className="room-card">
      <div className={"room-game-icon art-" + r.game.id}>
        <Gamepad2 size={25} />
      </div>
      <div className="room-summary">
        <h3>{r.name}</h3>
        <p>
          {r.game.title}
          <span>con {r.owner}</span>
        </p>
        <div className="room-tags">
          <span>
            <PrivacyIcon value={r.visibility} />
            {privacy[r.visibility]}
          </span>
          <span>
            <Users size={13} />
            {players}/{r.game.max_players} jugadores
          </span>
          <span>
            <MessageCircle size={13} />
            {r.members.length}
          </span>
        </div>
      </div>
      <button className="button secondary small" onClick={onEnter}>
        Entrar <ChevronRight size={14} />
      </button>
    </article>
  );
}

function Auth({ initialRegister, setup, onDone }) {
  const [register, setRegister] = useState(initialRegister),
    [challenge, setChallenge] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/auth/challenge")
      .then(setChallenge)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (register) load();
  }, [register]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (register) {
        b.challengeId = challenge?.id;
        await post("/auth/register", b);
      } else await post("/auth/login", b);
      await onDone();
    } catch (e) {
      setError(e.message);
      if (register) load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="tabs">
        <button
          onClick={() => setRegister(false)}
          className={!register ? "selected" : ""}
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => setRegister(true)}
          className={register ? "selected" : ""}
        >
          Crear cuenta
        </button>
      </div>
      <form onSubmit={submit} className="stack">
        <label>
          Nombre de usuario
          <input
            name="username"
            autoComplete="username"
            minLength={register ? 3 : 1}
            maxLength={24}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 12 : 1}
            maxLength={200}
            required
          />
          {register && <small>Usa al menos 12 caracteres.</small>}
        </label>
        {register && (
          <>
            <label className="honeypot" aria-hidden="true">
              Sitio web
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label>
              {challenge?.question || "Cargando comprobación…"}
              <input
                name="answer"
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </label>
            {setup && (
              <label>
                Código de instalación
                <input name="setupCode" required autoComplete="off" />
                <small>
                  El servidor muestra este código para crear la primera cuenta
                  de administrador.
                </small>
              </label>
            )}
            <p className="form-note">
              <Shield size={16} /> Registro abierto con comprobación antispam y
              límites de intentos.
            </p>
          </>
        )}
        <ErrorLine>{error}</ErrorLine>
        <button
          className="button full"
          disabled={busy || (register && !challenge)}
        >
          {busy
            ? "Un momento…"
            : register
              ? "Crear mi cuenta"
              : "Entrar al salón"}
          <ChevronRight size={17} />
        </button>
      </form>
    </>
  );
}
function RoomForm({ games, selected, onSubmit }) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        setBusy(false);
      }}
    >
      <label>
        Nombre de la sala
        <input
          name="name"
          required
          minLength={3}
          maxLength={64}
          placeholder="La última y nos vamos"
        />
      </label>
      <label>
        Juego
        <select name="gameId" defaultValue={selected?.id}>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title} · {g.max_players} jugadores
            </option>
          ))}
        </select>
      </label>
      <label>
        Quién puede entrar
        <select name="visibility">
          <option value="public">Cualquier miembro de la comunidad</option>
          <option value="friends">
            Mis amigos y quienes reciban invitación
          </option>
          <option value="invite">Solo quienes reciban invitación</option>
        </select>
      </label>
      <p className="form-note">
        El anfitrión ocupa el primer puesto. Los demás entran al chat y pueden
        pedir un puesto libre.
      </p>
      <button className="button" disabled={busy}>
        Crear sala <Plus size={17} />
      </button>
    </form>
  );
}

function MessageBody({ text }) {
  const pieces = text.split(/(https?:\/\/[^\s<>]+)/g);
  return (
    <p className="message-body">
      {pieces.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}
function VideoLinks({ text }) {
  const urls = text.match(/https?:\/\/[^\s<>]+/g) || [];
  return urls.slice(0, 2).map((value, i) => {
    try {
      const u = new URL(value);
      let src;
      if (
        ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
      ) {
        const id =
          u.searchParams.get("v") ||
          u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
        if (/^[\w-]{11}$/.test(id || ""))
          src = "https://www.youtube-nocookie.com/embed/" + id;
      } else if (u.hostname === "youtu.be" && /^\/[\w-]{11}$/.test(u.pathname))
        src = "https://www.youtube-nocookie.com/embed" + u.pathname;
      else if (
        ["vimeo.com", "www.vimeo.com"].includes(u.hostname) &&
        /^\/\d+$/.test(u.pathname)
      )
        src = "https://player.vimeo.com/video" + u.pathname;
      if (src)
        return (
          <details className="video-preview" key={i}>
            <summary>
              Ver vídeo de {u.hostname} <ExternalLink size={12} />
            </summary>
            <iframe
              loading="lazy"
              src={src}
              title={"Vídeo de " + u.hostname}
              allow="fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
              allowFullScreen
            />
          </details>
        );
    } catch {}
    return null;
  });
}
function RoomView({ id, me, socket, action, toast, busy, player, setPlayer }) {
  const [room, setRoom] = useState(null),
    [touchPlayer, setTouchPlayer] = useState(false),
    [messages, setMessages] = useState([]),
    [body, setBody] = useState(""),
    [file, setFile] = useState(null),
    [invite, setInvite] = useState(null),
    [error, setError] = useState("");
  const end = useRef(),
    playerFrame = useRef();
  useEffect(() => {
    setTouchPlayer(false);
    const onPlayerMessage = (event) => {
      if (
        event.origin === location.origin &&
        event.source === playerFrame.current?.contentWindow &&
        event.data?.type === "arcade:touch"
      )
        setTouchPlayer(event.data.enabled === true);
    };
    window.addEventListener("message", onPlayerMessage);
    return () => window.removeEventListener("message", onPlayerMessage);
  }, [id, player]);
  const load = () =>
    api("/rooms/" + id)
      .then(setRoom)
      .catch((e) => setError(e.message));
  const loadMessages = () =>
    api(`/rooms/${id}/messages`)
      .then(setMessages)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    loadMessages();
    setInvite(null);
  }, [id]);
  useEffect(() => {
    if (!socket) return;
    const watch = () =>
      socket.emit("room:watch", { roomId: id }, (result) => {
        if (!result.ok) setError(result.error);
      });
    const change = () => {
        load();
      },
      message = (m) =>
        setMessages((old) =>
          old.some((x) => x.id === m.id) ? old : [...old, m],
        ),
      closed = () => {
        setPlayer(false);
        navigate("rooms");
        toast("El anfitrión ha cerrado la sala.");
      },
      reset = () => {
        setPlayer(false);
        load();
        toast("Nueva partida preparada. Conecta de nuevo para jugar.");
      };
    watch();
    socket.on("connect", watch);
    socket.on("room:changed", change);
    socket.on("chat:message", message);
    socket.on("chat:refresh", loadMessages);
    socket.on("room:closed", closed);
    socket.on("game:reset", reset);
    return () => {
      socket.emit("room:unwatch", { roomId: id });
      socket.off("connect", watch);
      socket.off("room:changed", change);
      socket.off("chat:message", message);
      socket.off("chat:refresh", loadMessages);
      socket.off("room:closed", closed);
      socket.off("game:reset", reset);
    };
  }, [socket, id]);
  useEffect(() => {
    const container = end.current?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);
  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!room) return <div className="loading">Abriendo sala…</div>;
  const self = room.members.find((m) => m.id === me.id),
    owner = room.owner_id === me.id,
    slots = room.members.filter((m) => m.slot).length,
    joined = !!self;
  async function send(e) {
    e.preventDefault();
    if (!body.trim() && !file) return;
    const done = await action(async () => {
      let imageId;
      if (file) imageId = (await upload(file, { room: id })).id;
      const m = await post(`/rooms/${id}/messages`, { body, imageId });
      setMessages((old) =>
        old.some((x) => x.id === m.id) ? old : [...old, m],
      );
      return true;
    });
    if (done) {
      setBody("");
      setFile(null);
      e.target.reset();
    }
  }
  return (
    <section className="section room-page">
      <a className="back-link" href="#/rooms">
        Salas / {room.game.title}
      </a>
      <div className="page-heading">
        <div>
          <h1>{room.name}</h1>
          <p>
            <PrivacyIcon value={room.visibility} /> {privacy[room.visibility]}{" "}
            <span className="dot-separator" /> Anfitrión: {room.owner}
          </p>
        </div>
        {joined ? (
          <button
            className="button secondary"
            onClick={() =>
              action(async () => {
                if (
                  owner &&
                  !confirm(
                    "Cerrar la sala finalizará la partida para todos. ¿Continuar?",
                  )
                )
                  return;
                setPlayer(false);
                await post(`/rooms/${id}/leave`);
                navigate("rooms");
              })
            }
          >
            {owner ? "Cerrar sala" : "Salir de la sala"} <LogOut size={16} />
          </button>
        ) : (
          <button
            className="button"
            onClick={() =>
              action(async () => {
                await post(`/rooms/${id}/join`);
                load();
                loadMessages();
              })
            }
          >
            Entrar a la sala
          </button>
        )}
      </div>
      <div className="room-layout">
        <div className="game-panel">
          <div
            className={
              "play-screen" + (player && touchPlayer ? " touch-screen" : "")
            }
          >
            {player ? (
              <>
                <iframe
                  ref={playerFrame}
                  src={"/play.html?room=" + id}
                  title={"Partida de " + room.game.title}
                  allow="autoplay; fullscreen; gamepad"
                  allowFullScreen
                />
                <button
                  className="close-player"
                  onClick={() => setPlayer(false)}
                >
                  Cerrar partida <X size={14} />
                </button>
              </>
            ) : (
              <>
                <GameArt id={room.game.id} />
                <div className="screen-copy">
                  <Gamepad2 size={32} />
                  <h2>{room.game.title}</h2>
                  <p>
                    {!joined
                      ? "Entra a la sala para participar."
                      : !self.slot
                        ? "Estás en el chat. Pide un puesto libre para jugar."
                        : !room.game.ready
                          ? "El administrador está preparando los archivos de este juego."
                          : !room.game.emulatorReady
                            ? "El emulador todavía no está instalado."
                            : owner
                              ? "Inicia la partida en el servidor para conectar a los jugadores."
                              : room.live
                                ? "El servidor está listo. Puedes conectarte."
                                : "El servidor iniciará el juego al conectarte."}
                  </p>
                  {self?.slot && room.game.ready && room.game.emulatorReady && (
                    <button
                      className="button yellow"
                      onClick={() => setPlayer(true)}
                    >
                      <Play size={17} />
                      {owner ? "Iniciar partida" : "Conectar a la partida"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="seat-heading">
            <h3>Puestos de juego</h3>
            <span>
              {slots}/{room.game.max_players}
            </span>
          </div>
          <div className="info-note">
            Partida ejecutada en el servidor · Un crédito por jugador, sin
            continuaciones.
            {room.game.scoreSupported
              ? " Tu resultado se registra automáticamente; no necesitas una captura."
              : " El lector automático de este juego está en validación; esta partida todavía no publica resultados."}
            {room.game.controlHint && " " + room.game.controlHint}
          </div>
          {owner && (
            <button
              className="button secondary"
              onClick={() =>
                action(async () => {
                  if (
                    !confirm(
                      "Finalizar la partida actual y preparar otra para todos los jugadores?",
                    )
                  )
                    return;
                  await post(`/rooms/${id}/restart`);
                  setPlayer(false);
                  load();
                })
              }
            >
              Preparar nueva partida
            </button>
          )}
          <div className="seats">
            {Array.from({ length: room.game.max_players }, (_, i) => {
              const m = room.members.find((m) => m.slot === i + 1);
              return (
                <div key={i} className={"seat " + (m ? "occupied" : "")}>
                  <span className="slot">P{i + 1}</span>
                  <div>
                    <strong>{m?.username || "Puesto libre"}</strong>
                    <small>
                      {m?.id === room.owner_id
                        ? "Anfitrión"
                        : m
                          ? "Jugador"
                          : "Puedes unirte"}
                    </small>
                  </div>
                  {m?.id === me.id && <span className="you">Tú</span>}
                </div>
              );
            })}
          </div>
          {joined && !owner && (
            <button
              className="button secondary"
              disabled={busy || (!self.slot && slots === room.game.max_players)}
              onClick={() =>
                action(async () => {
                  setPlayer(false);
                  await post(`/rooms/${id}/seat`, { play: !self.slot });
                  load();
                })
              }
            >
              {self.slot
                ? "Dejar mi puesto y seguir en el chat"
                : slots === room.game.max_players
                  ? "Partida llena · Puedes usar el chat"
                  : "Ocupar un puesto libre"}
            </button>
          )}
          <div className="room-about">
            <h3>Antes de jugar</h3>
            <p>
              La partida se ejecuta en el navegador del anfitrión. Su pestaña
              debe permanecer abierta. Los miembros del chat no reciben imagen
              ni controles.
            </p>
            <p>{room.game.rules}</p>
            <a href={"#/scores/" + room.game.id}>
              <Trophy size={15} /> Ver marcador y enviar puntuación
            </a>
          </div>
          {owner && (
            <div className="invite-panel">
              <h3>Invita a alguien</h3>
              <p>Cada enlace sirve para una persona y caduca en 48 horas.</p>
              <button
                className="button secondary small"
                onClick={() =>
                  action(async () => {
                    const inv = await post(`/rooms/${id}/invites`);
                    setInvite({
                      ...inv,
                      url:
                        location.origin + "/#/invite/" + id + "/" + inv.token,
                    });
                  })
                }
              >
                <UserPlus size={15} /> Crear invitación
              </button>
              {invite && (
                <div className="invite-link">
                  <input
                    readOnly
                    value={invite.url}
                    aria-label="Enlace de invitación"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="icon-button"
                    aria-label="Copiar invitación"
                    onClick={() =>
                      action(async () => {
                        if (navigator.clipboard) {
                          await navigator.clipboard.writeText(invite.url);
                          toast("Invitación copiada.");
                        } else toast("Selecciona y copia el enlace.");
                      })
                    }
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Revocar invitación"
                    onClick={() =>
                      action(async () => {
                        await api(`/rooms/${id}/invites/${invite.id}`, {
                          method: "DELETE",
                        });
                        setInvite(null);
                      }, "Invitación revocada.")
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <aside className="chat-panel">
          <div className="chat-heading">
            <h2>
              <MessageCircle size={19} /> Chat de la sala
            </h2>
            <span>
              {room.members.length}{" "}
              {room.members.length === 1 ? "miembro" : "miembros"}
            </span>
          </div>
          <div className="chat-members">
            {room.members.map((m) => (
              <span
                key={m.id}
                title={m.slot ? "Jugador " + m.slot : "Solo chat"}
              >
                <span className="presence-dot" />
                {m.username}
              </span>
            ))}
          </div>
          <div className="messages" aria-live="polite">
            {messages.length ? (
              messages.map((m) => (
                <article
                  className={"message " + (m.userId === me.id ? "own" : "")}
                  key={m.id}
                >
                  <div className="message-heading">
                    <strong>{m.username}</strong>
                    <time>
                      {new Date(m.created_at).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {(owner || me.role === "admin") && (
                      <button
                        className="icon-button"
                        aria-label="Borrar mensaje"
                        onClick={() =>
                          action(() =>
                            api(`/rooms/${id}/messages/${m.id}`, {
                              method: "DELETE",
                            }),
                          )
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <MessageBody text={m.body} />
                  {m.imageId && (
                    <a
                      href={"/api/images/" + m.imageId}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="chat-image"
                        src={"/api/images/" + m.imageId}
                        alt={"Imagen compartida por " + m.username}
                      />
                    </a>
                  )}
                  <VideoLinks text={m.body} />
                </article>
              ))
            ) : (
              <Empty icon={MessageCircle} title="Aquí empieza la conversación">
                Saluda, comparte una imagen o pega un enlace de YouTube o Vimeo.
              </Empty>
            )}
            <div ref={end} />
          </div>
          <form className="chat-form" onSubmit={send}>
            {file && (
              <div className="attachment">
                {file.name}
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setFile(null)}
                  aria-label="Quitar imagen"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="Escribe a la sala…"
              aria-label="Mensaje para la sala"
              disabled={!joined}
            />
            <div>
              <label className="upload-label" title="Adjuntar imagen">
                <ImageIcon size={20} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  disabled={!joined}
                />
                <span>Imagen</span>
              </label>
              <button
                className="button small"
                disabled={busy || !joined || (!body.trim() && !file)}
              >
                <Send size={16} /> Enviar
              </button>
            </div>
            <small>PNG, JPEG o WebP · Hasta 4 MB</small>
          </form>
        </aside>
      </div>
    </section>
  );
}

function Scores({ games, gameId, me, action, toast, onAuth }) {
  const [data, setData] = useState(null),
    [mine, setMine] = useState([]),
    [error, setError] = useState("");
  const selected = games.find((g) => g.id === gameId) || games[0];
  const load = () => {
    if (selected)
      api(`/games/${selected.id}/scores`)
        .then(setData)
        .catch((e) => setError(e.message));
    if (me)
      api("/scores/mine")
        .then(setMine)
        .catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [selected?.id, me?.id]);
  return (
    <section className="section">
      <div className="page-heading">
        <div>
          <h1>El marcador del salón</h1>
          <p>Resultados obtenidos automáticamente por el motor del servidor.</p>
        </div>
      </div>
      <div className="score-layout">
        <aside className="score-games">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate("scores/" + g.id)}
              className={selected?.id === g.id ? "selected" : ""}
            >
              <Gamepad2 size={19} />
              <span>{g.title}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </aside>
        <div className="score-main">
          <ErrorLine>{error}</ErrorLine>
          <div className="score-title">
            <Trophy size={27} />
            <div>
              <h2>{selected?.title}</h2>
              <p>{selected?.scoreLabel || "Mejor puntuación por usuario"}</p>
            </div>
          </div>
          {!selected?.scoreSupported && (
            <p className="info-note">
              El lector de resultados de este juego está en validación. Hasta
              completarla, las partidas no publican puntuaciones.
            </p>
          )}
          {data?.scores.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Puesto</th>
                    <th>Jugador</th>
                    <th>{selected?.scoreLabel || "Puntuación"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scores.map((s, i) => (
                    <tr key={s.userId}>
                      <td>
                        <span className={"rank rank-" + i}>{i + 1}</span>
                      </td>
                      <td>
                        {s.username}
                        {s.userId === me?.id && <span className="you">Tú</span>}
                      </td>
                      <td className="numeric">
                        {number(s.value)}
                        {selected?.scoreUnit && ` ${selected.scoreUnit}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Trophy} title="Un récord por estrenar">
              Todavía no hay resultados automáticos de este juego.
            </Empty>
          )}
          <div className="rules">
            <Shield size={19} />
            <div>
              <h3>Todos jugamos con las mismas reglas</h3>
              <p>{selected?.rules}</p>
              <p>
                El navegador no puede enviar una puntuación ni importar archivos
                de récords. Solo cuentan los resultados que lee el servidor.
              </p>
            </div>
          </div>
          {me && (
            <div className="my-scores">
              <h3>Mis resultados</h3>
              {mine.filter((s) => s.game_id === selected?.id).length ? (
                mine
                  .filter((s) => s.game_id === selected?.id)
                  .map((s) => (
                    <div key={s.id}>
                      <strong>
                        {number(s.value)}
                        {selected?.scoreUnit && ` ${selected.scoreUnit}`}
                      </strong>
                      <span className={"status " + s.status}>
                        {
                          {
                            pending: "Partida en curso",
                            approved: "Registrada",
                            rejected: "Rechazada",
                          }[s.status]
                        }
                      </span>
                      <small>{time(s.created_at)}</small>
                    </div>
                  ))
              ) : (
                <p>Todavía no tienes resultados registrados para este juego.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Profile({ me, refreshMe, action, tab = "actividad" }) {
  const [controls, setControls] = useState({
      ...defaultControls,
      ...me.controls,
    }),
    [capturing, setCapturing] = useState(null);
  useEffect(() => {
    if (!capturing) return;
    const event = (e) => {
      e.preventDefault();
      if (e.key !== "Escape")
        setControls((old) => ({ ...old, [capturing]: keyName(e) }));
      setCapturing(null);
    };
    window.addEventListener("keydown", event, true);
    return () => window.removeEventListener("keydown", event, true);
  }, [capturing]);
  return (
    <section className="section">
      <div className="page-heading">
        <div>
          <h1>Tu rincón del salón</h1>
          <p>Tu actividad, tus marcas y las opciones de tu cuenta.</p>
        </div>
        <span className="profile-name">
          <span className="avatar">{me.username[0]}</span>
          {me.username}
        </span>
      </div>
      <nav className="profile-tabs" aria-label="Secciones de mi cuenta">
        {[
          ["actividad", "Mi actividad"],
          ["medallas", "Mis medallas"],
          ["opciones", "Mis opciones"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={"#/profile/" + id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "selected" : ""}
          >
            {label}
          </a>
        ))}
      </nav>
      {tab === "actividad" && <ProfileOverview />}
      {tab === "medallas" && <MedalsPanel />}
      {tab === "opciones" && (
        <>
          <section
            className="appearance-panel"
            aria-label="Apariencia de mi cuenta"
          >
            <div>
              <h2>A tu gusto</h2>
              <p>
                Elige el aspecto del salón. Se guarda en tu cuenta y se aplica
                en tus dispositivos al iniciar sesión.
              </p>
            </div>
            <label>
              Modo de color
              <select
                aria-label="Modo de color"
                value={me.theme || "light"}
                onChange={(e) => {
                  const theme = e.target.value;
                  action(async () => {
                    await api("/profile/theme", {
                      method: "PUT",
                      body: { theme },
                    });
                    await refreshMe();
                  }, "Apariencia guardada.");
                }}
              >
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
                <option value="system">Seguir el sistema</option>
              </select>
            </label>
          </section>
          <div className="profile-options">
            <section className="settings-panel">
              <h2>
                <Keyboard size={22} /> Tus controles
              </h2>
              <p>
                Pulsa una tecla para cambiarla. Se aplicará al abrir tu próxima
                partida.
              </p>
              <div className="controls-grid">
                {Object.entries(controlLabels).map(([key, label]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <button
                      className={
                        "keycap " + (capturing === key ? "capturing" : "")
                      }
                      onClick={() => setCapturing(key)}
                    >
                      {capturing === key ? "Pulsa una tecla…" : controls[key]}
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="button"
                onClick={() =>
                  action(async () => {
                    await api("/profile/controls", {
                      method: "PUT",
                      body: controls,
                    });
                    await refreshMe();
                  }, "Controles guardados.")
                }
              >
                Guardar controles
              </button>
              <GamepadSettings me={me} refreshMe={refreshMe} action={action} />
              <a href="#/friends">
                <UserPlus size={16} /> Gestionar mis amigos
              </a>
              <AccountSecurity action={action} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}
function Friends({ me, action }) {
  const [friends, setFriends] = useState([]),
    [users, setUsers] = useState([]),
    [search, setSearch] = useState("");
  const load = () => api("/friends").then(setFriends);
  useEffect(() => {
    action(load);
  }, []);
  return (
    <section className="section">
      <div className="page-heading">
        <div>
          <h1>Jugar entre amigos</h1>
          <p>
            Acepta una solicitud para que podáis entrar en vuestras salas de
            amigos.
          </p>
        </div>
      </div>
      <div className="profile-grid">
        <div className="settings-panel">
          <h2>
            <Users size={22} /> Mis amigos y solicitudes
          </h2>
          {friends.length ? (
            friends.map((f) => (
              <div key={f.id} className="friend-row">
                <span className="avatar">{f.username[0]}</span>
                <div>
                  <strong>{f.username}</strong>
                  <small>
                    {f.status === "accepted"
                      ? "Amigos"
                      : f.recipient === me.id
                        ? "Solicitud recibida"
                        : "Solicitud enviada"}
                  </small>
                </div>
                {f.status === "pending" && f.recipient === me.id && (
                  <button
                    className="button small"
                    onClick={() =>
                      action(async () => {
                        await post("/friends/" + f.sender + "/accept");
                        load();
                      })
                    }
                  >
                    Aceptar
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={"Eliminar a " + f.username}
                  onClick={() =>
                    action(async () => {
                      await api("/friends/" + f.id, { method: "DELETE" });
                      load();
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))
          ) : (
            <Empty icon={UserPlus} title="Tu grupo empieza aquí">
              Busca a alguien de la comunidad y envíale una solicitud.
            </Empty>
          )}
        </div>
        <div className="settings-panel">
          <h2>
            <Search size={22} /> Buscar miembros
          </h2>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () =>
                setUsers(await api("/users?q=" + encodeURIComponent(search))),
              );
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre de usuario"
              aria-label="Nombre de usuario"
              maxLength={24}
            />
            <button className="button">Buscar</button>
          </form>
          {users.map((u) => (
            <div className="friend-row" key={u.id}>
              <span className="avatar">{u.username[0]}</span>
              <strong>{u.username}</strong>
              <button
                className="button secondary small"
                disabled={friends.some((f) => f.id === u.id)}
                onClick={() =>
                  action(async () => {
                    await post("/friends", { userId: u.id });
                    load();
                  }, "Solicitud de amistad enviada.")
                }
              >
                Añadir
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Admin({ action, refreshHome }) {
  const [games, setGames] = useState([]),
    [editing, setEditing] = useState(null);
  const load = async () => {
    setGames(await api("/admin/games"));
  };
  useEffect(() => {
    action(load);
  }, []);
  return (
    <section className="section">
      <div className="page-heading">
        <div>
          <h1>Detrás de las recreativas</h1>
          <p>Gestiona el catálogo y las partidas ejecutadas por el servidor.</p>
        </div>
      </div>
      <AdminControl action={action} refreshGames={load}>
        <div className="section-heading">
          <h2>Catálogo de juegos</h2>
          <button
            className="button"
            onClick={() =>
              setEditing({
                max_players: 2,
                year: 1990,
                enabled: 1,
                rules:
                  "Configuración original. Sin trucos ni estados guardados.",
              })
            }
          >
            <Plus size={17} /> Añadir juego
          </button>
        </div>
        <div className="info-note">
          Las ROMs se leen desde <code>data/roms</code>. Usa el importador del
          proyecto para copiar los ZIP desde tu colección. El estado «Archivos
          presentes» todavía requiere una prueba de compatibilidad en el
          emulador.
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Juego</th>
                <th>Puestos</th>
                <th>Archivos</th>
                <th>Emulador</th>
                <th>Catálogo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{g.title}</strong>
                    <small>
                      {g.rom}
                      {g.bios ? " + " + g.bios : ""}
                    </small>
                  </td>
                  <td>{g.max_players}</td>
                  <td>
                    <span
                      className={"status " + (g.ready ? "approved" : "pending")}
                    >
                      {g.ready
                        ? "Archivos presentes"
                        : "Falta " + g.missing.join(", ")}
                    </span>
                  </td>
                  <td>{g.emulatorReady ? "Instalado" : "Pendiente"}</td>
                  <td>{g.enabled ? "Visible" : "Oculto"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setEditing(g)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <Dialog
            title={editing.id ? "Editar " + editing.title : "Añadir recreativa"}
            onClose={() => setEditing(null)}
          >
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const b = Object.fromEntries(new FormData(e.currentTarget));
                await action(async () => {
                  await api("/admin/games/" + b.id, {
                    method: "PUT",
                    body: {
                      ...b,
                      year: Number(b.year),
                      max_players: Number(b.max_players),
                      enabled: b.enabled === "1",
                    },
                  });
                  setEditing(null);
                  load();
                  refreshHome();
                }, "Catálogo actualizado.");
              }}
            >
              <label>
                Identificador
                <input
                  name="id"
                  defaultValue={editing.id}
                  readOnly={!!editing.id}
                  required
                  pattern="[a-z0-9_-]+"
                  maxLength={32}
                />
              </label>
              <label>
                Título
                <input name="title" defaultValue={editing.title} required />
              </label>
              <div className="form-columns">
                <label>
                  Año
                  <input
                    name="year"
                    type="number"
                    min="1970"
                    max="2100"
                    defaultValue={editing.year}
                    required
                  />
                </label>
                <label>
                  Jugadores
                  <select name="max_players" defaultValue={editing.max_players}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-columns">
                <label>
                  Fabricante
                  <input name="maker" defaultValue={editing.maker} required />
                </label>
                <label>
                  Género
                  <input name="genre" defaultValue={editing.genre} required />
                </label>
              </div>
              <label>
                Archivo ROM
                <input
                  name="rom"
                  defaultValue={editing.rom}
                  placeholder="juego.zip"
                  required
                />
              </label>
              <label>
                BIOS opcional
                <input
                  name="bios"
                  defaultValue={editing.bios || ""}
                  placeholder="neogeo.zip"
                />
              </label>
              <label>
                Visibilidad
                <select
                  name="enabled"
                  defaultValue={editing.enabled ? "1" : "0"}
                >
                  <option value="1">Visible</option>
                  <option value="0">Oculto</option>
                </select>
              </label>
              <label>
                Reglas del marcador
                <textarea
                  name="rules"
                  required
                  maxLength={1000}
                  defaultValue={editing.rules}
                />
              </label>
              <button className="button">Guardar juego</button>
            </form>
          </Dialog>
        )}
      </AdminControl>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
