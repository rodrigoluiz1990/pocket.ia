const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const layouts = ["details-bottom", "image-only", "image-compact", "details-side"];

for (const page of ["index.html", "meus-decks.html", "decks-meta.html", "trocas.html"]) {
  const pageHtml = fs.readFileSync(page, "utf8");
  assert.match(pageHtml, /<a class="site-brand" href="\.\/index\.html" aria-label="Voltar para a tela inicial">/);
}

assert.match(html, /id="cardLayoutControls"/);
layouts.forEach((layout) => {
  assert.ok(html.includes(`data-card-layout="${layout}"`), `Botao ausente no HTML: ${layout}`);
  assert.ok(app.includes(`"${layout}"`), `Layout ausente no renderizador: ${layout}`);
});

const layoutPositions = ["image-only", "image-compact", "details-bottom", "details-side"].map((layout) => html.indexOf(`data-card-layout="${layout}"`));
assert.deepEqual(layoutPositions, [...layoutPositions].sort((a, b) => a - b));
assert.match(html, /class="card-layout-button active" data-card-layout="image-only" aria-pressed="true"/);

const filterPositions = ["favorite-state-filter", "wanted-state-filter", "available-state-filter"].map((filter) => html.indexOf(filter));
assert.deepEqual(filterPositions, [...filterPositions].sort((a, b) => a - b));

assert.doesNotMatch(app, /imageOnlyToggle/);
assert.doesNotMatch(app, /cardLayoutSelect/);
assert.match(html, /aria-label="Dados abaixo"/);
assert.match(html, /aria-label="Somente imagens"/);
assert.match(html, /aria-label="Imagens compactas"/);
assert.match(html, /aria-label="Dados ao lado"/);
assert.match(app, /<strong>Raridade:<\/strong>/);
assert.match(app, /class="card-code-row"><strong>Codigo:<\/strong>/);
const cardInfoStart = app.indexOf('<ul class="card-info-list">');
const cardInfoMarkup = app.slice(cardInfoStart, app.indexOf("</ul>", cardInfoStart));
const expectedFieldOrder = ["Nome", "Categoria", "Estagio", "Tipo", "Vida", "Custo", "Dano", "Recuo", "Raridade", "Pacote", "Codigo"];
let previousFieldIndex = -1;
expectedFieldOrder.forEach((field) => {
  const fieldIndex = cardInfoMarkup.indexOf(`<strong>${field}:</strong>`);
  assert.ok(fieldIndex > previousFieldIndex, `Campo ausente ou fora de ordem: ${field}`);
  previousFieldIndex = fieldIndex;
});
assert.ok(!cardInfoMarkup.includes("<strong>Fraqueza:</strong>"));
assert.match(html, /font-awesome\/6\.7\.2\/css\/all\.min\.css/);
assert.match(app, /fa-regular fa-star/);
assert.match(app, /fa-solid fa-star/);
assert.match(app, /fa-regular fa-heart/);
assert.match(app, /fa-solid fa-heart/);
assert.match(app, /fa-solid fa-rotate/);
assert.match(app, /fa-solid fa-expand/);
assert.match(html, /favorite-state-filter[\s\S]*fa-regular fa-star[\s\S]*fa-solid fa-star/);
assert.match(html, /available-state-filter[\s\S]*fa-solid fa-rotate/);
assert.match(html, /Somente para troca/);
assert.doesNotMatch(html, /Somente disponíveis/);
assert.match(html, /wanted-state-filter[\s\S]*fa-regular fa-heart[\s\S]*fa-solid fa-heart/);
assert.match(html, /id="deckCardModalFavorite"[\s\S]*fa-regular fa-star[\s\S]*fa-solid fa-star/);
assert.match(html, /id="deckCardModalWanted"[\s\S]*fa-regular fa-heart[\s\S]*fa-solid fa-heart/);
assert.match(html, /id="deckCardModalAvailable"[\s\S]*fa-solid fa-rotate/);
assert.match(app, /function updateDeckCardModalActions\(cardId\)/);
assert.match(css, /\.deck-card-modal-actions/);
assert.match(css, /\.deck-card-modal-actions \.card-status-fa\s*\{[\s\S]*?font-size: 21px/);
assert.match(css, /\.deck-card-modal-preview\s*\{[\s\S]*?width: min\(340px, calc\(100% - 112px\)\)/);
assert.match(css, /\.deck-card-modal-actions\s*\{[\s\S]*?left: calc\(100% \+ 14px\)/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.hero-topline\s*\{\s*display: contents;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.subtitle\s*\{[\s\S]*?order: 2;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.app-nav\s*\{[\s\S]*?order: 3;[\s\S]*?flex-wrap: nowrap;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.deck-actions\s*\{[\s\S]*?position: absolute;[\s\S]*?right: 12px;/);
assert.match(html, /class="filter-column filter-column-ranges">[\s\S]*?id="searchInput"[\s\S]*?recuo-filter[\s\S]*?vida-filter[\s\S]*?ataque-filter[\s\S]*?custo-ataque-filter/);
assert.match(html, /class="filter-column filter-column-selects">[\s\S]*?id="tipoFilter"[\s\S]*?id="formatoFilter"/);
const mobileRangeColumn = html.slice(html.indexOf('class="filter-column filter-column-ranges"'), html.indexOf('class="filter-column filter-column-selects"'));
assert.ok(mobileRangeColumn.indexOf('custo-ataque-filter') < mobileRangeColumn.indexOf('sort-row-bottom'));
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.filter-column-ranges\s*\{\s*grid-column: 1;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.filter-column-selects\s*\{\s*grid-column: 2;/);
assert.match(css, /\.filter-column-selects \.multi-dd-trigger > span,[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
assert.match(css, /\.sort-inline \.single-dd-trigger > span\s*\{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.sort-inline\s*\{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
assert.match(css, /\.sort-inline \.single-dd-trigger\s*\{[\s\S]*?min-width: 0;[\s\S]*?overflow: hidden;/);
assert.match(css, /\.single-dd\[data-for="sortField"\],[\s\S]*?\.single-dd\[data-for="sortDir"\][\s\S]*?width: 100%;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.card-layout-control > span\s*\{\s*display: none;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.toggle-row \.card-state-filter\s*\{[\s\S]*?font-size: 0;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.toggle-row\s*\{[\s\S]*?flex-wrap: nowrap;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.card-layout-button\s*\{[\s\S]*?width: 32px;[\s\S]*?height: 32px;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.range-inline\s*\{[\s\S]*?grid-template-columns: 24px minmax\(0, 1fr\) 30px;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.range-value\s*\{[\s\S]*?white-space: nowrap;/);
assert.match(css, /\.cards-grid\.cards-layout-image-compact/);
assert.match(css, /\.card\.image-compact img/);
assert.match(css, /\.cards-grid\.cards-layout-details-side/);
assert.match(css, /\.card\.details-side > img/);
assert.match(css, /\.card\.details-side \.card-info-list/);
assert.match(css, /\.card\.details-side \.card-actions/);

console.log("Layouts de cartas: testes concluidos com sucesso.");
