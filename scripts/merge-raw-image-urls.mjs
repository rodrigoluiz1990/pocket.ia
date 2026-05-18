import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const RAW_INDEX_PATH = resolve(process.cwd(), "data", "raw", "pokemongohub", "index.json");
const CONSOLIDATED_INDEX_PATH = resolve(process.cwd(), "data", "consolidated", "index.json");

function normalizeNumber(value) {
  const m = String(value || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function run() {
  const rawIndexPayload = await readJson(RAW_INDEX_PATH);
  const consolidatedIndexPayload = await readJson(CONSOLIDATED_INDEX_PATH);

  const rawFiles = Array.isArray(rawIndexPayload) ? rawIndexPayload : rawIndexPayload.files || [];
  const consolidatedFiles = Array.isArray(consolidatedIndexPayload)
    ? consolidatedIndexPayload
    : consolidatedIndexPayload.files || [];

  const rawByCode = new Map(rawFiles.map((f) => [String(f.code || "").toUpperCase(), f]));

  let totalCards = 0;
  let matchedByNumber = 0;
  let updatedImageUrl = 0;
  let updatedSourceUrl = 0;
  let withoutMatch = 0;

  for (const entry of consolidatedFiles) {
    const code = String(entry.code || "").toUpperCase();
    const rawEntry = rawByCode.get(code);
    if (!rawEntry) continue;

    const rawPath = resolve(process.cwd(), String(rawEntry.path || "").replace(/^\.\//, ""));
    const conPath = resolve(process.cwd(), String(entry.path || "").replace(/^\.\//, ""));

    const rawCards = await readJson(rawPath);
    const conCards = await readJson(conPath);
    if (!Array.isArray(rawCards) || !Array.isArray(conCards)) continue;

    const rawByNumber = new Map();
    for (const r of rawCards) {
      const n = normalizeNumber(r.numero);
      if (n == null) continue;
      if (!rawByNumber.has(n)) rawByNumber.set(n, []);
      rawByNumber.get(n).push(r);
    }

    for (const c of conCards) {
      totalCards++;
      const n = normalizeNumber(c.numero);
      if (n == null) {
        withoutMatch++;
        continue;
      }

      const candidates = rawByNumber.get(n) || [];
      if (!candidates.length) {
        withoutMatch++;
        continue;
      }

      // Preferir nome equivalente quando houver múltiplas versões do mesmo número
      const cName = normalizeKey(c.nome);
      const best =
        candidates.find((r) => normalizeKey(r.nome) === cName) ||
        candidates[0];

      matchedByNumber++;

      const nextImageUrl = String(best.imageUrl || "").trim();
      const nextSourceUrl = String(best.sourceUrl || "").trim();

      if (nextImageUrl && String(c.imageUrl || "").trim() !== nextImageUrl) {
        c.imageUrl = nextImageUrl;
        updatedImageUrl++;
      }
      if (nextSourceUrl && String(c.sourceUrl || "").trim() !== nextSourceUrl) {
        c.sourceUrl = nextSourceUrl;
        updatedSourceUrl++;
      }
    }

    await writeFile(conPath, `${JSON.stringify(conCards, null, 2)}\n`, "utf8");
  }

  console.log(`Cartas consolidadas analisadas: ${totalCards}`);
  console.log(`Matches por numero: ${matchedByNumber}`);
  console.log(`Sem match: ${withoutMatch}`);
  console.log(`imageUrl atualizados: ${updatedImageUrl}`);
  console.log(`sourceUrl atualizados: ${updatedSourceUrl}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

