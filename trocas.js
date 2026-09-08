let cards = [];
let tradeState;
let draftOfferIds = [];
let draftWantIds = [];
const tradeListLayouts = { available: "images", wanted: "images" };

function setComboStatus(message, kind = "") {
  const status = document.getElementById("comboStatus");
  status.textContent = message;
  status.className = `combo-status${kind ? ` ${kind}` : ""}`;
}

function cardById(id) {
  return cards.find((card) => String(card.id) === String(id));
}

function cardReference(card) {
  return `${card.nome} [${String(card.id).toUpperCase()}]`;
}

function comboImageFileName(name) {
  const base = String(name || "combo-de-troca")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("pt-BR");
  return `${base || "combo-de-troca"}.png`;
}

function grouped(ids) {
  return ids.reduce((map, id) => map.set(id, (map.get(id) || 0) + 1), new Map());
}

function saveState() {
  PocketiaWorkspace.saveTradeState(tradeState);
}

function removeDraftCard(side, id) {
  const draft = side === "offer" ? draftOfferIds : draftWantIds;
  const index = draft.indexOf(id);
  if (index === -1) return;
  draft.splice(index, 1);
  renderAll();
}

function renderTradeList(elementId, ids, kind) {
  const list = document.getElementById(elementId);
  list.innerHTML = "";
  const imageLayout = tradeListLayouts[kind] === "images";
  list.classList.toggle("trade-list-images", imageLayout);
  const entries = [...grouped(ids).entries()];
  if (!entries.length) {
    list.innerHTML = "<p>Nenhuma carta adicionada.</p>";
    return;
  }
  if (imageLayout) {
    ids.forEach((id) => {
      const card = cardById(id);
      if (!card) return;
      const cardButton = document.createElement("button");
      cardButton.type = "button";
      cardButton.className = "trade-image-card";
      cardButton.dataset.addDraft = kind;
      cardButton.dataset.cardId = id;
      cardButton.setAttribute("aria-label", `Adicionar ${cardReference(card)} na troca`);
      cardButton.title = `${cardReference(card)} — clique para adicionar à troca`;
      cardButton.innerHTML = `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.parentElement.remove()" />`;
      list.appendChild(cardButton);
    });
    return;
  }
  entries.forEach(([id, quantity]) => {
    const card = cardById(id);
    if (!card) return;
    const row = document.createElement("div");
    row.className = "trade-row";
    row.innerHTML = `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" /><strong>${cardReference(card)}</strong><div class="trade-row-actions"><span>x${quantity}</span><button type="button" data-add-draft="${kind}" data-card-id="${id}" aria-label="Adicionar ${cardReference(card)} na troca">+</button><button type="button" data-remove-${kind}="${id}" aria-label="Remover ${cardReference(card)}">&minus;</button></div>`;
    list.appendChild(row);
  });
}

function renderComboPicker(elementId, source, side) {
  const picker = document.getElementById(elementId);
  picker.innerHTML = "";
  [...grouped(source).entries()].forEach(([cardId, quantity]) => {
    const card = cardById(cardId);
    if (!card) return;
    const option = document.createElement("div");
    option.className = "combo-card-option";
    option.innerHTML = `<img src="${card.imageLocal}" alt="${cardReference(card)}" title="${cardReference(card)}" onerror="this.remove()" /><span>x${quantity}</span><button type="button" class="combo-card-remove" data-combo-remove="${side}" data-combo-card-id="${cardId}" aria-label="Remover ${cardReference(card)}">&times;</button>`;
    picker.appendChild(option);
  });
}

