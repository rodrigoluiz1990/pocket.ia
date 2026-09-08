let cards = [];
const deck = [];
const maxDeck = 20;
const maxCopies = 2;
let renderToken = 0;
const DECK_QUERY_PARAM = "deck";
let metaDecks = [];
const favorites = new Set();
const deckEnergySelection = new Set();
let tradeState = { available: [], wanted: [], combos: [] };
const FALLBACK_IMAGE_SRC = "./assets/cards/pokemon_pocket_card_back.png";

let expansionOrder = [];
let normalizedExpansionOrder = [];
let expansionToSetCode = {};
let setSortIndex = {};
let expansionToSetCodeNormalized = {};


let defaultRarityOrder = [];

let stageOrder = [];

let tipoDisplayOrder = [];

let suggestionRules = [];
let evolutionFamilies = [];

const el = {
  cardsGrid: document.getElementById("cardsGrid"),
  deckList: document.getElementById("deckList"),
  deckCount: document.getElementById("deckCount"),
  deckEnergyOptions: document.getElementById("deckEnergyOptions"),
  deckQrBtn: document.getElementById("deckQrBtn"),
  saveDeckBtn: document.getElementById("saveDeckBtn"),
  clearDeckBtn: document.getElementById("clearDeckBtn"),
  deckQrModal: document.getElementById("deckQrModal"),
  deckQrModalTitle: document.getElementById("deckQrModalTitle"),
  deckQrImage: document.getElementById("deckQrImage"),
  deckQrNote: document.getElementById("deckQrNote"),
  deckQrShareBtn: document.getElementById("deckQrShareBtn"),
  deckCardModal: document.getElementById("deckCardModal"),
  deckCardModalTitle: document.getElementById("deckCardModalTitle"),
  deckCardModalImage: document.getElementById("deckCardModalImage"),
  simResults: document.getElementById("simResults"),
  loadStatus: document.getElementById("loadStatus"),
  suggestionsList: document.getElementById("suggestionsList"),
  mostUsedList: document.getElementById("mostUsedList"),
  metaDecksList: document.getElementById("metaDecksList"),
  metaDeckModal: document.getElementById("metaDeckModal"),
  metaDeckModalTitle: document.getElementById("metaDeckModalTitle"),
  metaDeckModalGrid: document.getElementById("metaDeckModalGrid"),
  metaDeckModalLoadBtn: document.getElementById("metaDeckModalLoadBtn"),
  metaDeckModalQrBtn: document.getElementById("metaDeckModalQrBtn"),

  searchInput: document.getElementById("searchInput"),
  tipoFilter: document.getElementById("tipoFilter"),
  elementoFilter: document.getElementById("elementoFilter"),
  raridadeFilter: document.getElementById("raridadeFilter"),
  estagioFilter: document.getElementById("estagioFilter"),
  tagFilter: document.getElementById("tagFilter"),
  expansaoFilter: document.getElementById("expansaoFilter"),
  fraquezaFilter: document.getElementById("fraquezaFilter"),
  attackEnergyFilter: document.getElementById("attackEnergyFilter"),
  habilidadeFilter: document.getElementById("habilidadeFilter"),
  recuoFilter: document.getElementById("recuoFilter"),
  recuoMinLabel: document.getElementById("recuoMinLabel"),
  recuoMaxLabel: document.getElementById("recuoMaxLabel"),
  vidaSlider: document.getElementById("vidaSlider"),
  vidaMinLabel: document.getElementById("vidaMinLabel"),
  vidaMaxLabel: document.getElementById("vidaMaxLabel"),
  ataqueSlider: document.getElementById("ataqueSlider"),
  ataqueMinLabel: document.getElementById("ataqueMinLabel"),
  ataqueMaxLabel: document.getElementById("ataqueMaxLabel"),
  custoAtaqueSlider: document.getElementById("custoAtaqueSlider"),
  custoAtaqueMinLabel: document.getElementById("custoAtaqueMinLabel"),
  custoAtaqueMaxLabel: document.getElementById("custoAtaqueMaxLabel"),
  formatoFilter: document.getElementById("formatoFilter"),
  sortField: document.getElementById("sortField"),
  sortDir: document.getElementById("sortDir"),
  cardLayoutControls: document.getElementById("cardLayoutControls"),
  favoriteOnlyToggle: document.getElementById("favoriteOnlyToggle"),
  availableOnlyToggle: document.getElementById("availableOnlyToggle"),
  wantedOnlyToggle: document.getElementById("wantedOnlyToggle"),

  simCount: document.getElementById("simCount"),
  aiProfile: document.getElementById("aiProfile"),
  runSimBtn: document.getElementById("runSimBtn")
};


function canInit() {
  const required = [
    "cardsGrid","deckList","deckCount","deckEnergyOptions","deckQrBtn","saveDeckBtn","clearDeckBtn","deckQrModal","deckQrModalTitle","deckQrImage","deckQrNote","deckQrShareBtn","deckCardModal","deckCardModalTitle","deckCardModalImage","simResults","loadStatus","searchInput","tipoFilter","elementoFilter",
    "raridadeFilter","estagioFilter","tagFilter","expansaoFilter","fraquezaFilter","habilidadeFilter",
    "recuoFilter","recuoMinLabel","recuoMaxLabel","vidaSlider","ataqueSlider","vidaMinLabel","vidaMaxLabel","ataqueMinLabel","ataqueMaxLabel","custoAtaqueSlider","custoAtaqueMinLabel","custoAtaqueMaxLabel","formatoFilter","sortField","sortDir","cardLayoutControls",
    "favoriteOnlyToggle","availableOnlyToggle","wantedOnlyToggle","attackEnergyFilter","mostUsedList","metaDecksList",
    "metaDeckModal","metaDeckModalTitle","metaDeckModalGrid","metaDeckModalLoadBtn","metaDeckModalQrBtn",
    "simCount","aiProfile","runSimBtn"
  ];
  return required.every((k) => el[k]);
}

function safeNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeSetCode(value) {
  return String(value || "").trim().toUpperCase();
}

const specialCardTagPatterns = {
  arceus: /(^|-)arceus(?:-|$)/,
  futurista: /iron-moth|iron-bundle|iron-hands|iron-thorns|iron-valiant|iron-leaves|iron-boulder|iron-crown|iron-jugulis|iron-treads/,
  ancestral: /brute-bonnet|slither-wing|scream-tail|flutter-mane|great-tusk|sandy-shocks|roaring-moon|walking-wake|gouging-fire|raging-bolt/,
  equiperocket: /team-rocket/
};

const specialCardTagLabels = {
  arceus: "Arceus",
  futurista: "Futurista",
  ancestral: "Ancestral",
  equiperocket: "Equipe Rocket"
};

// Identificadores funcionais das oito cartas com Link Ability de Arceus.
// Reimpressoes preservam o mesmo deckBuilderNr e tambem devem receber a tag.
const arceusLinkDeckBuilderNumbers = new Set([433, 437, 445, 450, 459, 465, 474, 479]);

