const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("meus-decks.html", "utf8");
const app = fs.readFileSync("meus-decks.js", "utf8");
const metaHtml = fs.readFileSync("decks-meta.html", "utf8");
const metaApp = fs.readFileSync("decks-meta.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.match(html, /id="savedDeckModal"/);
assert.match(html, /id="savedDeckModalGrid" class="meta-deck-modal-grid"/);
assert.match(app, /function openSavedDeckModal\(deckId\)/);
assert.match(app, /class="saved-deck-preview meta-deck-preview-button" data-open-deck=/);
assert.doesNotMatch(app, />Ver cartas<\/button>/);
assert.match(app, /class="deck-qr-fab" data-saved-qr=/);
assert.match(app, /class="deck-action-btn" data-load-deck=[\s\S]*?>Copiar<\/button>/);
assert.match(app, /class="deck-action-btn danger-button" data-delete-deck=[\s\S]*?>Excluir<\/button>/);
assert.match(app, /data-saved-deck-close/);
assert.match(html, /id="savedDeckModalQrBtn"[\s\S]*deck-qr-fab-icon/);
assert.match(html, /id="savedDeckModalCopyBtn"[\s\S]*>Copiar<\/button>/);
assert.match(html, /qrcode-generator@1\.4\.4/);
assert.match(app, /function openSavedDeckQrModal\(deckId\)/);
assert.match(app, /function copySavedDeckToBuilder\(deckId\)/);
assert.match(metaHtml, /id="metaDeckCardsQrBtn"[\s\S]*deck-qr-fab-icon/);
assert.match(metaHtml, /id="metaDeckCardsCopyBtn"[\s\S]*>Copiar<\/button>/);
assert.match(metaApp, /function copyMetaDeckToBuilder\(index\)/);
assert.match(css, /\.danger-button\s*\{[\s\S]*?color: #fff;[\s\S]*?font-family: inherit;/);
assert.match(css, /\.saved-deck-page-actions\s*\{[\s\S]*?display: flex/);
assert.match(css, /\.saved-deck-page-actions \.deck-action-stack\s*\{[\s\S]*?flex: 1 1 auto/);
assert.match(css, /\.meta-deck-modal-load\s*\{[\s\S]*?width: 120px;[\s\S]*?height: 66px;[\s\S]*?border-radius: 12px;/);

console.log("Meus Decks: modal e ações validados com sucesso.");
