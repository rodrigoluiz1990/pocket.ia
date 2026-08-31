import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const RAW_INDEX_PATH = resolve(process.cwd(), "data", "raw", "pokemongohub", "index.json");
const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");
const CONSOLIDATED_INDEX_PATH = resolve(process.cwd(), "data", "consolidated", "index.json");

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseCardNumber(numero) {
  const match = String(numero || "").match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeStage(stage) {
  const s = normalizeKey(stage);
  if (!s) return "basic";
  if (s.includes("mega")) return "mega";
  if (s === "ex" || s.includes(" ex")) return "ex";
  if (s.includes("estagio 2") || s.includes("stage 2")) return "2";
  if (s.includes("estagio 1") || s.includes("stage 1")) return "1";
  if (s.includes("basico") || s.includes("basic")) return "basic";
  return s;
}

function inferFormat(card) {
  const stage = normalizeKey(card?.estagio);
  const name = normalizeKey(card?.nome);
  if (stage.includes("mega") || /\bmega\b/.test(name)) return "mega";
  if (stage === "ex" || stage.includes(" ex") || name.endsWith(" ex") || name.includes("-ex")) return "ex";
  return "noex";
}

function buildFilterTags(stage, formato, existingTags = []) {
  const tags = new Set(
    (Array.isArray(existingTags) ? existingTags : [])
      .map(normalizeKey)
      .filter(Boolean)
  );
  const stageKey = normalizeStage(stage);
  if (stageKey) tags.add(stageKey);
  if (stageKey === "baby") tags.add("basic");
  if (formato === "mega" || formato === "ex") tags.add(formato);
  return [...tags];
}

function buildImageLocal(code, numero) {
  const n = String(numero).padStart(3, "0");
  const normalizedCode = String(code || "").trim().toUpperCase();
  const assetCode = normalizedCode === "PROMO-A"
    ? "pa"
    : normalizedCode === "PROMO-B"
      ? "pb"
      : normalizedCode.toLowerCase();
  const fileNameBase = String(code).toLowerCase().replace(/^promo-a$/, "pa").replace(/^promo-b$/, "pb");
  return `./assets/cards/cartas_${assetCode}/${fileNameBase}-${n}.jpg`;
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function run() {
  const codeFilter = String(argValue("--code", "")).trim().toUpperCase();
  const [rawIndexPayload, expansionsPayload, consolidatedIndexPayload] = await Promise.all([
    readJson(RAW_INDEX_PATH),
    readJson(EXPANSIONS_PATH),
    readJson(CONSOLIDATED_INDEX_PATH)
  ]);

  const rawFiles = Array.isArray(rawIndexPayload) ? rawIndexPayload : rawIndexPayload.files || [];
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload.expansions || [];
  const consolidatedFiles = Array.isArray(consolidatedIndexPayload)
    ? consolidatedIndexPayload
    : consolidatedIndexPayload.files || [];

  const expansionByCode = new Map(
    expansions.map((entry) => [String(entry.code || "").toUpperCase(), String(entry.name || "").trim()])
  );
  const consolidatedByCode = new Map(
    consolidatedFiles.map((entry) => [String(entry.code || "").toUpperCase(), entry])
  );

  let importedSets = 0;
  let importedCards = 0;

  for (const rawEntry of rawFiles) {
    const code = String(rawEntry.code || "").toUpperCase();
    if (!code) continue;
    if (codeFilter && code !== codeFilter) continue;

    const targetEntry = consolidatedByCode.get(code);
    if (!targetEntry) continue;

    const rawPath = resolve(process.cwd(), String(rawEntry.path || "").replace(/^\.\//, ""));
    const outPath = resolve(process.cwd(), String(targetEntry.path || "").replace(/^\.\//, ""));
    const rawCards = await readJson(rawPath);
    if (!Array.isArray(rawCards) || !rawCards.length) continue;

    const expansionName = expansionByCode.get(code) || String(targetEntry.expansion || "").trim() || code;
    const cards = rawCards
      .map((card) => {
        const numero = parseCardNumber(card?.numero);
        const estagio = normalizeStage(card?.estagio);
        const formato = inferFormat(card);
        return {
          id: `${String(code).toLowerCase()}-${String(numero).padStart(3, "0")}`,
          categoria: String(card?.tipo || "").trim() || "Pokemon",
          nome: String(card?.nome || "").trim(),
          estagio,
          evolucao: "",
          tipo: String(card?.elemento || "").trim(),
          hp: Number(card?.hp || 0) || 0,
          ataque: [],
          fraqueza: "",
          recuo: 0,
          raridade: String(card?.raridade || "").trim(),
          habilidade: false,
          promo: /^PROMO-/i.test(code) || normalizeKey(card?.raridade) === "promo",
          formato,
          mega: formato === "mega",
          tags: buildFilterTags(estagio, formato, card?.tags),
          expansao: `${expansionName} (${code})`,
          numero: String(card?.numero || "").trim(),
          pacote: "",
          imageLocal: buildImageLocal(code, numero),
          custoDeck: Number(card?.custoDeck || 0) || 0,
          imageUrl: String(card?.imageUrl || "").trim(),
          sourceUrl: String(card?.sourceUrl || "").trim()
        };
      })
      .sort((a, b) => parseCardNumber(a.numero) - parseCardNumber(b.numero) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    await mkdir(resolve(outPath, ".."), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(cards, null, 2)}\n`, "utf8");

    importedSets++;
    importedCards += cards.length;
    console.log(`Importado ${code}: ${cards.length} cartas -> ${outPath}`);
  }

  console.log(`Sets importados: ${importedSets}`);
  console.log(`Cartas importadas: ${importedCards}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
