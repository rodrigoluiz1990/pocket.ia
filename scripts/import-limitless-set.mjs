import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Importa uma colecao (ou parte dela) do pocket.limitlesstcg.com para data/raw/pokemongohub,
// para colecoes que ainda nao existem no flibustier nem no pokemongohub.
// Uso: node scripts/import-limitless-set.mjs C1
//      node scripts/import-limitless-set.mjs PROMO-B --numbers 95-103   (acrescenta ao raw existente)
//      --cache <pasta>  le/grava as paginas HTML numa pasta local (<CODIGO_LIMITLESS>_<n>.html)

const BASE_URL = "https://pocket.limitlesstcg.com";
const IMAGE_BASE = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/pocket";
const RAW_ROOT = resolve(process.cwd(), "data", "raw", "pokemongohub");
const COMPLETE_ALL = resolve(process.cwd(), "data", "complete", "all", "cards-complete.json");
const MIN_CARDS = resolve(process.cwd(), "data", "raw", "flibustier", "cards.min.json");
const REQUEST_DELAY_MS = 400;

const SET_CODE = String(process.argv[2] || "").trim().toUpperCase();
const NUMBERS_ARG = argValue("--numbers", "");
const CACHE_DIR = argValue("--cache", "");

const energyBySymbol = {
  G: "grass", R: "fire", W: "water", L: "lightning", P: "psychic",
  F: "fighting", D: "darkness", M: "metal", N: "dragon", C: "colorless"
};

const rarityBySymbol = {
  "◊": "Comum",
  "◊◊": "Incomum",
  "◊◊◊": "Rara",
  "◊◊◊◊": "Duplamente Raro",
  "☆": "Ilustração Rara",
  // A Limitless nao separa Super Raro de Arte Especial Raro; o flibustier corrige quando tiver o set.
  "☆☆": "Super Raro",
  "☆☆☆": "Raro Imersivo",
  "Crown Rare": "Coroa Rara"
};

const stageByLimitless = {
  basic: "Basico",
  "stage 1": "Estagio 1",
  "stage 2": "Estagio 2"
};

const trainerSubtypeByLimitless = {
  item: "Item",
  tool: "Ferramenta",
  "pokémon tool": "Ferramenta",
  supporter: "Apoiador",
  stadium: "Estadio"
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function seriesFromCode(code) {
  const c = String(code).toUpperCase();
  if (c.startsWith("C") || c === "PROMO-C") return "c";
  if (c.startsWith("B") || c === "PROMO-B") return "b";
  return "a";
}

function limitlessCodeFromSetCode(code) {
  const match = String(code).toUpperCase().match(/^PROMO-([A-Z])$/);
  return match ? `P-${match[1]}` : String(code);
}

function setCodeFromLimitlessCode(code) {
  const match = String(code).toUpperCase().match(/^P-([A-Z])$/);
  return match ? `PROMO-${match[1]}` : String(code).toUpperCase();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumbers(value) {
  const out = [];
  for (const part of String(value).split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) out.push(n);
    } else {
      out.push(Number(part));
    }
  }
  return out.filter((n) => Number.isSafeInteger(n) && n > 0);
}

