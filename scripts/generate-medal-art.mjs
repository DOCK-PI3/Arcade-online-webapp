import { mkdir, writeFile } from "node:fs/promises";
import { generalMedals, championMedal } from "../config/medals.js";
import { medalSvg } from "../server/medal-art.js";
import { catalogAdditions } from "../server/catalog.js";
await mkdir(new URL("../public/medals/", import.meta.url), { recursive: true });
const games = [
  { id: "columns", title: "Columns" },
  { id: "contra", title: "Contra" },
  { id: "mslug", title: "Metal Slug" },
  { id: "mslug2", title: "Metal Slug 2" },
  { id: "1941", title: "1941: Counter Attack" },
  ...catalogAdditions.filter((g) => !["twcup98"].includes(g.id)),
];
for (const medal of [...generalMedals, ...games.map(championMedal)])
  await writeFile(
    new URL(`../public/medals/${medal.id}.svg`, import.meta.url),
    medalSvg(medal) + "\n",
  );
console.log(
  `${generalMedals.length} medallas generales y ${games.length} insignias de primer puesto.`,
);
