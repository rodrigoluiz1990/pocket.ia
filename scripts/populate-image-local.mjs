import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadIndexFiles, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

const OUT_DIR = resolve(process.cwd(), "assets", "cards");

function sanitizeForMatching(text) {
  // Same regex as used in app.js renderSuggestions
  return String(text).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function run() {
  const imageFileList = await readdir(OUT_DIR);
  const { files } = await loadIndexFiles();

  // Build a map of sanitized names to filenames
  const fileNameMap = new Map();
  for (const fileName of imageFileList) {
    // Extract the part after the hash (after the hyphen)
    // Files are named like: "hash-cardname.jpg"
    const dashIndex = fileName.lastIndexOf("-");
    if (dashIndex > 0) {
      const namePart = fileName.substring(dashIndex + 1).replace(/\.jpg$/i, "");
      const sanitized = sanitizeForMatching(namePart);
      // Store with full filename
      if (!fileNameMap.has(sanitized)) {
        fileNameMap.set(sanitized, fileName);
      }
    }
  }

  let matched = 0;
  let notMatched = 0;

  for (const entry of files) {
    const { cards } = await readCardsFromEntry(entry);
    for (const card of cards) {
      const sanitized = sanitizeForMatching(card.nome);
      const fileName = fileNameMap.get(sanitized);
      
      if (fileName) {
        card.imageLocal = `./assets/cards/${fileName}`;
        matched++;
      } else {
        card.imageLocal = "";
        notMatched++;
      }
    }
    await writeCardsToEntry(entry, cards);
  }

  console.log(`imageLocal populado. Correspondências: ${matched}, Não encontradas: ${notMatched}`);
}

run().catch(console.error);