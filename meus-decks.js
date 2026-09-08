let cards = [];

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
