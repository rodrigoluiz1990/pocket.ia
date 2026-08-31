import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ADAPTED_PATH = resolve(process.cwd(), "data", "consolidated", "cards-adapted.json");
const COMPLETE_PATH = resolve(process.cwd(), "data", "complete", "all", "cards-complete.json");
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function assetCodeFromSetCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized === "PROMO-A") return "pa";
  if (normalized === "PROMO-B") return "pb";
  return normalized.toLowerCase();
}

function extractSetCode(card) {
  const expansionMatch = String(card?.expansao || "").match(/\(([A-Z0-9-]+)\)\s*$/i);
  if (expansionMatch) return String(expansionMatch[1] || "").toUpperCase();
  const idMatch = String(card?.id || "").match(/^([a-z]\d[a-z]?|p-[ab])-/i);
  if (!idMatch) return "";
  if (/^p-a$/i.test(idMatch[1])) return "PROMO-A";
  if (/^p-b$/i.test(idMatch[1])) return "PROMO-B";
  return String(idMatch[1]).toUpperCase();
}

function normalizeImageLocal(card) {
  const current = String(card?.imageLocal || "").trim().replace(/\\/g, "/");
  if (!current) return "";
  const fileName = current.split("/").pop() || "";
  if (!fileName) return current;
  const normalizedFileName = fileName
    .replace(/^p-a-/i, "pa-")
    .replace(/^p-b-/i, "pb-")
    .toLowerCase();
  const assetCode = assetCodeFromSetCode(extractSetCode(card));
  if (!assetCode) return `./assets/cards/${normalizedFileName}`;
  return `./assets/cards/cartas_${assetCode}/${normalizedFileName}`;
}

async function run() {
  const [adaptedCards, completeCards] = await Promise.all([readJson(ADAPTED_PATH), readJson(COMPLETE_PATH)]);
  const completeById = new Map(completeCards.map((card) => [String(card?.id || "").trim(), card]));

  let updated = 0;
  let stillMissing = 0;

  for (const card of adaptedCards) {
    const cardId = String(card?.id || "").trim();
    const completeCard = completeById.get(cardId);
    const nextPath = normalizeImageLocal({ ...completeCard, ...card });
    const nextAbs = nextPath ? resolve(process.cwd(), nextPath.replace(/^\.\//, "")) : "";

    if (nextPath && String(card?.imageLocal || "").trim() !== nextPath) {
      card.imageLocal = nextPath;
      updated++;
    }

    if (!nextAbs || !(await exists(nextAbs))) {
      stillMissing++;
    }
  }

  await writeFile(ADAPTED_PATH, `${JSON.stringify(adaptedCards, null, 2)}\n`, "utf8");

  console.log(`imageLocal corrigidos: ${updated}`);
  console.log(`cartas ainda sem arquivo local: ${stillMissing}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
