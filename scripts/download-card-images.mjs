import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { argValue, filterFilesByCode, loadIndexFiles, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

const OUT_DIR = resolve(process.cwd(), "assets", "cards");

function sanitizeFileName(text) {
  return String(text).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const ab = await response.arrayBuffer();
  return Buffer.from(ab);
}

async function run() {
  const code = argValue("--code", "");
  const { files } = await loadIndexFiles();
  const targetFiles = filterFilesByCode(files, code);

  await mkdir(OUT_DIR, { recursive: true });

  let total = 0;
  for (const entry of targetFiles) {
    const { cards } = await readCardsFromEntry(entry);
    total += cards.filter((c) => c.imageUrl).length;
  }

  if (!total) {
    console.log("Nenhuma carta com imageUrl encontrada para baixar imagens.");
    return;
  }

  let done = 0;
  for (const entry of targetFiles) {
    const { cards } = await readCardsFromEntry(entry);
    const withImages = cards.filter((c) => c.imageUrl);
    const concurrency = 10;
    let cursor = 0;

    async function worker() {
      while (cursor < withImages.length) {
        const i = cursor++;
        const card = withImages[i];
        const rawExt = extname(new URL(card.imageUrl).pathname) || ".jpg";
        const fileName = `${sanitizeFileName(card.id)}${rawExt}`;
        const outPath = resolve(OUT_DIR, fileName);
        const relPath = `./assets/cards/${fileName}`;

        try {
          if (!(await exists(outPath))) {
            const bytes = await fetchBuffer(card.imageUrl);
            await writeFile(outPath, bytes);
          }
          card.imageLocal = relPath;
        } catch (error) {
          card.imageLocal = "";
          console.warn(`Falha imagem ${card.id}: ${error.message}`);
        } finally {
          done++;
          if (done % 100 === 0 || done === total) {
            console.log(`Imagens: ${done}/${total}`);
          }
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await writeCardsToEntry(entry, cards);
  }

  console.log(`Concluido. Imagens em ${OUT_DIR}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