function renderCombos() {
  const list = document.getElementById("tradeCombos");
  list.innerHTML = "";
  if (!tradeState.combos.length) {
    list.innerHTML = "<p class=\"trade-combo-empty\">Nenhum combo salvo.</p>";
    return;
  }
  tradeState.combos.forEach((combo) => {
    const offer = combo.offerIds.map(cardById).filter(Boolean);
    const wanted = combo.wantedIds.map(cardById).filter(Boolean);
    const article = document.createElement("article");
    article.className = "trade-combo";
    article.innerHTML = `<h3>${combo.nome}</h3><p><strong>Ofereço:</strong> ${offer || "-"}</p><p><strong>Quero:</strong> ${wanted || "-"}</p><button type="button" class="danger-button" data-delete-combo="${combo.id}">Excluir</button>`;
    if (article.classList.contains("trade-combo")) {
      article.replaceChildren();
      const title = document.createElement("h3");
      title.textContent = combo.nome;
      const sides = document.createElement("div");
      sides.className = "trade-combo-sides";
      [["Ofereco", offer], ["Quero receber", wanted]].forEach(([label, cardsInSide]) => {
        const side = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = label;
        const images = document.createElement("span");
        cardsInSide.forEach((card) => {
          const image = document.createElement("img");
          image.src = card.imageLocal;
          image.alt = cardReference(card);
          image.title = cardReference(card);
          image.onerror = () => image.remove();
          images.appendChild(image);
        });
        side.append(heading, images);
        sides.appendChild(side);
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "danger-button";
      deleteButton.dataset.deleteCombo = combo.id;
      deleteButton.textContent = "Excluir";
      const actions = document.createElement("div");
      actions.className = "trade-combo-actions";
      const loadButton = document.createElement("button");
      loadButton.type = "button";
      loadButton.dataset.loadCombo = combo.id;
      loadButton.textContent = "Editar";
      const shareButton = document.createElement("button");
      shareButton.type = "button";
      shareButton.dataset.shareCombo = combo.id;
      shareButton.textContent = "Compartilhar";
      actions.append(loadButton, shareButton, deleteButton);
      article.append(title, sides, actions);
    }
    list.appendChild(article);
  });
}

function renderAll() {
  renderTradeList("availableTradeList", tradeState.available, "available");
  renderTradeList("wantedTradeList", tradeState.wanted, "wanted");
  renderComboPicker("comboOffer", draftOfferIds, "offer");
  renderComboPicker("comboWant", draftWantIds, "want");
  renderCombos();
  document.getElementById("shareComboBtn").disabled = !draftOfferIds.length || !draftWantIds.length;
}

function renderSearch() {
  const query = document.getElementById("tradeSearch").value.trim().toLocaleLowerCase("pt-BR");
  const results = document.getElementById("tradeSearchResults");
  results.innerHTML = "";
  if (!query) return;
  cards.filter((card) => card.nome.toLocaleLowerCase("pt-BR").includes(query) || String(card.id).toLocaleLowerCase("pt-BR").includes(query)).slice(0, 20).forEach((card) => {
    const row = document.createElement("article");
    row.className = "trade-search-card";
    row.innerHTML = `<img src="${card.imageLocal}" alt="${card.nome}" onerror="this.remove()" /><div class="trade-search-content"><div class="trade-search-info"><strong>${card.nome}</strong><div class="trade-search-meta"><small>${String(card.id).toUpperCase()}</small><span>${card.raridade || ""}</span></div></div><div class="trade-search-actions"><button type="button" data-add-available="${card.id}">+ Para troca</button><button type="button" data-add-wanted="${card.id}">+ Desejo</button></div></div>`;
    results.appendChild(row);
  });
}

document.getElementById("tradeSearch").addEventListener("input", renderSearch);
document.querySelectorAll("[data-trade-list-layout]").forEach((button) => {
  button.addEventListener("click", () => {
    const kind = button.dataset.tradeListKind;
    const layout = button.dataset.tradeListLayout;
    if (!tradeState || !tradeListLayouts[kind] || !["images", "list"].includes(layout)) return;
    tradeListLayouts[kind] = layout;
    document.querySelectorAll(`[data-trade-list-kind="${kind}"]`).forEach((option) => {
      const active = option.dataset.tradeListLayout === layout;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });
    renderTradeList(kind === "available" ? "availableTradeList" : "wantedTradeList", tradeState[kind], kind);
  });
});
document.getElementById("tradeSearchResults").addEventListener("click", (event) => {
  const available = event.target.closest("[data-add-available]")?.dataset.addAvailable;
  const wanted = event.target.closest("[data-add-wanted]")?.dataset.addWanted;
  if (available) tradeState.available.push(available);
  if (wanted) tradeState.wanted.push(wanted);
  if (available || wanted) { saveState(); renderAll(); }
});
document.getElementById("availableTradeList").addEventListener("click", (event) => {
  const add = event.target.closest("[data-add-draft]");
  if (add) {
    draftOfferIds.push(add.dataset.cardId);
    renderAll();
    return;
  }
  const id = event.target.closest("[data-remove-available]")?.dataset.removeAvailable;
  if (!id) return;
  tradeState.available.splice(tradeState.available.indexOf(id), 1);
  saveState(); renderAll();
});
document.getElementById("wantedTradeList").addEventListener("click", (event) => {
  const add = event.target.closest("[data-add-draft]");
  if (add) {
    draftWantIds.push(add.dataset.cardId);
    renderAll();
    return;
  }
  const id = event.target.closest("[data-remove-wanted]")?.dataset.removeWanted;
  if (!id) return;
  tradeState.wanted.splice(tradeState.wanted.indexOf(id), 1);
  saveState(); renderAll();
});
function handleComboPickerClick(event, side) {
  const remove = event.target.closest("[data-combo-remove]");
  if (remove) {
    removeDraftCard(side, remove.dataset.comboCardId);
  }
}
document.getElementById("comboOffer").addEventListener("click", (event) => {
  handleComboPickerClick(event, "offer");
});
document.getElementById("comboWant").addEventListener("click", (event) => {
  handleComboPickerClick(event, "want");
});
document.getElementById("saveComboBtn").addEventListener("click", () => {
  if (!tradeState) {
    setComboStatus("Aguarde o carregamento das cartas.", "error");
    return;
  }
  const offerIds = [...draftOfferIds];
  const wantedIds = [...draftWantIds];
  const nome = document.getElementById("comboName").value.trim();
  if (!nome || !offerIds.length || !wantedIds.length) {
    const missing = [!nome && "um nome", !offerIds.length && "uma carta em Ofereco", !wantedIds.length && "uma carta em Desejo"].filter(Boolean);
    setComboStatus(`Informe ${missing.join(", ")}.`, "error");
    return;
  }
  tradeState.combos.unshift({ id: PocketiaWorkspace.nextId("trade"), nome, offerIds, wantedIds });
  document.getElementById("comboName").value = "";
  saveState(); renderAll();
  setComboStatus("Combo salvo neste navegador.", "success");
});

function loadCardImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function createComboShareImage(offerIds, wantedIds) {
  const offer = offerIds.map(cardById).filter(Boolean);
  const wanted = wantedIds.map(cardById).filter(Boolean);
  const columns = 4;
  const cardWidth = 82;
  const cardHeight = 115;
  const gap = 8;
  const padding = 20;
  const headingHeight = 44;
  const sideWidth = (padding * 2) + (columns * cardWidth) + ((columns - 1) * gap);
  const rows = Math.max(Math.ceil(offer.length / columns), Math.ceil(wanted.length / columns));
  const canvas = document.createElement("canvas");
  canvas.width = (sideWidth * 2) + gap;
  canvas.height = headingHeight + (padding * 2) + (Math.max(rows, 1) * cardHeight) + (Math.max(rows - 1, 0) * gap);
  const context = canvas.getContext("2d");
  context.fillStyle = "#e8f0f8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3b536a";
  context.font = "700 20px sans-serif";
  context.fillText("Ofereco", padding, 29);
  context.fillText("Desejo", sideWidth + gap + padding, 29);

  async function drawCards(list, offsetX) {
    await Promise.all(list.map(async (card, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = offsetX + padding + (column * (cardWidth + gap));
      const y = headingHeight + padding + (row * (cardHeight + gap));
      try {
        const image = await loadCardImage(card.imageLocal);
        context.drawImage(image, x, y, cardWidth, cardHeight);
      } catch {
        context.fillStyle = "#cbd8e6";
        context.fillRect(x, y, cardWidth, cardHeight);
      }
    }));
  }

  await drawCards(offer, 0);
  await drawCards(wanted, sideWidth + gap);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function shareCombo(offerIds, wantedIds, name) {
  const blob = await createComboShareImage(offerIds, wantedIds);
  if (!blob) throw new Error("Nao foi possivel gerar a imagem do combo.");
  const filename = comboImageFileName(name);
  const file = new File([blob], filename, { type: "image/png" });
  const shareData = { title: name, text: name, files: [file] };
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobileDevice && navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setComboStatus("Imagem do combo baixada.", "success");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareCurrentCombo() {
  if (!draftOfferIds.length || !draftWantIds.length) {
    setComboStatus("Selecione ao menos uma carta em cada lado.", "error");
    return;
  }
  const name = document.getElementById("comboName").value.trim() || "combo-de-troca";
  await shareCombo([...draftOfferIds], [...draftWantIds], name);
}

document.getElementById("shareComboBtn").addEventListener("click", () => {
  shareCurrentCombo().catch(() => setComboStatus("Nao foi possivel compartilhar o combo.", "error"));
});
document.getElementById("tradeCombos").addEventListener("click", (event) => {
  const loadId = event.target.closest("[data-load-combo]")?.dataset.loadCombo;
  const shareId = event.target.closest("[data-share-combo]")?.dataset.shareCombo;
  const deleteId = event.target.closest("[data-delete-combo]")?.dataset.deleteCombo;
  const comboId = loadId || shareId || deleteId;
  const combo = tradeState.combos.find((item) => item.id === comboId);
  if (loadId && combo) {
    draftOfferIds = [...combo.offerIds];
    draftWantIds = [...combo.wantedIds];
    document.getElementById("comboName").value = combo.nome;
    renderAll();
    setComboStatus("Combo carregado para edicao.", "success");
    return;
  }
  if (shareId && combo) {
    shareCombo(combo.offerIds, combo.wantedIds, combo.nome).catch(() => setComboStatus("Nao foi possivel compartilhar o combo.", "error"));
    return;
  }
  if (deleteId) {
    tradeState.combos = tradeState.combos.filter((item) => item.id !== deleteId);
    saveState();
    renderAll();
  }
});

PocketiaWorkspace.loadCards().then((loadedCards) => {
  cards = loadedCards;
  tradeState = PocketiaWorkspace.getTradeState();
  renderAll();
  document.getElementById("saveComboBtn").disabled = false;
}).catch(() => {
  document.getElementById("tradeSearchResults").textContent = "Nao foi possivel carregar o catalogo.";
});
