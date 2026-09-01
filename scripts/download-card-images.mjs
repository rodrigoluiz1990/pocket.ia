import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { argValue, filterFilesByCode, loadIndexFiles, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

const OUT_DIR = resolve(process.cwd(), "assets", "cards");
const COMPLETE_INDEX_PATH = resolve(process.cwd(), "data", "complete", "index.json");

async function loadCardIndexFiles() {
  try {
    const raw = await readFile(COMPLETE_INDEX_PATH, "utf8");
    const payload = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const files = Array.isArray(payload) ? payload : payload.files || [];
    if (files.length) return { files };
  } catch {
    // Mantem compatibilidade com a base consolidada legada.
  }
  return loadIndexFiles();
}

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

function cardOnlyImageUrl(imageUrl) {
  const url = new URL(imageUrl);
  const match = url.pathname.match(/^\/tcg-pocket\/cards\/wallpapers\/([^/]+)\/(\d+)_([a-z]{2})_wallpaper\.jpg$/i);
  if (!match) return imageUrl;

  const [, setCode, number, language] = match;
  url.pathname = `/tcg-pocket/cards/${setCode}/webp/${number}_${language}.webp`;
  return url.toString();
}

function assetCodeFromEntry(entry) {
  const normalizedCode = String(entry?.code || "").trim().toUpperCase();
  if (normalizedCode === "PROMO-A") return "pa";
  if (normalizedCode === "PROMO-B") return "pb";
  return normalizedCode.toLowerCase();
}

async function run() {
  const code = argValue("--code", "");
  const cardOnly = process.argv.includes("--card-only");
  const force = process.argv.includes("--force");
  const { files } = await loadCardIndexFiles();
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
    const assetCode = assetCodeFromEntry(entry);
    const targetDir = resolve(OUT_DIR, `cartas_${assetCode}`);

    await mkdir(targetDir, { recursive: true });

    async function worker() {
      while (cursor < withImages.length) {
        const i = cursor++;
        const card = withImages[i];
        const downloadUrl = cardOnly ? cardOnlyImageUrl(card.imageUrl) : card.imageUrl;
        const rawExt = extname(new URL(downloadUrl).pathname) || ".jpg";
        const normalizedId = sanitizeFileName(card.id).replace(/^p-a-/i, "pa-").replace(/^p-b-/i, "pb-");
        const fileName = `${normalizedId}${rawExt}`.toLowerCase();
        const outPath = resolve(targetDir, fileName);
        const relPath = `./assets/cards/cartas_${assetCode}/${fileName}`;
        const previousPath = String(card.imageLocal || "").trim();
        const previousAbs = previousPath ? resolve(process.cwd(), previousPath.replace(/^\.\//, "")) : "";

        try {
          if (force || !(await exists(outPath))) {
            const bytes = await fetchBuffer(downloadUrl);
            await writeFile(outPath, bytes);
          }
          if (force && previousAbs && previousAbs !== outPath && await exists(previousAbs)) {
            await unlink(previousAbs);
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