function normalizeTagKey(value) {
  return normalizeKey(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function inferSpecialCardTags(card) {
  const source = String(card?.sourceId || "").toLowerCase();
  const name = normalizeTagKey(card?.nome);
  const interactionText = JSON.stringify({
    ataques: card?.ataqueLista || card?.ataque || [],
    habilidade: card?.habilidadeTexto || card?.habilidadeDescricao || card?.ability || card?.abilities || ""
  }).toLowerCase();
  const tags = Object.entries(specialCardTagPatterns)
    .filter(([, pattern]) => pattern.test(source))
    .map(([tag]) => tag);

  if (
    arceusLinkDeckBuilderNumbers.has(safeNumber(card?.deckBuilderNr, 0)) ||
    /arceus/i.test(interactionText)
  ) {
    tags.push("arceus");
  }
  if (name.includes("equiperocket")) tags.push("equiperocket");

  return [...new Set(tags)];
}

function getSpecialCardTagLabels(card) {
  return Object.entries(specialCardTagLabels)
    .filter(([tag]) => card?.tags?.includes(tag))
    .map(([, label]) => label);
}

function assetCodeFromSetCode(code) {
  const normalized = normalizeSetCode(code);
  if (normalized === "PROMO-A") return "pa";
  if (normalized === "PROMO-B") return "pb";
  return normalized.toLowerCase();
}

function configureExpansions(expansions) {
  expansionOrder = expansions.map((e) => String(e.name || "").trim()).filter(Boolean);
  normalizedExpansionOrder = expansionOrder.map((name) => normalizeKey(name));
  expansionToSetCode = {};
  setSortIndex = {};

  expansions.forEach((entry, index) => {
    const name = String(entry.name || "").trim();
    const code = normalizeSetCode(entry.code);
    if (!name || !code) return;
    expansionToSetCode[name] = code;
    setSortIndex[code] = index;
  });

  expansionToSetCodeNormalized = Object.fromEntries(
    Object.entries(expansionToSetCode).map(([k, v]) => [normalizeKey(k), v])
  );
}

function parseCardNumber(numero) {
  const m = String(numero || "").match(/(\d+)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function canonicalExpansionName(expansao) {
  return String(expansao || "").trim();
}

function extractSetCodeFromExpansion(expansao) {
  const text = String(expansao || "").trim();
  if (!text) return "";
  const match = text.match(/\(([A-Z0-9-]+)\)\s*$/i);
  if (match) return normalizeSetCode(match[1]);
  return normalizeSetCode(text);
}

function normalizeCardImagePath(card) {
  const current = String(card?.imageLocal || "").trim();
  if (!current) return "";

  const normalized = current.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || "";
  if (!fileName) return current;

  const promoMatch = fileName.match(/^p-([ab])-(\d+\.[a-z0-9]+)$/i);
  const normalizedFileName = promoMatch ? `p${promoMatch[1].toLowerCase()}-${promoMatch[2]}` : fileName.toLowerCase();
  const setCode =
    extractSetCodeFromExpansion(card?.expansao) ||
    (() => {
      const idMatch = String(card?.id || "").trim().match(/^([a-z]\d[a-z]?|p-[ab])-/i);
      return idMatch ? idMatch[1] : "";
    })();
  const assetCode = assetCodeFromSetCode(setCode);
  if (!assetCode) return `./assets/cards/${normalizedFileName}`;

  return `./assets/cards/cartas_${assetCode}/${normalizedFileName}`;
}



function selectedValues(selectEl) {
  if (!selectEl) return new Set();
  return new Set([...selectEl.selectedOptions].map((opt) => opt.value).filter(Boolean));
}

function normalizeEnergyType(value) {
  return normalizeKey(value)
    .replace(/^lightning$/, "raio")
    .replace(/^electrico$|^eletrico$/, "raio")
    .replace(/^grass$|^grama$/, "planta")
    .replace(/^fighting$|^lutador$/, "luta")
    .replace(/^dark$|^noturno$/, "escuridao")
    .replace(/^steel$|^metalico$/, "metal")
    .replace(/^psychic$/, "psiquico")
    .replace(/^water$/, "agua")
    .replace(/^fire$/, "fogo")
    .replace(/^dragon$/, "dragao")
    .replace(/^colorless$|^colourless$/, "incolor");
}

function cardHasAttackType(card, selectedAttackTypes) {
  if (!selectedAttackTypes.size) return true;
  const ataques = Array.isArray(card.ataqueLista) ? card.ataqueLista : [];
  for (const atk of ataques) {
    const custos = Array.isArray(atk?.custoataque) ? atk.custoataque : [];
    for (const custo of custos) {
      if (selectedAttackTypes.has(normalizeEnergyType(custo))) return true;
    }
  }
  return false;
}

function attackDamage(atk) {
  const values = String(atk?.dano || "").match(/\d+/g);
  return values?.length ? Math.max(...values.map(Number)) : 0;
}

function attackDamageLabel(atk) {
  const raw = String(atk?.dano || "").trim();
  if (!raw) return String(attackDamage(atk));
  return raw
    .replace(/\u00d7/g, "x")
    .replace(/\u00c3\u2014/g, "x");
}

function attackCost(atk) {
  return Array.isArray(atk?.custoataque) ? atk.custoataque.length : 0;
}

function cardAttacks(card) {
  const attacks = Array.isArray(card?.ataqueLista) ? card.ataqueLista : [];
  if (attacks.length) return attacks;
  return [{ dano: card?.ataque, custoataque: Array(safeNumber(card?.custoAtaque, 0)) }];
}

function cardHasAttackInRange(card, damageMin, damageMax, costMin, costMax) {
  return cardAttacks(card).some((atk) => {
    const damage = attackDamage(atk);
    const cost = attackCost(atk);
    return damage >= damageMin && damage <= damageMax && cost >= costMin && cost <= costMax;
  });
}

function findCardByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return cards.find((c) => String(c.nome || "").trim().toLowerCase() === n) || null;
}

function metaIdCandidates(value) {
  const id = String(value || "").trim();
  if (!id) return [];

  const candidates = [id];
  const promoShortMatch = id.match(/^p-([ab])-(\d+)$/i);
  if (promoShortMatch) {
    candidates.push(`promo-${promoShortMatch[1].toLowerCase()}-${promoShortMatch[2]}`);
  }

  const promoFullMatch = id.match(/^promo-([ab])-(\d+)$/i);
  if (promoFullMatch) {
    candidates.push(`p-${promoFullMatch[1].toLowerCase()}-${promoFullMatch[2]}`);
  }

  return [...new Set(candidates)];
}

/**
 * Resolve uma carta de meta-decks.json: string (nome), id unico, ou objeto com criterios.
 * Objeto aceito: { id }, { nome, expansao?, raridade?, numero? } — use o mesmo texto de `expansao`/`raridade`/`numero` da base.
 */
function findCardByMetaRef(ref) {
  if (ref == null) return null;
  if (typeof ref === "string") {
    return findCardByName(ref);
  }
  if (typeof ref === "object" && !Array.isArray(ref)) {
    const idRaw = ref.id;
    if (idRaw != null && String(idRaw).trim() !== "") {
      for (const candidateId of metaIdCandidates(idRaw)) {
        const card = cards.find((c) => String(c.id) === candidateId);
        if (card) return card;
      }
      return null;
    }
    const nome = String(ref.nome || ref.name || "").trim();
    if (!nome) return null;
    const nKey = nome.toLowerCase();
    let candidates = cards.filter((c) => String(c.nome || "").trim().toLowerCase() === nKey);
    const expWanted = ref.expansao != null ? String(ref.expansao).trim() : "";
    if (expWanted) {
      const next = candidates.filter((c) => String(c.expansao || "").trim() === expWanted);
      if (next.length) candidates = next;
    }
    const rarWanted = ref.raridade != null ? String(ref.raridade).trim() : "";
    if (rarWanted) {
      const next = candidates.filter((c) => String(c.raridade || "").trim() === rarWanted);
      if (next.length) candidates = next;
    }
    const numWanted = ref.numero != null ? String(ref.numero).trim() : "";
    if (numWanted) {
      const next = candidates.filter((c) => String(c.numero || "").trim() === numWanted);
      if (next.length) candidates = next;
    }
    if (candidates.length) return candidates[0];
    return null;
  }
  return null;
}

function metaRefLabel(ref) {
  if (ref == null) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && !Array.isArray(ref)) {
    if (ref.id != null && String(ref.id).trim() !== "") return String(ref.id).trim();
    const nome = String(ref.nome || ref.name || "").trim();
    if (!nome) return "";
    const bits = [nome];
    if (ref.expansao) bits.push(String(ref.expansao).trim());
    if (ref.raridade) bits.push(String(ref.raridade).trim());
    return bits.join(" · ");
  }
  return String(ref);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let metaModalDeckIndex = -1;
let deckQrOpen = false;
let deckCardModalOpen = false;

function updateDeckActionButtons() {
  const validEnergyCount = deckEnergySelection.size >= 1 && deckEnergySelection.size <= 3;
  updateDeckEnergyOptions();
  if (el.deckQrBtn) {
    el.deckQrBtn.disabled = deck.length !== maxDeck;
    el.deckQrBtn.title = deck.length !== maxDeck
      ? "Complete 20 cartas para gerar o QR Code"
      : !validEnergyCount
        ? "Selecione de 1 a 3 energias do deck"
        : "QR Code para importar no jogo";
  }
  if (el.clearDeckBtn) el.clearDeckBtn.disabled = deck.length === 0;
  if (el.saveDeckBtn) el.saveDeckBtn.disabled = deck.length === 0;
}

function serializeDeckState() {
  return deck.map((id) => String(id)).join(",");
}

function updateDeckEnergyOptions() {
  if (!el.deckEnergyOptions) return;
  const reachedLimit = deckEnergySelection.size >= 3;
  el.deckEnergyOptions.querySelectorAll("input[data-deck-energy]").forEach((input) => {
    const code = Number(input.value);
    const selected = deckEnergySelection.has(code);
    input.checked = selected;
    input.disabled = reachedLimit && !selected;
  });
}

function deckEnergyCodes() {
  return [...deckEnergySelection];
}

function pushUint24(bytes, value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffff) {
    throw new Error("Uma carta do deck nao possui um identificador compativel com o jogo.");
  }
  bytes.push((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
}

function encodeGameDeckPayload(deckCards) {
  if (deckCards.length !== maxDeck) {
    throw new Error("O QR Code do jogo exige exatamente 20 cartas.");
  }

  const trainers = deckCards.filter((card) => normalizeKey(card.categoria) !== "pokemon");
  const pokemon = deckCards.filter((card) => normalizeKey(card.categoria) === "pokemon");
  const energy = deckEnergyCodes();

  if (energy.length === 0 || energy.length > 3) {
    throw new Error("Selecione de 1 a 3 energias do deck para gerar o QR Code.");
  }
  if (trainers.length > 255 || pokemon.length > 255) {
    throw new Error("O deck excede o limite do formato de compartilhamento.");
  }

  const bytes = [trainers.length];
  trainers.forEach((card) => {
    const deckBuilderNr = safeNumber(card.deckBuilderNr, 0);
    if (deckBuilderNr <= 0) throw new Error(`A carta ${card.nome} nao pode ser exportada para o jogo.`);
    pushUint24(bytes, deckBuilderNr * 10);
  });
  bytes.push(pokemon.length);
  pokemon.forEach((card) => {
    const deckBuilderNr = safeNumber(card.deckBuilderNr, 0);
    if (deckBuilderNr <= 0) throw new Error(`A carta ${card.nome} nao pode ser exportada para o jogo.`);
    pushUint24(bytes, deckBuilderNr * 10);
  });
  bytes.push(energy.length, ...energy);

  return btoa(String.fromCharCode(...bytes));
}

function buildGameDeckQrDataUrl(payload) {
  if (typeof qrcode !== "function") {
    throw new Error("O gerador de QR Code nao foi carregado.");
  }
  const qr = qrcode(0, "M");
  qr.addData(payload, "Byte");
  qr.make();
  return qr.createDataURL(8, 4);
}

function openDeckQrModal() {
  if (!el.deckQrModal || !el.deckQrImage || deck.length !== maxDeck) return;
  const deckCards = deck.map((id) => cards.find((card) => String(card.id) === String(id))).filter(Boolean);
  if (deckCards.length !== maxDeck) {
    alert("Nao foi possivel localizar todas as cartas do deck.");
    return;
  }

  try {
    const payload = encodeGameDeckPayload(deckCards);
    el.deckQrImage.src = buildGameDeckQrDataUrl(payload);
  } catch (error) {
    alert(error.message || "Nao foi possivel gerar o QR Code do jogo.");
    return;
  }

  deckQrOpen = true;
  el.deckQrModalTitle.textContent = "QR Code do Deck";
  if (el.deckQrNote) {
    el.deckQrNote.textContent = "No Pokemon TCG Pocket, toque em Montar Novo e depois em Escanear Codigo para importar este deck.";
  }
  el.deckQrModal.classList.add("open");
  el.deckQrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
}

function openMetaDeckQr(index) {
  const def = metaDecks[index];
  if (!def || !Array.isArray(def.cartas) || !window.PocketiaWorkspace) return;
  const deckCards = def.cartas.map(findCardByMetaRef).filter(Boolean);

  try {
    const energies = window.PocketiaWorkspace.inferDeckEnergyCodes(deckCards);
    const payload = window.PocketiaWorkspace.encodeGameDeckPayload(deckCards, energies);
    el.deckQrImage.src = window.PocketiaWorkspace.buildDeckQrDataUrl(payload);
    el.deckQrModalTitle.textContent = `QR Code — ${def.nome || `Deck ${index + 1}`}`;
    el.deckQrNote.textContent = "As energias foram identificadas automaticamente pelos custos de ataque do deck meta.";
  } catch (error) {
    alert(error.message || "Nao foi possivel gerar o QR Code deste deck meta.");
    return;
  }

  deckQrOpen = true;
  el.deckQrModal.classList.add("open");
  el.deckQrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
}

function closeDeckQrModal() {
  if (!el.deckQrModal) return;
  deckQrOpen = false;
  el.deckQrModal.classList.remove("open");
  el.deckQrModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
}

async function shareDeckQrCode() {
  const dataUrl = String(el.deckQrImage?.src || "");
  if (!dataUrl.startsWith("data:")) return;

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mimeType = blob.type || "image/png";
  const extension = mimeType.split("/")[1] || "png";
  const file = new File([blob], `pocketia-deck-qr.${extension}`, { type: mimeType });
  const shareData = {
    title: "QR Code do Deck",
    text: "QR Code para importar este deck no Pokemon TCG Pocket.",
    files: [file]
  };
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
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function openDeckCardModal(card) {
  if (!card || !el.deckCardModal || !el.deckCardModalImage || !el.deckCardModalTitle) return;
  deckCardModalOpen = true;
  el.deckCardModalTitle.textContent = String(card.nome || "Carta");
  el.deckCardModalImage.src = getCardImageSrc(card);
  el.deckCardModalImage.alt = String(card.nome || "Carta");
  el.deckCardModal.classList.add("open");
  el.deckCardModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
}

function closeDeckCardModal() {
  if (!el.deckCardModal) return;
  deckCardModalOpen = false;
  el.deckCardModal.classList.remove("open");
  el.deckCardModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
}

function clearDeck() {
  if (!deck.length) return;
  deck.length = 0;
  deckEnergySelection.clear();
  closeDeckQrModal();
  closeDeckCardModal();
  renderDeck();
}

function persistDeckDraft() {
  if (!window.PocketiaWorkspace) return;
  if (!deck.length) {
    window.PocketiaWorkspace.clearDeckDraft();
    return;
  }
  window.PocketiaWorkspace.saveDeckDraft(deck, deckEnergyCodes());
}

function saveCurrentDeck() {
  if (!deck.length || !window.PocketiaWorkspace) return;
  const suggestedName = `Meu Deck ${new Date().toLocaleDateString("pt-BR")}`;
  const nome = window.prompt("Nome do deck", suggestedName)?.trim();
  if (!nome) return;

  const savedDecks = window.PocketiaWorkspace.getSavedDecks();
  savedDecks.unshift({
    id: window.PocketiaWorkspace.nextId("deck"),
    nome: nome.slice(0, 60),
    cartas: [...deck],
    energias: deckEnergyCodes(),
    salvoEm: new Date().toISOString()
  });
  window.PocketiaWorkspace.saveSavedDecks(savedDecks);
  alert("Deck salvo neste navegador.");
}

function applyDeckState(ids, energyCodes = []) {
  const nextDeck = [];
  const copies = new Map();
  for (const rawId of Array.isArray(ids) ? ids.slice(0, maxDeck) : []) {
    const id = String(rawId || "").trim();
    if (!id) continue;
    const card = cards.find((entry) => String(entry.id) === id);
    if (!card) continue;
    const count = copies.get(id) || 0;
    if (count >= maxCopies) continue;
    copies.set(id, count + 1);
    nextDeck.push(id);
  }

  if (!nextDeck.length) return false;
  deck.length = 0;
  deck.push(...nextDeck);

  deckEnergySelection.clear();
  (Array.isArray(energyCodes) ? energyCodes : [])
    .map(Number)
    .filter((code) => code >= 1 && code <= 8)
    .slice(0, 3)
    .forEach((code) => deckEnergySelection.add(code));
  return true;
}

function loadDeckFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = String(params.get(DECK_QUERY_PARAM) || "").trim();
  if (!raw) return false;
  const ids = raw.split(",");
  const energyCodes = String(params.get("energy") || "").split(",");
  return applyDeckState(ids, energyCodes);
}

function loadDeckDraft() {
  if (!window.PocketiaWorkspace) return false;
  const draft = window.PocketiaWorkspace.getDeckDraft();
  return applyDeckState(draft.cards, draft.energies);
}

function getMetaDeckPrincipalCard(def) {
  if (!def) return null;
  let explicitRef = def.principal ?? def.capa ?? null;
  if (explicitRef == null && def.capaId != null && String(def.capaId).trim() !== "") {
    explicitRef = { id: String(def.capaId).trim() };
  }
  if (explicitRef != null) {
    const c = findCardByMetaRef(explicitRef);
    if (c) return c;
  }
  const list = Array.isArray(def.cartas) ? def.cartas : [];
  for (const ref of list) {
    const c = findCardByMetaRef(ref);
    if (c && normalizeKey(c.categoria) === "pokemon") return c;
  }
  for (const ref of list) {
    const c = findCardByMetaRef(ref);
    if (c) return c;
  }
  return null;
}

function renderMetaDeckModalGrid(index) {
  if (!el.metaDeckModalGrid) return;
  const def = metaDecks[index];
  if (!def || !Array.isArray(def.cartas)) {
    el.metaDeckModalGrid.innerHTML = "";
    return;
  }

  const orderKeys = [];
  const agg = new Map();

  for (const ref of def.cartas) {
    const card = findCardByMetaRef(ref);
    const label = metaRefLabel(ref);
    if (card) {
      const key = `id:${String(card.id)}`;
      if (!agg.has(key)) {
        agg.set(key, { kind: "card", card, count: 0 });
        orderKeys.push(key);
      }
      agg.get(key).count += 1;
    } else {
      const ukey = `miss:${label || ""}`;
      if (!agg.has(ukey)) {
        agg.set(ukey, { kind: "missing", label: label || "Carta desconhecida", count: 0 });
        orderKeys.push(ukey);
      }
      agg.get(ukey).count += 1;
    }
  }

  const parts = [];
  for (const key of orderKeys) {
    const row = agg.get(key);
    const qtyBadge =
      row.count > 1 ? `<span class="meta-modal-qty">${row.count}x</span>` : "";
    if (row.kind === "card") {
      const { card } = row;
      const imgSrc = getCardImageSrc(card);
      const nomeEsc = escapeHtml(card.nome);
      parts.push(`
        <div class="meta-modal-slot">
          <div class="meta-modal-slot-thumb">
            ${qtyBadge}
            <img class="deck-thumb" src="${imgSrc}" alt="${nomeEsc}" loading="lazy"
              onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}"
              onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
          </div>
          <span class="meta-modal-slot-name">${nomeEsc}</span>
        </div>`);
    } else {
      const labelEsc = escapeHtml(row.label);
      parts.push(`
        <div class="meta-modal-slot">
          <div class="meta-modal-slot-thumb meta-modal-slot-missing">
            ${qtyBadge}
            <span>?</span>
          </div>
          <span class="meta-modal-slot-name meta-modal-slot-unknown">${labelEsc}</span>
        </div>`);
    }
  }
  el.metaDeckModalGrid.innerHTML = parts.join("");
}

function openMetaDeckModal(index) {
  if (!el.metaDeckModal) return;
  if (!Number.isFinite(index) || index < 0 || index >= metaDecks.length) return;
  metaModalDeckIndex = index;
  const def = metaDecks[index];
  const title = def?.nome || `Deck ${index + 1}`;
  if (el.metaDeckModalTitle) el.metaDeckModalTitle.textContent = title;
  renderMetaDeckModalGrid(index);
  el.metaDeckModal.classList.add("open");
  el.metaDeckModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("meta-modal-open");
  queueMicrotask(() => el.metaDeckModalLoadBtn?.focus({ preventScroll: true }));
}

function closeMetaDeckModal() {
  if (!el.metaDeckModal) return;
  el.metaDeckModal.classList.remove("open");
  el.metaDeckModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("meta-modal-open");
  metaModalDeckIndex = -1;
}

function getMostUsedCards(limit = 20) {
  const counts = new Map();
  for (const deckDef of metaDecks) {
    const list = Array.isArray(deckDef?.cartas) ? deckDef.cartas : [];
    for (const ref of list) {
      const card = findCardByMetaRef(ref);
      if (!card) continue;
      const k = String(card.id);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, usos]) => ({ card: cards.find((c) => String(c.id) === String(id)), usos }))
    .filter((x) => x.card);
}

function renderMostUsedCards() {
  if (!el.mostUsedList) return;
  el.mostUsedList.innerHTML = "";
  const mostUsed = getMostUsedCards(20);
  if (!mostUsed.length) {
    el.mostUsedList.innerHTML = "<p>Nenhum dado de uso disponivel.</p>";
    return;
  }
  mostUsed.forEach(({ card }) => {
    const item = document.createElement("div");
    item.className = "deck-item";
    const imageSrc = getCardImageSrc(card);
    item.innerHTML = `
      <div class="deck-item-main" style="width:72px;aspect-ratio:63/88;">
        <img class="deck-thumb" src="${imageSrc}" alt="${card.nome}" title="${card.nome}" onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <button class="deck-preview" data-preview="${card.id}" title="Ampliar carta" aria-label="Ampliar ${card.nome}">
          <svg class="deck-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="M3 21v-6h6"/><path d="m3 21 7-7"/></svg>
        </button>
        <button class="deck-add" data-add="${card.id}" title="Adicionar ao deck" aria-label="Adicionar ${card.nome} ao deck">+</button>
      </div>
    `;
    el.mostUsedList.appendChild(item);
  });
}

function renderMetaDecks() {
  if (!el.metaDecksList) return;
  el.metaDecksList.innerHTML = "";
  if (!metaDecks.length) {
    el.metaDecksList.innerHTML = "<p>Nenhum deck de meta carregado.</p>";
    return;
  }
  metaDecks.slice(0, 10).forEach((d, i) => {
    const principal = getMetaDeckPrincipalCard(d);
    const title = d.nome || `Deck ${i + 1}`;
    const imageSrc = principal ? getCardImageSrc(principal) : FALLBACK_IMAGE_SRC;
    const article = document.createElement("article");
    article.className = "meta-deck-tile";
    article.setAttribute("role", "listitem");
    article.dataset.openMeta = String(i);
    article.tabIndex = 0;
    article.setAttribute("aria-label", `Abrir deck ${title}`);
    article.innerHTML = `
      <div class="meta-deck-tile-visual">
        <img class="meta-deck-tile-img deck-thumb" src="${imageSrc}" alt="" loading="lazy"
          onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}"
          onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
      </div>
      <h3 class="meta-deck-tile-name">${escapeHtml(title)}</h3>
      <div class="meta-deck-tile-actions">
        <button type="button" class="deck-qr-fab meta-deck-qr-btn" data-qr-meta="${i}" aria-label="Abrir QR Code do deck" title="QR Code">
          <span class="deck-qr-fab-icon" aria-hidden="true"></span>
        </button>
        <button type="button" class="meta-deck-load-btn" data-load-meta="${i}">Copiar</button>
      </div>
    `;
    el.metaDecksList.appendChild(article);
  });
}

function loadMetaDeckIntoDeck(index) {
  const def = metaDecks[index];
  if (!def || !Array.isArray(def.cartas)) return;
  deck.length = 0;
  const copyCounter = new Map();
  for (const ref of def.cartas) {
    const card = findCardByMetaRef(ref);
    if (!card) continue;
    const id = String(card.id);
    const copies = copyCounter.get(id) || 0;
    if (copies >= maxCopies || deck.length >= maxDeck) continue;
    copyCounter.set(id, copies + 1);
    deck.push(id);
  }
  renderDeck();
}
function expansionRank(expansao) {
  const canonical = canonicalExpansionName(expansao);
  const codeMatch = canonical.match(/\(([A-Za-z0-9-]+)\)\s*$/);
  const codeFromName = codeMatch ? normalizeSetCode(codeMatch[1]) : "";
  if (codeFromName && setSortIndex[codeFromName] !== undefined) return setSortIndex[codeFromName];
  const setCode = normalizeSetCode(expansionToSetCodeNormalized[normalizeKey(canonical)] || "");
  if (setCode && setSortIndex[setCode] !== undefined) return setSortIndex[setCode];
  const key = normalizeKey(canonical);
  const idx = normalizedExpansionOrder.indexOf(key);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function normalizeCard(card) {
  const ataques = Array.isArray(card.ataqueLista)
    ? card.ataqueLista
    : Array.isArray(card.ataque)
      ? card.ataque
      : [];
  const maxDano = ataques.reduce((acc, atk) => {
    const nums = String(atk?.dano || "").match(/\d+/g);
    const score = nums && nums.length ? Math.max(...nums.map(Number)) : 0;
    return Math.max(acc, score);
  }, 0);
  const maxCustoAtaque = ataques.reduce((acc, atk) => {
    const len = Array.isArray(atk?.custoataque) ? atk.custoataque.length : 0;
    return Math.max(acc, len);
  }, 0);
  const estagio = String(card.estagio || "").trim();
  const formato = String(card.formato || "noex").trim();
  const tags = new Set(
    (Array.isArray(card.tags) ? card.tags : [])
      .map(normalizeTagKey)
      .filter(Boolean)
  );
  inferSpecialCardTags(card).forEach((tag) => tags.add(tag));
  const estagioKey = normalizeKey(estagio);
  if (estagioKey) tags.add(estagioKey);
  if (estagioKey === "baby") tags.add("basic");
  const formatoKey = normalizeKey(formato);
  if (formatoKey === "mega" || formatoKey === "ex") tags.add(formatoKey);

  return {
    ...card,
    nome: String(card.nome || "").trim(),
    categoria: String(card.categoria || "").trim(),
    tipo: String(card.tipo || "").trim(),
    expansao: String(card.expansao || "").trim(),
    pacote: String(card.pacote || "").trim(),
    estagio,
    raridade: String(card.raridade || "").trim(),
    fraqueza: String(card.fraqueza || "").trim(),
    imageLocal: normalizeCardImagePath(card),
    hp: safeNumber(card.hp, 0),
    ataque: safeNumber(maxDano, safeNumber(card.ataque, 0)),
    custoAtaque: safeNumber(maxCustoAtaque, safeNumber(card.custoAtaque, 0)),
    custoDeck: safeNumber(card.custoDeck ?? card.custo, 0),
    recuo: safeNumber(card.recuo, 0),
    formato,
    tags: [...tags],
    habilidade: Boolean(card.habilidade ?? card.temHabilidade),
    promo: Boolean(card.promo ?? card.tagPromo),
    ataqueLista: ataques
  };
}

function hasValidImage(card) {
  const local = String(card?.imageLocal || "").trim();
  const remote = String(card?.imageUrl || "").trim();
  return Boolean(local || (remote && !isWallpaperImage(remote)));
}

function getPrimaryCardImage(card) {
  if (!card) return "";
  const local = String(card.imageLocal || "").trim();
  if (local) return local;
  const remote = String(card.imageUrl || "").trim();
  if (remote && !isWallpaperImage(remote)) return remote;
  return "";
}

function isWallpaperImage(src) {
  const normalized = String(src || "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes("/wallpapers/") || /_wallpaper\.(jpg|jpeg|png|webp)$/i.test(normalized);
}

function getCardImageSrc(card) {
  if (!card) return FALLBACK_IMAGE_SRC;
  const image = getPrimaryCardImage(card);
  if (image) return image;
  return FALLBACK_IMAGE_SRC;
}

function getCardImageSrcStrict(card) {
  return getPrimaryCardImage(card);
}

function getSuggestionImageSrc(card, suggestionName) {
  const strict = getCardImageSrcStrict(card);
  if (strict) return strict;

  const key = String(suggestionName || card?.nome || "").toLowerCase().trim();
  const explicitMap = {
    "rare candy": "./assets/cards/6keu5a2wm77khla-doce-raro.jpg",
    "professor's research": "./assets/cards/57l2tqtpwvp4mk9-pesquisa-de-professores.jpg"
  };
  if (explicitMap[key]) return explicitMap[key];

  return FALLBACK_IMAGE_SRC;
}

function uniqueValues(key, list = cards) {
  return [...new Set(list.map((c) => c[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function populateFilter(selectEl, values) {
  for (const item of values) {
    const value = typeof item === "object" ? String(item.value || "").trim() : String(item || "").trim();
    const label = typeof item === "object" ? String(item.label || value).trim() : value;
    if (!value) continue;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    selectEl.appendChild(option);
  }
}


function compareCards(a, b, sortField, sortDir) {
  const dirKey = String(sortDir || "asc").toLowerCase();
  const dir = dirKey === "desc" ? -1 : 1;
  const compareExpNumAsc = (x, y) => {
    const rankX = expansionRank(x.expansao);
    const rankY = expansionRank(y.expansao);
    const exp = rankX - rankY;
    if (exp !== 0) return exp;
    if (rankX === Number.MAX_SAFE_INTEGER && rankY === Number.MAX_SAFE_INTEGER) {
      const byName = String(x.expansao || "").localeCompare(String(y.expansao || ""), "pt-BR");
      if (byName !== 0) return byName;
    }
    const num = parseCardNumber(x.numero) - parseCardNumber(y.numero);
    if (num !== 0) return num;
    return String(x.nome).localeCompare(String(y.nome), "pt-BR");
  };

  if (sortField === "nome") return String(a.nome).localeCompare(String(b.nome), "pt-BR") * dir;
  if (sortField === "numero-exp") return (parseCardNumber(a.numero) - parseCardNumber(b.numero)) * dir;
  if (sortField === "tipo") {
    const typeA = normalizeEnergyType(a.tipo);
    const typeB = normalizeEnergyType(b.tipo);
    const indexA = tipoDisplayOrder.findIndex((type) => normalizeEnergyType(type) === typeA);
    const indexB = tipoDisplayOrder.findIndex((type) => normalizeEnergyType(type) === typeB);
    const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (rankA !== rankB) return (rankA - rankB) * dir;
    if (typeA !== typeB) return String(a.tipo).localeCompare(String(b.tipo), "pt-BR") * dir;
    return compareExpNumAsc(a, b) * dir;
  }
  if (sortField === "raridade") {
    const rarityA = a.promo || String(a.raridade || "").toLowerCase() === "promo" ? "Promo" : String(a.raridade || "").trim();
    const rarityB = b.promo || String(b.raridade || "").toLowerCase() === "promo" ? "Promo" : String(b.raridade || "").trim();
    const indexA = defaultRarityOrder.indexOf(rarityA);
    const indexB = defaultRarityOrder.indexOf(rarityB);
    const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (rankA !== rankB) return (rankA - rankB) * dir;
    if (rarityA !== rarityB) return rarityA.localeCompare(rarityB, "pt-BR") * dir;
    return compareExpNumAsc(a, b) * dir;
  }
  if (sortField === "hp") return (a.hp - b.hp) * dir || String(a.nome).localeCompare(String(b.nome), "pt-BR");
  if (sortField === "ataque") return (a.ataque - b.ataque) * dir || String(a.nome).localeCompare(String(b.nome), "pt-BR");
  if (sortField === "exp-num") {
    const base = compareExpNumAsc(a, b);
    return dir * base;
  }

  const rankA = expansionRank(a.expansao);
  const rankB = expansionRank(b.expansao);
  const exp = rankA - rankB;
  if (exp !== 0) return exp * dir;
  if (rankA === Number.MAX_SAFE_INTEGER && rankB === Number.MAX_SAFE_INTEGER) {
    const byName = String(a.expansao || "").localeCompare(String(b.expansao || ""), "pt-BR");
    if (byName !== 0) return byName * dir;
  }
  const num = parseCardNumber(a.numero) - parseCardNumber(b.numero);
  if (num !== 0) return num * dir;
  return String(a.nome).localeCompare(String(b.nome), "pt-BR") * dir;
}

function getFilteredCards() {
  const search = el.searchInput.value.trim().toLowerCase();
  const tipos = selectedValues(el.tipoFilter);
  const elementos = selectedValues(el.elementoFilter);
  const raridades = selectedValues(el.raridadeFilter);
  const favoriteOnly = Boolean(el.favoriteOnlyToggle.checked);
  const availableOnly = Boolean(el.availableOnlyToggle.checked);
  const wantedOnly = Boolean(el.wantedOnlyToggle.checked);
  const estagios = selectedValues(el.estagioFilter);
  const tags = new Set([...selectedValues(el.tagFilter)].map(normalizeTagKey));
  const expansoes = selectedValues(el.expansaoFilter);
  const fraquezas = selectedValues(el.fraquezaFilter);
  const attackTypes = new Set([...selectedValues(el.attackEnergyFilter)].map(normalizeEnergyType));
  const habilidade = el.habilidadeFilter.value;
  const recuoValues = el.recuoFilter?.noUiSlider ? el.recuoFilter.noUiSlider.get() : [0, 5];
  const recuoMin = safeNumber(Array.isArray(recuoValues) ? recuoValues[0] : 0, 0);
  const recuoMax = safeNumber(Array.isArray(recuoValues) ? recuoValues[1] : recuoValues, 5);
  const vidaValues = el.vidaSlider?.noUiSlider ? el.vidaSlider.noUiSlider.get() : [0, 250];
  const ataqueValues = el.ataqueSlider?.noUiSlider ? el.ataqueSlider.noUiSlider.get() : [0, 250];
  const vidaMin = safeNumber(vidaValues[0], 0);
  const vidaMax = safeNumber(vidaValues[1], 250);
  const ataqueMin = safeNumber(ataqueValues[0], 0);
  const ataqueMax = safeNumber(ataqueValues[1], 250);
  const custoAtaqueValues = el.custoAtaqueSlider?.noUiSlider ? el.custoAtaqueSlider.noUiSlider.get() : [0, 5];
  const custoAtaqueMin = safeNumber(Array.isArray(custoAtaqueValues) ? custoAtaqueValues[0] : 0, 0);
  const custoAtaqueMax = safeNumber(Array.isArray(custoAtaqueValues) ? custoAtaqueValues[1] : custoAtaqueValues, 5);
  const formatos = selectedValues(el.formatoFilter);
  const sortField = el.sortField.value;
  const sortDir = el.sortDir.value;

  return cards
    .filter((card) => {
      if (search && !String(card.nome).toLowerCase().includes(search)) return false;
      if (tipos.size && !tipos.has(card.categoria)) return false;
      if (elementos.size && !elementos.has(card.tipo)) return false;
      if (raridades.size) {
        const promoSelected = raridades.has("Promo");
        const normalSelected = [...raridades].filter((r) => r !== "Promo");
        const isPromo = card.promo || String(card.raridade || "").toLowerCase() === "promo";
        if (!(promoSelected && isPromo) && !normalSelected.includes(card.raridade)) return false;
      }
      if (favoriteOnly && !favorites.has(String(card.id))) return false;
      if (availableOnly && !isCardInTradeList("available", card.id)) return false;
      if (wantedOnly && !isCardInTradeList("wanted", card.id)) return false;
      if (estagios.size && ![card.estagio, ...card.tags].some((tag) => estagios.has(tag))) return false;
      if (tags.size && !card.tags.some((tag) => tags.has(normalizeTagKey(tag)))) return false;
      if (expansoes.size && !expansoes.has(card.expansao)) return false;
      if (fraquezas.size && !fraquezas.has(card.fraqueza)) return false;
      if (!cardHasAttackType(card, attackTypes)) return false;
      if (habilidade === "tem" && !card.habilidade) return false;
      if (habilidade === "nao-tem" && card.habilidade) return false;
      if (card.recuo < recuoMin || card.recuo > recuoMax) return false;
      if (card.hp < vidaMin || card.hp > vidaMax) return false;
      if (!cardHasAttackInRange(card, ataqueMin, ataqueMax, custoAtaqueMin, custoAtaqueMax)) return false;
      if (formatos.size && !formatos.has(card.formato)) return false;
      return true;
    })
    .sort((a, b) => compareCards(a, b, sortField, sortDir));
}

function getCopiesInDeck(cardId) {
  return deck.filter((id) => String(id) === String(cardId)).length;
}

function loadFavorites() {
  try {
    const parsed = window.PocketiaWorkspace?.getFavorites() || [];
    favorites.clear();
    parsed.forEach((id) => favorites.add(String(id)));
  } catch (error) {
    console.warn("Nao foi possivel carregar favoritos:", error);
  }
}

function saveFavorites() {
  try {
    window.PocketiaWorkspace?.saveFavorites([...favorites]);
  } catch (error) {
    console.warn("Nao foi possivel salvar favoritos:", error);
  }
}

function isFavorite(cardId) {
  return favorites.has(String(cardId));
}

function toggleFavorite(cardId) {
  const id = String(cardId);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
}

function loadTradeState() {
  if (window.PocketiaWorkspace) tradeState = window.PocketiaWorkspace.getTradeState();
}

function isCardInTradeList(kind, cardId) {
  const list = kind === "available" ? tradeState.available : tradeState.wanted;
  return list.some((id) => String(id) === String(cardId));
}

function toggleCardTradeStatus(kind, cardId) {
  if (!window.PocketiaWorkspace || !["available", "wanted"].includes(kind)) return false;
  const id = String(cardId);
  const list = kind === "available" ? tradeState.available : tradeState.wanted;
  const isActive = list.some((item) => String(item) === id);

  if (isActive) {
    const next = list.filter((item) => String(item) !== id);
    if (kind === "available") tradeState.available = next;
    else tradeState.wanted = next;
  } else {
    list.push(id);
  }

  window.PocketiaWorkspace.saveTradeState(tradeState);
  return !isActive;
}


function renderCards() {
  renderToken++;
  const thisRender = renderToken;
  const filtered = getFilteredCards();
  const selectedLayout = el.cardLayoutControls?.querySelector("[data-card-layout].active")?.dataset.cardLayout;
  const cardLayout = ["details-bottom", "image-only", "image-compact", "details-side"].includes(selectedLayout)
    ? selectedLayout
    : "details-bottom";
  const imageOnly = cardLayout === "image-only" || cardLayout === "image-compact";
  el.cardsGrid.className = `cards-grid cards-layout-${cardLayout}`;
  el.cardsGrid.innerHTML = "";
  el.loadStatus.textContent = `Mostrando 0 de ${filtered.length} cartas...`;

  if (!filtered.length) {
    el.cardsGrid.innerHTML = "<p>Nenhuma carta encontrada com esses filtros.</p>";
    el.loadStatus.textContent = "Nenhuma carta encontrada.";
    return;
  }

  let index = 0;
  const batchSize = 24;
  function appendNext() {
    if (thisRender !== renderToken) return;
    if (index >= filtered.length) {
      el.loadStatus.textContent = `Mostrando ${filtered.length} de ${filtered.length} cartas.`;
      return;
    }
    const fragment = document.createDocumentFragment();
    const end = Math.min(index + batchSize, filtered.length);
    for (; index < end; index++) {
      const card = filtered[index];
      const imageSrc = getCardImageSrc(card);
      const ataques = cardAttacks(card);
      const custos = ataques.map(attackCost);
      const danos = ataques.map(attackDamageLabel);
      const custoText = custos.join(" / ");
      const danoText = danos.join(" / ");
      const specialTags = getSpecialCardTagLabels(card);
      const tagsMarkup = specialTags.length
        ? `<li class="card-tags-row"><strong>Tags:</strong><span class="card-tag-list">${specialTags.map((tag) => `<span class="card-tag">${tag}</span>`).join("")}</span></li>`
        : "";
      const cardEl = document.createElement("article");
      const layoutClass = cardLayout === "image-compact"
        ? "image-only image-compact"
        : cardLayout === "image-only"
          ? "image-only"
          : cardLayout === "details-side"
            ? "details-side"
            : "";
      cardEl.className = `card card-clickable ${layoutClass}`.trim();
      cardEl.dataset.id = String(card.id);
      const fav = isFavorite(card.id);
      const isAvailable = isCardInTradeList("available", card.id);
      const isWanted = isCardInTradeList("wanted", card.id);
      cardEl.innerHTML = `
        <div class="card-actions">
          <button class="card-fav ${fav ? "active" : ""}" data-favorite="${card.id}" title="${fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}" aria-label="${fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
            <i class="fa-regular fa-star card-status-fa status-icon-off" aria-hidden="true"></i>
            <i class="fa-solid fa-star card-status-fa status-icon-on" aria-hidden="true"></i>
          </button>
          <button type="button" class="card-trade-button wanted ${isWanted ? "active" : ""}" data-trade-kind="wanted" data-trade-card="${card.id}" aria-pressed="${isWanted}" title="${isWanted ? "Remover das desejadas" : "Marcar como desejada"}" aria-label="${isWanted ? "Remover das desejadas" : "Marcar como desejada"}">
            <i class="fa-regular fa-heart card-status-fa status-icon-off" aria-hidden="true"></i>
            <i class="fa-solid fa-heart card-status-fa status-icon-on" aria-hidden="true"></i>
          </button>
          <button type="button" class="card-trade-button available ${isAvailable ? "active" : ""}" data-trade-kind="available" data-trade-card="${card.id}" aria-pressed="${isAvailable}" title="${isAvailable ? "Remover das cartas para troca" : "Marcar para troca"}" aria-label="${isAvailable ? "Remover das cartas para troca" : "Marcar para troca"}">
            <i class="fa-solid fa-rotate card-status-fa available-icon" aria-hidden="true"></i>
          </button>
          <button class="card-expand" data-preview="${card.id}" title="Ampliar carta" aria-label="Ampliar carta">
            <i class="fa-solid fa-expand card-status-fa expand-icon" aria-hidden="true"></i>
          </button>
        </div>
        <img loading="lazy" src="${imageSrc}" alt="${card.nome}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <ul class="card-info-list">
          <li><strong>Nome:</strong> ${card.nome}</li>
          <li><strong>Categoria:</strong> ${card.categoria || "-"}</li>
          <li><strong>Estagio:</strong> ${card.estagio}</li>
          <li><strong>Tipo:</strong> ${card.tipo || "-"}</li>
          <li><strong>Vida:</strong> ${card.hp}</li>
          <li><strong>Custo:</strong> ${custoText}</li>
          <li><strong>Dano:</strong> ${danoText}</li>
          <li><strong>Recuo:</strong> ${card.recuo}</li>
          <li><strong>Raridade:</strong> ${card.raridade || "-"}</li>
          <li><strong>Pacote:</strong> ${card.pacote || card.expansao}</li>
          <li class="card-code-row"><strong>Codigo:</strong> ${String(card.id).toUpperCase()}</li>
          ${tagsMarkup}
        </ul>
      `;
      fragment.appendChild(cardEl);
    }
    el.cardsGrid.appendChild(fragment);
    el.loadStatus.textContent = `Mostrando ${index} de ${filtered.length} cartas...`;
    setTimeout(appendNext, 0);
  }

  appendNext();
}

function deckStats() {
  const selected = deck.map((id) => cards.find((c) => String(c.id) === String(id))).filter(Boolean);
  const totals = selected.reduce(
    (acc, c) => {
      acc.poder += c.ataque || 0;
      acc.controle += c.habilidade ? 70 : 40;
      acc.consistencia += c.custoAtaque <= 2 ? 70 : 45;
      acc.custo += c.custoDeck || 0;
      return acc;
    },
    { poder: 0, controle: 0, consistencia: 0, custo: 0 }
  );
  const n = selected.length || 1;
  return {
    poder: totals.poder / n,
    controle: totals.controle / n,
    consistencia: totals.consistencia / n,
    custo: totals.custo / n
  };
}


function renderDeck() {
  el.deckList.innerHTML = "";
  el.deckCount.textContent = String(deck.length);
  persistDeckDraft();
  updateDeckActionButtons();
  if (!deck.length) {
    if (deckQrOpen) closeDeckQrModal();
    el.deckList.innerHTML = "<p>Seu deck esta vazio.</p>";
    el.suggestionsList.innerHTML = "<p>Adicione cartas ao deck para ver sugestoes.</p>";
    renderMostUsedCards();
    return;
  }

  const grouped = deck.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  Object.entries(grouped).forEach(([id, qty]) => {
    const card = cards.find((c) => String(c.id) === String(id));
    if (!card) return;
    const item = document.createElement("div");
    item.className = "deck-item";
    const imageSrc = getCardImageSrc(card);
    item.innerHTML = `
      <div class="deck-item-main" style="width:72px;aspect-ratio:63/88;">
        <span class="deck-qty">x${qty}</span>
        <img class="deck-thumb" src="${imageSrc}" alt="${card.nome}" title="${card.nome}" onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <button class="deck-preview" data-preview="${card.id}" title="Ampliar carta" aria-label="Ampliar ${card.nome}">
          <svg class="deck-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="M3 21v-6h6"/><path d="m3 21 7-7"/></svg>
        </button>
        <div class="deck-controls">
          <button class="deck-add" data-add="${card.id}" title="Adicionar uma copia">+</button>
          <button class="deck-remove" data-remove="${card.id}" title="Remover uma copia">-</button>
        </div>
      </div>
    `;
    el.deckList.appendChild(item);
  });

  renderSuggestions();
  renderMostUsedCards();
}

function renderSuggestions() {
  el.suggestionsList.innerHTML = "";

  const deckCards = deck.map(id => cards.find(c => String(c.id) === String(id))).filter(Boolean);
  const suggestions = window.PocketiaSuggestions?.getSuggestedCards(cards, deckCards, suggestionRules, evolutionFamilies) || [];

  if (suggestions.length === 0) {
    el.suggestionsList.innerHTML = "<p>Nenhuma sugestao disponivel.</p>";
    return;
  }

  suggestions.forEach(card => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    const imageSrc = getSuggestionImageSrc(card, card.nome);
    item.innerHTML = `
      <div class="deck-item-main suggestion-item-main" style="width:72px;aspect-ratio:63/88;">
        <img class="deck-thumb suggestion-thumb" src="${imageSrc}" alt="${card.nome}" title="${card.nome}" onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <button class="deck-preview" data-preview="${card.id}" title="Ampliar carta" aria-label="Ampliar ${card.nome}">
          <svg class="deck-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="M3 21v-6h6"/><path d="m3 21 7-7"/></svg>
        </button>
        <button class="deck-add" data-add="${card.id}" title="Adicionar ao deck" aria-label="Adicionar ${card.nome} ao deck">+</button>
      </div>
    `;
    el.suggestionsList.appendChild(item);
  });
}

function addCard(id) {
  if (deck.length >= maxDeck) return alert("Deck cheio (20 cartas).");
  if (getCopiesInDeck(id) >= maxCopies) return alert("Maximo de 2 copias por carta.");
  deck.push(String(id));
  renderDeck();
}

function removeCard(id) {
  const index = deck.findIndex((x) => String(x) === String(id));
  if (index !== -1) {
    deck.splice(index, 1);
    renderDeck();
  }
}

function opponentProfile(profile) {
  if (profile === "agressivo") return { poder: 78, controle: 22, consistencia: 58 };
  if (profile === "controle") return { poder: 58, controle: 70, consistencia: 66 };
  return { poder: 68, controle: 48, consistencia: 62 };
}

function simulateGames(total, profile) {
  const s = deckStats();
  const opp = opponentProfile(profile);
  let wins = 0;
  let totalTurns = 0;
  let totalDamage = 0;
  for (let i = 0; i < total; i++) {
    const variance = (Math.random() - 0.5) * 18;
    const playerScore = s.poder * 0.52 + s.controle * 0.2 + s.consistencia * 0.28 + variance;
    const oppScore = opp.poder * 0.52 + opp.controle * 0.2 + opp.consistencia * 0.28 + (Math.random() - 0.5) * 18;
    if (playerScore >= oppScore) wins++;
    totalTurns += Math.max(5, Math.round(18 - (s.poder + opp.poder) / 18 + Math.random() * 4));
    totalDamage += Math.max(40, Math.round(s.poder * 1.2 + Math.random() * 35));
  }
  return { total, wins, winRate: (wins / total) * 100, avgTurns: totalTurns / total, avgDamage: totalDamage / total };
}

function recommendation(winRate) {
  if (winRate < 45) return "Troque cartas de custo alto por opcoes de setup rapido e compra.";
  if (winRate < 58) return "Deck promissor: ajuste 2 a 3 slots para aumentar consistencia.";
  return "Deck forte no meta simulado. Vale testar contra perfis diferentes.";
}

function renderSimulation() {
  if (deck.length < 10) return alert("Adicione pelo menos 10 cartas para simular.");
  const total = Math.min(2000, Math.max(10, safeNumber(el.simCount.value, 200)));
  const result = simulateGames(total, el.aiProfile.value);
  el.simResults.innerHTML = `
    <h3>Resultado da IA</h3>
    <p>Partidas: ${result.total}</p>
    <p>Vitorias: ${result.wins}</p>
    <p>Winrate: <strong class="${result.winRate >= 50 ? "good" : "bad"}">${result.winRate.toFixed(1)}%</strong></p>
    <p>Dano medio por jogo: ${result.avgDamage.toFixed(1)}</p>
    <p>Duracao media: ${result.avgTurns.toFixed(1)} turnos</p>
    <p><strong>Recomendacao:</strong> ${recommendation(result.winRate)}</p>
  `;
}

function bindInputLabels() {
  const setupNoUi = (sliderEl, minLabelEl, maxLabelEl, min, max, step) => {
    if (!sliderEl || !minLabelEl || !maxLabelEl || typeof noUiSlider === "undefined") return;
    noUiSlider.create(sliderEl, {
      start: [min, max],
      connect: true,
      step,
      range: { min, max }
    });
    sliderEl.noUiSlider.on("update", (values) => {
      const lo = Math.round(Number(values[0]));
      const hi = Math.round(Number(values[1]));
      minLabelEl.textContent = String(lo);
      maxLabelEl.textContent = String(hi);
      renderCards();
    });
  };

  setupNoUi(el.recuoFilter, el.recuoMinLabel, el.recuoMaxLabel, 0, 5, 1);
  setupNoUi(el.vidaSlider, el.vidaMinLabel, el.vidaMaxLabel, 0, 250, 10);
  setupNoUi(el.ataqueSlider, el.ataqueMinLabel, el.ataqueMaxLabel, 0, 250, 10);
  setupNoUi(el.custoAtaqueSlider, el.custoAtaqueMinLabel, el.custoAtaqueMaxLabel, 0, 5, 1);
}

function bindCustomMultiSelects() {
  const multiSelects = [
    el.tipoFilter, el.elementoFilter, el.raridadeFilter, el.estagioFilter,
    el.expansaoFilter, el.fraquezaFilter, el.attackEnergyFilter, el.formatoFilter, el.tagFilter
  ].filter(Boolean);

  const closeAll = (exceptPanel = null) => {
    document.querySelectorAll(".multi-dd-panel.open, .single-dd-panel.open").forEach((panel) => {
      if (panel !== exceptPanel) panel.classList.remove("open");
    });
  };

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".multi-dd")) closeAll();
  });

  multiSelects.forEach((select) => {
    const title = select.getAttribute("title") || "Filtro";
    const wrapper = document.createElement("div");
    wrapper.className = "multi-dd";
    wrapper.dataset.for = select.id;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "multi-dd-trigger";
    trigger.innerHTML = `<span>${title}: Todos</span>`;

    const panel = document.createElement("div");
    panel.className = "multi-dd-panel";

    const updateLabel = () => {
      const selected = [...select.selectedOptions].map((o) => o.textContent);
      if (!selected.length) {
        trigger.querySelector("span").textContent = `${title}: Todos`;
      } else if (selected.length === 1) {
        trigger.querySelector("span").textContent = `${title}: ${selected[0]}`;
      } else {
        trigger.querySelector("span").textContent = `${title}: ${selected.length} selecionados`;
      }
    };

    const renderItems = () => {
      panel.innerHTML = "";
      [...select.options].forEach((opt, i) => {
        const id = `${select.id}-opt-${i}`;
        const label = document.createElement("label");
        label.className = "multi-dd-item";
        label.setAttribute("for", id);
        label.innerHTML = `
          <input id="${id}" type="checkbox" ${opt.selected ? "checked" : ""} />
          <span>${opt.textContent}</span>
        `;
        const checkbox = label.querySelector("input");
        checkbox.addEventListener("change", () => {
          opt.selected = checkbox.checked;
          updateLabel();
          select.dispatchEvent(new Event("input", { bubbles: true }));
        });
        panel.appendChild(label);
      });
      updateLabel();
    };

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !panel.classList.contains("open");
      closeAll();
      panel.classList.toggle("open", willOpen);
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    select.insertAdjacentElement("beforebegin", wrapper);
    select.classList.add("multi-source-hidden");
    renderItems();
    select.addEventListener("change", updateLabel);
    select.addEventListener("input", updateLabel);
  });
}

function bindCustomSingleSelects() {
  const singleSelects = [el.habilidadeFilter, el.sortField, el.sortDir].filter(Boolean);

  const closeAllSingles = () => {
    document.querySelectorAll(".single-dd-panel.open, .multi-dd-panel.open").forEach((panel) => panel.classList.remove("open"));
  };

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".single-dd")) closeAllSingles();
  });

  singleSelects.forEach((select) => {
    const wrapper = document.createElement("div");
    wrapper.className = "single-dd";
    wrapper.dataset.for = select.id;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "single-dd-trigger strong-select";
    trigger.innerHTML = `<span></span>`;

    const panel = document.createElement("div");
    panel.className = "single-dd-panel";

    const updateLabel = () => {
      const selected = [...select.options].find((o) => o.value === select.value);
      trigger.querySelector("span").textContent = selected ? selected.textContent : "";
    };

    const renderItems = () => {
      panel.innerHTML = "";
      [...select.options].forEach((opt, i) => {
        const id = `${select.id}-single-${i}`;
        const item = document.createElement("button");
        item.type = "button";
        item.className = `single-dd-item ${opt.value === select.value ? "active" : ""}`;
        item.id = id;
        item.textContent = opt.textContent;
        item.addEventListener("click", () => {
          select.value = opt.value;
          panel.querySelectorAll(".single-dd-item").forEach((x) => x.classList.remove("active"));
          item.classList.add("active");
          updateLabel();
          select.dispatchEvent(new Event("input", { bubbles: true }));
          panel.classList.remove("open");
        });
        panel.appendChild(item);
      });
      updateLabel();
    };

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !panel.classList.contains("open");
      closeAllSingles();
      panel.classList.toggle("open", willOpen);
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    select.insertAdjacentElement("beforebegin", wrapper);
    select.classList.add("single-source-hidden");
    renderItems();
    select.addEventListener("change", updateLabel);
    select.addEventListener("input", updateLabel);
  });
}

function init() {
  if (!canInit()) throw new Error("HTML desatualizado: faltam elementos obrigatorios dos filtros.");
  loadFavorites();
  loadTradeState();
  if (!cards.length) throw new Error("Nenhuma carta encontrada na base de dados.");
  cards = cards.map(normalizeCard);

  populateFilter(el.tipoFilter, uniqueValues("categoria"));
  populateFilter(el.elementoFilter, tipoDisplayOrder);
  const raritySet = new Set([...defaultRarityOrder, ...uniqueValues("raridade")]);
  const rarityValues = [...raritySet].sort((a, b) => {
    const ia = defaultRarityOrder.indexOf(a);
    const ib = defaultRarityOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "pt-BR");
  });
  populateFilter(el.raridadeFilter, rarityValues);
  populateFilter(el.estagioFilter, stageOrder);
  const expansionValues = uniqueValues("expansao").sort((a, b) => expansionRank(a) - expansionRank(b));
  for (const exp of expansionValues) {
    const option = document.createElement("option");
    option.value = exp;
    option.textContent = canonicalExpansionName(exp);
    el.expansaoFilter.appendChild(option);
  }
  populateFilter(el.fraquezaFilter, tipoDisplayOrder);
  populateFilter(el.attackEnergyFilter, tipoDisplayOrder);

  [
    el.searchInput, el.tipoFilter, el.elementoFilter, el.raridadeFilter, el.estagioFilter, el.tagFilter, el.expansaoFilter, el.fraquezaFilter, el.attackEnergyFilter,
    el.habilidadeFilter, el.formatoFilter, el.sortField, el.sortDir, el.favoriteOnlyToggle, el.availableOnlyToggle, el.wantedOnlyToggle
  ].filter(Boolean).forEach((node) => node.addEventListener("input", renderCards));

  el.cardLayoutControls?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-card-layout]");
    if (!button) return;
    el.cardLayoutControls.querySelectorAll("[data-card-layout]").forEach((option) => {
      const active = option === button;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });
    renderCards();
  });

  bindInputLabels();
  bindCustomMultiSelects();
  bindCustomSingleSelects();

  el.cardsGrid?.addEventListener("click", (event) => {
    const tradeButton = event.target.closest("[data-trade-kind][data-trade-card]");
    if (tradeButton) {
      const kind = tradeButton.dataset.tradeKind;
      const isActive = toggleCardTradeStatus(kind, tradeButton.dataset.tradeCard);
      tradeButton.classList.toggle("active", isActive);
      tradeButton.setAttribute("aria-pressed", String(isActive));
      const tradeLabel = kind === "available"
        ? (isActive ? "Remover das cartas para troca" : "Marcar para troca")
        : (isActive ? "Remover das desejadas" : "Marcar como desejada");
      tradeButton.title = tradeLabel;
      tradeButton.setAttribute("aria-label", tradeLabel);
      const activeTradeFilter = kind === "available"
        ? el.availableOnlyToggle?.checked
        : el.wantedOnlyToggle?.checked;
      if (activeTradeFilter) renderCards();
      return;
    }
    const favBtn = event.target.closest(".card-fav");
    if (favBtn?.dataset.favorite) {
      const cardId = String(favBtn.dataset.favorite);
      toggleFavorite(cardId);
      if (el.favoriteOnlyToggle?.checked) {
        renderCards();
        return;
      }
      const nowFavorite = isFavorite(cardId);
      favBtn.classList.toggle("active", nowFavorite);
      const label = nowFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
      favBtn.title = label;
      favBtn.setAttribute("aria-label", label);
      return;
    }
    const previewId = event.target.closest("[data-preview]")?.dataset.preview;
    if (previewId) {
      const card = cards.find((item) => String(item.id) === String(previewId));
      if (card) openDeckCardModal(card);
      return;
    }
    const cardEl = event.target.closest(".card-clickable");
    const id = cardEl?.dataset.id;
    if (id) addCard(id);
  });
  el.deckList?.addEventListener("click", (event) => {
    const previewId = event.target.closest("[data-preview]")?.dataset.preview;
    if (previewId) {
      const card = cards.find((c) => String(c.id) === String(previewId));
      if (card) openDeckCardModal(card);
      return;
    }
    const addId = event.target.dataset.add;
    if (addId) {
      addCard(addId);
      return;
    }
    const id = event.target.dataset.remove;
    if (id) removeCard(id);
  });
  el.suggestionsList?.addEventListener("click", (event) => {
    const previewId = event.target.closest("[data-preview]")?.dataset.preview;
    if (previewId) {
      const card = cards.find((item) => String(item.id) === String(previewId));
      if (card) openDeckCardModal(card);
      return;
    }
    const addId = event.target.dataset.add;
    if (addId) {
      addCard(addId);
      return;
    }
  });
  el.mostUsedList?.addEventListener("click", (event) => {
    const previewId = event.target.closest("[data-preview]")?.dataset.preview;
    if (previewId) {
      const card = cards.find((item) => String(item.id) === String(previewId));
      if (card) openDeckCardModal(card);
      return;
    }
    const addId = event.target.dataset.add;
    if (addId) addCard(addId);
  });

  el.metaDecksList?.addEventListener("click", (event) => {
    const qrBtn = event.target.closest("[data-qr-meta]");
    if (qrBtn) {
      event.stopPropagation();
      const idx = Number(qrBtn.dataset.qrMeta);
      if (Number.isFinite(idx)) openMetaDeckQr(idx);
      return;
    }
    const loadBtn = event.target.closest("[data-load-meta]");
    if (loadBtn) {
      event.stopPropagation();
      const idx = Number(loadBtn.dataset.loadMeta);
      if (Number.isFinite(idx)) loadMetaDeckIntoDeck(idx);
      return;
    }
    const tile = event.target.closest("[data-open-meta]");
    if (tile) {
      const idx = Number(tile.dataset.openMeta);
      if (Number.isFinite(idx)) openMetaDeckModal(idx);
    }
  });
  el.metaDecksList?.addEventListener("keydown", (event) => {
    const tile = event.target.closest("[data-open-meta]");
    if (!tile || event.target.closest("[data-load-meta], [data-qr-meta]")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const idx = Number(tile.dataset.openMeta);
      if (Number.isFinite(idx)) openMetaDeckModal(idx);
    }
  });

  el.metaDeckModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-meta-modal-close]")) closeMetaDeckModal();
  });
  el.metaDeckModalLoadBtn?.addEventListener("click", () => {
    if (metaModalDeckIndex < 0) return;
    loadMetaDeckIntoDeck(metaModalDeckIndex);
    closeMetaDeckModal();
  });
  el.metaDeckModalQrBtn?.addEventListener("click", () => {
    if (metaModalDeckIndex < 0) return;
    const index = metaModalDeckIndex;
    closeMetaDeckModal();
    openMetaDeckQr(index);
  });
  el.deckQrBtn?.addEventListener("click", openDeckQrModal);
  el.deckQrShareBtn?.addEventListener("click", () => {
    shareDeckQrCode().catch(() => alert("Nao foi possivel compartilhar o QR Code."));
  });
  el.deckEnergyOptions?.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-deck-energy]");
    if (!input) return;
    const energyCode = Number(input.value);
    if (!Number.isInteger(energyCode)) return;
    if (input.checked) deckEnergySelection.add(energyCode);
    else deckEnergySelection.delete(energyCode);
    persistDeckDraft();
    updateDeckActionButtons();
  });
  el.clearDeckBtn?.addEventListener("click", clearDeck);
  el.saveDeckBtn?.addEventListener("click", saveCurrentDeck);
  el.deckQrModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-deck-qr-close]")) closeDeckQrModal();
  });
  el.deckCardModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-deck-card-close]")) closeDeckCardModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.metaDeckModal?.classList.contains("open")) closeMetaDeckModal();
    if (event.key === "Escape" && deckQrOpen) closeDeckQrModal();
    if (event.key === "Escape" && deckCardModalOpen) closeDeckCardModal();
  });

  el.runSimBtn?.addEventListener("click", renderSimulation);

  if (!loadDeckFromUrl()) loadDeckDraft();
  renderCards();
  renderDeck();
  renderMetaDecks();
}

