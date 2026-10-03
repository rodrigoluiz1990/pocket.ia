import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SET_CODE = String(process.argv[2] || "B4B").trim().toUpperCase();
const RAW_ROOT = resolve(process.cwd(), "data", "raw", "pokemongohub");
const COMPLETE_INDEX = resolve(process.cwd(), "data", "complete", "index.json");
const MIN_CARDS = resolve(process.cwd(), "data", "raw", "flibustier", "cards.min.json");
const SETS = resolve(process.cwd(), "data", "raw", "flibustier", "sets.json");

async function readJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
}

function deckBuilderNrFromImage(image) {
  const match = String(image || "").match(/^(cPK|cTR)_[0-9]+_([0-9]+)_/);
  if (!match) return 0;
  const baseNr = Number(match[2]) / 10;
  if (!Number.isSafeInteger(baseNr) || baseNr <= 0) return 0;
  return match[1] === "cTR" ? baseNr + 1_000_000 : baseNr;
}

function seriesFromCode(code) {
  return String(code).toUpperCase().startsWith("B") ? "b" : "a";
}

async function run() {
  const [completeIndex, minCards, setsPayload] = await Promise.all([
    readJson(COMPLETE_INDEX),
    readJson(MIN_CARDS),
    readJson(SETS)
  ]);
  const completeEntries = (completeIndex.files || []).filter(
    (entry) => String(entry.code || "").toUpperCase() !== SET_CODE
  );
  const existingCards = [];
  for (const entry of completeEntries) {
    const cards = await readJson(resolve(process.cwd(), String(entry.path).replace(/^\.\//, "")));
    existingCards.push(...cards);
  }
  const byDeckBuilderNr = new Map(
    existingCards.filter((card) => Number(card.deckBuilderNr) > 0).map((card) => [Number(card.deckBuilderNr), card])
  );
  const setCards = minCards
    .filter((card) => String(card.set || "").toUpperCase() === SET_CODE)
    .sort((a, b) => Number(a.number) - Number(b.number));
  if (!setCards.length) throw new Error(`Nenhuma carta ${SET_CODE} encontrada em cards.min.json.`);

  const missing = setCards.filter((card) => !byDeckBuilderNr.has(deckBuilderNrFromImage(card.image)));
  if (missing.length) {
    throw new Error(`${missing.length} cartas nao possuem uma versao-base no catalogo: ${missing.map((c) => c.number).join(", ")}`);
  }

  const setEntries = Object.values(setsPayload || {}).flat().filter(Boolean);
  const setMeta = setEntries.find((entry) => String(entry.code || "").toUpperCase() === SET_CODE);
  const totalRegular = Math.min(402, Number(setMeta?.count) || setCards.length);
  const sourceCode = String(setMeta?.code || SET_CODE);
  const rawCards = setCards.map((print) => {
    const number = Number(print.number);
    const padded = String(number).padStart(3, "0");
    const base = byDeckBuilderNr.get(deckBuilderNrFromImage(print.image));
    return {
      id: `${SET_CODE.toLowerCase()}-${padded}`,
      nome: String(base.nome || print.name || "").trim(),
      tipo: String(base.categoria || "Pokemon").trim(),
      elemento: String(base.tipo || "").trim(),
      raridade: String(print.rarity || "").trim(),
      custoDeck: Number(base.custoDeck) || 1,
      estagio: String(base.estagio || "").trim(),
      subtipo: String(base.subtipo || "").trim(),
      tags: Array.isArray(base.tags) ? base.tags : [],
      expansao: String(setMeta?.name?.en || SET_CODE).trim(),
      numero: `${number} / ${totalRegular}`,
      hp: Number(base.hp) || 0,
      evolucao: String(base.evolucao || "").trim(),
      ataque: Array.isArray(base.ataque) ? base.ataque : Array.isArray(base.ataqueLista) ? base.ataqueLista : [],
      fraqueza: String(base.fraqueza || "").trim(),
      recuo: Number(base.recuo) || 0,
      temHabilidade: Boolean(base.habilidade),
      pacote: Array.isArray(print.packs) ? print.packs.join(" / ") : "",
      imageUrl: `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/pocket/${sourceCode}/${sourceCode}_${padded}_EN_SM.webp`,
      sourceUrl: `https://pocket.limitlesstcg.com/cards/${sourceCode}/${number}`
    };
  });

  const series = seriesFromCode(SET_CODE);
  const rawDir = resolve(RAW_ROOT, series);
  const rawPath = resolve(rawDir, `${SET_CODE.toLowerCase()}.json`);
  await mkdir(rawDir, { recursive: true });
  await writeFile(rawPath, `${JSON.stringify(rawCards, null, 2)}\n`, "utf8");

  const rawIndexPath = resolve(RAW_ROOT, "index.json");
  const rawIndex = await readJson(rawIndexPath);
  const nextEntry = {
    code: SET_CODE,
    series,
    path: `./data/raw/pokemongohub/${series}/${SET_CODE.toLowerCase()}.json`,
    count: rawCards.length
  };
  const files = (rawIndex.files || [])
    .filter((entry) => String(entry.code || "").toUpperCase() !== SET_CODE)
    .concat(nextEntry)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  await writeFile(rawIndexPath, `${JSON.stringify({ ...rawIndex, files }, null, 2)}\n`, "utf8");
  console.log(`${rawCards.length} cartas ${SET_CODE} importadas a partir das versoes-base.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
