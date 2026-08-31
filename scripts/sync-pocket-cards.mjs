import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = "https://pocket.pokemongohub.net";
const START_URL = `${BASE_URL}/pt`;

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const OUTPUT_PATH = resolve(
  process.cwd(),
  argValue("--out", "data/raw/pokemongohub/all/cards-synced.json")
);
const EXPANSIONS_PATH = resolve(process.cwd(), "data/expansions.json");
const FLIBUSTIER_SETS_PATH = resolve(process.cwd(), "data/raw/flibustier/sets.json");
const RAW_SITE_ROOT = resolve(process.cwd(), "data/raw/pokemongohub");

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function seriesFromCode(code) {
  const c = String(code || "").toUpperCase();
  if (/^A/.test(c) || c === "PROMO-A") return "a";
  if (/^B/.test(c) || c === "PROMO-B") return "b";
  return "misc";
}

function abs(url) {
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}

function findAll(html, regex) {
  const out = [];
  let match;
  while ((match = regex.exec(html)) !== null) out.push(match[1]);
  return [...new Set(out)];
}

async function loadExistingCardUrls() {
  const urls = new Set();
  const seriesDirs = ["a", "b", "misc"];

  for (const series of seriesDirs) {
    const dir = resolve(RAW_SITE_ROOT, series);
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !/\.json$/i.test(String(entry.name || ""))) continue;
      const absPath = resolve(dir, entry.name);
      const raw = await readFile(absPath, "utf8");
      const cards = JSON.parse(raw.replace(/^\uFEFF/, ""));
      if (!Array.isArray(cards)) continue;

      for (const card of cards) {
        const url = String(card?.sourceUrl || "").trim();
        if (url) urls.add(abs(url));
      }
    }
  }

  return [...urls];
}

