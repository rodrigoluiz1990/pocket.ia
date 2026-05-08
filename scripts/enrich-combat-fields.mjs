import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argValue, filterFilesByCode, loadIndexFiles, normalizeKey, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

const BASE = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist";
const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");

const tipoMap = {
  grass: "Planta",
  fire: "Fogo",
  water: "Agua",
  lightning: "Raio",
  psychic: "Psiquico",
  fighting: "Luta",
  darkness: "Escuridao",
  metal: "Metal",
  dragon: "Dragao",
  colorless: "Incolor"
};

const fraquezaMap = {
  fire: "Fogo",
  water: "Agua",
  electric: "Raio",
  lightning: "Raio",
  psychic: "Psiquico",
  fighting: "Luta",
  darkness: "Escuridao",
  metal: "Metal",
  dragon: "Dragao",
  colorless: "Incolor",
  grass: "Planta"
};

function firstNumber(text) {
  const m = String(text || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function safeNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function deriveAttack(hp, isPokemon) {
  if (!isPokemon) return 0;
  return Math.max(0, Math.round(hp * 0.7));
}

function deriveAttackCost(attack, isPokemon) {
  if (!isPokemon) return 0;
  return Math.max(0, Math.min(5, Math.floor(attack / 40)));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "pocketia" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.json();
}

async function run() {
  const code = argValue("--code", "");
  const [{ files }, extraCards, expansionsRaw] = await Promise.all([
    loadIndexFiles(),
    fetchJson(`${BASE}/cards.extra.json`),
    readFile(EXPANSIONS_PATH, "utf8")
  ]);

  const expansionsPayload = JSON.parse(expansionsRaw);
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload.expansions || [];
  const expansionPtToCode = Object.fromEntries(expansions.map((e) => [normalizeKey(e.name), String(e.code || "")]));
  const extraMap = new Map(extraCards.map((c) => [`${c.set}#${Number(c.number)}`, c]));

  let matchedOfficial = 0;
  let derivedCount = 0;

  const targetFiles = filterFilesByCode(files, code);
  for (const entry of targetFiles) {
    const { cards } = await readCardsFromEntry(entry);

    for (const card of cards) {
      const setCode = expansionPtToCode[normalizeKey(card.expansao)];
      const n = firstNumber(card.numero);
      const key = setCode && n != null ? `${setCode}#${n}` : null;
      const extra = key ? extraMap.get(key) : null;

      const isPokemon = String(card.categoria || "").toLowerCase() === "pokemon";

      if (extra) {
        matchedOfficial++;
        if (extra.element) card.tipo = tipoMap[String(extra.element || "").toLowerCase()] || card.tipo;
        if (typeof extra.health === "number") card.hp = Number(extra.health);
        if (typeof extra.retreatCost === "number") card.recuo = Number(extra.retreatCost);
        if (extra.weakness) {
          const wk = String(extra.weakness || "").toLowerCase();
          card.fraqueza = fraquezaMap[wk] || card.fraqueza || "";
        }
      } else {
        derivedCount++;
      }

      card.hp = safeNumber(card.hp, 0);
      card.recuo = Math.max(0, Math.min(5, safeNumber(card.recuo, 0)));
      card.fraqueza = String(card.fraqueza || "");
      card.ataque = safeNumber(card.ataque, deriveAttack(card.hp, isPokemon));
      card.custoAtaque = Math.max(0, Math.min(5, safeNumber(card.custoAtaque, deriveAttackCost(card.ataque, isPokemon))));
      card.temHabilidade = Boolean(card.temHabilidade);
    }

    await writeCardsToEntry(entry, cards);
  }

  console.log(`Campos oficiais aplicados (cards.extra): ${matchedOfficial}`);
  console.log(`Cartas sem match oficial (fallback): ${derivedCount}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
