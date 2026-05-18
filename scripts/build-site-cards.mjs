import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INDEX_PATH = resolve(process.cwd(), "data", "consolidated", "index.json");
const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");
const OUT_PATH = resolve(process.cwd(), "data", "consolidated", "cards-adapted.json");

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

async function run() {
  const [indexRaw, expansionsRaw] = await Promise.all([
    readFile(INDEX_PATH, "utf8"),
    readFile(EXPANSIONS_PATH, "utf8")
  ]);

  const indexPayload = JSON.parse(indexRaw.replace(/^\uFEFF/, ""));
  const expansionsPayload = JSON.parse(expansionsRaw.replace(/^\uFEFF/, ""));

  const files = Array.isArray(indexPayload) ? indexPayload : indexPayload?.files || [];
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload?.expansions || [];

  const expansionByCode = new Map(
    expansions.map((e) => [String(e.code || "").toUpperCase(), String(e.name || "").trim()])
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
      out.push({
        id: String(card?.id || "").trim(),
        categoria: String(card?.categoria || card?.tipo || "").trim(),
        nome: String(card?.nome || "").trim(),
        estagio: normalizeStage(card?.estagio),
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
        formato: String(card?.formato || "noex").trim(),
        expansao: expansionLabel,
        numero: String(card?.numero || "").trim(),
        pacote: String(card?.pacote || "").trim(),
        imageLocal: String(card?.imageLocal || "").trim(),
        imageUrl: String(card?.imageUrl || "").trim(),
        custoDeck: safeNumber(card?.custoDeck ?? card?.custo, 0)
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
  console.log(`Arquivo: ${OUT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
