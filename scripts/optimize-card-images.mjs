import { access, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { argValue, filterFilesByCode, loadIndexFiles, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

// Converte as imagens das cartas para WebP (qualidade 80) e atualiza imageLocal.
// Muitas imagens baixadas sao PNG salvos como .jpg (~300 KB); em WebP ficam com ~40 KB.
// Arquivos que ja sao WebP por dentro so trocam a extensao. Pode rodar quantas vezes quiser.
// Tambem gera a miniatura usada na grade (cartas_<set>/thumbs/<id>.webp, 184x256).
// Uso: npm run optimize:images [-- --code C1] [-- --quality 80]

const COMPLETE_INDEX_PATH = resolve(process.cwd(), "data", "complete", "index.json");
const COMPLETE_ALL_PATH = resolve(process.cwd(), "data", "complete", "all", "cards-complete.json");
const QUALITY = Number(argValue("--quality", "80")) || 80;
const CONCURRENCY = 4;
// Metade da imagem completa (367x512): nitida na grade em telas comuns; telas de alta densidade usam a completa.
const THUMB_WIDTH = 184;

async function loadCardIndexFiles() {
  try {
    const raw = await readFile(COMPLETE_INDEX_PATH, "utf8");
    const payload = JSON.parse(raw.replace(/^﻿/, ""));
    const files = Array.isArray(payload) ? payload : payload.files || [];
    if (files.length) return { files };
  } catch {
    // Mantem compatibilidade com a base consolidada legada.
  }
  return loadIndexFiles();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function detectFormat(path) {
  const handle = await open(path, "r");
  try {
    const { buffer } = await handle.read(Buffer.alloc(12), 0, 12, 0);
    if (buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
    return "unknown";
  } finally {
    await handle.close();
  }
}

function toWebpPath(relPath) {
  return relPath.replace(/\.[a-z0-9]+$/i, ".webp");
}

// Mesmo padrao de caminho usado em scripts/build-site-cards.mjs.
function thumbPathFor(relPath) {
  return relPath.replace(/\/([^/]+)\.webp$/i, "/thumbs/$1.webp");
}

// Gera (ou refaz, se a imagem completa for mais nova) a miniatura da carta.
async function ensureThumb(card, stats) {
  const full = String(card.imageLocal || "").trim();
  if (!/\.webp$/i.test(full)) return;
  const fullAbs = resolve(process.cwd(), full.replace(/^\.\//, ""));
  const thumbAbs = resolve(process.cwd(), thumbPathFor(full).replace(/^\.\//, ""));
  if (!(await exists(fullAbs))) return;
  if (await exists(thumbAbs)) {
    const [fullStat, thumbStat] = await Promise.all([stat(fullAbs), stat(thumbAbs)]);
    if (thumbStat.mtimeMs >= fullStat.mtimeMs) return;
  }
  await mkdir(resolve(thumbAbs, ".."), { recursive: true });
  await sharp(fullAbs).resize({ width: THUMB_WIDTH }).webp({ quality: QUALITY, effort: 6 }).toFile(thumbAbs);
  stats.thumbs++;
}

async function optimizeCard(card, stats) {
  const current = String(card.imageLocal || "").trim();
  if (!current) return;
  const target = toWebpPath(current);
  const currentAbs = resolve(process.cwd(), current.replace(/^\.\//, ""));
  const targetAbs = resolve(process.cwd(), target.replace(/^\.\//, ""));

  if (!(await exists(currentAbs))) {
    // Ja convertida numa execucao anterior que nao chegou a salvar o JSON.
    if (await exists(targetAbs)) card.imageLocal = target;
    else stats.missing++;
    return;
  }

  const format = await detectFormat(currentAbs);
  if (format === "webp") {
    if (current === target) {
      stats.alreadyWebp++;
      return;
    }
    if (await exists(targetAbs)) await unlink(currentAbs);
    else await rename(currentAbs, targetAbs);
    card.imageLocal = target;
    stats.renamed++;
    return;
  }
  if (format === "unknown") {
    stats.unknown++;
    console.warn(`Formato desconhecido: ${current}`);
    return;
  }

  const before = (await stat(currentAbs)).size;
  await sharp(currentAbs).webp({ quality: QUALITY, effort: 6 }).toFile(targetAbs);
  const after = (await stat(targetAbs)).size;
  if (currentAbs !== targetAbs) await unlink(currentAbs);
  card.imageLocal = target;
  stats.converted++;
  stats.bytesBefore += before;
  stats.bytesAfter += after;
}

async function run() {
  const code = argValue("--code", "");
  const { files } = await loadCardIndexFiles();
  const targetFiles = filterFilesByCode(files, code);
  const stats = { converted: 0, renamed: 0, alreadyWebp: 0, missing: 0, unknown: 0, thumbs: 0, bytesBefore: 0, bytesAfter: 0 };

  for (const entry of targetFiles) {
    const { cards } = await readCardsFromEntry(entry);
    let cursor = 0;
    async function worker() {
      while (cursor < cards.length) {
        const card = cards[cursor++];
        try {
          await optimizeCard(card, stats);
          await ensureThumb(card, stats);
        } catch (error) {
          console.warn(`Falha ao otimizar ${card.id}: ${error.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    await writeCardsToEntry(entry, cards);
    console.log(`${entry.code}: ok`);
  }

  const allCards = [];
  for (const entry of files) {
    const { cards } = await readCardsFromEntry(entry);
    allCards.push(...cards);
  }
  await mkdir(resolve(COMPLETE_ALL_PATH, ".."), { recursive: true });
  await writeFile(COMPLETE_ALL_PATH, `${JSON.stringify(allCards, null, 2)}\n`, "utf8");

  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  console.log(
    `Convertidas: ${stats.converted} (${mb(stats.bytesBefore)} MB -> ${mb(stats.bytesAfter)} MB) | ` +
    `extensao corrigida: ${stats.renamed} | ja em WebP: ${stats.alreadyWebp} | ` +
    `sem arquivo: ${stats.missing} | formato desconhecido: ${stats.unknown} | miniaturas geradas: ${stats.thumbs}`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
