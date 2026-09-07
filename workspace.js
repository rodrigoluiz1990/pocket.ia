(function registerPocketiaWorkspace() {
  const KEYS = {
    savedDecks: "pocketia_saved_decks_v1",
    importedMetaDecks: "pocketia_imported_meta_decks_v1",
    trades: "pocketia_trades_v1"
  };

  function read(key, fallback) {
    try {
      const value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  async function loadCards() {
    const response = await fetch("./data/consolidated/cards-adapted.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Nao foi possivel carregar o catalogo de cartas.");
    const cards = await response.json();
    return Array.isArray(cards) ? cards : [];
  }

  function nextId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSavedDecks() {
    const decks = read(KEYS.savedDecks, []);
    return Array.isArray(decks) ? decks : [];
  }

  function saveSavedDecks(decks) {
    write(KEYS.savedDecks, decks);
  }

  function getImportedMetaDecks() {
    const decks = read(KEYS.importedMetaDecks, []);
    return Array.isArray(decks) ? decks : [];
  }

  function saveImportedMetaDecks(decks) {
    write(KEYS.importedMetaDecks, decks);
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
    write(KEYS.trades, state);
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
    getSavedDecks,
    saveSavedDecks,
    getImportedMetaDecks,
    saveImportedMetaDecks,
    getTradeState,
    saveTradeState,
    inferDeckEnergyCodes,
    encodeGameDeckPayload,
    buildDeckQrDataUrl
  };
})();
