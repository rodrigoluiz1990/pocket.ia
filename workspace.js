(function registerPocketiaWorkspace() {
  const KEYS = {
    favorites: "pocketia_favorites_v1",
    savedDecks: "pocketia_saved_decks_v1",
    importedMetaDecks: "pocketia_imported_meta_decks_v1",
    trades: "pocketia_trades_v1",
    deckDraft: "pocketia_deck_draft_v1"
  };

  function migrateSessionStorage() {
    Object.values(KEYS).forEach((key) => {
      try {
        if (localStorage.getItem(key) !== null) return;
        const legacyValue = sessionStorage.getItem(key);
        if (legacyValue === null) return;
        JSON.parse(legacyValue);
        localStorage.setItem(key, legacyValue);
        sessionStorage.removeItem(key);
      } catch {
        // Mantem o dado legado intacto quando o navegador bloqueia a migracao.
      }
    });
  }

  function read(key, fallback) {
    let value = null;
    try {
      value = localStorage.getItem(key);
    } catch {
      // Tenta o armazenamento legado abaixo.
    }
    if (value === null) {
      try {
        value = sessionStorage.getItem(key);
      } catch {
        // O navegador pode bloquear ambos os armazenamentos.
      }
    }
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  migrateSessionStorage();

  async function loadCards() {
    const response = await fetch("./data/consolidated/cards-adapted.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Nao foi possivel carregar o catalogo de cartas.");
    const cards = await response.json();
    return Array.isArray(cards) ? cards : [];
  }

  function nextId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getFavorites() {
    const favorites = read(KEYS.favorites, []);
    return Array.isArray(favorites) ? favorites.map(String) : [];
  }

  function saveFavorites(favorites) {
    return write(KEYS.favorites, [...new Set((favorites || []).map(String))]);
  }

  function getSavedDecks() {
    const decks = read(KEYS.savedDecks, []);
    return Array.isArray(decks) ? decks : [];
  }

  function saveSavedDecks(decks) {
    return write(KEYS.savedDecks, decks);
  }

  function getImportedMetaDecks() {
    const decks = read(KEYS.importedMetaDecks, []);
    return Array.isArray(decks) ? decks : [];
  }

  function saveImportedMetaDecks(decks) {
    return write(KEYS.importedMetaDecks, decks);
  }

  function getTradeState() {
    const state = read(KEYS.trades, { available: [], wanted: [], combos: [] });
    return {
      available: Array.isArray(state?.available) ? state.available : [],
      wanted: Array.isArray(state?.wanted) ? state.wanted : [],
      combos: Array.isArray(state?.combos) ? state.combos : []
    };
  }

  function saveTradeState(state) {
    return write(KEYS.trades, state);
  }

  function getDeckDraft() {
    const draft = read(KEYS.deckDraft, { cards: [], energies: [] });
    return {
      cards: Array.isArray(draft?.cards) ? draft.cards.map(String) : [],
      energies: Array.isArray(draft?.energies) ? draft.energies.map(Number).filter(Number.isInteger) : [],
      updatedAt: String(draft?.updatedAt || "")
    };
  }

  function saveDeckDraft(cards, energies) {
    return write(KEYS.deckDraft, {
      cards: Array.isArray(cards) ? cards.map(String) : [],
      energies: Array.isArray(energies) ? energies.map(Number).filter(Number.isInteger) : [],
      updatedAt: new Date().toISOString()
    });
  }

  function clearDeckDraft() {
    try {
      localStorage.removeItem(KEYS.deckDraft);
      return true;
    } catch {
      return false;
    }
  }

  function createBackup() {
    return {
      app: "Pocket.ia",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        favorites: getFavorites(),
        savedDecks: getSavedDecks(),
        importedMetaDecks: getImportedMetaDecks(),
        trades: getTradeState(),
        deckDraft: getDeckDraft()
      }
    };
  }

  function restoreBackup(backup) {
    if (!backup || backup.app !== "Pocket.ia" || backup.version !== 1 || !backup.data) {
      throw new Error("Arquivo de backup invalido ou incompativel.");
    }

    const data = backup.data;
    if (!Array.isArray(data.favorites) || !Array.isArray(data.savedDecks) || !Array.isArray(data.importedMetaDecks)) {
      throw new Error("O backup nao possui listas validas.");
    }
    if (!data.trades || !Array.isArray(data.trades.available) || !Array.isArray(data.trades.wanted) || !Array.isArray(data.trades.combos)) {
      throw new Error("O backup nao possui dados de trocas validos.");
    }
    if (!data.deckDraft || !Array.isArray(data.deckDraft.cards) || !Array.isArray(data.deckDraft.energies)) {
      throw new Error("O backup nao possui um rascunho de deck valido.");
    }

    const results = [
      saveFavorites(data.favorites),
      saveSavedDecks(data.savedDecks),
      saveImportedMetaDecks(data.importedMetaDecks),
      saveTradeState(data.trades),
      saveDeckDraft(data.deckDraft.cards, data.deckDraft.energies)
    ];
    if (results.some((saved) => !saved)) {
      throw new Error("O navegador nao permitiu salvar todos os dados do backup.");
    }
    return true;
  }

  function normalizeKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function inferDeckEnergyCodes(deckCards) {
    const energyCodeByName = {
      planta: 1,
      fogo: 2,
      agua: 3,
      raio: 4,
      eletrico: 4,
      psiquico: 5,
      luta: 6,
      lutador: 6,
      escuridao: 7,
      metal: 8
    };
    const codes = new Set();

    for (const card of deckCards || []) {
      const attacks = Array.isArray(card?.ataqueLista)
        ? card.ataqueLista
        : Array.isArray(card?.ataque) ? card.ataque : [];
      for (const attack of attacks) {
        for (const energy of Array.isArray(attack?.custoataque) ? attack.custoataque : []) {
          const code = energyCodeByName[normalizeKey(energy)];
          if (code) codes.add(code);
        }
      }
    }

    return [...codes].slice(0, 3);
  }

  function pushUint24(bytes, value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffff) {
      throw new Error("Uma carta do deck nao possui um identificador compativel com o jogo.");
    }
    bytes.push((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  }

  function encodeGameDeckPayload(deckCards, energyCodes) {
    if (!Array.isArray(deckCards) || deckCards.length !== 20) {
      throw new Error("O QR Code do jogo exige exatamente 20 cartas.");
    }
    const energies = [...new Set((energyCodes || []).map(Number).filter((code) => code >= 1 && code <= 8))];
    if (!energies.length || energies.length > 3) {
      throw new Error("Nao foi possivel determinar de 1 a 3 energias para este deck.");
    }

    const trainers = deckCards.filter((card) => normalizeKey(card?.categoria) !== "pokemon");
    const pokemon = deckCards.filter((card) => normalizeKey(card?.categoria) === "pokemon");
    const bytes = [trainers.length];
    trainers.forEach((card) => {
      const number = Number(card?.deckBuilderNr);
      if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`A carta ${card?.nome || ""} nao pode ser exportada para o jogo.`);
      pushUint24(bytes, number * 10);
    });
    bytes.push(pokemon.length);
    pokemon.forEach((card) => {
      const number = Number(card?.deckBuilderNr);
      if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`A carta ${card?.nome || ""} nao pode ser exportada para o jogo.`);
      pushUint24(bytes, number * 10);
    });
    bytes.push(energies.length, ...energies);
    return btoa(String.fromCharCode(...bytes));
  }

  function buildDeckQrDataUrl(payload) {
    if (typeof window.qrcode !== "function") throw new Error("O gerador de QR Code nao foi carregado.");
    const qr = window.qrcode(0, "M");
    qr.addData(payload, "Byte");
    qr.make();
    return qr.createDataURL(8, 4);
  }

  window.PocketiaWorkspace = {
    nextId,
    loadCards,
    getFavorites,
    saveFavorites,
    getSavedDecks,
    saveSavedDecks,
    getImportedMetaDecks,
    saveImportedMetaDecks,
    getTradeState,
    saveTradeState,
    getDeckDraft,
    saveDeckDraft,
    clearDeckDraft,
    createBackup,
    restoreBackup,
    inferDeckEnergyCodes,
    encodeGameDeckPayload,
    buildDeckQrDataUrl
  };
})();
