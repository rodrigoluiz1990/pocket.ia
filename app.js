let cards = [];
const deck = [];
const maxDeck = 20;
const maxCopies = 2;
let renderToken = 0;
const FAVORITES_KEY = "pocketia_favorites_v1";
let metaDecks = [];
const favorites = new Set();
const FALLBACK_IMAGE_SRC = "./assets/cards/pokemon_pocket_card_back.png";

let expansionOrder = [];
let normalizedExpansionOrder = [];
let expansionToSetCode = {};
let setSortIndex = {};
let expansionToSetCodeNormalized = {};


let defaultRarityOrder = [];

let stageOrder = [];

let tipoDisplayOrder = [];

const el = {
  cardsGrid: document.getElementById("cardsGrid"),
  deckList: document.getElementById("deckList"),
  deckCount: document.getElementById("deckCount"),
  simResults: document.getElementById("simResults"),
  loadStatus: document.getElementById("loadStatus"),
  suggestionsList: document.getElementById("suggestionsList"),
  mostUsedList: document.getElementById("mostUsedList"),
  metaDecksList: document.getElementById("metaDecksList"),
  metaDeckModal: document.getElementById("metaDeckModal"),
  metaDeckModalTitle: document.getElementById("metaDeckModalTitle"),
  metaDeckModalGrid: document.getElementById("metaDeckModalGrid"),
  metaDeckModalLoadBtn: document.getElementById("metaDeckModalLoadBtn"),

  searchInput: document.getElementById("searchInput"),
  tipoFilter: document.getElementById("tipoFilter"),
  elementoFilter: document.getElementById("elementoFilter"),
  raridadeFilter: document.getElementById("raridadeFilter"),
  estagioFilter: document.getElementById("estagioFilter"),
  expansaoFilter: document.getElementById("expansaoFilter"),
  fraquezaFilter: document.getElementById("fraquezaFilter"),
  attackEnergyFilter: document.getElementById("attackEnergyFilter"),
  habilidadeFilter: document.getElementById("habilidadeFilter"),
  recuoFilter: document.getElementById("recuoFilter"),
  recuoLabel: document.getElementById("recuoLabel"),
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
  imageOnlyToggle: document.getElementById("imageOnlyToggle"),
  favoriteOnlyToggle: document.getElementById("favoriteOnlyToggle"),

  simCount: document.getElementById("simCount"),
  aiProfile: document.getElementById("aiProfile"),
  runSimBtn: document.getElementById("runSimBtn")
};


