import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argValue, filterFilesByCode, loadIndexFiles, normalizeKey, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

const BASE = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist";
const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");

const rarityLabelPt = {
  C: "Comum",
  U: "Incomum",
  R: "Rara",
  RR: "Duplamente Raro",
  AR: "Ilustracao Rara",
  SAR: "Arte Especial Raro",
  SR: "Super Raro",
  IM: "Raro Imersivo",
  S: "Raro Brilhante",
  SSR: "Duplo Brilhante Raro",
  UR: "Coroa Rara"
};

function firstNumber(text) {
  const m = String(text || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "pocketia" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.json();
}

async function run() {
  const code = argValue("--code", "");
  const [{ files }, repoCards, expansionsRaw] = await Promise.all([
    loadIndexFiles(),
    fetchJson(`${BASE}/cards.min.json`),
    readFile(EXPANSIONS_PATH, "utf8")
  ]);

  const expansionsPayload = JSON.parse(expansionsRaw);
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload.expansions || [];
  const expansionPtToCode = Object.fromEntries(expansions.map((e) => [normalizeKey(e.name), String(e.code || "")]));

  const bySetNumber = new Map();
  for (const c of repoCards) bySetNumber.set(`${c.set}#${Number(c.number)}`, c.rarity);

  let updated = 0;
  let matched = 0;
  let unmatched = 0;

  const targetFiles = filterFilesByCode(files, code);
  for (const entry of targetFiles) {
    const { cards } = await readCardsFromEntry(entry);
    for (const card of cards) {
      const setCode = expansionPtToCode[normalizeKey(card.expansao)];
      const n = firstNumber(card.numero);
      if (!setCode || n == null) {
        unmatched++;
        continue;
      }
      const rarityCode = bySetNumber.get(`${setCode}#${n}`);
      if (!rarityCode) {
        unmatched++;
        continue;
      }
      matched++;
      const next = rarityLabelPt[rarityCode] || card.raridade;
      if (next !== card.raridade) {
        card.raridade = next;
        updated++;
      }
    }
    await writeCardsToEntry(entry, cards);
  }

  console.log(`Match set+numero: ${matched}`);
  console.log(`Sem match: ${unmatched}`);
  console.log(`Raridade atualizada: ${updated}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
