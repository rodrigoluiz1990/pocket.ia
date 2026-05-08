import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argValue, filterFilesByCode, loadIndexFiles, normalizeKey, readCardsFromEntry, writeCardsToEntry } from "./lib/cards-store.mjs";

const BASE = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist";
const EXPANSIONS_PATH = resolve(process.cwd(), "data", "expansions.json");

const typeMap = {
  pokemon: "Pokemon",
  trainer: "Treinador",
  energy: "Energia"
};

const tipoMap = {
  grass: "Planta",
  fire: "Fogo",
  water: "Agua",
  lightning: "Raio",
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
  mega: "Mega"
};

function firstNumber(text) {
  const m = String(text || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "pocketia" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.json();
}

async function run() {
  const code = argValue("--code", "");
  const [{ files }, extraCards, expansionsRaw] = await Promise.all([
    loadIndexFiles(),
    fetchJson(`${BASE}/cards.extra.json`),
    readFile(EXPANSIONS_PATH, "utf8")
  ]);

  const expansionsPayload = JSON.parse(expansionsRaw);
  const expansions = Array.isArray(expansionsPayload) ? expansionsPayload : expansionsPayload.expansions || [];
  const expansionPtToCode = Object.fromEntries(expansions.map((e) => [normalizeKey(e.name), String(e.code || "")]));

  const extraMap = new Map(extraCards.map((c) => [`${c.set}#${Number(c.number)}`, c]));

  let fixedCategory = 0;
  let fixedTipo = 0;
  let fixedStage = 0;
  let fixedHp = 0;
  let promoTagged = 0;

  const targetFiles = filterFilesByCode(files, code);
  for (const entry of targetFiles) {
    const { cards } = await readCardsFromEntry(entry);

    for (const card of cards) {
      const setCode = expansionPtToCode[normalizeKey(card.expansao)];
      const n = firstNumber(card.numero);
      const extra = setCode && n != null ? extraMap.get(`${setCode}#${n}`) : null;

      if (extra) {
        const nextCategory = typeMap[String(extra.type || "").toLowerCase()];
        if (nextCategory && nextCategory !== card.categoria) {
          card.categoria = nextCategory;
          fixedCategory++;
        }

        if (extra.element) {
          const nextTipo = tipoMap[String(extra.element || "").toLowerCase()];
          if (nextTipo && nextTipo !== card.tipo) {
            card.tipo = nextTipo;
            fixedTipo++;
          }
        }

        if (extra.stage) {
          const rawStage = String(extra.stage || "").toLowerCase();
          const nextStage = stageMap[rawStage] || card.estagio;
          if (nextStage && nextStage !== card.estagio) {
            card.estagio = nextStage;
            fixedStage++;
          }
        }

        if (typeof extra.health === "number" && Number(extra.health) !== Number(card.hp || 0)) {
          card.hp = Number(extra.health);
          fixedHp++;
        }
      }

      const isPromoSet = /^PROMO-/i.test(String(card.expansao || ""));
      const isPromoRarity = normalizeKey(card.raridade) === "promo";
      const promo = isPromoSet || isPromoRarity;
      if (promo) promoTagged++;
      card.tagPromo = promo;
    }

    await writeCardsToEntry(entry, cards);
  }

  console.log(`Categoria corrigida: ${fixedCategory}`);
  console.log(`Tipo corrigido: ${fixedTipo}`);
  console.log(`Estagio corrigido: ${fixedStage}`);
  console.log(`HP corrigido: ${fixedHp}`);
  console.log(`Cartas com tagPromo=true: ${promoTagged}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
