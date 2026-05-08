import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INDEX_PATH = resolve(process.cwd(), "data", "cards", "index.json");
const JS_PATH = resolve(process.cwd(), "data", "cards.js");

async function run() {
  const rawIndex = await readFile(INDEX_PATH, "utf8");
  const indexPayload = JSON.parse(rawIndex);
  const files = Array.isArray(indexPayload) ? indexPayload : indexPayload.files || [];
  const chunks = await Promise.all(
    files.map(async (entry) => {
      const relPath = typeof entry === "string" ? entry : entry.path;
      const absolutePath = resolve(process.cwd(), String(relPath || "").replace(/^\.\//, ""));
      const raw = await readFile(absolutePath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    })
  );
  const cards = chunks.flat();
  const js = `window.POCKETIA_CARDS = ${JSON.stringify(cards)};\n`;
  await writeFile(JS_PATH, js, "utf8");
  console.log(`Bundle gerado: ${JS_PATH} (${cards.length} cartas)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
