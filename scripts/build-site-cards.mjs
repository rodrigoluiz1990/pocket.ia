import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");
const OUT_PATH = resolve(process.cwd(), "data", "consolidated", "cards-adapted.json");
function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function resolveIndexPath() {
  const explicit = argValue("--index", "");
  if (explicit) return resolve(process.cwd(), explicit.replace(/^\.\//, ""));

  const completePath = resolve(process.cwd(), "data", "complete", "index.json");
  try {
    await access(completePath);
    return completePath;
  } catch {
    return resolve(process.cwd(), "data", "consolidated", "index.json");
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseCardNumber(numero) {
  const m = String(numero || "").match(/(\d+)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeStage(stage) {
  const s = normalizeKey(stage);
  if (!s) return "basic";
  if (s.includes("mega")) return "mega";
  if (s === "ex" || s.includes("stage ex")) return "ex";
  if (s.includes("baby")) return "baby";
  if (s.includes("2")) return "2";
  if (s.includes("1")) return "1";
  if (s.includes("basic") || s.includes("basico")) return "basic";
  return s;
}

function normalizeAttackList(card) {
  if (Array.isArray(card?.ataque)) return card.ataque;
  return [];
}

function inferFormat(name, stage, fallback) {
  const nameKey = normalizeKey(name);
  const stageKey = normalizeKey(stage);
  const fallbackKey = normalizeKey(fallback);
  if (stageKey.includes("mega") || /\bmega\b/.test(nameKey) || fallbackKey === "mega") return "mega";
  if (stageKey === "ex" || stageKey.includes(" ex") || nameKey.endsWith(" ex") || nameKey.includes("-ex") || fallbackKey === "ex") return "ex";
  return "noex";
}

function buildFilterTags(stage, formato, existingTags = []) {
  const tags = new Set(
    (Array.isArray(existingTags) ? existingTags : [])
      .map(normalizeKey)
      .filter(Boolean)
  );
  const stageKey = normalizeStage(stage);
  if (stageKey) tags.add(stageKey);
  if (stageKey === "baby") tags.add("basic");
  if (formato === "mega" || formato === "ex") tags.add(formato);
  return [...tags];
}

function deriveAttackStats(card, ataqueLista) {
  const maxDanoFromList = ataqueLista.reduce((acc, atk) => {
    const nums = String(atk?.dano || "").match(/\d+/g);
    const score = nums && nums.length ? Math.max(...nums.map(Number)) : 0;
    return Math.max(acc, score);
  }, 0);
  const maxCustoFromList = ataqueLista.reduce((acc, atk) => {
    const len = Array.isArray(atk?.custoataque) ? atk.custoataque.length : 0;
    return Math.max(acc, len);
  }, 0);

  return {
    ataque: safeNumber(card?.ataque, maxDanoFromList),
    custoAtaque: safeNumber(card?.custoAtaque, maxCustoFromList)
  };
}

function sourceTokenFromCard(card) {
  const sourceId = String(card?.sourceId || "").trim();
  if (!sourceId) return "";
  return sourceId.split("-")[0] || "";
}

function assetCodeFromSetCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized === "PROMO-A") return "pa";
  if (normalized === "PROMO-B") return "pb";
  return normalized.toLowerCase();
}

function extractSetCodeFromCard(card) {
  const expansionMatch = String(card?.expansao || "").match(/\(([A-Z0-9-]+)\)\s*$/i);
  if (expansionMatch) return String(expansionMatch[1] || "").toUpperCase();

  const idMatch = String(card?.id || "").match(/^([a-z]\d[a-z]?|p-[ab])-/i);
  if (idMatch) {
    const idToken = String(idMatch[1] || "");
    if (/^p-a$/i.test(idToken)) return "PROMO-A";
    if (/^p-b$/i.test(idToken)) return "PROMO-B";
    return idToken.toUpperCase();
  }

  return "";
}

function normalizeImageFileName(fileName) {
  const value = String(fileName || "").trim();
  const shortPromoMatch = value.match(/^p-([ab])-(\d+\.[a-z0-9]+)$/i);
  if (shortPromoMatch) return `p${String(shortPromoMatch[1]).toLowerCase()}-${shortPromoMatch[2]}`;

  const fullPromoMatch = value.match(/^promo-([ab])-(\d+\.[a-z0-9]+)$/i);
  if (fullPromoMatch) return `p${String(fullPromoMatch[1]).toLowerCase()}-${fullPromoMatch[2]}`;

  const compactPromoMatch = value.match(/^p([ab])-(\d+\.[a-z0-9]+)$/i);
  if (compactPromoMatch) return `p${String(compactPromoMatch[1]).toLowerCase()}-${compactPromoMatch[2]}`;

  return String(fileName || "").trim().toLowerCase();
}

function buildImageLocalFromCard(card, fileName = "") {
  const name = normalizeImageFileName(fileName);
  const setCode = extractSetCodeFromCard(card);
  const assetCode = assetCodeFromSetCode(setCode);
  if (!assetCode || !name) return "";
  return `./assets/cards/cartas_${assetCode}/${name}`;
}

async function resolveImageLocal(card) {
  const preferred = String(card?.imageLocal || "").trim();
  if (preferred) {
    const normalizedPreferred = preferred.replace(/\\/g, "/");
    const preferredFileName = normalizedPreferred.split("/").pop() || "";
    const nextPreferred = buildImageLocalFromCard(card, preferredFileName) || preferred;
    const abs = resolve(process.cwd(), nextPreferred.replace(/^\.\//, ""));
    if (await exists(abs)) return nextPreferred;

    const webpPath = nextPreferred.replace(/\.[^.]+$/, ".webp");
    const webpAbs = resolve(process.cwd(), webpPath.replace(/^\.\//, ""));
    if (webpPath !== nextPreferred && (await exists(webpAbs))) return webpPath;
  }

  const token = sourceTokenFromCard(card);
  if (!token) return preferred;
  const fallbackPath = buildImageLocalFromCard(card, `${token.toLowerCase()}.jpg`);
  if (!fallbackPath) return preferred;
  const abs = resolve(process.cwd(), fallbackPath.replace(/^\.\//, ""));
  return (await exists(abs)) ? fallbackPath : preferred;
}

async function run() {
  const INDEX_PATH = await resolveIndexPath();
  const [indexRaw, expansionsRaw] = await Promise.all([
    readFile(INDEX_PATH, "utf8"),
    readFile(EXPANSIONS_PATH, "utf8")
  ]);

  const indexPayload = JSON.parse(indexRaw.replace(/^\uFEFF/, ""));
  const expansionsPayload = JSON.parse(expansionsRaw.replace(/^\uFEFF/, ""));

  const files = Array.isArray(indexPayload) ? indexPayload : indexPayload?.files || [];
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload?.expansions || [];

  const expansionByCode = new Map(
    expansions.map((entry) => [String(entry.code || "").toUpperCase(), String(entry.name || "").trim()])
  );

  const out = [];
  for (const entry of files) {
    const rel = String((typeof entry === "string" ? entry : entry?.path) || "");
    if (!rel) continue;
    const code = String((typeof entry === "string" ? "" : entry?.code) || "").toUpperCase();
    const expansionBase = expansionByCode.get(code) || String(entry?.expansion || "").trim();
    const expansionLabel = code ? `${expansionBase} (${code})` : expansionBase;
    const abs = resolve(process.cwd(), rel.replace(/^\.\//, ""));
    const raw = await readFile(abs, "utf8");
    const cards = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!Array.isArray(cards)) continue;

    for (const card of cards) {
      const ataqueLista = normalizeAttackList(card);
      const stats = deriveAttackStats(card, ataqueLista);
      const imageLocal = await resolveImageLocal(card);
      const formato = inferFormat(card?.nome, card?.estagio, card?.formato);
      const estagio = normalizeStage(card?.estagio);
      const tags = buildFilterTags(estagio, formato, card?.tags);
      out.push({
        id: String(card?.id || "").trim(),
        sourceId: String(card?.sourceId || "").trim(),
        categoria: String(card?.categoria || card?.tipo || "").trim(),
        nome: String(card?.nome || "").trim(),
        estagio,
        subtipo: String(card?.subtipo || "").trim(),
        evolucao: String(card?.evolucao || "").trim(),
        tipo: String(card?.tipo || card?.elemento || "").trim(),
        hp: safeNumber(card?.hp, 0),
        ataque: stats.ataque,
        custoAtaque: stats.custoAtaque,
        ataqueLista,
        fraqueza: String(card?.fraqueza || "").trim(),
        recuo: safeNumber(card?.recuo, 0),
        raridade: String(card?.raridade || "").trim(),
        habilidade: Boolean(card?.habilidade ?? card?.temHabilidade),
        promo: Boolean(card?.promo ?? card?.tagPromo),
        formato,
        mega: formato === "mega",
        tags,
        expansao: expansionLabel,
        numero: String(card?.numero || "").trim(),
        pacote: String(card?.pacote || "").trim(),
        imageLocal,
        imageUrl: String(card?.imageUrl || "").trim(),
        custoDeck: safeNumber(card?.custoDeck ?? card?.custo, 0),
        deckBuilderNr: safeNumber(card?.deckBuilderNr, 0)
      });
    }
  }

  out.sort((a, b) => {
    const exp = String(a.expansao).localeCompare(String(b.expansao), "pt-BR");
    if (exp !== 0) return exp;
    const n = parseCardNumber(a.numero) - parseCardNumber(b.numero);
    if (n !== 0) return n;
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });

  await mkdir(resolve(OUT_PATH, ".."), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`Cartas adaptadas geradas: ${out.length}`);
  console.log(`Origem: ${INDEX_PATH}`);
  console.log(`Arquivo: ${OUT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
