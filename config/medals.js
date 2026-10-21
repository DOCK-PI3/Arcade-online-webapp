// Stable IDs keep earned medals intact as the active catalog grows.
export const medalCategories = [
  { id: "play", label: "Partidas" },
  { id: "scores", label: "Marcadores" },
  { id: "explore", label: "Exploración" },
  { id: "rooms", label: "Salas" },
  { id: "community", label: "Comunidad" },
  { id: "habit", label: "Constancia" },
  { id: "settings", label: "A tu gusto" },
  { id: "champion", label: "Primeros puestos" },
];

const tracks = [
  [
    "scores",
    "scores",
    "trophy",
    [1, 20, 50, 100],
    [
      "Mi primera marca",
      "Veinte en el marcador",
      "Cincuenta resultados",
      "Centenario de marcas",
    ],
    (n) =>
      `Registra ${n === 1 ? "tu primera puntuación automática" : `${n} puntuaciones automáticas`} al terminar partidas.`,
  ],
  [
    "plays",
    "play",
    "joystick",
    [1, 10, 25, 50, 100],
    [
      "La primera moneda",
      "Diez oportunidades",
      "Un cuarto de centenar",
      "Cincuenta aventuras",
      "Cien partidas después",
    ],
    (n) =>
      `Juega ${n === 1 ? "tu primera partida" : `${n} partidas`}. Cuenta cuando el motor detecta que ya estás jugando.`,
  ],
  [
    "rooms",
    "rooms",
    "cabinet",
    [1, 5, 20, 50],
    [
      "Se abre el salón",
      "Anfitrión habitual",
      "Siempre hay sitio",
      "Maestro de ceremonias",
    ],
    (n) => `Crea ${n === 1 ? "tu primera sala" : `${n} salas`} de juego.`,
  ],
  [
    "catalog",
    "explore",
    "map",
    [1, 5, 10, "half", "all"],
    [
      "Enciende una recreativa",
      "Cinco mundos",
      "Ruta de diez juegos",
      "Medio salón recorrido",
      "Todas las recreativas",
    ],
    (n) =>
      n === "half"
        ? "Juega al menos a la mitad del catálogo activo del salón."
        : n === "all"
          ? "Juega a todos los juegos del catálogo activo del salón."
          : `Juega a ${n} ${n === 1 ? "juego del catálogo" : "juegos diferentes del catálogo"}.`,
  ],
  [
    "completed",
    "play",
    "flag",
    [1, 10, 25, 50, 100],
    [
      "Hasta la última vida",
      "Diez finales",
      "Veinticinco desenlaces",
      "Nunca dejo una a medias",
      "Veterano de cien finales",
    ],
    (n) =>
      `Finaliza ${n} ${n === 1 ? "participación" : "participaciones"} con puntuación automática registrada.`,
  ],
  [
    "shared",
    "play",
    "duel",
    [1, 5, 20, 50],
    [
      "Player two",
      "Cinco partidas en compañía",
      "Veinte a dobles",
      "Pareja de recreativas",
    ],
    (n) =>
      `Participa en ${n} ${n === 1 ? "partida" : "partidas"} donde también juegue otra persona. Pueden ser simultáneas o por turnos.`,
  ],
  [
    "friends",
    "community",
    "handshake",
    [1, 3, 5],
    ["Una cara conocida", "La pandilla", "Mesa para seis"],
    (n) =>
      `Conecta por amistad aceptada con ${n} ${n === 1 ? "persona" : "personas diferentes"}.`,
  ],
  [
    "visits",
    "rooms",
    "door",
    [1, 5, 20],
    ["Me paso por tu sala", "De sala en sala", "Conozco todos los rincones"],
    (n) =>
      `Entra en ${n} ${n === 1 ? "sala creada" : "salas diferentes creadas"} por otras personas.`,
  ],
  [
    "chatRooms",
    "community",
    "chat",
    [1, 5],
    ["¡Hola, salón!", "Conversaciones entre partidas"],
    (n) => `Envía un mensaje en ${n} ${n === 1 ? "sala" : "salas diferentes"}.`,
  ],
  [
    "imageRooms",
    "community",
    "image",
    [1],
    ["Una imagen para la pandilla"],
    () => "Comparte una imagen en el chat de una sala.",
  ],
  [
    "days",
    "habit",
    "calendar",
    [1, 7, 15, 30],
    [
      "Hoy se juega",
      "Siete días de arcade",
      "Quince días por aquí",
      "Treinta días en el salón",
    ],
    (n) =>
      `Juega en ${n} ${n === 1 ? "día" : "días diferentes"}. No tienen que ser consecutivos; se usa la hora de Canarias.`,
  ],
  [
    "records",
    "scores",
    "record",
    [1, 10, 50],
    ["Me he superado", "Diez pasos más arriba", "Mi rival soy yo"],
    (n) =>
      `Mejora ${n} ${n === 1 ? "vez" : "veces"} una marca personal anterior con un resultado finalizado.`,
  ],
  [
    "keyboard",
    "settings",
    "keyboard",
    [1],
    ["Mis teclas, mis reglas"],
    () => "Guarda una asignación de teclado personal.",
  ],
  [
    "gamepad",
    "settings",
    "controller",
    [1],
    ["Mando preparado"],
    () => "Guarda la asignación de botones de tu mando.",
  ],
  [
    "theme",
    "settings",
    "palette",
    [1],
    ["El salón a mi gusto"],
    () => "Elige y guarda la apariencia de tu cuenta.",
  ],
  [
    "boards",
    "explore",
    "board",
    [1, "all"],
    ["Echando un ojo al récord", "Conozco a los campeones"],
    (n) =>
      n === "all"
        ? "Consulta el marcador de todos los juegos del catálogo activo."
        : "Consulta el marcador de un juego mientras tienes la sesión iniciada.",
  ],
  [
    "makers",
    "explore",
    "factory",
    [3, 5],
    ["Tres sellos de arcade", "Cinco escuelas del arcade"],
    (n) => `Juega a títulos de ${n} fabricantes diferentes.`,
  ],
];

export const generalMedals = tracks.flatMap(
  ([metric, category, symbol, goals, titles, describe]) =>
    goals.map((goal, tier) => ({
      id: `${metric}-${goal}`,
      title: titles[tier],
      description: describe(goal),
      metric,
      goal,
      category,
      symbol,
      tier,
      image: `/medals/${metric}-${goal}.svg`,
    })),
);

export function championMedal(game) {
  return {
    id: `champion-${game.id}`,
    title: `N.º 1 en ${game.title}`,
    description: `Registra una puntuación automática finalizada que te coloque en el primer puesto de ${game.title}. En empates se aplica el mismo orden del marcador: puntuación y nombre de usuario.`,
    category: "champion",
    symbol: "crown",
    tier: 4,
    goal: 1,
    gameId: game.id,
    gameTitle: game.title,
    image: `/api/medals/champion/${encodeURIComponent(game.id)}.svg`,
  };
}
