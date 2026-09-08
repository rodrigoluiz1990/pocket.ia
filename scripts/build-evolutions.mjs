import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SPECIES_URL = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv";
const CARDS_PATH = resolve(process.cwd(), "data", "complete", "all", "cards-complete.json");
const MIN_CARDS_PATH = resolve(process.cwd(), "data", "raw", "flibustier", "cards.min.json");
const OUT_PATH = resolve(process.cwd(), "data", "evolutions.json");

const fossilRoots = new Map([
  ["helixfossil", "omanyte"],
  ["domefossil", "kabuto"],
  ["oldamber", "aerodactyl"],
  ["skullfossil", "cranidos"],
  ["armorfossil", "shieldon"],
  ["plumefossil", "archen"],
  ["coverfossil", "tirtouga"],
  ["jawfossil", "tyrunt"],
  ["sailfossil", "amaura"],
  ["clawfossil", "anorith"],
  ["rootfossil", "lileep"]
]);
const fossilRootSpecies = new Set(fossilRoots.values());
const babyRootSpecies = new Set([
  "pichu", "cleffa", "igglybuff", "togepi", "tyrogue", "smoochum", "elekid", "magby",
  "azurill", "wynaut", "budew", "chingling", "bonsly", "mime-jr", "happiny", "munchlax",
  "riolu", "mantyke", "toxel"
]);

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function canonicalLocalName(value) {
  return String(value || "")
    .replace(/^Mega\s+/i, "")
    .replace(/\s+ex$/i, "")
    .trim();
}

function parseSpeciesCsv(csv) {
  const lines = String(csv || "").trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  const idIndex = headers.indexOf("id");
  const identifierIndex = headers.indexOf("identifier");
  const parentIndex = headers.indexOf("evolves_from_species_id");
  return lines.map((line) => {
    const columns = line.split(",");
    return {
      id: Number(columns[idIndex]),
      identifier: columns[identifierIndex],
      parentId: Number(columns[parentIndex]) || 0
    };
  });
}

function describePokemonName(value, speciesByCompact) {
  let name = String(value || "").replace(/[’‘]/g, "'").trim();
  let namespace = "standard";

  if (/^Team Rocket'?s\s+/i.test(name)) {
    namespace = "team-rocket";
    name = name.replace(/^Team Rocket'?s\s+/i, "");
  }

  const regionMatch = name.match(/^(Alolan|Galarian|Hisuian|Paldean)\s*/i);
  if (regionMatch) {
    namespace = regionMatch[1].toLowerCase();
    name = name.slice(regionMatch[0].length);
  }

  const isMega = /^Mega\s+/i.test(name);
  name = name.replace(/^Mega\s+/i, "").replace(/\s+ex$/i, "").trim();
  if (isMega) name = name.replace(/\s+[XY]$/i, "");

  const compact = normalizeKey(name);
  const special = compact === "nidoran" && /♀/.test(name)
    ? "nidoran-f"
    : compact === "nidoran" && /♂/.test(name)
      ? "nidoran-m"
      : "";
  const species = special || speciesByCompact.get(compact) || "";
  return { namespace, species };
}

function findRoot(species, parentBySpecies) {
  let current = species;
  const visited = new Set();
  while (current && parentBySpecies.get(current) && !visited.has(current)) {
    visited.add(current);
    current = parentBySpecies.get(current);
  }
  return current;
}

function evolutionDepth(species, parentBySpecies) {
  let current = species;
  let depth = 0;
  const visited = new Set();
  while (current && parentBySpecies.get(current) && !visited.has(current)) {
    visited.add(current);
    current = parentBySpecies.get(current);
    depth++;
  }
  return depth;
}

function cardStageForSpecies(species, root, parentBySpecies) {
  const depth = evolutionDepth(species, parentBySpecies);
  const stageDepth = fossilRootSpecies.has(root)
    ? depth + 1
    : babyRootSpecies.has(root)
      ? Math.max(0, depth - 1)
      : depth;
  return stageDepth >= 2 ? "2" : stageDepth === 1 ? "1" : "basic";
}

async function run() {
  const [cardsRaw, minCardsRaw, speciesResponse] = await Promise.all([
    readFile(CARDS_PATH, "utf8"),
    readFile(MIN_CARDS_PATH, "utf8"),
    fetch(SPECIES_URL)
  ]);
  if (!speciesResponse.ok) throw new Error(`Falha ao carregar espécies: HTTP ${speciesResponse.status}`);

  const cards = JSON.parse(cardsRaw.replace(/^\uFEFF/, ""));
  const minCards = JSON.parse(minCardsRaw.replace(/^\uFEFF/, ""));
  const speciesRows = parseSpeciesCsv(await speciesResponse.text());
  const speciesById = new Map(speciesRows.map((row) => [row.id, row.identifier]));
  const parentBySpecies = new Map(
    speciesRows.filter((row) => row.parentId).map((row) => [row.identifier, speciesById.get(row.parentId)])
  );
  const speciesByCompact = new Map(speciesRows.map((row) => [normalizeKey(row.identifier), row.identifier]));
  const minByKey = new Map(
    minCards.map((card) => [`${String(card.set || "").toUpperCase()}#${Number(card.number)}`, card])
  );
  const families = new Map();
  const cardStages = new Map();

  function familyFor(id) {
    if (!families.has(id)) families.set(id, { id, pokemon: new Map(), fossils: new Set() });
    return families.get(id);
  }

  for (const card of cards) {
    const minCard = minByKey.get(card?.sourceMeta?.matchKey);
    if (!minCard) continue;

    if (card.categoria === "Pokemon") {
      const descriptor = describePokemonName(minCard.name, speciesByCompact);
      if (!descriptor.species) continue;
      const root = findRoot(descriptor.species, parentBySpecies);
      cardStages.set(card.sourceMeta.matchKey, cardStageForSpecies(descriptor.species, root, parentBySpecies));
      const family = familyFor(`${descriptor.namespace}:${root}`);
      const localName = canonicalLocalName(card.nome);
      const depth = evolutionDepth(descriptor.species, parentBySpecies);
      family.pokemon.set(localName, Math.min(depth, family.pokemon.get(localName) ?? depth));
      continue;
    }

    if (card.tags?.includes("fossil")) {
      const root = fossilRoots.get(normalizeKey(minCard.name));
      if (root) familyFor(`standard:${root}`).fossils.add(String(card.nome || "").trim());
    }
  }

  const output = [...families.values()]
    .filter((family) => family.pokemon.size > 1 || family.fossils.size > 0)
    .map((family) => ({
      id: family.id,
      pokemon: [...family.pokemon.entries()]
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "pt-BR"))
        .map(([name]) => name),
      fossils: [...family.fossils].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const sortedCardStages = Object.fromEntries([...cardStages.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  await writeFile(
    OUT_PATH,
    `${JSON.stringify({ source: SPECIES_URL, cardStages: sortedCardStages, families: output }, null, 2)}\n`,
    "utf8"
  );
  console.log(`Famílias evolutivas geradas: ${output.length}`);
  console.log(`Famílias com Fóssil: ${output.filter((family) => family.fossils.length).length}`);
  console.log(`Saída: ${OUT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