function fixEncoding(text) {
  return String(text || "")
    .replace(/ÃƒÂ¡/g, "á")
    .replace(/Ãƒ /g, "à")
    .replace(/ÃƒÂ¢/g, "â")
    .replace(/ÃƒÂ£/g, "ã")
    .replace(/ÃƒÂ©/g, "é")
    .replace(/ÃƒÂª/g, "ê")
    .replace(/ÃƒÂ­/g, "í")
    .replace(/ÃƒÂ³/g, "ó")
    .replace(/ÃƒÂ´/g, "ô")
    .replace(/ÃƒÂµ/g, "õ")
    .replace(/ÃƒÂº/g, "ú")
    .replace(/ÃƒÂ§/g, "ç")
    .replace(/Ãƒâ€°/g, "É")
    .replace(/Ãƒâ€¡/g, "Ç");
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function clean(text) {
  return decodeHtmlEntities(fixEncoding(String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
}

function decodeEscapedUnicode(text) {
  return String(text || "").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function findField(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowRegex = new RegExp(`<th[^>]*>${esc}<\\/th><td[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const rowMatch = html.match(rowRegex);
  if (rowMatch) return clean(rowMatch[1]);

  const genericRegex = new RegExp(`${esc}\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, "i");
  const genericMatch = html.match(genericRegex);
  return genericMatch ? clean(genericMatch[1]) : "";
}

function findFieldHtml(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowRegex = new RegExp(`<th[^>]*>${esc}<\\/th><td[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const rowMatch = html.match(rowRegex);
  return rowMatch ? String(rowMatch[1] || "") : "";
}

function extractSection(html, labelId) {
  const marker = `aria-labelledby="${labelId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return "";

  if (labelId === "section-moves") {
    const nextMarker = html.indexOf('aria-labelledby="section-card-stats"', start);
    return nextMarker === -1 ? html.slice(start) : html.slice(start, nextMarker);
  }

  if (labelId === "section-abilities") {
    const nextMarker = html.indexOf('aria-labelledby="section-moves"', start);
    return nextMarker === -1 ? html.slice(start) : html.slice(start, nextMarker);
  }

  return html.slice(start);
}

function parseMoves(html) {
  const section = extractSection(html, "section-moves");
  if (!section) return [];

  const out = [];
  const moveRegex =
    /<ul[^>]*aria-label="Tipo de Energia"[^>]*>([\s\S]*?)<\/ul>\s*<h3[^>]*>\s*(?:<a[^>]*href="\/(?:pt\/)?attack\/[^"]+"[^>]*>)?([^<]+)(?:<\/a>)?\s*<\/h3>[\s\S]*?<span[^>]*class="[^"]*shrink-0 font-bold[^"]*"[^>]*>([\s\S]*?)<\/span>(?:[\s\S]*?<p[^>]*class="[^"]*text-sm[^"]*"[^>]*>([\s\S]*?)<\/p>)?/gi;
  let itemMatch;
  while ((itemMatch = moveRegex.exec(section)) !== null) {
    const costsBlock = itemMatch[1] || "";
    const name = clean(itemMatch[2] || "");
    const damage = clean((itemMatch[3] || "").replace(/<!--[\s\S]*?-->/g, ""));
    const effect = clean(itemMatch[4] || "");
    const costs = [...costsBlock.matchAll(/<img[^>]+alt="([^"]+)"/gi)].map((match) => normalizeKey(match[1]));

    if (!name) continue;
    out.push({
      nomeataque: name,
      dano: damage,
      custoataque: costs,
      efeito: effect
    });
  }

  if (out.length) return out;

  const serializedMoves = [];
  const blocks = section.split(/\\"move-\d+\\"/g).slice(1);
  for (const block of blocks) {
    const untilNextSection = block.split('section-card-stats')[0] || block;
    const nameMatch = untilNextSection.match(/\\"href\\":\\"\/attack\/[^"]+\\",\\"className\\":\\"[^"]*\\",\\"children\\":\\"([^"]+)\\"/);
    const name = clean(decodeEscapedUnicode(nameMatch?.[1] || ""));
    if (!name) continue;

    const preName = nameMatch ? untilNextSection.slice(0, nameMatch.index) : untilNextSection;
    const costs = [...preName.matchAll(/\\"alt\\":\\"([^"]+)\\"/g)].map((match) => normalizeKey(match[1]));
    const damageMatch = untilNextSection.match(/\\"className\\":\\"shrink-0 font-bold\\",\\"children\\":\\[(.*?)\\]/);
    const damageToken = String(damageMatch?.[1] || "").split(",")[0]?.trim() || "";
    const damage = damageToken.replace(/^"|"$/g, "");
    const effectMatch = untilNextSection.match(/\\"className\\":\\"text-sm pt-1\\",\\"children\\":\\"([^"]*)\\"/);
    const effect = clean(decodeEscapedUnicode(effectMatch?.[1] || ""));

    serializedMoves.push({
      nomeataque: name,
      dano: clean(decodeEscapedUnicode(damage)),
      custoataque: costs,
      efeito: effect
    });
  }

  return serializedMoves;
}

const energyLabelMap = {
  grass: "Planta",
  grama: "Planta",
  fire: "Fogo",
  water: "Agua",
  agua: "Agua",
  lightning: "Raio",
  electric: "Raio",
  eletrico: "Raio",
  electrico: "Raio",
  psychic: "Psiquico",
  psiquico: "Psiquico",
  fighting: "Luta",
  darkness: "Escuridao",
  dark: "Escuridao",
  metal: "Metal",
  steel: "Metal",
  dragon: "Dragao",
  colorless: "Incolor",
  incolor: "Incolor",
  neutral: "Incolor",
  neutro: "Incolor"
};

function mapEnergyLabel(value) {
  const key = normalizeKey(value).replace(/\+\d+/g, "").trim();
  return energyLabelMap[key] || clean(value);
}

function parseWeakness(html) {
  const weaknessHtml = findFieldHtml(html, "Fraqueza");
  if (!weaknessHtml) return "";
  const altMatch = weaknessHtml.match(/alt="([^"]+)"/i);
  if (altMatch) return mapEnergyLabel(altMatch[1]);
  return mapEnergyLabel(weaknessHtml);
}

function parseRetreatCost(html) {
  const retreatHtml = findFieldHtml(html, "Custo de Recuo");
  if (!retreatHtml) return 0;
  const iconMatches = [...retreatHtml.matchAll(/alt="([^"]+)"/gi)];
  if (iconMatches.length) {
    return iconMatches.filter((match) => normalizeKey(match[1]) === "colorless").length || iconMatches.length;
  }
  const numericMatch = clean(retreatHtml).match(/(\d+)/);
  return numericMatch ? Number(numericMatch[1]) : 0;
}

function parsePackName(html) {
  const introMatch = html.match(/a partir de\s+[^:]+:\s+([^<]+?)\s+pacote no conjunto/i);
  return introMatch ? clean(introMatch[1]) : "";
}

function inferSetCodeFromImageUrl(url) {
  const value = String(url || "").trim().toLowerCase();
  const match = value.match(/\/wallpapers\/([a-z0-9-]+)\//i);
  return match ? String(match[1] || "").toUpperCase() : "";
}

function rarityToTier(r) {
  if (/ultra|coroa|estrela|shiny|brilhante/i.test(r)) return "Ultra Rara";
  if (/rara/i.test(r)) return "Rara";
  if (/incomum/i.test(r)) return "Incomum";
  if (/comum|diamante/i.test(r)) return "Comum";
  return r || "Desconhecida";
}

function inferTipo(stage, text, hp) {
  if (hp > 0) return "Pokemon";
  if (/item|ferramenta|apoiador|suporte|estádio|stadium/i.test(text)) return "Treinador";
  if (/energia/i.test(text)) return "Energia";
  if (/básico|estágio|ex\b|mega/i.test(stage + " " + text)) return "Pokemon";
  return "Pokemon";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`Falha ${response.status} em ${url}`);
  return response.text();
}

function parseCardPage(html, url) {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const nome = titleMatch ? clean(titleMatch[1]) : "";
  const numeroTxt = findField(html, "Número da Carta");
  const estagio = findField(html, "Estágio") || "Desconhecido";
  const elemento = findField(html, "Tipo de Energia") || "Neutro";
  const raridadeRaw = findField(html, "Descrição da Raridade") || findField(html, "Raridade");
  const setMatch = html.match(/conjunto\s+([^.<]+?)\s+no Pokémon TCG Pocket/i);
  const expansao = setMatch ? clean(setMatch[1]) : "Desconhecida";
  const hpTxt = findField(html, "Vida");
  const craftTxt = findField(html, "Custo para criar");
  const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const idMatch = url.match(/\/card\/([^/"?#]+)/i);
  const numMatch = numeroTxt.match(/(\d+)/);

  const hp = Number(hpTxt.match(/(\d+)/)?.[1] || 0);
  return {
    id: idMatch ? idMatch[1] : `${expansao}-${numMatch ? numMatch[1] : nome}`.toLowerCase().replace(/\s+/g, "-"),
    nome,
    tipo: inferTipo(estagio, html, hp),
    elemento,
    raridade: rarityToTier(raridadeRaw),
    custoDeck: Math.max(1, Math.min(8, Math.round((Number(craftTxt.match(/(\d+)/)?.[1] || 80) || 80) / 50))),
    estagio,
    expansao,
    numero: numeroTxt,
    hp,
    evolucao: findField(html, "Evolui de") || findField(html, "Evolves From"),
    ataque: parseMoves(html),
    fraqueza: parseWeakness(html),
    recuo: parseRetreatCost(html),
    temHabilidade: /aria-labelledby="section-abilities"/i.test(html),
    pacote: parsePackName(html),
    imageUrl: imageMatch ? imageMatch[1] : "",
    sourceUrl: url
  };
}

async function run() {
  console.log("Buscando sets...");
  const home = await fetchText(START_URL);
  const setLinks = findAll(home, /href="(\/pt\/set\/[^"]+)"/g).map(abs);
  if (!setLinks.length) throw new Error("Nenhum set encontrado na página inicial.");

  console.log(`Sets encontrados: ${setLinks.length}`);
  const cardUrlSet = new Set();

  for (const setUrl of setLinks) {
    console.log(`Lendo set: ${setUrl}`);
    const setHtml = await fetchText(setUrl);
    const cardLinks = findAll(setHtml, /href="(\/pt\/card\/[^"]+)"/g).map(abs);
    cardLinks.forEach((u) => cardUrlSet.add(u));
    console.log(`Cartas acumuladas: ${cardUrlSet.size}`);
  }

  let cardUrls = [...cardUrlSet];
  if (!cardUrls.length) {
    console.warn("Nenhum link de carta encontrado nas paginas de set. Usando sourceUrl salvos localmente como fallback.");
    cardUrls = await loadExistingCardUrls();
  }
  if (!cardUrls.length) {
    throw new Error("Nenhuma URL de carta encontrada nem nas paginas de set nem nos arquivos raw locais.");
  }

  const cardsOut = [];
  console.log(`Extraindo detalhes de ${cardUrls.length} cartas...`);
  const concurrency = 12;
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < cardUrls.length) {
      const i = cursor++;
      const url = cardUrls[i];
      try {
        const html = await fetchText(url);
        const card = parseCardPage(html, url);
        if (card.nome) cardsOut.push(card);
      } catch (error) {
        console.warn(`Falhou em ${url}: ${error.message}`);
      } finally {
        done++;
        if (done % 100 === 0 || done === cardUrls.length) {
          console.log(`Progresso: ${done}/${cardUrls.length}`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  await mkdir(resolve(OUTPUT_PATH, ".."), { recursive: true });
  const unique = Object.values(
    cardsOut.reduce((acc, card) => {
      acc[card.id] = card;
      return acc;
    }, {})
  );
  await writeFile(OUTPUT_PATH, `${JSON.stringify(unique, null, 2)}\n`, "utf8");
  console.log(`Finalizado. ${unique.length} cartas salvas em ${OUTPUT_PATH}`);

  try {
    const expansionsRaw = await readFile(EXPANSIONS_PATH, "utf8");
    const payload = JSON.parse(expansionsRaw.replace(/^\uFEFF/, ""));
    const expansions = Array.isArray(payload) ? payload : payload?.expansions || [];
    const codeByExpansion = new Map();
    for (const entry of expansions) {
      const code = String(entry.code || "").trim();
      const name = String(entry.name || "").trim();
      if (code && name) codeByExpansion.set(normalizeKey(name), code);
    }

    try {
      const setsRaw = await readFile(FLIBUSTIER_SETS_PATH, "utf8");
      const setsPayload = JSON.parse(setsRaw.replace(/^\uFEFF/, ""));
      const setEntries = Object.values(setsPayload || {}).flat().filter(Boolean);
      for (const entry of setEntries) {
        const code = String(entry.code || "").trim();
        const names = entry?.name && typeof entry.name === "object" ? Object.values(entry.name) : [];
        for (const name of names) {
          const key = normalizeKey(name);
          if (code && key && !codeByExpansion.has(key)) codeByExpansion.set(key, code);
        }
      }
    } catch {
      // Continua apenas com nomes locais quando o cache do flibustier ainda nao existe.
    }

    const byCode = new Map();
    for (const card of unique) {
      const code = codeByExpansion.get(normalizeKey(card.expansao)) || inferSetCodeFromImageUrl(card.imageUrl);
      if (!code) continue;
      if (!byCode.has(code)) byCode.set(code, []);
      if (card.expansao === "{setName}") {
        const expansionEntry = expansions.find((entry) => String(entry.code || "").trim().toUpperCase() === code);
        if (expansionEntry?.name) card.expansao = String(expansionEntry.name).trim();
      }
      byCode.get(code).push(card);
    }

    const rawFiles = [];
    for (const [code, items] of byCode.entries()) {
      const series = seriesFromCode(code);
      const codeFile = String(code).toLowerCase();
      const dir = resolve(RAW_SITE_ROOT, series);
      await mkdir(dir, { recursive: true });
      const outPath = resolve(dir, `${codeFile}.json`);
      await writeFile(outPath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
      rawFiles.push({
        code,
        series,
        path: `./data/raw/pokemongohub/${series}/${codeFile}.json`,
        count: items.length
      });
    }

    rawFiles.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    await mkdir(RAW_SITE_ROOT, { recursive: true });
    await writeFile(
      resolve(RAW_SITE_ROOT, "index.json"),
      `${JSON.stringify({ site: "pokemongohub", files: rawFiles }, null, 2)}\n`,
      "utf8"
    );
    console.log(`Raw por coleção atualizado em ${RAW_SITE_ROOT}`);
  } catch (error) {
    console.warn(`Aviso ao gerar raw por coleção: ${error.message}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
