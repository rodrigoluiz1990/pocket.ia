const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const cards = JSON.parse(fs.readFileSync("data/consolidated/cards-adapted.json", "utf8"));
const rules = JSON.parse(fs.readFileSync("data/suggestion-rules.json", "utf8")).rules;
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync("suggestions.js", "utf8"), context);
const engine = context.window.PocketiaSuggestions;

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

console.log("Regras de sugestão: aliases de tipo e estágio validados com sucesso.");