async function loadMetaDecksData() {
  try {
    const response = await fetch("./data/meta-decks.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    metaDecks = Array.isArray(payload) ? payload : (Array.isArray(payload?.decks) ? payload.decks : []);
  } catch {
    metaDecks = [];
  }
}
async function loadCardsData() {
  if (Array.isArray(window.POCKETIA_CARDS) && window.POCKETIA_CARDS.length) {
    cards = window.POCKETIA_CARDS;
    return;
  }

  // Preferimos o JSON consolidado/adaptado para manter fontes originais separadas.
  try {
    const adaptedResponse = await fetch("./data/consolidated/cards-adapted.json", { cache: "no-store" });
    if (adaptedResponse.ok) {
      const adapted = await adaptedResponse.json();
      if (Array.isArray(adapted) && adapted.length) {
        cards = adapted;
        return;
      }
    }
  } catch {
    // fallback para carregamento por arquivos de expansao
  }

  try {
    const indexResponse = await fetch("./data/complete/index.json", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error(`HTTP ${indexResponse.status}`);
    const indexPayload = await indexResponse.json();
    const files = Array.isArray(indexPayload) ? indexPayload : indexPayload?.files;
    if (!Array.isArray(files) || !files.length) {
      throw new Error("data/complete/index.json vazio ou invalido.");
    }

    const chunks = await Promise.all(
      files.map(async (entry) => {
        const path = typeof entry === "string" ? entry : entry?.path;
        if (!path) return [];
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) throw new Error(`Falha ao carregar ${path}: HTTP ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      })
    );

    cards = chunks.flat();
    if (!cards.length) {
      throw new Error("Nenhuma carta encontrada nos arquivos por expansao.");
    }
  } catch (error) {
    throw new Error(`Falha ao carregar cartas: ${error.message}`);
  }
}

async function loadExpansionsData() {
  const response = await fetch("./data/expansions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const expansions = Array.isArray(payload) ? payload : payload?.expansions;
  if (!Array.isArray(expansions) || !expansions.length) {
    throw new Error("data/expansions.json vazio ou invalido.");
  }
  configureExpansions(expansions);
}

async function loadRaritiesData() {
  const response = await fetch("./data/rarities.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const rarities = Array.isArray(payload) ? payload : payload?.rarities;
  if (!Array.isArray(rarities) || !rarities.length) {
    throw new Error("data/rarities.json vazio ou invalido.");
  }
  defaultRarityOrder = rarities.map((r) => String(r || "").trim()).filter(Boolean);
}

async function loadStagesData() {
  const response = await fetch("./data/stages.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const stages = Array.isArray(payload) ? payload : payload?.stages;
  if (!Array.isArray(stages) || !stages.length) {
    throw new Error("data/stages.json vazio ou invalido.");
  }
  stageOrder = stages
    .map((stage) => {
      if (typeof stage === "object" && stage) {
        const value = normalizeKey(stage.value);
        const label = String(stage.label || value).trim();
        return value ? { value, label } : null;
      }
      const value = normalizeKey(stage);
      return value ? { value, label: String(stage).trim() } : null;
    })
    .filter(Boolean);
}

async function loadTypesData() {
  const response = await fetch("./data/types.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const types = Array.isArray(payload) ? payload : payload?.types;
  if (!Array.isArray(types) || !types.length) {
    throw new Error("data/types.json vazio ou invalido.");
  }
  tipoDisplayOrder = types.map((t) => String(t || "").trim()).filter(Boolean);
}

async function loadSuggestionRulesData() {
  const response = await fetch("./data/suggestion-rules.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const rules = Array.isArray(payload) ? payload : payload?.rules;
  if (!Array.isArray(rules)) throw new Error("data/suggestion-rules.json invalido.");
  suggestionRules = rules;
}

async function loadEvolutionFamiliesData() {
  const response = await fetch("./data/evolutions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const families = Array.isArray(payload) ? payload : payload?.families;
  if (!Array.isArray(families)) throw new Error("data/evolutions.json invalido.");
  evolutionFamilies = families;
}

(async function bootstrap() {
  await loadExpansionsData();
  await loadRaritiesData();
  await loadStagesData();
  await loadTypesData();
  await loadSuggestionRulesData();
  await loadEvolutionFamiliesData();
  await loadCardsData();
  await loadMetaDecksData();

  try {
    init();
  } catch (error) {
    console.error("Falha ao inicializar Pocketia:", error);
    const body = document.body || document.documentElement;
    if (body) {
      const warn = document.createElement("p");
      warn.style.color = "#fff";
      warn.style.padding = "16px";
      warn.textContent = "Falha ao inicializar a pagina. Atualize com Ctrl+F5.";
      body.prepend(warn);
    }
  }
})();















