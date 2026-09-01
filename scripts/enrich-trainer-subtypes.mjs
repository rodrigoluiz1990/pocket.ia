import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const RAW_ROOT = resolve(process.cwd(), "data", "raw", "pokemongohub");
const INDEX_PATH = resolve(RAW_ROOT, "index.json");
const ALL_PATH = resolve(RAW_ROOT, "all", "cards-synced.json");

function cleanHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findField(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const row = html.match(new RegExp(`<th[^>]*>${escaped}<\\/th><td[^>]*>([\\s\\S]*?)<\\/td>`, "i"));
  if (row) return cleanHtml(row[1]);

  const generic = html.match(new RegExp(`${escaped}\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return generic ? cleanHtml(generic[1]) : "";
}

async function readJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
}

async function fetchSubtype(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "pt-BR,pt;q=0.9"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return findField(await response.text(), "Categoria");
}

async function run() {
  const indexPayload = await readJson(INDEX_PATH);
  const files = Array.isArray(indexPayload?.files) ? indexPayload.files : [];
  const collections = [];

  for (const entry of files) {
    const path = resolve(process.cwd(), String(entry.path || "").replace(/^\.\//, ""));
    const cards = await readJson(path);
    collections.push({ path, cards: Array.isArray(cards) ? cards : [] });
  }

  const trainers = collections.flatMap(({ cards }) => cards).filter((card) => card?.tipo === "Treinador" && card?.sourceUrl);
  let cursor = 0;
  let updated = 0;
  const concurrency = 12;

  async function worker() {
    while (cursor < trainers.length) {
      const card = trainers[cursor++];
      try {
        const subtipo = await fetchSubtype(card.sourceUrl);
        if (subtipo) {
          card.subtipo = subtipo;
          updated++;
        }
      } catch (error) {
        console.warn(`Falhou em ${card.nome}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  for (const { path, cards } of collections) {
    await writeFile(path, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
  }

  const allCards = collections.flatMap(({ cards }) => cards);
  await writeFile(ALL_PATH, `${JSON.stringify(allCards, null, 2)}\n`, "utf8");
  console.log(`Treinadores analisados: ${trainers.length}; subtipos preenchidos: ${updated}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
