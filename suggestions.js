(function registerSuggestionEngine() {
  function normalizeKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function hasSharedValue(values, acceptedValues) {
    const accepted = new Set((acceptedValues || []).map(normalizeKey));
    return values.some((value) => accepted.has(normalizeKey(value)));
  }

  function matchesRule(rule, deckCards) {
    const pokemon = deckCards.filter((card) => normalizeKey(card?.categoria) === "pokemon");
    const requiredTypes = rule?.when?.pokemonTypes || [];
    const requiredStages = rule?.when?.pokemonStages || [];

    if (requiredTypes.length && !hasSharedValue(pokemon.map((card) => card.tipo), requiredTypes)) return false;
    if (requiredStages.length && !hasSharedValue(pokemon.map((card) => card.estagio), requiredStages)) return false;
    return Boolean(requiredTypes.length || requiredStages.length);
  }

  function getSuggestedCards(cards, deckCards, rules) {
    const cardsById = new Map(cards.map((card) => [String(card.id), card]));
    const deckNames = new Set(deckCards.map((card) => normalizeKey(card.nome)));
    const suggestions = new Map();

    for (const rule of rules || []) {
      if (!matchesRule(rule, deckCards)) continue;
      for (const cardId of rule.cardIds || []) {
        const card = cardsById.get(String(cardId));
        if (!card || deckNames.has(normalizeKey(card.nome))) continue;
        const priority = Number(rule.priority) || 0;
        const existing = suggestions.get(String(card.id));
        if (!existing || priority > existing.priority) suggestions.set(String(card.id), { card, priority });
      }
    }

    return [...suggestions.values()]
      .sort((a, b) => b.priority - a.priority || String(a.card.nome).localeCompare(String(b.card.nome), "pt-BR"))
      .map((entry) => entry.card);
  }

  window.PocketiaSuggestions = { getSuggestedCards };
})();
