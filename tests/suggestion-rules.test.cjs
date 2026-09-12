const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const cards = JSON.parse(fs.readFileSync("data/consolidated/cards-adapted.json", "utf8"));
const rules = JSON.parse(fs.readFileSync("data/suggestion-rules.json", "utf8")).rules;
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync("suggestions.js", "utf8"), context);
const engine = context.window.PocketiaSuggestions;
const suggestedRarities = new Set(["Comum", "Incomum", "Rara", "Duplamente Raro"]);

function assertOnlyAllowedRarities(suggestions, label) {
  assert.ok(
    suggestions.every((card) => card.promo || suggestedRarities.has(card.raridade)),
    `${label} deve conter somente cartas promocionais ou de 1 a 4 diamantes`
  );
}

function verifySuggestion(label, predicate, expectedCardId) {
  const deckCard = cards.find(predicate);
  assert.ok(deckCard, `carta de teste ausente para ${label}`);
  const suggestions = engine.getSuggestedCards(cards, [deckCard], rules, []);
  assert.ok(
    suggestions.some((card) => card.id === expectedCardId),
    `${label} deve sugerir ${expectedCardId}; carta usada: ${deckCard.id} (${deckCard.nome})`
  );
}

verifySuggestion("Água", (card) => card.categoria === "Pokemon" && card.tipo === "Água", "a4a-067");
verifySuggestion("Fogo", (card) => card.categoria === "Pokemon" && card.tipo === "Fogo", "b1-217");
verifySuggestion("Grama", (card) => card.categoria === "Pokemon" && card.tipo === "Grama", "a3-147");
verifySuggestion("Elétrico", (card) => card.categoria === "Pokemon" && card.tipo === "Elétrico", "b2a-086");
verifySuggestion("Psíquico", (card) => card.categoria === "Pokemon" && card.tipo === "Psíquico", "b2-149");
verifySuggestion("Lutador", (card) => card.categoria === "Pokemon" && card.tipo === "Lutador", "b3-154");
verifySuggestion("Noturno", (card) => card.categoria === "Pokemon" && card.tipo === "Noturno", "a4-154");
verifySuggestion("Metálico", (card) => card.categoria === "Pokemon" && card.tipo === "Metálico", "b2-148");
verifySuggestion("Dragão", (card) => card.categoria === "Pokemon" && card.tipo === "Dragão", "b4-155");
verifySuggestion("Básico", (card) => card.categoria === "Pokemon" && card.estagio === "basic", "promo-a-005");
verifySuggestion("Estágio 1", (card) => card.categoria === "Pokemon" && card.estagio === "1", "b3b-065");
verifySuggestion("Estágio 2", (card) => card.categoria === "Pokemon" && card.estagio === "2", "b2a-087");

const coinAttackPokemon = cards.find((card) =>
  card.categoria === "Pokemon"
  && (card.ataqueLista || []).some((attack) => /coin|moeda/i.test(`${attack.nomeataque || ""} ${attack.efeito || ""}`))
);
assert.ok(coinAttackPokemon, "deve existir um Pokémon com ataque que usa moeda");
const coinSuggestions = engine.getSuggestedCards(cards, [coinAttackPokemon], rules, []);
assertOnlyAllowedRarities(coinSuggestions, "sugestões para ataques com moeda");
assert.ok(
  coinSuggestions.some((card) => card.id === "a4-156" && card.nome === "Will"),
  `${coinAttackPokemon.nome} deve sugerir Will`
);

const rocketPokemon = cards.find((card) =>
  card.categoria === "Pokemon" && String(card.sourceId || "").includes("team-rocket")
);
assert.ok(rocketPokemon, "deve existir um Pokémon da Equipe Rocket");
const rocketSuggestions = engine.getSuggestedCards(cards, [rocketPokemon], rules, []);
assertOnlyAllowedRarities(rocketSuggestions, "sugestões da Equipe Rocket");
const rocketRuleSuggestions = rocketSuggestions.filter((card) =>
  String(card.sourceId || "").includes("team-rocket")
);
assert.ok(rocketRuleSuggestions.length > 0, `${rocketPokemon.nome} deve sugerir treinadores da Equipe Rocket`);
assert.ok(
  rocketRuleSuggestions.every((card) => card.categoria === "Treinador"),
  "a regra da Equipe Rocket deve sugerir apenas cartas de treinador"
);

const nonDiamondPromo = cards.find((card) => card.promo && !suggestedRarities.has(card.raridade));
assert.ok(nonDiamondPromo, "deve existir uma carta promocional fora das raridades de diamante");
const promoSuggestions = engine.getSuggestedCards(cards, [coinAttackPokemon], [{
  id: "promo-rarity-test",
  when: { pokemonHasCoinFlipAttack: true },
  cardIds: [nonDiamondPromo.id]
}], []);
assert.ok(
  promoSuggestions.some((card) => card.id === nonDiamondPromo.id),
  `a carta promocional ${nonDiamondPromo.id} deve ser aceita nas sugestões`
);

console.log("Regras de sugestão: tipos, estágios, moeda e Equipe Rocket validados com sucesso.");
