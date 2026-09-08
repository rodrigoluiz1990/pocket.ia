const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const cards = JSON.parse(fs.readFileSync("data/consolidated/cards-adapted.json", "utf8"));
const families = JSON.parse(fs.readFileSync("data/evolutions.json", "utf8")).families;
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync("suggestions.js", "utf8"), context);
const engine = context.window.PocketiaSuggestions;

function cardByName(name) {
  const card = cards.find((item) => item.nome === name);
  assert.ok(card, `carta de teste ausente: ${name}`);
  return card;
}

function suggestionsFor(name) {
  return engine.getSuggestedCards(cards, [cardByName(name)], [], families);
}

function suggestionsForDeck(deckCards) {
  return engine.getSuggestedCards(cards, deckCards, [], families);
}

const bulbasaur = cardByName("Bulbasaur");
const bulbasaurSuggestions = suggestionsFor("Bulbasaur");
assert.ok(bulbasaurSuggestions.some((card) => card.nome === "Ivysaur"));
assert.ok(bulbasaurSuggestions.some((card) => /^Venusaur(?: ex)?$/.test(card.nome)));
assert.ok(bulbasaurSuggestions.some((card) => card.id === bulbasaur.id), "a segunda cópia deve continuar sugerida");
const fullBulbasaurSuggestions = suggestionsForDeck([bulbasaur, bulbasaur]);
assert.ok(!fullBulbasaurSuggestions.some((card) => card.id === bulbasaur.id), "a carta deve sair ao atingir duas cópias");
assert.ok(fullBulbasaurSuggestions.some((card) => card.nome === "Bulbasaur"), "outras versões devem permanecer");

const pikachuSuggestions = suggestionsFor("Pikachu");
assert.ok(pikachuSuggestions.filter((card) => /^Pikachu(?: ex)?$/.test(card.nome)).length > 2);
assert.ok(pikachuSuggestions.filter((card) => /^Raichu(?: ex)?$/.test(card.nome)).length > 2);

const omastarSuggestions = suggestionsFor("Omastar");
assert.ok(omastarSuggestions.some((card) => card.nome === "Omanyte"));
assert.ok(omastarSuggestions.some((card) => card.nome === "Fóssil Espiral"));

const fossilSuggestions = suggestionsFor("Fóssil Espiral");
assert.ok(fossilSuggestions.some((card) => card.nome === "Omanyte"));
assert.ok(fossilSuggestions.some((card) => card.nome === "Omastar"));

const rocketSuggestions = suggestionsFor("Houndour da Equipe Rocket");
assert.ok(rocketSuggestions.some((card) => card.nome === "Houndoom da Equipe Rocket"));
assert.ok(!rocketSuggestions.some((card) => card.nome === "Houndoom"));

const fossilFamilies = families.filter((family) => family.fossils.length > 0);
assert.equal(fossilFamilies.length, 11);
for (const family of fossilFamilies) {
  const fossilName = family.fossils[0];
  const pokemonName = family.pokemon[0];
  assert.ok(
    suggestionsFor(pokemonName).some((card) => card.nome === fossilName),
    `${fossilName} deve ser sugerido para ${pokemonName}`
  );
  assert.ok(
    suggestionsFor(fossilName).some((card) => family.pokemon.includes(card.nome.replace(/\s+ex$/i, ""))),
    `${pokemonName} deve ser sugerido para ${fossilName}`
  );
}
console.log(`Sugestões evolutivas: testes concluídos com sucesso (${families.length} famílias).`);
