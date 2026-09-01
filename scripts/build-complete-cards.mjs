import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");
const POKEMONGOHUB_INDEX_PATH = resolve(process.cwd(), "data", "raw", "pokemongohub", "index.json");
const FLIBUSTIER_DIR = resolve(process.cwd(), "data", "raw", "flibustier");
const OUT_ROOT = resolve(process.cwd(), "data", "complete");
const CARD_CORRECTIONS_PATH = resolve(process.cwd(), "data", "card-corrections.json");

const categoryMap = {
  pokemon: "Pokemon",
  trainer: "Treinador",
  energy: "Energia"
};

const tipoMap = {
  grass: "Planta",
  fire: "Fogo",
  water: "Agua",
  lightning: "Raio",
  electric: "Raio",
  psychic: "Psiquico",
  fighting: "Luta",
  darkness: "Escuridao",
  metal: "Metal",
  dragon: "Dragao",
  colorless: "Incolor"
};

const stageMap = {
  basic: "Basico",
  stage1: "Estagio 1",
  stage2: "Estagio 2",
  baby: "Baby",
  mega: "Mega",
  ex: "Ex"
};

const rarityLabelPt = {
  C: "Comum",
  U: "Incomum",
  R: "Rara",
  RR: "Duplamente Raro",
  AR: "Ilustração Rara",
  SAR: "Arte Especial Raro",
  SR: "Super Raro",
  IM: "Raro Imersivo",
  S: "Raro Brilhante",
  SSR: "Duplo Brilhante Raro",
  UR: "Coroa Rara"
};

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCardNumber(numero) {
  const match = String(numero || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function inferFormat(name, stage) {
  const nameKey = normalizeKey(name);
  const stageKey = normalizeKey(stage);
  if (stageKey.includes("mega") || /\bmega\b/.test(nameKey)) return "mega";
  if (stageKey === "ex" || stageKey.includes(" ex") || nameKey.endsWith(" ex") || nameKey.includes("-ex")) return "ex";
  return "noex";
}

function buildFilterTags(stage, formato, existingTags = []) {
  const tags = new Set(
    (Array.isArray(existingTags) ? existingTags : [])
      .map(normalizeKey)
      .filter(Boolean)
  );
  const rawStageKey = normalizeKey(stage);
  const stageKey = rawStageKey.includes("estagio 2") || rawStageKey.includes("stage 2")
    ? "2"
    : rawStageKey.includes("estagio 1") || rawStageKey.includes("stage 1")
      ? "1"
      : rawStageKey.includes("basico") || rawStageKey.includes("basic")
        ? "basic"
        : rawStageKey;
  if (stageKey) tags.add(stageKey);
  if (stageKey === "baby") tags.add("basic");
  if (formato === "mega" || formato === "ex") tags.add(formato);
  return [...tags];
}

function deckBuilderNrFromImage(image) {
  const match = String(image || "").match(/^(cPK|cTR)_[0-9]+_([0-9]+)_/);
  if (!match) return 0;
  const baseNr = Number(match[2]) / 10;
  if (!Number.isSafeInteger(baseNr) || baseNr <= 0) return 0;
  return match[1] === "cTR" ? baseNr + 1_000_000 : baseNr;
}

function normalizeStage(stage) {
  const key = normalizeKey(stage);
  return stageMap[key] || String(stage || "").trim();
}

function mapWeakness(value) {
  const key = normalizeKey(String(value || "").replace(/\+\d+/g, ""));
  return tipoMap[key] || "";
}

function mapWeaknessFromRaw(value) {
  const key = normalizeKey(String(value || "").replace(/\+\d+/g, ""));
  return tipoMap[key] || String(value || "").trim();
}

function mapEnergyType(value) {
  return tipoMap[normalizeKey(value)] || String(value || "").trim();
}

function buildStableId(code, number) {
  return `${String(code).toLowerCase()}-${String(number).padStart(3, "0")}`;
}

function buildImageLocal(code, number) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const paddedNumber = String(number).padStart(3, "0");
  if (normalizedCode === "PROMO-A") {
    return `./assets/cards/cartas_pa/pa-${paddedNumber}.jpg`;
  }
  if (normalizedCode === "PROMO-B") {
    return `./assets/cards/cartas_pb/pb-${paddedNumber}.jpg`;
  }

  return `./assets/cards/cartas_${normalizedCode.toLowerCase()}/${buildStableId(code, number)}.jpg`;
}

function buildPackLabel(code, rawPack, packs) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (normalizedCode === "PROMO-A" || normalizedCode === "PROMO-B") {
    return normalizedCode;
  }

  return packs.join(" / ") || String(rawPack || "").trim();
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function run() {
  const [expansionsPayload, rawIndexPayload, cardsMin, cardsExtra, setsPayload, correctionsPayload] = await Promise.all([
    readJson(EXPANSIONS_PATH),
    readJson(POKEMONGOHUB_INDEX_PATH),
    readJson(resolve(FLIBUSTIER_DIR, "cards.min.json")),
    readJson(resolve(FLIBUSTIER_DIR, "cards.extra.json")),
    readJson(resolve(FLIBUSTIER_DIR, "sets.json")),
    readJson(CARD_CORRECTIONS_PATH)
  ]);

  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload.expansions || [];
  const rawFiles = Array.isArray(rawIndexPayload) ? rawIndexPayload : rawIndexPayload.files || [];
  const minArray = Array.isArray(cardsMin) ? cardsMin : [];
  const extraArray = Array.isArray(cardsExtra) ? cardsExtra : [];
  const setEntries = Object.values(setsPayload || {}).flat().filter(Boolean);
  const attackDamageCorrections = correctionsPayload?.attackDamage || {};

  const expansionByCode = new Map(
    expansions.map((entry) => [String(entry.code || "").toUpperCase(), String(entry.name || "").trim()])
  );
  const minMap = new Map(
    minArray.map((card) => [`${String(card.set || "").toUpperCase()}#${Number(card.number)}`, card])
  );
  const extraMap = new Map(
    extraArray.map((card) => [`${String(card.set || "").toUpperCase()}#${Number(card.number)}`, card])
  );
  const setMetaByCode = new Map(setEntries.map((entry) => [String(entry.code || "").toUpperCase(), entry]));

  const outIndex = [];
  const allCards = [];

  for (const entry of rawFiles) {
    const code = String(entry.code || "").toUpperCase();
    const series = String(entry.series || "").trim();
    const rawPath = resolve(process.cwd(), String(entry.path || "").replace(/^\.\//, ""));
    const rawCards = await readJson(rawPath);
    if (!Array.isArray(rawCards)) continue;

    const expansionName =
      expansionByCode.get(code) ||
      String(setMetaByCode.get(code)?.name?.pt || setMetaByCode.get(code)?.name?.en || code).trim();
    const setMeta = setMetaByCode.get(code);

    const mergedCards = rawCards
      .map((rawCard) => {
        const number = parseCardNumber(rawCard.numero);
        const key = number == null ? "" : `${code}#${number}`;
        const min = minMap.get(key);
        const extra = extraMap.get(key);
        const packs = Array.isArray(min?.packs) ? min.packs : Array.isArray(setMeta?.packs) ? setMeta.packs : [];
        const damageCorrection = attackDamageCorrections[key] || [];
        const ataqueLista = Array.isArray(rawCard.ataque)
          ? rawCard.ataque.map((atk, index) => ({
              nomeataque: String(atk?.nomeataque || "").trim(),
              dano: String(damageCorrection[index] ?? atk?.dano ?? "").trim(),
              custoataque: Array.isArray(atk?.custoataque) ? atk.custoataque.map(mapEnergyType) : [],
              efeito: String(atk?.efeito || "").trim()
            }))
          : [];

        const tipo =
          mapEnergyType(extra?.element) ||
          mapEnergyType(rawCard.elemento) ||
          "";

        const categoria =
          categoryMap[normalizeKey(extra?.type)] ||
          (String(rawCard.tipo || "").trim() === "Pokemon" ? "Pokemon" : String(rawCard.tipo || "").trim());

        const stage = normalizeStage(extra?.stage) || String(rawCard.estagio || "").trim();
        const nome = String(rawCard.nome || min?.name || "").trim();
        const rarityCode = String(min?.rarity || extra?.rarity || "").trim().toUpperCase();
        const formato = inferFormat(nome, stage);
        const tags = buildFilterTags(stage, formato, rawCard.tags);

        return {
          id: buildStableId(code, number ?? 0),
          sourceId: String(rawCard.id || "").trim(),
          categoria,
          nome,
          estagio: stage,
          evolucao: String(rawCard.evolucao || "").trim(),
          tipo,
          hp: safeNumber(rawCard.hp, safeNumber(extra?.health, 0)),
          ataque: ataqueLista,
          fraqueza: mapWeaknessFromRaw(rawCard.fraqueza) || mapWeakness(extra?.weakness),
          recuo: safeNumber(rawCard.recuo, safeNumber(extra?.retreatCost, 0)),
          raridade: rarityLabelPt[rarityCode] || String(rawCard.raridade || "").trim(),
          habilidade: Boolean(rawCard.temHabilidade),
          promo: /^PROMO-/i.test(code) || normalizeKey(rawCard.raridade) === "promo",
          formato,
          mega: formato === "mega",
          tags,
          expansao: `${expansionName} (${code})`,
          numero: String(rawCard.numero || "").trim(),
          pacote: buildPackLabel(code, rawCard.pacote, packs),
          imageLocal: buildImageLocal(code, number ?? 0),
          imageUrl: String(rawCard.imageUrl || "").trim(),
          sourceUrl: String(rawCard.sourceUrl || "").trim(),
          custoDeck: safeNumber(rawCard.custoDeck, 0),
          deckBuilderNr: deckBuilderNrFromImage(min?.image || extra?.image),
          releaseDate: String(setMeta?.releaseDate || "").trim(),
          sourceMeta: {
            setCode: code,
            series,
            matchKey: key,
            flibustierMin: Boolean(min),
            flibustierExtra: Boolean(extra),
            pokemongohub: true
          }
        };
      })
      .sort((a, b) => {
        const aNumber = parseCardNumber(a.numero) ?? Number.MAX_SAFE_INTEGER;
        const bNumber = parseCardNumber(b.numero) ?? Number.MAX_SAFE_INTEGER;
        if (aNumber !== bNumber) return aNumber - bNumber;
        return String(a.nome).localeCompare(String(b.nome), "pt-BR");
      });

    const outDir = resolve(OUT_ROOT, series);
    const outPath = resolve(outDir, `${String(code).toLowerCase()}.json`);
    await mkdir(outDir, { recursive: true });
    await writeFile(outPath, `${JSON.stringify(mergedCards, null, 2)}\n`, "utf8");

    outIndex.push({
      code,
      expansion: expansionName,
      series,
      path: `./data/complete/${series}/${String(code).toLowerCase()}.json`,
      count: mergedCards.length
    });
    allCards.push(...mergedCards);
  }

  outIndex.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  await mkdir(resolve(OUT_ROOT, "all"), { recursive: true });
  await writeFile(resolve(OUT_ROOT, "index.json"), `${JSON.stringify({ files: outIndex }, null, 2)}\n`, "utf8");
  await writeFile(resolve(OUT_ROOT, "all", "cards-complete.json"), `${JSON.stringify(allCards, null, 2)}\n`, "utf8");

  console.log(`Arquivos completos por set: ${outIndex.length}`);
  console.log(`Cartas completas: ${allCards.length}`);
  console.log(`Saida: ${OUT_ROOT}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
