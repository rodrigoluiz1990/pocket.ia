import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function seriesFromCode(code) {
  if (/^A/i.test(code) || /^PROMO-A$/i.test(code)) return "a";
  if (/^B/i.test(code) || /^PROMO-B$/i.test(code)) return "b";
  return "misc";
}

async function run() {
  const sourcePath = resolve(process.cwd(), argValue("--source", "data/incoming/cards-synced.json"));
  const expansionsPath = resolve(process.cwd(), "data/expansions.json");
  const codeArg = String(argValue("--code", "")).trim();
  const expansionArg = String(argValue("--expansion", "")).trim();

  if (!codeArg && !expansionArg) {
    throw new Error("Informe --code <A1|B2|PROMO-A...> ou --expansion <nome da expansao>.");
  }

  const [sourceRaw, expansionsRaw] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(expansionsPath, "utf8")
  ]);

  const sourceCards = JSON.parse(sourceRaw);
  const expansionsPayload = JSON.parse(expansionsRaw);
  const expansions = Array.isArray(expansionsPayload)
    ? expansionsPayload
    : expansionsPayload.expansions || [];

  const expansionByCode = new Map(expansions.map((e) => [String(e.code || "").toUpperCase(), e]));
  const expansionByName = new Map(expansions.map((e) => [normalizeKey(e.name), e]));

  let expansionEntry = null;
  if (codeArg) expansionEntry = expansionByCode.get(codeArg.toUpperCase()) || null;
  if (!expansionEntry && expansionArg) expansionEntry = expansionByName.get(normalizeKey(expansionArg)) || null;
  if (!expansionEntry) throw new Error("Expansao nao encontrada em data/expansions.json.");

  const expansionName = String(expansionEntry.name || "").trim();
  const code = String(expansionEntry.code || "").trim();
  const series = seriesFromCode(code);
  const codeFile = code.toLowerCase();

  const filtered = sourceCards.filter(
    (card) => normalizeKey(card.expansao) === normalizeKey(expansionName)
  );
  if (!filtered.length) {
    throw new Error(`Nenhuma carta encontrada para "${expansionName}" em ${sourcePath}.`);
  }

  const outDir = resolve(process.cwd(), "data/drafts", series);
  const outPath = resolve(outDir, `${codeFile}.draft.json`);
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, `${JSON.stringify(filtered, null, 2)}\n`, "utf8");

  console.log(`Draft gerado: ${outPath}`);
  console.log(`Expansao: ${expansionName} (${code}) | Cartas: ${filtered.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

