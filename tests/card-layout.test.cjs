const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const layouts = ["details-bottom", "image-only", "image-compact", "details-side"];

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
assert.match(css, /\.cards-grid\.cards-layout-image-compact/);
assert.match(css, /\.card\.image-compact img/);
assert.match(css, /\.cards-grid\.cards-layout-details-side/);
assert.match(css, /\.card\.details-side > img/);
assert.match(css, /\.card\.details-side \.card-info-list/);
assert.match(css, /\.card\.details-side \.card-actions/);

console.log("Layouts de cartas: testes concluidos com sucesso.");
