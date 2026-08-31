import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const COMPLETE_INDEX_PATH = resolve(process.cwd(), "data", "complete", "index.json");
const CONSOLIDATED_INDEX_PATH = resolve(process.cwd(), "data", "consolidated", "index.json");
const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function normalizeFiles(payload) {
  return Array.isArray(payload) ? payload : payload?.files || [];
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePayloadShape(payload, files) {
  if (Array.isArray(payload)) return files;
  return { ...payload, files };
}

function buildExpansionOrder(expansions) {
  const order = new Map();
  expansions.forEach((entry, index) => {
    order.set(normalizeCode(entry?.code), index);
  });
  return order;
}

function sortEntries(entries, expansionOrder) {
  return [...entries].sort((a, b) => {
    const codeA = normalizeCode(a?.code);
    const codeB = normalizeCode(b?.code);
    const idxA = expansionOrder.has(codeA) ? expansionOrder.get(codeA) : Number.MAX_SAFE_INTEGER;
    const idxB = expansionOrder.has(codeB) ? expansionOrder.get(codeB) : Number.MAX_SAFE_INTEGER;
    if (idxA !== idxB) return idxA - idxB;
    return codeA.localeCompare(codeB, "pt-BR");
  });
}

async function run() {
  const [completeIndexPayload, consolidatedIndexPayload, expansionsPayload] = await Promise.all([
    readJson(COMPLETE_INDEX_PATH),
    readJson(CONSOLIDATED_INDEX_PATH),
    readJson(EXPANSIONS_PATH)
  ]);

  const completeFiles = normalizeFiles(completeIndexPayload);
  const consolidatedFiles = normalizeFiles(consolidatedIndexPayload);
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload?.expansions || [];

  const consolidatedCodes = new Set(consolidatedFiles.map((entry) => normalizeCode(entry?.code)));
  const missingEntries = completeFiles.filter((entry) => !consolidatedCodes.has(normalizeCode(entry?.code)));

  if (!missingEntries.length) {
    console.log("Nenhum set faltando entre complete -> consolidated.");
    return;
  }

  for (const entry of missingEntries) {
    const sourcePath = resolve(process.cwd(), String(entry.path || "").replace("./data/complete/", "data/complete/"));
    const targetRelativePath = String(entry.path || "").replace("./data/complete/", "./data/consolidated/");
    const targetPath = resolve(process.cwd(), targetRelativePath.replace(/^\.\//, ""));
    const cards = await readJson(sourcePath);

    await mkdir(resolve(targetPath, ".."), { recursive: true });
    await writeFile(targetPath, `${JSON.stringify(cards, null, 2)}\n`, "utf8");

    consolidatedFiles.push({
      ...entry,
      path: targetRelativePath
    });

    console.log(`Set sincronizado: ${entry.code} -> ${targetRelativePath}`);
  }

  const nextFiles = sortEntries(consolidatedFiles, buildExpansionOrder(expansions));
  const nextPayload = normalizePayloadShape(consolidatedIndexPayload, nextFiles);
  await writeFile(CONSOLIDATED_INDEX_PATH, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");

  console.log(`Sets adicionados ao consolidated: ${missingEntries.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
