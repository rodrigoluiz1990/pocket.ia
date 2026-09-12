let cards = [];
let openSavedDeckId = "";

function setBackupStatus(message, kind = "") {
  const status = document.getElementById("backupStatus");
  status.textContent = message;
  status.className = `workspace-status${kind ? ` ${kind}` : ""}`;
}

function exportBackup() {
  const backup = PocketiaWorkspace.createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pocketia-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setBackupStatus("Backup exportado com sucesso.", "success");
}

async function importBackup(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) throw new Error("O arquivo de backup excede o limite de 2 MB.");
  const backup = JSON.parse(await file.text());
  const confirmed = window.confirm("Importar este backup substituirá os dados atualmente salvos neste navegador. Deseja continuar?");
  if (!confirmed) return;
  PocketiaWorkspace.restoreBackup(backup);
  renderSavedDecks();
  setBackupStatus("Backup importado. As demais telas usarão os dados restaurados ao serem abertas novamente.", "success");
}

function cardById(id) {
  return cards.find((card) => String(card.id) === String(id));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function closeSavedDeckModal() {
  const modal = document.getElementById("savedDeckModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
}

function closeSavedDeckQrModal() {
  const modal = document.getElementById("savedDeckQrModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
}

function savedDeckById(deckId) {
  return PocketiaWorkspace.getSavedDecks().find((item) => String(item.id) === String(deckId));
}

function savedDeckUrl(deck) {
  const params = new URLSearchParams({
    deck: (deck.cartas || []).join(","),
    energy: (deck.energias || []).join(",")
  });
  return `./index.html?${params.toString()}`;
}

function copySavedDeckToBuilder(deckId) {
  const deck = savedDeckById(deckId);
  if (deck) window.location.href = savedDeckUrl(deck);
}

function openSavedDeckQrModal(deckId) {
  const deck = savedDeckById(deckId);
  if (!deck) return;
  const deckCards = (deck.cartas || []).map(cardById).filter(Boolean);

  try {
    const storedEnergies = (deck.energias || []).map(Number).filter((code) => code >= 1 && code <= 8);
    const energies = storedEnergies.length ? storedEnergies : PocketiaWorkspace.inferDeckEnergyCodes(deckCards);
    const payload = PocketiaWorkspace.encodeGameDeckPayload(deckCards, energies);
    document.getElementById("savedDeckQrImage").src = PocketiaWorkspace.buildDeckQrDataUrl(payload);
    document.getElementById("savedDeckQrModalTitle").textContent = `QR Code — ${deck.nome || "Deck salvo"}`;
  } catch (error) {
    alert(error.message || "Nao foi possivel gerar o QR Code deste deck.");
    return;
  }

  const modal = document.getElementById("savedDeckQrModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
}

function openSavedDeckModal(deckId) {
  const deck = savedDeckById(deckId);
  if (!deck) return;
  openSavedDeckId = String(deck.id);

  const groupedCards = new Map();
  for (const id of deck.cartas || []) {
    const card = cardById(id);
    if (!card) continue;
    const cardId = String(card.id);
    const current = groupedCards.get(cardId) || { card, quantity: 0 };
    current.quantity += 1;
    groupedCards.set(cardId, current);
  }

  document.getElementById("savedDeckModalTitle").textContent = deck.nome || "Deck salvo";
  document.getElementById("savedDeckModalGrid").innerHTML = [...groupedCards.values()].map(({ card, quantity }) => `
    <div class="meta-modal-slot">
      <div class="meta-modal-slot-thumb">
        ${quantity > 1 ? `<span class="meta-modal-qty">${quantity}x</span>` : ""}
        <img class="deck-thumb" src="${escapeHtml(card.imageLocal)}" alt="${escapeHtml(card.nome)}" loading="lazy" onerror="this.onerror=null; this.src='./assets/cards/pokemon_pocket_card_back.png'" />
      </div>
      <span class="meta-modal-slot-name">${escapeHtml(card.nome)}</span>
    </div>
  `).join("");

  const modal = document.getElementById("savedDeckModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
  modal.querySelector("[data-saved-deck-close]")?.focus({ preventScroll: true });
}

function renderSavedDecks() {
  const list = document.getElementById("savedDeckList");
  const status = document.getElementById("savedDeckStatus");
  const decks = PocketiaWorkspace.getSavedDecks();
  status.textContent = `${decks.length} deck${decks.length === 1 ? "" : "s"} salvo${decks.length === 1 ? "" : "s"} neste navegador.`;
  list.innerHTML = "";

  if (!decks.length) {
    list.innerHTML = "<p>Nenhum deck salvo neste navegador.</p>";
    return;
  }

  decks.forEach((deck) => {
    const deckCards = (deck.cartas || []).map(cardById).filter(Boolean);
    const preview = deckCards.slice(0, 5).map((card) => `<img src="${escapeHtml(card.imageLocal)}" alt="${escapeHtml(card.nome)}" onerror="this.remove()" />`).join("");
    const article = document.createElement("article");
    article.className = "saved-deck-card";
    article.innerHTML = `
      <button type="button" class="saved-deck-preview meta-deck-preview-button" data-open-deck="${escapeHtml(deck.id)}" aria-label="Ver cartas do deck ${escapeHtml(deck.nome || "Deck salvo")}">${preview}</button>
      <h3>${escapeHtml(deck.nome || "Deck salvo")}</h3>
      <p>${deckCards.length}/20 cartas</p>
      <div class="saved-deck-page-actions">
        <button type="button" class="deck-qr-fab" data-saved-qr="${escapeHtml(deck.id)}" aria-label="Abrir QR Code do deck" title="QR Code">
          <span class="deck-qr-fab-icon" aria-hidden="true"></span>
        </button>
        <div class="deck-action-stack">
          <button type="button" class="deck-action-btn" data-load-deck="${escapeHtml(deck.id)}">Copiar</button>
          <button type="button" class="deck-action-btn danger-button" data-delete-deck="${escapeHtml(deck.id)}">Excluir</button>
        </div>
      </div>`;
    list.appendChild(article);
  });
}

document.getElementById("savedDeckList").addEventListener("click", (event) => {
  const decks = PocketiaWorkspace.getSavedDecks();
  const openId = event.target.closest("[data-open-deck]")?.dataset.openDeck;
  const qrId = event.target.closest("[data-saved-qr]")?.dataset.savedQr;
  const loadId = event.target.closest("[data-load-deck]")?.dataset.loadDeck;
  const deleteId = event.target.closest("[data-delete-deck]")?.dataset.deleteDeck;
  if (openId) {
    openSavedDeckModal(openId);
    return;
  }
  if (qrId) {
    openSavedDeckQrModal(qrId);
    return;
  }
  if (loadId) {
    const deck = decks.find((item) => item.id === loadId);
    if (!deck) return;
    window.location.href = savedDeckUrl(deck);
  }
  if (deleteId) {
    PocketiaWorkspace.saveSavedDecks(decks.filter((deck) => deck.id !== deleteId));
    renderSavedDecks();
  }
});

document.getElementById("savedDeckModal").addEventListener("click", (event) => {
  if (event.target.closest("[data-saved-deck-close]")) closeSavedDeckModal();
});

document.getElementById("savedDeckModalQrBtn").addEventListener("click", () => {
  if (!openSavedDeckId) return;
  const deckId = openSavedDeckId;
  closeSavedDeckModal();
  openSavedDeckQrModal(deckId);
});

document.getElementById("savedDeckModalCopyBtn").addEventListener("click", () => {
  if (openSavedDeckId) copySavedDeckToBuilder(openSavedDeckId);
});

document.getElementById("savedDeckQrModal").addEventListener("click", (event) => {
  if (event.target.closest("[data-saved-deck-qr-close]")) closeSavedDeckQrModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("savedDeckModal").classList.contains("open")) {
    closeSavedDeckModal();
  }
  if (event.key === "Escape" && document.getElementById("savedDeckQrModal").classList.contains("open")) {
    closeSavedDeckQrModal();
  }
});

document.getElementById("exportBackupBtn").addEventListener("click", () => {
  try {
    exportBackup();
  } catch (error) {
    setBackupStatus(error.message || "Não foi possível exportar o backup.", "error");
  }
});

document.getElementById("importBackupBtn").addEventListener("click", () => {
  document.getElementById("backupFileInput").click();
});

document.getElementById("backupFileInput").addEventListener("change", (event) => {
  const input = event.currentTarget;
  importBackup(input.files?.[0])
    .catch((error) => setBackupStatus(error.message || "Não foi possível importar o backup.", "error"))
    .finally(() => { input.value = ""; });
});

PocketiaWorkspace.loadCards().then((loadedCards) => {
  cards = loadedCards;
  renderSavedDecks();
}).catch(() => {
  document.getElementById("savedDeckStatus").textContent = "Nao foi possivel carregar as cartas salvas.";
});