function canInit() {
  const required = [
    "cardsGrid","deckList","deckCount","simResults","loadStatus","searchInput","tipoFilter","elementoFilter",
    "raridadeFilter","estagioFilter","expansaoFilter","fraquezaFilter","habilidadeFilter",
    "recuoFilter","recuoLabel","vidaSlider","ataqueSlider","vidaMinLabel","vidaMaxLabel","ataqueMinLabel","ataqueMaxLabel","custoAtaqueSlider","custoAtaqueMinLabel","custoAtaqueMaxLabel","formatoFilter","sortField","sortDir","imageOnlyToggle",
    "favoriteOnlyToggle","attackEnergyFilter","mostUsedList","metaDecksList",
    "metaDeckModal","metaDeckModalTitle","metaDeckModalGrid","metaDeckModalLoadBtn",
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

function findCardByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return cards.find((c) => String(c.nome || "").trim().toLowerCase() === n) || null;
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
      const id = String(idRaw).trim();
      return cards.find((c) => String(c.id) === id) || null;
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
        <button class="deck-add" data-add="${card.id}" title="Adicionar ao deck">+</button>
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
  metaDecks.forEach((d, i) => {
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
      <button type="button" class="meta-deck-load-btn" data-load-meta="${i}">Carregar no Seu Deck</button>
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
  const ataques = Array.isArray(card.ataque) ? card.ataque : [];
  const maxDano = ataques.reduce((acc, atk) => {
    const nums = String(atk?.dano || "").match(/\d+/g);
    const score = nums && nums.length ? Math.max(...nums.map(Number)) : 0;
    return Math.max(acc, score);
  }, 0);
  const maxCustoAtaque = ataques.reduce((acc, atk) => {
    const len = Array.isArray(atk?.custoataque) ? atk.custoataque.length : 0;
    return Math.max(acc, len);
  }, 0);
  return {
    ...card,
    nome: String(card.nome || "").trim(),
    categoria: String(card.categoria || "").trim(),
    tipo: String(card.tipo || "").trim(),
    expansao: String(card.expansao || "").trim(),
    estagio: String(card.estagio || "").trim(),
    raridade: String(card.raridade || "").trim(),
    fraqueza: String(card.fraqueza || "").trim(),
    imageLocal: String(card.imageLocal || "").trim(),
    hp: safeNumber(card.hp, 0),
    ataque: safeNumber(maxDano, safeNumber(card.ataque, 0)),
    custoAtaque: safeNumber(maxCustoAtaque, safeNumber(card.custoAtaque, 0)),
    custoDeck: safeNumber(card.custoDeck ?? card.custo, 0),
    recuo: safeNumber(card.recuo, 0),
    formato: String(card.formato || "noex").trim(),
    habilidade: Boolean(card.habilidade ?? card.temHabilidade),
    promo: Boolean(card.promo ?? card.tagPromo),
    ataqueLista: ataques
  };
}

function hasValidImage(card) {
  const local = String(card?.imageLocal || "").trim();
  const remote = String(card?.imageUrl || "").trim();
  return Boolean(local || remote);
}

function getPrimaryCardImage(card) {
  if (!card) return "";
  const local = String(card.imageLocal || "").trim();
  if (local) return local;
  const remote = String(card.imageUrl || "").trim();
  if (remote) return remote;
  return "";
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
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
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
  const estagios = selectedValues(el.estagioFilter);
  const expansoes = selectedValues(el.expansaoFilter);
  const fraquezas = selectedValues(el.fraquezaFilter);
  const attackTypes = new Set([...selectedValues(el.attackEnergyFilter)].map(normalizeEnergyType));
  const habilidade = el.habilidadeFilter.value;
  const recuoMax = safeNumber(el.recuoFilter.value, 5);
  const vidaValues = el.vidaSlider?.noUiSlider ? el.vidaSlider.noUiSlider.get() : [0, 300];
  const ataqueValues = el.ataqueSlider?.noUiSlider ? el.ataqueSlider.noUiSlider.get() : [0, 250];
  const vidaMin = safeNumber(vidaValues[0], 0);
  const vidaMax = safeNumber(vidaValues[1], 300);
  const ataqueMin = safeNumber(ataqueValues[0], 0);
  const ataqueMax = safeNumber(ataqueValues[1], 250);
  const custoAtaqueValues = el.custoAtaqueSlider?.noUiSlider ? el.custoAtaqueSlider.noUiSlider.get() : [0, 5];
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
      if (estagios.size && !estagios.has(card.estagio)) return false;
      if (expansoes.size && !expansoes.has(card.expansao)) return false;
      if (fraquezas.size && !fraquezas.has(card.fraqueza)) return false;
      if (!cardHasAttackType(card, attackTypes)) return false;
      if (habilidade === "tem" && !card.habilidade) return false;
      if (habilidade === "nao-tem" && card.habilidade) return false;
      if (card.recuo > recuoMax) return false;
      if (card.hp < vidaMin || card.hp > vidaMax) return false;
      if (card.ataque < ataqueMin || card.ataque > ataqueMax) return false;
      if (card.custoAtaque > custoAtaqueMax) return false;
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
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    favorites.clear();
    parsed.forEach((id) => favorites.add(String(id)));
  } catch (error) {
    console.warn("Nao foi possivel carregar favoritos:", error);
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
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


function renderCards() {
  renderToken++;
  const thisRender = renderToken;
  const filtered = getFilteredCards();
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
      const imageOnly = Boolean(el.imageOnlyToggle?.checked);
      const ataques = Array.isArray(card.ataqueLista) ? card.ataqueLista : [];
      const custos = ataques
        .map((a) => Array.isArray(a?.custoataque) ? a.custoataque.length : 0)
        .filter((n) => Number.isFinite(n));
      const danos = ataques
        .map((a) => {
          const nums = String(a?.dano || "").match(/\d+/g);
          return nums && nums.length ? Math.max(...nums.map(Number)) : 0;
        })
        .filter((n) => Number.isFinite(n));
      const custoText = custos.length ? custos.join(" / ") : String(card.custoAtaque || 0);
      const danoText = danos.length ? danos.join(" / ") : String(card.ataque || 0);
      const cardEl = document.createElement("article");
      cardEl.className = `card card-clickable ${imageOnly ? "image-only" : ""}`;
      cardEl.dataset.id = String(card.id);
      const fav = isFavorite(card.id);
      cardEl.innerHTML = `
        <button class="card-fav ${fav ? "active" : ""}" data-favorite="${card.id}" title="${fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}" aria-label="${fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
          <svg class="fav-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-6.7-4.35-9.33-8.02C.64 10.1 1.2 6.3 4.4 4.8c2.1-.97 4.35-.2 5.6 1.4 1.25-1.6 3.5-2.37 5.6-1.4 3.2 1.5 3.76 5.3 1.73 8.18C18.7 16.65 12 21 12 21z"/>
          </svg>
        </button>
        <img loading="lazy" src="${imageSrc}" alt="${card.nome}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <ul class="card-info-list">
          <li><strong>Nome:</strong> ${card.nome}</li>
          <li><strong>Estagio:</strong> ${card.estagio}</li>
          <li><strong>Categoria:</strong> ${card.categoria || "-"}</li>
          <li><strong>Tipo:</strong> ${card.tipo || "-"}</li>
          <li><strong>Vida:</strong> ${card.hp}</li>
          <li><strong>Custo:</strong> ${custoText}</li>
          <li><strong>Dano:</strong> ${danoText}</li>
          <li><strong>Fraqueza:</strong> ${card.fraqueza || "-"}</li>
          <li><strong>Recuo:</strong> ${card.recuo}</li>
          <li><strong>Pacote:</strong> ${card.expansao}</li>
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
  if (!deck.length) {
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
        <img class="deck-thumb" src="${imageSrc}" alt="${card.nome}" title="${card.nome}" onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <span class="deck-qty">x${qty}</span>
        <button class="deck-add" data-add="${card.id}" title="Adicionar uma copia">+</button>
        <button class="deck-remove" data-remove="${card.id}" title="Remover uma copia">-</button>
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
  const suggestions = new Set();

  // Regra: se ha estagio 2, sugerir Rare Candy e Professor's Research.
  if (deckCards.some(c => c.estagio === '2')) {
    suggestions.add("Rare Candy");
    suggestions.add("Professor's Research");
  }

  // Regra: sempre sugerir item basico se o deck nao os tem.
  if (!deckCards.some(c => c.nome === "Potion")) {
    suggestions.add("Potion");
  }

  // Filtrar sugestoes que ja estao no deck.
  const deckNames = new Set(deckCards.map(c => c.nome));
  const filteredSuggestions = Array.from(suggestions).filter(name => !deckNames.has(name));

  if (filteredSuggestions.length === 0) {
    el.suggestionsList.innerHTML = "<p>Nenhuma sugestao disponivel.</p>";
    return;
  }

  filteredSuggestions.forEach(name => {
    const candidates = cards.filter((c) => c.nome === name || c.nome?.toLowerCase() === name.toLowerCase());
    const card = candidates.find((c) => hasValidImage(c)) || candidates[0];
    if (!card) return;
    const item = document.createElement("div");
    item.className = "suggestion-item";
    const imageSrc = getSuggestionImageSrc(card, name);
    item.innerHTML = `
      <div class="deck-item-main suggestion-item-main" style="width:72px;aspect-ratio:63/88;">
        <img class="deck-thumb suggestion-thumb" src="${imageSrc}" alt="${card.nome}" title="${card.nome}" onload="if(this.naturalWidth>this.naturalHeight){this.classList.add('is-wallpaper')}" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE_SRC}'" />
        <button class="deck-add" data-add="${card.id}" title="Adicionar ao deck">+</button>
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
  const simpleMap = [[el.recuoFilter, el.recuoLabel]];

  const paintRangeProgress = (input) => {
    if (!input) return;
    const min = safeNumber(input.min, 0);
    const max = safeNumber(input.max, 100);
    const value = safeNumber(input.value, min);
    const ratio = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, ratio))}%`);
  };

  for (const [input, label] of simpleMap) {
    if (!input || !label) continue;
    paintRangeProgress(input);
    input.addEventListener("input", () => {
      label.textContent = input.value;
      paintRangeProgress(input);
      renderCards();
    });
  }

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

  setupNoUi(el.vidaSlider, el.vidaMinLabel, el.vidaMaxLabel, 0, 300, 10);
  setupNoUi(el.ataqueSlider, el.ataqueMinLabel, el.ataqueMaxLabel, 0, 250, 10);
  setupNoUi(el.custoAtaqueSlider, el.custoAtaqueMinLabel, el.custoAtaqueMaxLabel, 0, 5, 1);
}

function bindCustomMultiSelects() {
  const multiSelects = [
    el.tipoFilter, el.elementoFilter, el.raridadeFilter, el.estagioFilter,
    el.expansaoFilter, el.fraquezaFilter, el.attackEnergyFilter, el.formatoFilter
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
    el.searchInput, el.tipoFilter, el.elementoFilter, el.raridadeFilter, el.estagioFilter, el.expansaoFilter, el.fraquezaFilter, el.attackEnergyFilter,
    el.habilidadeFilter, el.formatoFilter, el.sortField, el.sortDir, el.imageOnlyToggle, el.favoriteOnlyToggle
  ].filter(Boolean).forEach((node) => node.addEventListener("input", renderCards));

  bindInputLabels();
  bindCustomMultiSelects();
  bindCustomSingleSelects();

  el.cardsGrid?.addEventListener("click", (event) => {
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
    const cardEl = event.target.closest(".card-clickable");
    const id = cardEl?.dataset.id;
    if (id) addCard(id);
  });
  el.deckList?.addEventListener("click", (event) => {
    const addId = event.target.dataset.add;
    if (addId) {
      addCard(addId);
      return;
    }
    const id = event.target.dataset.remove;
    if (id) removeCard(id);
  });
  el.suggestionsList?.addEventListener("click", (event) => {
    const addId = event.target.dataset.add;
    if (addId) {
      addCard(addId);
      return;
    }
  });
  el.mostUsedList?.addEventListener("click", (event) => {
    const addId = event.target.dataset.add;
    if (addId) addCard(addId);
  });

  el.metaDecksList?.addEventListener("click", (event) => {
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
    if (!tile || event.target.closest("[data-load-meta]")) return;
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.metaDeckModal?.classList.contains("open")) closeMetaDeckModal();
  });

  el.runSimBtn?.addEventListener("click", renderSimulation);

  renderCards();
  renderDeck();
  renderMetaDecks();
}

async function loadMetaDecksData() {
  try {
    const response = await fetch("./data/meta-decks.json", { cache: "no-store" });
    if (!response.ok) {
      metaDecks = [];
      return;
    }
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
    const indexResponse = await fetch("./data/consolidated/index.json", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error(`HTTP ${indexResponse.status}`);
    const indexPayload = await indexResponse.json();
    const files = Array.isArray(indexPayload) ? indexPayload : indexPayload?.files;
    if (!Array.isArray(files) || !files.length) {
      throw new Error("data/consolidated/index.json vazio ou invalido.");
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
  stageOrder = stages.map((s) => String(s || "").trim()).filter(Boolean);
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

(async function bootstrap() {
  await loadExpansionsData();
  await loadRaritiesData();
  await loadStagesData();
  await loadTypesData();
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















