const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cards = JSON.parse(
  fs.readFileSync(path.join(root, "data", "consolidated", "cards-adapted.json"), "utf8")
);
const byId = new Map(cards.map((card) => [card.id, card]));

const babyCards = cards.filter((card) => card.estagio === "baby");
assert.ok(babyCards.length > 0, "o catálogo deve conter cartas Baby");
assert.ok(
  babyCards.every((card) => card.tags.includes("baby") && card.tags.includes("basic")),
  "cartas Baby devem aparecer nos filtros Baby e Básico"
);

const inflatableBoat = byId.get("a4a-067");
assert.equal(inflatableBoat?.subtipo, "ferramenta");
assert.equal(inflatableBoat?.estagio, "ferramenta");
assert.ok(inflatableBoat?.tags.includes("ferramenta"));

const goldenElectricGenerator = byId.get("b2a-131");
assert.equal(goldenElectricGenerator?.subtipo, "item");
assert.equal(goldenElectricGenerator?.estagio, "item");
assert.deepEqual(goldenElectricGenerator?.tags, ["item"]);

const fossilCards = cards.filter((card) =>
  card.categoria === "Treinador"
  && (/f[oó]ssil|fossil|âmbar velho|ambar velho|old amber/i.test(`${card.nome} ${card.sourceId}`)
    || card.tags.includes("fossil"))
);
assert.ok(fossilCards.length > 0, "o catálogo deve conter cartas Fóssil");
assert.ok(
  fossilCards.every((card) =>
    card.subtipo === "fossil"
    && card.estagio === "fossil"
    && card.tags.length === 1
    && card.tags[0] === "fossil"
  ),
  "todas as cartas Fóssil devem possuir somente a classificação fossil"
);

assert.equal(byId.get("b4-005")?.estagio, "2", "Dustox B4 deve ser Estágio 2");

const corrections = JSON.parse(
  fs.readFileSync(path.join(root, "data", "card-corrections.json"), "utf8")
);
for (const [key, expectedStage] of Object.entries(corrections.stage || {})) {
  const [setCode, number] = key.split("#");
  const id = `${setCode.toLowerCase()}-${String(number).padStart(3, "0")}`;
  const normalizedStage = expectedStage.endsWith(" 1") ? "1" : expectedStage.endsWith(" 2") ? "2" : "baby";
  assert.equal(byId.get(id)?.estagio, normalizedStage, `${id} deve respeitar a correção de estágio`);
}

const evolutionData = JSON.parse(
  fs.readFileSync(path.join(root, "data", "evolutions.json"), "utf8")
);
for (const [key, expectedStage] of Object.entries(evolutionData.cardStages || {})) {
  const [setCode, number] = key.split("#");
  const id = `${setCode.toLowerCase()}-${String(number).padStart(3, "0")}`;
  const card = byId.get(id);
  assert.ok(card, `${id} deve existir para validar o estágio evolutivo`);
  if (card.estagio !== "baby") {
    assert.equal(card.estagio, expectedStage, `${id} deve respeitar sua família evolutiva`);
  }
}

for (const id of ["promo-b-088", "promo-b-089", "promo-b-090", "promo-b-091", "promo-b-093"]) {
  const card = byId.get(id);
  assert.ok(card, `${id} deve existir no catálogo`);
  const imagePath = path.resolve(root, String(card.imageLocal).replace(/^\.\//, ""));
  assert.ok(fs.existsSync(imagePath), `${id} deve possuir imagem local`);
  assert.ok(fs.statSync(imagePath).size > 0, `${id} não pode possuir imagem vazia`);
}

console.log(`card-data-quality: ok (${babyCards.length} cartas Baby)`);
