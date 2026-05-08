import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function seriesFromCode(code) {
  if (/^A/i.test(code) || /^PROMO-A$/i.test(code)) return "a";
  if (/^B/i.test(code) || /^PROMO-B$/i.test(code)) return "b";
  return "misc";
}

async function run() {
  const code = String(argValue("--code", "")).trim();
  if (!code) throw new Error("Informe --code <A1|A2a|PROMO-B...>.");

  const series = seriesFromCode(code);
  const codeFile = code.toLowerCase();
  const defaultDraftPath = `data/drafts/${series}/${codeFile}.draft.json`;
  const draftPath = resolve(process.cwd(), argValue("--draft", defaultDraftPath));
  const targetPath = resolve(process.cwd(), `data/cards/${series}/${codeFile}.json`);
  const indexPath = resolve(process.cwd(), "data/cards/index.json");
  const expansionsPath = resolve(process.cwd(), "data/expansions.json");

  const [draftRaw, indexRaw, expansionsRaw] = await Promise.all([
    readFile(draftPath, "utf8"),
    readFile(indexPath, "utf8"),
    readFile(expansionsPath, "utf8")
  ]);

  const draftCards = JSON.parse(draftRaw);
  if (!Array.isArray(draftCards) || !draftCards.length) {
    throw new Error("Draft invalido: esperado array com cartas.");
  }

  const indexPayload = JSON.parse(indexRaw);
  const files = Array.isArray(indexPayload) ? indexPayload : indexPayload.files || [];
  const expansionsPayload = JSON.parse(expansionsRaw);
  const expansions = Array.isArray(expansionsPayload)
    ? expansionsPayload
    : expansionsPayload.expansions || [];
  const expansion = expansions.find((e) => String(e.code || "").toUpperCase() === code.toUpperCase());
  if (!expansion) throw new Error("Codigo de expansao nao encontrado em data/expansions.json.");

  await writeFile(targetPath, `${JSON.stringify(draftCards, null, 2)}\n`, "utf8");

  const relPath = `./data/cards/${series}/${codeFile}.json`;
  const entry = files.find((f) => String(f.code || "").toUpperCase() === code.toUpperCase());
  if (entry) {
    entry.path = relPath;
    entry.series = series;
    entry.expansion = expansion.name;
    entry.count = draftCards.length;
  } else {
    files.push({
      code,
      expansion: expansion.name,
      series,
      path: relPath,
      count: draftCards.length
    });
  }

  const nextIndex = Array.isArray(indexPayload) ? files : { ...indexPayload, files };
  await writeFile(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, "utf8");

  console.log(`Publicado: ${targetPath}`);
  console.log(`Index atualizado: ${indexPath}`);
  console.log(`Expansao: ${expansion.name} (${code}) | Cartas: ${draftCards.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

