let cards = [];

async function loadMetaDecks() {
  const response = await fetch("./data/meta-decks.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Nao foi possivel carregar os decks meta.");
  const payload = await response.json();
  return Array.isArray(payload) ? payload : Array.isArray(payload?.decks) ? payload.decks : [];
}

function renderMetaDecks(decks) {
  const catalog = document.getElementById("metaDeckCatalog");
  const status = document.getElementById("metaDeckStatus");
  status.textContent = `${decks.length} deck${decks.length === 1 ? "" : "s"} de referência.`;
  catalog.innerHTML = "";
  if (!decks.length) {
    catalog.innerHTML = "<p>Nenhum deck meta cadastrado.</p>";
    return;
  }

  decks.forEach((deck) => {
    const ids = (deck.cartas || []).map((ref) => String(ref?.id || ref || ""));
    const deckCards = ids.map((id) => cards.find((card) => String(card.id) === id)).filter(Boolean);
    const principalId = String(deck.principal?.id || ids[0] || "");
    const principal = cards.find((card) => String(card.id) === principalId) || deckCards[0];
    const preview = deckCards.slice(0, 5).map((card) => `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" />`).join("");
    const article = document.createElement("article");
    article.className = "saved-deck-card";
    article.innerHTML = `<div class="saved-deck-preview">${preview || (principal ? `<img src="${principal.imageLocal}" alt="${principal.nome}" />` : "")}</div><h3>${deck.nome || "Deck Meta"}</h3><p>${deckCards.length}/20 cartas</p><div class="workspace-actions"><a class="meta-open-link" href="./index.html?deck=${encodeURIComponent(ids.join(","))}">Abrir no construtor</a></div>`;
    catalog.appendChild(article);
  });
}

Promise.all([PocketiaWorkspace.loadCards(), loadMetaDecks()])
  .then(([loadedCards, decks]) => {
    cards = loadedCards;
    renderMetaDecks(decks);
  })
  .catch((error) => {
    document.getElementById("metaDeckStatus").textContent = error.message || "Nao foi possivel carregar os decks.";
  });
