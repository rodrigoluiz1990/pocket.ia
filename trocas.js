let cards = [];
let tradeState;

function cardById(id) {
  return cards.find((card) => String(card.id) === String(id));
}

function grouped(ids) {
  return ids.reduce((map, id) => map.set(id, (map.get(id) || 0) + 1), new Map());
}

function saveState() {
  PocketiaWorkspace.saveTradeState(tradeState);
}

function renderTradeList(elementId, ids, kind) {
  const list = document.getElementById(elementId);
  list.innerHTML = "";
  const entries = [...grouped(ids).entries()];
  if (!entries.length) {
    list.innerHTML = "<p>Nenhuma carta adicionada.</p>";
    return;
  }
  entries.forEach(([id, quantity]) => {
    const card = cardById(id);
    if (!card) return;
    const row = document.createElement("div");
    row.className = "trade-row";
    row.innerHTML = `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" /><strong>${card.nome}</strong><span>x${quantity}</span><button type="button" data-remove-${kind}="${id}" aria-label="Remover ${card.nome}">&minus;</button>`;
    list.appendChild(row);
  });
}

function fillComboSelect(id, source) {
  const select = document.getElementById(id);
  select.innerHTML = "";
  [...grouped(source).entries()].forEach(([cardId, quantity]) => {
    const card = cardById(cardId);
    if (!card) return;
    const option = document.createElement("option");
    option.value = cardId;
    option.textContent = `${card.nome} (x${quantity})`;
    select.appendChild(option);
  });
}

function renderCombos() {
  const list = document.getElementById("tradeCombos");
  list.innerHTML = "";
  tradeState.combos.forEach((combo) => {
    const offer = combo.offerIds.map(cardById).filter(Boolean).map((card) => card.nome).join(", ");
    const wanted = combo.wantedIds.map(cardById).filter(Boolean).map((card) => card.nome).join(", ");
    const article = document.createElement("article");
    article.className = "trade-combo";
    article.innerHTML = `<h3>${combo.nome}</h3><p><strong>Ofereço:</strong> ${offer || "-"}</p><p><strong>Quero:</strong> ${wanted || "-"}</p><button type="button" class="danger-button" data-delete-combo="${combo.id}">Excluir</button>`;
    list.appendChild(article);
  });
}

function renderAll() {
  renderTradeList("availableTradeList", tradeState.available, "available");
  renderTradeList("wantedTradeList", tradeState.wanted, "wanted");
  fillComboSelect("comboOffer", tradeState.available);
  fillComboSelect("comboWant", tradeState.wanted);
  renderCombos();
}

function renderSearch() {
  const query = document.getElementById("tradeSearch").value.trim().toLocaleLowerCase("pt-BR");
  const results = document.getElementById("tradeSearchResults");
  results.innerHTML = "";
  if (!query) return;
  cards.filter((card) => card.nome.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 18).forEach((card) => {
    const row = document.createElement("article");
    row.className = "trade-search-card";
    row.innerHTML = `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" /><strong>${card.nome}</strong><span>${card.raridade || ""}</span><div><button type="button" data-add-available="${card.id}">+ Disponível</button><button type="button" data-add-wanted="${card.id}">+ Desejo</button></div>`;
    results.appendChild(row);
  });
}

document.getElementById("tradeSearch").addEventListener("input", renderSearch);
document.getElementById("tradeSearchResults").addEventListener("click", (event) => {
  const available = event.target.closest("[data-add-available]")?.dataset.addAvailable;
  const wanted = event.target.closest("[data-add-wanted]")?.dataset.addWanted;
  if (available) tradeState.available.push(available);
  if (wanted) tradeState.wanted.push(wanted);
  if (available || wanted) { saveState(); renderAll(); }
});
document.getElementById("availableTradeList").addEventListener("click", (event) => {
  const id = event.target.closest("[data-remove-available]")?.dataset.removeAvailable;
  if (!id) return;
  tradeState.available.splice(tradeState.available.indexOf(id), 1);
  saveState(); renderAll();
});
document.getElementById("wantedTradeList").addEventListener("click", (event) => {
  const id = event.target.closest("[data-remove-wanted]")?.dataset.removeWanted;
  if (!id) return;
  tradeState.wanted.splice(tradeState.wanted.indexOf(id), 1);
  saveState(); renderAll();
});
document.getElementById("saveComboBtn").addEventListener("click", () => {
  const offerIds = [...document.getElementById("comboOffer").selectedOptions].map((option) => option.value);
  const wantedIds = [...document.getElementById("comboWant").selectedOptions].map((option) => option.value);
  const nome = document.getElementById("comboName").value.trim();
  if (!nome || !offerIds.length || !wantedIds.length) return;
  tradeState.combos.unshift({ id: PocketiaWorkspace.nextId("trade"), nome, offerIds, wantedIds });
  document.getElementById("comboName").value = "";
  saveState(); renderAll();
});
document.getElementById("tradeCombos").addEventListener("click", (event) => {
  const id = event.target.closest("[data-delete-combo]")?.dataset.deleteCombo;
  if (!id) return;
  tradeState.combos = tradeState.combos.filter((combo) => combo.id !== id);
  saveState(); renderAll();
});

PocketiaWorkspace.loadCards().then((loadedCards) => {
  cards = loadedCards;
  tradeState = PocketiaWorkspace.getTradeState();
  renderAll();
}).catch(() => {
  document.getElementById("tradeSearchResults").textContent = "Nao foi possivel carregar o catalogo.";
});
