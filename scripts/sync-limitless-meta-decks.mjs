import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const CATALOG_PATH = resolve(process.cwd(), "data", "consolidated", "cards-adapted.json");
const OUTPUT_PATH = resolve(process.cwd(), "data", "meta-decks.json");
const META_URL = "https://play.limitlesstcg.com/decks?game=POCKET";
const LIMIT = 50;

async function readJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Pocketia meta deck importer/1.0" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${response.status} ao acessar ${url}`);
  return response.text();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeCardId(set, number) {
  const normalizedSet = String(set || "").trim().toLowerCase();
  const normalizedNumber = String(number || "").trim().padStart(3, "0");
  const promo = normalizedSet.match(/^p-([ab])$/);
  return promo ? `promo-${promo[1]}-${normalizedNumber}` : `${normalizedSet}-${normalizedNumber}`;
}

function parseArchetypes(html) {
  const archetypes = [];
  const seen = new Set();
  const matcher = /<td><a href="\/decks\/([^?"/]+)\?([^"\n]+)">([^<]+)<\/a><\/td>/g;
  let match;

  while ((match = matcher.exec(html)) && archetypes.length < LIMIT) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    archetypes.push({
      slug,
      name: decodeHtml(match[3]).trim(),
      url: `https://play.limitlesstcg.com/decks/${slug}?${decodeHtml(match[2])}`
    });
  }
  return archetypes;
}

function decklistUrls(html) {
  return [...new Set([...html.matchAll(/href="([^"\n]*\/decklist)"/g)].map((match) => {
    const href = decodeHtml(match[1]);
    return href.startsWith("http") ? href : `https://play.limitlesstcg.com${href}`;
  }))];
}

function parseDecklist(html, cardIds, archetypeName) {
  const input = html.match(/<input type="hidden" name="input" value="([^"]+)"/);
  if (!input) throw new Error("lista sem dados de cartas");

  const entries = JSON.parse(decodeHtml(input[1]));
  const cards = entries.flatMap((entry) => {
    const id = normalizeCardId(entry.set, entry.number);
    return Array.from({ length: Number(entry.count) || 0 }, () => ({ id, name: String(entry.name || "") }));
  });
  const ids = cards.map((card) => card.id);
  const invalid = [...new Set(ids.filter((id) => !cardIds.has(id)))];
  if (ids.length !== 20) throw new Error(`lista com ${ids.length} cartas`);
  if (invalid.length) throw new Error(`cartas ausentes no catalogo: ${invalid.join(", ")}`);
  const normalizedArchetype = archetypeName.toLocaleLowerCase("en-US");
  const featured = cards.find((card) => card.name && normalizedArchetype.includes(card.name.toLocaleLowerCase("en-US")));
  return { ids, principalId: featured?.id || ids[0] };
}

async function firstValidDeck(archetype, cardIds) {
  const archetypeHtml = await fetchText(archetype.url);
  const candidates = decklistUrls(archetypeHtml).slice(0, 8);
  if (!candidates.length) throw new Error("nenhuma lista publicada");

  const reasons = [];
  for (const url of candidates) {
    try {
      return parseDecklist(await fetchText(url), cardIds, archetype.name);
    } catch (error) {
      reasons.push(error.message);
    }
  }
  throw new Error(reasons[0] || "nenhuma lista valida");
}

async function run() {
  const catalog = await readJson(CATALOG_PATH);
  const cardIds = new Set(catalog.map((card) => String(card.id).toLowerCase()));
  const archetypes = parseArchetypes(await fetchText(META_URL));
  if (archetypes.length !== LIMIT) throw new Error(`Foram encontrados ${archetypes.length} arquétipos; esperado: ${LIMIT}.`);

  const decks = [];
  const failures = [];
  for (const [index, archetype] of archetypes.entries()) {
    process.stdout.write(`[${index + 1}/${LIMIT}] ${archetype.name}... `);
    try {
      const deck = await firstValidDeck(archetype, cardIds);
      decks.push({ nome: archetype.name, principal: { id: deck.principalId }, cartas: deck.ids.map((id) => ({ id })) });
      console.log("ok");
    } catch (error) {
      failures.push(`${archetype.name}: ${error.message}`);
      console.log("falhou");
    }
  }

  if (failures.length) {
    console.error(`Importacao cancelada: ${failures.length} lista(s) nao puderam ser validadas.\n${failures.join("\n")}`);
    process.exitCode = 1;
    return;
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(decks, null, 2)}\n`, "utf8");
  console.log(`Concluido: ${decks.length} decks validados e gravados em data/meta-decks.json.`);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
