let cards = [];

function cardById(id) {
  return cards.find((card) => String(card.id) === String(id));
}

function renderSavedDecks() {
  const list = document.getElementById("savedDeckList");
  const status = document.getElementById("savedDeckStatus");
  const decks = PocketiaWorkspace.getSavedDecks();
  status.textContent = `${decks.length} deck${decks.length === 1 ? "" : "s"} salvo${decks.length === 1 ? "" : "s"} nesta sessao.`;
  list.innerHTML = "";

  if (!decks.length) {
    list.innerHTML = "<p>Nenhum deck salvo nesta sessao.</p>";
    return;
  }

  decks.forEach((deck) => {
    const deckCards = (deck.cartas || []).map(cardById).filter(Boolean);
    const preview = deckCards.slice(0, 5).map((card) => `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" />`).join("");
    const article = document.createElement("article");
    article.className = "saved-deck-card";
    article.innerHTML = `
      <div class="saved-deck-preview">${preview}</div>
      <h3>${deck.nome}</h3>
      <p>${deckCards.length}/20 cartas</p>
      <div class="workspace-actions">
        <button type="button" data-load-deck="${deck.id}">Carregar</button>
        <button type="button" class="danger-button" data-delete-deck="${deck.id}">Excluir</button>
      </div>`;
    list.appendChild(article);
  });
}

document.getElementById("savedDeckList").addEventListener("click", (event) => {
  const decks = PocketiaWorkspace.getSavedDecks();
  const loadId = event.target.closest("[data-load-deck]")?.dataset.loadDeck;
  const deleteId = event.target.closest("[data-delete-deck]")?.dataset.deleteDeck;
  if (loadId) {
    const deck = decks.find((item) => item.id === loadId);
    if (!deck) return;
    const params = new URLSearchParams({ deck: (deck.cartas || []).join(","), energy: (deck.energias || []).join(",") });
    window.location.href = `./index.html?${params.toString()}`;
  }
  if (deleteId) {
    PocketiaWorkspace.saveSavedDecks(decks.filter((deck) => deck.id !== deleteId));
    renderSavedDecks();
  }
});

PocketiaWorkspace.loadCards().then((loadedCards) => {
  cards = loadedCards;
  renderSavedDecks();
}).catch(() => {
  document.getElementById("savedDeckStatus").textContent = "Nao foi possivel carregar as cartas salvas.";
});
