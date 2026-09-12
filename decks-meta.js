let cards = [];
let metaDecks = [];
let openMetaDeckIndex = -1;

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

  decks.forEach((deck, index) => {
    const ids = (deck.cartas || []).map((ref) => String(ref?.id || ref || ""));
    const deckCards = ids.map((id) => cards.find((card) => String(card.id) === id)).filter(Boolean);
    const principalId = String(deck.principal?.id || ids[0] || "");
    const principal = cards.find((card) => String(card.id) === principalId) || deckCards[0];
    const preview = deckCards.slice(0, 5).map((card) => `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" />`).join("");
    const article = document.createElement("article");
    article.className = "saved-deck-card";
    article.innerHTML = `
      <button type="button" class="saved-deck-preview meta-deck-preview-button" data-meta-cards="${index}" aria-label="Ver cartas do deck ${deck.nome || "Deck Meta"}">${preview || (principal ? `<img src="${principal.imageLocal}" alt="${principal.nome}" />` : "")}</button>
      <h3>${deck.nome || "Deck Meta"}</h3>
      <p>${deckCards.length}/20 cartas</p>
      <div class="meta-deck-page-copy-actions">
        <button type="button" class="deck-qr-fab meta-deck-page-qr" data-meta-qr="${index}" aria-label="Abrir QR Code do deck" title="QR Code">
          <span class="deck-qr-fab-icon" aria-hidden="true"></span>
        </button>
        <a class="meta-deck-load-btn meta-deck-page-copy" href="./index.html?deck=${encodeURIComponent(ids.join(","))}">Copiar</a>
      </div>`;
    catalog.appendChild(article);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function closeMetaDeckCardsModal() {
  const modal = document.getElementById("metaDeckCardsModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
}

function openMetaDeckCardsModal(index) {
  const deck = metaDecks[index];
  if (!deck) return;
  openMetaDeckIndex = index;
  const groupedCards = new Map();

  for (const ref of deck.cartas || []) {
    const id = String(ref?.id || ref || "");
    const card = cards.find((item) => String(item.id) === id);
    if (!card) continue;
    const current = groupedCards.get(id) || { card, quantity: 0 };
    current.quantity += 1;
    groupedCards.set(id, current);
  }

  document.getElementById("metaDeckCardsModalTitle").textContent = deck.nome || `Deck ${index + 1}`;
  document.getElementById("metaDeckCardsModalGrid").innerHTML = [...groupedCards.values()].map(({ card, quantity }) => `
    <div class="meta-modal-slot">
      <div class="meta-modal-slot-thumb">
        ${quantity > 1 ? `<span class="meta-modal-qty">${quantity}x</span>` : ""}
        <img class="deck-thumb" src="${escapeHtml(card.imageLocal)}" alt="${escapeHtml(card.nome)}" loading="lazy" onerror="this.onerror=null; this.src='./assets/cards/pokemon_pocket_card_back.png'" />
      </div>
      <span class="meta-modal-slot-name">${escapeHtml(card.nome)}</span>
    </div>
  `).join("");

  const modal = document.getElementById("metaDeckCardsModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
  modal.querySelector("[data-meta-cards-close]")?.focus({ preventScroll: true });
}

function closeMetaQrModal() {
  const modal = document.getElementById("metaQrModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
}

function openMetaQrModal(index) {
  const deck = metaDecks[index];
  if (!deck) return;
  const deckCards = (deck.cartas || [])
    .map((ref) => cards.find((card) => String(card.id) === String(ref?.id || ref || "")))
    .filter(Boolean);

  try {
    const energies = PocketiaWorkspace.inferDeckEnergyCodes(deckCards);
    const payload = PocketiaWorkspace.encodeGameDeckPayload(deckCards, energies);
    document.getElementById("metaQrImage").src = PocketiaWorkspace.buildDeckQrDataUrl(payload);
    document.getElementById("metaQrModalTitle").textContent = `QR Code — ${deck.nome || `Deck ${index + 1}`}`;
  } catch (error) {
    alert(error.message || "Nao foi possivel gerar o QR Code deste deck meta.");
    return;
  }

  const modal = document.getElementById("metaQrModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
}

function copyMetaDeckToBuilder(index) {
  const deck = metaDecks[index];
  if (!deck) return;
  const ids = (deck.cartas || []).map((ref) => String(ref?.id || ref || "")).filter(Boolean);
  const deckCards = ids.map((id) => cards.find((card) => String(card.id) === id)).filter(Boolean);
  const energies = PocketiaWorkspace.inferDeckEnergyCodes(deckCards);
  const params = new URLSearchParams({ deck: ids.join(","), energy: energies.join(",") });
  window.location.href = `./index.html?${params.toString()}`;
}

document.getElementById("metaDeckCatalog").addEventListener("click", (event) => {
  const cardsButton = event.target.closest("[data-meta-cards]");
  if (cardsButton) {
    openMetaDeckCardsModal(Number(cardsButton.dataset.metaCards));
    return;
  }
  const button = event.target.closest("[data-meta-qr]");
  if (button) openMetaQrModal(Number(button.dataset.metaQr));
});

document.getElementById("metaDeckCardsModal").addEventListener("click", (event) => {
  if (event.target.closest("[data-meta-cards-close]")) closeMetaDeckCardsModal();
});

document.getElementById("metaDeckCardsQrBtn").addEventListener("click", () => {
  if (openMetaDeckIndex < 0) return;
  const index = openMetaDeckIndex;
  closeMetaDeckCardsModal();
  openMetaQrModal(index);
});

document.getElementById("metaDeckCardsCopyBtn").addEventListener("click", () => {
  if (openMetaDeckIndex >= 0) copyMetaDeckToBuilder(openMetaDeckIndex);
});

document.getElementById("metaQrModal").addEventListener("click", (event) => {
  if (event.target.closest("[data-meta-qr-close]")) closeMetaQrModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("metaDeckCardsModal").classList.contains("open")) closeMetaDeckCardsModal();
  if (event.key === "Escape" && document.getElementById("metaQrModal").classList.contains("open")) closeMetaQrModal();
});

Promise.all([PocketiaWorkspace.loadCards(), loadMetaDecks()])
  .then(([loadedCards, decks]) => {
    cards = loadedCards;
    metaDecks = decks;
    renderMetaDecks(decks);
  })
  .catch((error) => {
    document.getElementById("metaDeckStatus").textContent = error.message || "Nao foi possivel carregar os decks.";
  });
