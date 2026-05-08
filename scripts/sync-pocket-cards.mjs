import { mkdir, writeFile } from "node:fs/promises";
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
  argValue("--out", "data/incoming/cards-synced.json")
);

function abs(url) {
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}

function findAll(html, regex) {
  const out = [];
  let match;
  while ((match = regex.exec(html)) !== null) out.push(match[1]);
  return [...new Set(out)];
}

function clean(text) {
  return fixEncoding(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function fixEncoding(text) {
  return text
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã‰/g, "É")
    .replace(/Ã‡/g, "Ç");
}

function findField(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`${esc}\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/[^>]+>`, "i");
  const m = html.match(rx);
  return m ? clean(m[1]) : "";
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

  const cardUrls = [...cardUrlSet];
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
    cardsOut.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {})
  );
  await writeFile(OUTPUT_PATH, JSON.stringify(unique, null, 2), "utf8");
  console.log(`Finalizado. ${unique.length} cartas salvas em ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
