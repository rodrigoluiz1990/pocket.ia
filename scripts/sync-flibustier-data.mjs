import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist";
const OUT_DIR = resolve(process.cwd(), "data", "raw", "flibustier");
const FILES = ["cards.min.json", "cards.extra.json", "sets.json"];

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "pocketia"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.text();
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const file of FILES) {
    const outPath = resolve(OUT_DIR, file);
    const text = await fetchText(`${BASE}/${file}`);
    await writeFile(outPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
    console.log(`Salvo ${file}`);
  }

  console.log(`Arquivos sincronizados em ${OUT_DIR}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
