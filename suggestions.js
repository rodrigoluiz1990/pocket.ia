(function registerSuggestionEngine() {
  function normalizeKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .toLowerCase()
      .trim();
  }

  function hasSharedValue(values, acceptedValues) {
    const accepted = new Set((acceptedValues || []).map(normalizeKey));
    return values.some((value) => accepted.has(normalizeKey(value)));
  }

  const specialPokemonTags = {
    ultracriatura: /buzzwole|pheromosa|xurkitree|celesteela|guzzlord|nihilego|kartana|blacephalon|poipole|naganadel|stakataka/,
    arceus: /(^|-)arceus(?:-|$)/,
    ancestral: /brute-bonnet|slither-wing|scream-tail|flutter-mane|great-tusk|sandy-shocks|roaring-moon|walking-wake|gouging-fire|raging-bolt/,
    futurista: /iron-moth|iron-bundle|iron-hands|iron-thorns|iron-valiant|iron-leaves|iron-boulder|iron-crown|iron-jugulis|iron-treads/,
    "equipe-rocket": /team-rocket/
  };

  function getPokemonTags(card) {
    const tags = [...(card?.tags || [])].map(normalizeKey);
    const sourceId = String(card?.sourceId || "").toLowerCase();

    for (const [tag, pattern] of Object.entries(specialPokemonTags)) {
      if (pattern.test(sourceId)) tags.push(tag);
    }

    return tags;
  }

  function hasCoinFlipAttack(card) {
    const attacks = Array.isArray(card?.ataqueLista)
      ? card.ataqueLista
      : Array.isArray(card?.ataque)
        ? card.ataque
        : [];

    return attacks.some((attack) =>
      /coin|moeda/.test(String(attack?.nomeataque || "") + " " + String(attack?.efeito || ""))
    );
  }

  function matchesRule(rule, deckCards) {
    const pokemon = deckCards.filter((card) => normalizeKey(card?.categoria) === "pokemon");
    const requiredTypes = rule?.when?.pokemonTypes || [];
    const requiredStages = rule?.when?.pokemonStages || [];
    const requiredTags = rule?.when?.pokemonTags || [];
    const requiredSubtypes = rule?.when?.deckSubtypes || [];
    const requiredSourceIdIncludes = String(rule?.when?.deckSourceIdIncludes || "").toLowerCase();
    const hpAtMost = Number(rule?.when?.pokemonHpAtMost);
    const retreatAtLeast = Number(rule?.when?.pokemonRetreatAtLeast);
    const requiresMega = rule?.when?.pokemonMega;
    const requiresCoinFlipAttack = rule?.when?.pokemonHasCoinFlipAttack;

    if (requiredTypes.length && !hasSharedValue(pokemon.map((card) => card.tipo), requiredTypes)) return false;
    if (requiredStages.length && !hasSharedValue(pokemon.map((card) => card.estagio), requiredStages)) return false;
    if (requiredTags.length && !hasSharedValue(pokemon.flatMap(getPokemonTags), requiredTags)) return false;
    if (requiredSubtypes.length && !hasSharedValue(deckCards.map((card) => card.subtipo), requiredSubtypes)) return false;
    if (requiredSourceIdIncludes && !deckCards.some((card) => String(card?.sourceId || "").toLowerCase().includes(requiredSourceIdIncludes))) return false;
    if (Number.isFinite(hpAtMost) && !pokemon.some((card) => Number(card.hp) <= hpAtMost)) return false;
    if (Number.isFinite(retreatAtLeast) && !pokemon.some((card) => Number(card.recuo) >= retreatAtLeast)) return false;
    if (requiresMega && !pokemon.some((card) => card.mega || getPokemonTags(card).includes("mega"))) return false;
    if (requiresCoinFlipAttack && !pokemon.some(hasCoinFlipAttack)) return false;

    return Boolean(
      requiredTypes.length || requiredStages.length || requiredTags.length || requiredSubtypes.length || requiredSourceIdIncludes ||
      Number.isFinite(hpAtMost) || Number.isFinite(retreatAtLeast) || requiresMega || requiresCoinFlipAttack
    );
  }

  function getRuleCards(rule, cards, cardsById) {
    const selectedCards = (rule.cardIds || []).map((cardId) => cardsById.get(String(cardId))).filter(Boolean);
    const sourceIdIncludes = String(rule?.suggest?.sourceIdIncludes || "").toLowerCase();

    if (sourceIdIncludes) {
      selectedCards.push(...cards.filter((card) => String(card?.sourceId || "").toLowerCase().includes(sourceIdIncludes)));
    }

    return selectedCards;
  }

  function getSuggestedCards(cards, deckCards, rules) {
    const cardsById = new Map(cards.map((card) => [String(card.id), card]));
    const deckNames = new Set(deckCards.map((card) => normalizeKey(card.nome)));
    const suggestions = new Map();

    for (const rule of rules || []) {
      if (!matchesRule(rule, deckCards)) continue;
      for (const card of getRuleCards(rule, cards, cardsById)) {
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
