const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const workspaceSource = fs.readFileSync("workspace.js", "utf8");

function memoryStorage(values = new Map(), blocked = false) {
  return {
    getItem(key) {
      if (blocked) throw new Error("storage blocked");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (blocked) throw new Error("storage blocked");
      values.set(key, String(value));
    },
    removeItem(key) {
      if (blocked) throw new Error("storage blocked");
      values.delete(key);
    }
  };
}

function boot(localValues = new Map(), sessionValues = new Map(), blockLocal = false) {
  const context = vm.createContext({
    window: {},
    localStorage: memoryStorage(localValues, blockLocal),
    sessionStorage: memoryStorage(sessionValues)
  });
  vm.runInContext(workspaceSource, context);
  return context.window.PocketiaWorkspace;
}

function testMigration() {
  const local = new Map([
    ["pocketia_trades_v1", JSON.stringify({ available: ["local"], wanted: [], combos: [] })]
  ]);
  const session = new Map([
    ["pocketia_saved_decks_v1", JSON.stringify([{ id: "legacy-deck" }])],
    ["pocketia_trades_v1", JSON.stringify({ available: ["legacy"], wanted: [], combos: [] })]
  ]);
  const api = boot(local, session);
  assert.equal(api.getSavedDecks()[0].id, "legacy-deck");
  assert.equal(api.getTradeState().available[0], "local");
  assert.equal(session.has("pocketia_saved_decks_v1"), false);
}

function testPersistenceAcrossReloads() {
  const local = new Map();
  const firstPage = boot(local);
  firstPage.saveFavorites(["fav-1", "fav-1"]);
  firstPage.saveSavedDecks([{ id: "deck-1", cartas: ["a1"] }]);
  firstPage.saveTradeState({ available: ["a1"], wanted: ["b2"], combos: [] });
  firstPage.saveDeckDraft(["a1", "b2"], [2, 3]);

  const reopenedPage = boot(local);
  assert.deepEqual([...reopenedPage.getFavorites()], ["fav-1"]);
  assert.equal(reopenedPage.getSavedDecks()[0].id, "deck-1");
  assert.deepEqual([...reopenedPage.getTradeState().wanted], ["b2"]);
  assert.deepEqual([...reopenedPage.getDeckDraft().cards], ["a1", "b2"]);
  assert.deepEqual([...reopenedPage.getDeckDraft().energies], [2, 3]);
}

function testBackupRoundTrip() {
  const local = new Map();
  const api = boot(local);
  api.saveFavorites(["fav-1"]);
  api.saveSavedDecks([{ id: "deck-1" }]);
  api.saveImportedMetaDecks([{ id: "meta-1" }]);
  api.saveTradeState({ available: ["a1"], wanted: ["b2"], combos: [{ id: "combo-1" }] });
  api.saveDeckDraft(["a1"], [2]);
  const backup = JSON.parse(JSON.stringify(api.createBackup()));

  api.saveFavorites([]);
  api.saveSavedDecks([]);
  api.saveImportedMetaDecks([]);
  api.saveTradeState({ available: [], wanted: [], combos: [] });
  api.clearDeckDraft();
  api.restoreBackup(backup);

  assert.deepEqual([...api.getFavorites()], ["fav-1"]);
  assert.equal(api.getSavedDecks()[0].id, "deck-1");
  assert.equal(api.getImportedMetaDecks()[0].id, "meta-1");
  assert.equal(api.getTradeState().combos[0].id, "combo-1");
  assert.deepEqual([...api.getDeckDraft().cards], ["a1"]);
  assert.throws(() => api.restoreBackup({ app: "Outro", version: 1, data: {} }), /invalido/i);
}

function testLegacyFallback() {
  const session = new Map([
    ["pocketia_saved_decks_v1", JSON.stringify([{ id: "fallback-deck" }])]
  ]);
  const api = boot(new Map(), session, true);
  assert.equal(api.getSavedDecks()[0].id, "fallback-deck");
}

testMigration();
testPersistenceAcrossReloads();
testBackupRoundTrip();
testLegacyFallback();
console.log("Persistencia e backup: testes concluidos com sucesso.");
