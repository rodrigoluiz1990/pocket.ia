import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INDEX_PATH = resolve(process.cwd(), "data", "cards", "index.json");

export function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

export function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function loadIndexFiles() {
  const raw = await readFile(INDEX_PATH, "utf8");
  const payload = JSON.parse(raw);
  const files = Array.isArray(payload) ? payload : payload.files || [];
  return { payload, files };
}

export function filterFilesByCode(files, code = "") {
  const wanted = String(code || "").trim().toUpperCase();
  if (!wanted) return files;
  return files.filter((f) => String(f.code || "").toUpperCase() === wanted);
}

export function fileEntryToAbsolutePath(entry) {
  const relPath = typeof entry === "string" ? entry : entry.path;
  return resolve(process.cwd(), String(relPath || "").replace(/^\.\//, ""));
}

export async function readCardsFromEntry(entry) {
  const abs = fileEntryToAbsolutePath(entry);
  const raw = await readFile(abs, "utf8");
  const cards = JSON.parse(raw);
  return { abs, cards: Array.isArray(cards) ? cards : [] };
}

export async function writeCardsToEntry(entry, cards) {
  const abs = fileEntryToAbsolutePath(entry);
  await writeFile(abs, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
}