async function readJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^﻿/, ""));
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchHtml(path, cacheName) {
  const cachePath = CACHE_DIR && cacheName ? resolve(CACHE_DIR, cacheName) : "";
  if (cachePath) {
    try {
      return await readFile(cachePath, "utf8");
    } catch {
      // nao esta no cache: baixa
    }
  }
  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(`${BASE_URL}${path}`, { headers: { "User-Agent": "pocketia" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${BASE_URL}${path}`);
  const html = await response.text();
  if (cachePath) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, html, "utf8");
  }
  return html;
}

function formatDamage(value) {
  const match = String(value || "").match(/^(\d+)\s*([+x×])?$/);
  if (!match) return "";
  if (!match[2]) return match[1];
  return `${match[1]} ${match[2] === "+" ? "+" : "×"}`;
}

function parseCardPage(html) {
  const start = html.indexOf('<div class="card-text">');
  const end = html.indexOf("card-text-artist", start);
  const text = start >= 0 ? html.slice(start, end > start ? end : undefined) : "";

  const name = decodeHtml(text.match(/card-text-name">([\s\S]*?)<\/span>/)?.[1]);
  const titleRest = decodeHtml(text.match(/card-text-title">[\s\S]*?<\/span>([\s\S]*?)<\/p>/)?.[1]);
  // Cartas de dois tipos vem como "Water/Darkness": o primeiro e o tipo principal.
  const titleMatch = titleRest.match(/-\s*([A-Za-z]+(?:\/[A-Za-z]+)*)\s*-\s*(\d+)\s*HP/);
  const elements = String(titleMatch?.[1] || "").split("/").map(normalizeKey).filter(Boolean);
  const typeLine = decodeHtml(text.match(/card-text-type">([\s\S]*?)<\/p>/)?.[1]);
  const [kind = "", detail = ""] = typeLine.split(" - ").map((part) => part.trim());

  const attacks = [...text.matchAll(/<div class="card-text-attack">([\s\S]*?)<\/div>/g)].map((match) => {
    const block = match[1];
    const symbols = block.match(/ptcg-symbol">([^<]*)</)?.[1]?.trim() || "";
    const info = decodeHtml(block.match(/card-text-attack-info">([\s\S]*?)<\/p>/)?.[1]).replace(symbols, "").trim();
    const infoMatch = info.match(/^(.*?)(?:\s+(\d+\s*[+x×]?))?$/);
    return {
      name: String(infoMatch?.[1] || info).trim(),
      damage: formatDamage(infoMatch?.[2]),
      cost: symbols && symbols !== "0"
        ? symbols.split("").map((symbol) => energyBySymbol[symbol] || symbol)
        : ["empty"],
      effect: decodeHtml(block.match(/card-text-attack-effect">([\s\S]*?)<\/p>/)?.[1])
    };
  });

  const weakness = decodeHtml(text.match(/Weakness:\s*([^<]*)</)?.[1]);
  const retreat = Number(text.match(/Retreat:\s*(\d+)/)?.[1] || 0);

  const printDetails = decodeHtml(html.match(/prints-current-details">\s*<span[^>]*>[\s\S]*?<\/span>\s*<span>([\s\S]*?)<\/span>/)?.[1]);
  const printParts = printDetails.split("·").map((part) => part.trim()).filter(Boolean);
  const raritySymbol = printParts.find((part) => rarityBySymbol[part]) || "";
  const packPart = printParts.find((part) => / pack$/i.test(part)) || "";

  const versionsStart = html.indexOf("card-prints-versions");
  const versionsHtml = versionsStart >= 0 ? html.slice(versionsStart, html.indexOf("</table>", versionsStart)) : "";
  const versions = [...versionsHtml.matchAll(/href="\/cards\/([A-Za-z0-9-]+)\/(\d+)"/g)]
    .map((match) => ({ code: setCodeFromLimitlessCode(match[1]), number: Number(match[2]) }));

  return {
    name,
    element: elements[0] || "",
    elements,
    hp: Number(titleMatch?.[2] || 0),
    isPokemon: /^pok/i.test(normalizeKey(kind)),
    stage: stageByLimitless[normalizeKey(detail)] || "",
    trainerSubtype: trainerSubtypeByLimitless[normalizeKey(detail)] || "",
    hasAbility: /card-text-ability/.test(text),
    attacks,
    weakness: /^none$/i.test(weakness) ? "" : normalizeKey(weakness),
    retreat,
    rarity: rarityBySymbol[raritySymbol] || "",
    pack: packPart.replace(/ pack$/i, "").trim(),
    versions
  };
}

function custoDeckFromRarity(rarity) {
  if (rarity === "Comum" || rarity === "Incomum" || rarity === "Promo") return 1;
  if (rarity === "Rara") return 3;
  if (rarity === "Raro Brilhante" || rarity === "Duplo Brilhante Raro") return 2;
  return 8;
}

// Traducoes a partir do catalogo atual: nome EN (flibustier) -> nome PT do projeto,
// e nome de ataque PT pelo mesmo Pokemon/dano/custo ou pelo mesmo efeito (os efeitos estao em ingles).
function buildTranslations(catalog, minCards) {
  const enByKey = new Map(minCards.map((card) => [`${String(card.set).toUpperCase()}#${Number(card.number)}`, card.name]));
  const nameVotes = new Map();
  const attackByPokemon = new Map();
  const attackByEffect = new Map();

  for (const card of catalog) {
    const en = enByKey.get(card?.sourceMeta?.matchKey);
    if (en && card.nome) {
      const votes = nameVotes.get(en) || new Map();
      votes.set(card.nome, (votes.get(card.nome) || 0) + 1);
      nameVotes.set(en, votes);
    }
    for (const attack of Array.isArray(card.ataque) ? card.ataque : []) {
      if (!attack?.nomeataque) continue;
      const costs = (attack.custoataque || []).map(normalizeKey).join(",");
      attackByPokemon.set(`${normalizeKey(card.nome)}|${attack.dano}|${costs}`, attack.nomeataque);
      if (attack.efeito) attackByEffect.set(`${normalizeKey(attack.efeito)}|${attack.dano}`, attack.nomeataque);
    }
  }

  const ptNameByEn = new Map(
    [...nameVotes].map(([en, votes]) => [en, [...votes].sort((a, b) => b[1] - a[1])[0][0]])
  );
  return { ptNameByEn, attackByPokemon, attackByEffect };
}

const regionalFormPt = { Alolan: "Alola", Galarian: "Galar", Hisuian: "Hisui", Paldean: "Paldea" };

// "Alolan Exeggutor ex" -> "Exeggutor de Alola ex", no padrao dos nomes do projeto.
function translateRegionalForm(name) {
  const match = String(name).match(/^(Alolan|Galarian|Hisuian|Paldean) (.+?)( ex)?$/);
  if (!match) return name;
  return `${match[2]} de ${regionalFormPt[match[1]]}${match[3] || ""}`;
}

const tipoPtByEn = {
  grass: "Planta", fire: "Fogo", water: "Agua", lightning: "Raio", psychic: "Psiquico",
  fighting: "Luta", darkness: "Escuridao", metal: "Metal", dragon: "Dragao", colorless: "Incolor"
};

async function run() {
  if (!SET_CODE) throw new Error("Informe o codigo do set, ex.: node scripts/import-limitless-set.mjs C1");

  const limitlessCode = limitlessCodeFromSetCode(SET_CODE);
  const [catalog, minCards] = await Promise.all([readJson(COMPLETE_ALL), readJson(MIN_CARDS)]);
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const { ptNameByEn, attackByPokemon, attackByEffect } = buildTranslations(catalog, minCards);

  const setHtml = await fetchHtml(`/cards/${limitlessCode}`, `${limitlessCode}.html`);
  const setNumbers = [...new Set([...setHtml.matchAll(new RegExp(`href="/cards/${limitlessCode}/(\\d+)"`, "g"))].map((m) => Number(m[1])))]
    .sort((a, b) => a - b);
  if (!setNumbers.length) throw new Error(`Nenhuma carta encontrada em ${BASE_URL}/cards/${limitlessCode}`);
  const totalInSet = setNumbers[setNumbers.length - 1];
  const numbers = NUMBERS_ARG ? parseNumbers(NUMBERS_ARG) : setNumbers;
  const pages = new Map();
  for (const number of numbers) {
    pages.set(number, parseCardPage(await fetchHtml(`/cards/${limitlessCode}/${number}`, `${limitlessCode}_${number}.html`)));
  }
  // Sem pacote indicado, a carta sai em todos os pacotes do set.
  const allPacks = [...new Set([...pages.values()].map((page) => page.pack).filter(Boolean))].sort();

  const stats = { reimpressao: 0, nomeTraduzido: 0, ataqueTraduzido: 0, ataqueIngles: 0, semRaridade: 0 };
  const rawCards = [];
  for (const number of numbers) {
    const padded = String(number).padStart(3, "0");
    const page = pages.get(number);
    if (!page.name) throw new Error(`Nao foi possivel ler ${limitlessCode} #${number}`);

    const rarity = page.rarity || (/^PROMO-/.test(SET_CODE) ? "Promo" : "");
    if (!rarity) stats.semRaridade++;
    const common = {
      id: `${SET_CODE.toLowerCase()}-${padded}`,
      raridade: rarity,
      custoDeck: custoDeckFromRarity(rarity),
      tags: [],
      expansao: SET_CODE,
      numero: `${number} / ${totalInSet}`,
      evolucao: "",
      pacote: page.pack || allPacks.join(" / "),
      imageUrl: `${IMAGE_BASE}/${limitlessCode}/${limitlessCode}_${padded}_EN_SM.webp`,
      sourceUrl: `${BASE_URL}/cards/${limitlessCode}/${number}`
    };

    // Reimpressao de colecao antiga: reaproveita o texto em portugues da carta original.
    const base = page.versions
      .filter((version) => version.code !== SET_CODE)
      .map((version) => catalogById.get(`${version.code.toLowerCase()}-${String(version.number).padStart(3, "0")}`))
      .find(Boolean);
    if (base) {
      stats.reimpressao++;
      rawCards.push({
        ...common,
        nome: base.nome,
        tipo: base.categoria,
        elemento: base.tipo,
        elementos: Array.isArray(base.tipos) && base.tipos.length ? base.tipos : [base.tipo].filter(Boolean),
        estagio: base.estagio,
        subtipo: base.subtipo || "",
        hp: Number(base.hp) || 0,
        ataque: Array.isArray(base.ataque) ? base.ataque : [],
        fraqueza: base.fraqueza || "",
        recuo: Number(base.recuo) || 0,
        temHabilidade: Boolean(base.habilidade)
      });
      continue;
    }

    const nome = ptNameByEn.get(page.name) || translateRegionalForm(page.name);
    if (nome !== page.name) stats.nomeTraduzido++;
    const ataque = page.attacks.map((attack) => {
      const costsPt = attack.cost.map((cost) => tipoPtByEn[cost] || cost);
      const ptName =
        attackByPokemon.get(`${normalizeKey(nome)}|${attack.damage}|${costsPt.map(normalizeKey).join(",")}`) ||
        (attack.effect ? attackByEffect.get(`${normalizeKey(attack.effect)}|${attack.damage}`) : "");
      if (ptName) stats.ataqueTraduzido++;
      else stats.ataqueIngles++;
      return {
        nomeataque: ptName || attack.name,
        dano: attack.damage,
        custoataque: attack.cost,
        efeito: attack.effect
      };
    });

    rawCards.push({
      ...common,
      nome,
      tipo: page.isPokemon ? "Pokemon" : "Treinador",
      elemento: page.isPokemon ? page.element : "Neutro",
      elementos: page.isPokemon ? page.elements : ["Neutro"],
      estagio: page.isPokemon ? page.stage || "Basico" : "Basico",
      subtipo: page.isPokemon ? "" : page.trainerSubtype,
      hp: page.hp,
      ataque,
      fraqueza: page.weakness,
      recuo: page.retreat,
      temHabilidade: page.hasAbility
    });
  }

  const series = seriesFromCode(SET_CODE);
  const rawDir = resolve(RAW_ROOT, series);
  const rawPath = resolve(rawDir, `${SET_CODE.toLowerCase()}.json`);
  await mkdir(rawDir, { recursive: true });

  // Com --numbers, mantem as cartas que ja existem no raw e troca so as importadas.
  let outCards = rawCards;
  if (NUMBERS_ARG) {
    let existing = [];
    try {
      existing = await readJson(rawPath);
    } catch {
      existing = [];
    }
    const imported = new Set(numbers);
    const numberOf = (card) => Number(String(card.numero || "").match(/\d+/)?.[0] || 0);
    outCards = existing
      .filter((card) => !imported.has(numberOf(card)))
      .concat(rawCards)
      .sort((a, b) => numberOf(a) - numberOf(b));
  }
  await writeFile(rawPath, `${JSON.stringify(outCards, null, 2)}\n`, "utf8");

  const rawIndexPath = resolve(RAW_ROOT, "index.json");
  const rawIndex = await readJson(rawIndexPath);
  const nextEntry = {
    code: SET_CODE,
    series,
    path: `./data/raw/pokemongohub/${series}/${SET_CODE.toLowerCase()}.json`,
    count: outCards.length
  };
  const files = (rawIndex.files || [])
    .filter((entry) => String(entry.code || "").toUpperCase() !== SET_CODE)
    .concat(nextEntry)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  await writeFile(rawIndexPath, `${JSON.stringify({ ...rawIndex, files }, null, 2)}\n`, "utf8");

  console.log(`${rawCards.length} cartas ${SET_CODE} importadas da Limitless (${outCards.length} no arquivo).`);
  console.log(
    `Reimpressoes com texto PT: ${stats.reimpressao} | nomes traduzidos: ${stats.nomeTraduzido} | ` +
    `ataques traduzidos: ${stats.ataqueTraduzido} | ataques em ingles: ${stats.ataqueIngles} | sem raridade: ${stats.semRaridade}`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
