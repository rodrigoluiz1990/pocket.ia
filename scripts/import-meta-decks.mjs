import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const CATALOG_PATH = resolve(process.cwd(), "data", "consolidated", "cards-adapted.json");
const OUTPUT_PATH = resolve(process.cwd(), "data", "meta-decks.json");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : String(process.argv[index + 1] || "").trim();
}

async function readJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
}

function deckCards(rawDeck) {
  const refs = Array.isArray(rawDeck?.cartas) ? rawDeck.cartas : rawDeck?.cards;
  return Array.isArray(refs) ? refs.map((ref) => normalizeCardId(typeof ref === "string" ? ref : ref?.id || "")) : [];
}

function normalizeCardId(value) {
  const id = String(value || "").trim().toLowerCase();
  const promo = id.match(/^p-([ab])-(\d+)$/i);
  return promo ? `promo-${promo[1].toLowerCase()}-${String(promo[2]).padStart(3, "0")}` : id;
}

function normalizeDeck(rawDeck, index, cardIds) {
  const nome = String(rawDeck?.nome || rawDeck?.name || `Deck Meta ${index + 1}`).trim();
  const ids = deckCards(rawDeck);
  if (ids.length !== 20) throw new Error(`${nome}: o deck precisa ter exatamente 20 cartas.`);
  const invalid = ids.filter((id) => !cardIds.has(id));
  if (invalid.length) throw new Error(`${nome}: IDs invalidos: ${[...new Set(invalid)].join(", ")}.`);
  const principalId = normalizeCardId(typeof rawDeck?.principal === "string" ? rawDeck.principal : rawDeck?.principal?.id || ids[0]);
  return {
    nome,
    principal: { id: cardIds.has(principalId) ? principalId : ids[0] },
    cartas: ids.map((id) => ({ id }))
  };
}

async function run() {
  const input = argValue("--input");
  if (!input) throw new Error("Informe o arquivo JSON: npm run import:meta -- --input caminho/do/arquivo.json");

  const [catalog, existingPayload, importedPayload] = await Promise.all([
    readJson(CATALOG_PATH),
    readJson(OUTPUT_PATH),
    readJson(resolve(process.cwd(), input))
  ]);
  const cardIds = new Set((Array.isArray(catalog) ? catalog : []).map((card) => String(card.id)));
  const imported = Array.isArray(importedPayload) ? importedPayload : importedPayload?.decks;
  if (!Array.isArray(imported) || !imported.length) throw new Error("O arquivo nao contem uma lista de decks.");

  const normalized = imported.map((deck, index) => normalizeDeck(deck, index, cardIds));
  const existing = Array.isArray(existingPayload) ? existingPayload : existingPayload?.decks || [];
  const byName = new Map(existing.map((deck) => [String(deck.nome || "").toLocaleLowerCase("pt-BR"), deck]));
  normalized.forEach((deck) => byName.set(deck.nome.toLocaleLowerCase("pt-BR"), deck));
  const merged = [...byName.values()];

  await writeFile(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Importados ${normalized.length} deck(s). Total em data/meta-decks.json: ${merged.length}.`);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
