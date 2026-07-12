const state = {
  sets: [],
  recipes: [],
  route: { name: "home" },
  query: ""
};

const content = document.querySelector("#content");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const backButton = document.querySelector("#backButton");
const screenTitle = document.querySelector("#screenTitle");
const sectionLabel = document.querySelector("#sectionLabel");
const setsCount = document.querySelector("#setsCount");
const recipesCount = document.querySelector("#recipesCount");

const normalize = (value) => String(value)
  .toLowerCase()
  .replaceAll("ё", "е")
  .replaceAll("big", "биг")
  .replace(/\s+/g, " ")
  .trim();

function recipeFor(rollName) {
  const key = normalize(rollName);
  return state.recipes.find((recipe) => normalize(recipe.name) === key)
    || state.recipes.find((recipe) => key.includes(normalize(recipe.name)) || normalize(recipe.name).includes(key));
}

function makeRollButton(roll) {
  const template = document.querySelector("#rollPillTemplate").content.cloneNode(true);
  const button = template.querySelector(".roll-pill");
  template.querySelector(".roll-name").textContent = roll[0];
  template.querySelector(".roll-quantity").textContent = roll[1];
  button.addEventListener("click", () => navigate({ name: "recipe", roll }));
  return template;
}

function renderHome() {
  content.className = "content-list";
  searchPanel.hidden = false;
  backButton.hidden = true;
  sectionLabel.textContent = "Каталог";
  screenTitle.textContent = "Наборы роллов";

  const query = normalize(state.query);
  const sets = query
    ? state.sets.filter((set) => normalize(set.name).includes(query) || set.items.some((roll) => normalize(roll[0]).includes(query)))
    : state.sets;

  content.replaceChildren();

  if (!sets.length) {
    content.append(emptyState("Ничего не найдено", "Попробуйте другое название набора или ролла."));
    return;
  }

  for (const set of sets) {
    const template = document.querySelector("#setCardTemplate").content.cloneNode(true);
    template.querySelector(".set-name").textContent = set.name;
    template.querySelector(".set-meta").textContent = `${set.output} · ${set.items.length} поз.`;
    template.querySelector(".set-open").addEventListener("click", () => navigate({ name: "set", set }));
    const preview = template.querySelector(".roll-preview");
    for (const roll of set.items.slice(0, 6)) preview.append(makeRollButton(roll));
    content.append(template);
  }
}

function renderSet(set) {
  content.className = "content-list detail-mode";
  searchPanel.hidden = true;
  backButton.hidden = false;
  sectionLabel.textContent = "Набор";
  screenTitle.textContent = set.name;

  const head = document.createElement("article");
  head.className = "detail-head";
  head.innerHTML = `<h2></h2><p></p>`;
  head.querySelector("h2").textContent = set.name;
  head.querySelector("p").textContent = `${set.output} · ${set.items.length} позиций`;

  const list = document.createElement("section");
  list.className = "roll-list";
  for (const roll of set.items) list.append(makeRollButton(roll));

  content.replaceChildren(head, list);
}

function renderRecipe(roll) {
  const recipe = recipeFor(roll[0]);
  content.className = "content-list detail-mode";
  searchPanel.hidden = true;
  backButton.hidden = false;
  sectionLabel.textContent = "Состав";
  screenTitle.textContent = recipe?.name || roll[0];
  content.replaceChildren();

  if (!recipe) {
    content.append(emptyState("Состав не найден", `Для «${roll[0]}» нет точного совпадения в извлеченных ТТК. Его можно добавить в recipes.json.`));
    return;
  }

  const card = document.createElement("article");
  card.className = "recipe-card";
  const meta = [
    recipe.category,
    recipe.output ? `Выход ${recipe.output} г` : "",
    `стр. ${recipe.page}`
  ].filter(Boolean);
  card.innerHTML = `
    <h2></h2>
    <div class="recipe-meta"></div>
    <ul class="ingredient-list"></ul>
  `;
  card.querySelector("h2").textContent = recipe.name;
  const metaBox = card.querySelector(".recipe-meta");
  for (const item of meta) {
    const span = document.createElement("span");
    span.textContent = item;
    metaBox.append(span);
  }
  const list = card.querySelector(".ingredient-list");
  for (const ingredient of recipe.ingredients) {
    const li = document.createElement("li");
    li.textContent = ingredient;
    list.append(li);
  }
  content.append(card);
}

function emptyState(title, text) {
  const box = document.createElement("article");
  box.className = "empty-state";
  box.innerHTML = `<strong></strong><span></span>`;
  box.querySelector("strong").textContent = title;
  box.querySelector("span").textContent = text;
  return box;
}

function navigate(route) {
  state.route = route;
  history.pushState(route, "", route.name === "home" ? "#" : `#${route.name}`);
  render();
}

function render() {
  if (state.route.name === "set") renderSet(state.route.set);
  else if (state.route.name === "recipe") renderRecipe(state.route.roll);
  else renderHome();
}

async function init() {
  const [sets, recipes] = await Promise.all([
    fetch("sets.json").then((response) => response.json()),
    fetch("recipes.json").then((response) => response.json())
  ]);
  state.sets = sets;
  state.recipes = recipes;
  setsCount.textContent = `${sets.length} наборов`;
  recipesCount.textContent = `${recipes.length} составов`;
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.route = { name: "home" };
  renderHome();
});

backButton.addEventListener("click", () => history.back());

window.addEventListener("popstate", () => {
  state.route = { name: "home" };
  render();
});

init().catch(() => {
  content.append(emptyState("Не удалось загрузить данные", "Проверьте, что рядом с index.html лежат sets.json и recipes.json."));
});
