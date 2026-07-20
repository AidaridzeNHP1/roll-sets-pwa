const state = {
  sets: [],
  recipes: [],
  route: { name: "sets" },
  query: "",
  tab: "sets"
};

const content = document.querySelector("#content");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const backButton = document.querySelector("#backButton");
const screenTitle = document.querySelector("#screenTitle");
const sectionLabel = document.querySelector("#sectionLabel");
const setsCount = document.querySelector("#setsCount");
const recipesCount = document.querySelector("#recipesCount");

const categoryOrder = ["Запеченные", "Холодные", "Темпура", "Поке", "Суши-тако", "Ёнигири"];
const rollTabCategories = ["Запеченные", "Холодные", "Темпура"];

const normalize = (value) => String(value)
  .toLowerCase()
  .replaceAll("ё", "е")
  .replaceAll("big", "биг")
  .replace(/[«»"]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const recipeAliases = {
  "запеченная филадельфия с л и к": "Запеченная Филадельфия с лососем и крабом",
  "запеченная филадельфия с лососем": "Запеченная Филадельфия с лососем",
  "запеченная филадельфия с лососем и крабом": "Запеченная Филадельфия с лососем и крабом",
  "запеченный с жаренным лососем": "Запеченный с жаренным лососем",
  "запеченный с крабом": "Запеченный с крабом",
  "запеченный с курицей": "Запеченный с курицей",
  "запеченный с лососем": "Запеченный с лососем",
  "запеченный с лососем и спайси": "Запеченный с лососем спайси",
  "манхэттен": "Манхеттен",
  "филадельфия роял": "Филадельфия «РОЯЛ»",
  "запеченный с креветкой": "Запеченный с креветкой",
  "лава краб спайси": "Лава Краб Спайс",
  "том ям": "Том Ям Ролл"
};

const multiRecipeAliases = {
  "краб терияки": ["Краб Терияки Нью", "Сочный Краб Терияки"]
};

const recipeWarnings = {
  "краб терияки": "Нужно уточнить: в рецептах есть два похожих варианта. Пока показаны оба рецепта."
};

function categoryRank(category) {
  const index = categoryOrder.findIndex((item) => normalize(item) === normalize(category));
  return index === -1 ? categoryOrder.length : index;
}

function recipeMatchesFor(rollName) {
  const key = normalize(rollName);
  const multi = multiRecipeAliases[key];
  if (multi) {
    return multi
      .map((name) => state.recipes.find((recipe) => normalize(recipe.name) === normalize(name)))
      .filter(Boolean);
  }

  const alias = recipeAliases[key];
  if (alias) {
    const recipe = state.recipes.find((item) => normalize(item.name) === normalize(alias));
    return recipe ? [recipe] : [];
  }

  const exact = state.recipes.find((recipe) => normalize(recipe.name) === key);
  if (exact) return [exact];

  const fuzzy = state.recipes.filter((recipe) => {
    const recipeName = normalize(recipe.name);
    return key.includes(recipeName) || recipeName.includes(key);
  });

  return fuzzy.length ? [fuzzy[0]] : [];
}

function primaryRecipeFor(rollName) {
  return recipeMatchesFor(rollName)[0] || null;
}

function warningFor(rollName) {
  return recipeWarnings[normalize(rollName)] || "";
}

function parseIngredient(rawIngredient) {
  const sectionMatch = rawIngredient.match(/^(Обвалка|Украшение):\s*(.+)$/);
  const section = sectionMatch ? sectionMatch[1] : "Состав";
  const text = sectionMatch ? sectionMatch[2] : rawIngredient;
  const amountMatch = text.match(/^(.*\S)\s+(\d+(?:,\d+)?)$/);

  return {
    section,
    name: amountMatch ? amountMatch[1] : text,
    amount: amountMatch ? amountMatch[2] : ""
  };
}

function groupedIngredients(recipe) {
  const groups = {
    "Состав": [],
    "Обвалка": [],
    "Украшение": []
  };

  for (const ingredient of recipe.ingredients || []) {
    const row = parseIngredient(ingredient);
    groups[row.section].push(row);
  }

  return groups;
}

function ensureTabs() {
  if (document.querySelector("#mainTabs")) return;
  const tabs = document.createElement("div");
  tabs.className = "main-tabs";
  tabs.id = "mainTabs";
  tabs.innerHTML = `
    <button class="main-tab" type="button" data-tab="sets">Сеты</button>
    <button class="main-tab" type="button" data-tab="rolls">Роллы</button>
  `;
  searchPanel.prepend(tabs);
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    state.tab = button.dataset.tab;
    state.route = { name: state.tab };
    state.query = "";
    searchInput.value = "";
    history.pushState(state.route, "", `#${state.tab}`);
    render();
  });
}

function updateTabs() {
  document.querySelectorAll(".main-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.tab);
  });
}

function makeRollChip(roll) {
  const chip = document.createElement("span");
  chip.className = "roll-chip";
  chip.innerHTML = `<span></span><b></b>`;
  chip.querySelector("span").textContent = roll[0];
  chip.querySelector("b").textContent = roll[1];
  return chip;
}

function makeSetCard(set) {
  const template = document.querySelector("#setCardTemplate").content.cloneNode(true);
  if (set.image) {
    const media = document.createElement("div");
    media.className = "set-media";
    media.innerHTML = `<img alt="">`;
    const image = media.querySelector("img");
    image.src = set.image;
    image.alt = set.name;
    template.querySelector(".set-open").before(media);
  }
  template.querySelector(".set-name").textContent = set.name;
  template.querySelector(".set-meta").textContent = `${set.output} · ${set.items.length} поз.`;
  template.querySelector(".set-open").addEventListener("click", () => navigate({ name: "set", set }));
  const preview = template.querySelector(".roll-preview");
  for (const roll of set.items.slice(0, 6)) preview.append(makeRollChip(roll));
  return template;
}

function renderSetsTab() {
  content.className = "content-list";
  searchPanel.hidden = false;
  backButton.hidden = true;
  state.tab = "sets";
  sectionLabel.textContent = "Сеты";
  screenTitle.textContent = "Сеты";
  searchInput.placeholder = "Найти сет или ролл";
  updateTabs();

  const query = normalize(state.query);
  const sets = query
    ? state.sets.filter((set) => normalize(set.name).includes(query) || set.items.some((roll) => normalize(roll[0]).includes(query)))
    : state.sets;

  content.replaceChildren();

  if (!sets.length) {
    content.append(emptyState("Ничего не найдено", "Попробуйте другое название сета или ролла."));
    return;
  }

  for (const set of sets) content.append(makeSetCard(set));
}

function setRollsInRecipeOrder(set) {
  return [...set.items].sort((a, b) => {
    const recipeA = primaryRecipeFor(a[0]);
    const recipeB = primaryRecipeFor(b[0]);
    const rankDiff = categoryRank(recipeA?.category || "") - categoryRank(recipeB?.category || "");
    if (rankDiff !== 0) return rankDiff;
    return normalize(a[0]).localeCompare(normalize(b[0]));
  });
}

function renderSet(set) {
  content.className = "content-list detail-mode";
  searchPanel.hidden = true;
  backButton.hidden = false;
  sectionLabel.textContent = "Сет";
  screenTitle.textContent = set.name;

  const head = document.createElement("article");
  head.className = "detail-head";
  head.innerHTML = `<h2></h2><p></p>`;
  head.querySelector("h2").textContent = set.name;
  head.querySelector("p").textContent = `${set.output} · ${set.items.length} позиций`;

  if (set.image) {
    const image = document.createElement("img");
    image.className = "detail-image";
    image.src = set.image;
    image.alt = set.name;
    head.prepend(image);
  }

  const list = document.createElement("section");
  list.className = "recipe-stack";
  for (const roll of setRollsInRecipeOrder(set)) list.append(makeRollRecipePanel(roll[0], roll[1]));

  content.replaceChildren(head, list);
}

function renderRollsTab() {
  content.className = "content-list detail-mode";
  searchPanel.hidden = false;
  backButton.hidden = true;
  state.tab = "rolls";
  sectionLabel.textContent = "Роллы";
  screenTitle.textContent = "Роллы";
  searchInput.placeholder = "Найти ролл";
  updateTabs();
  content.replaceChildren();

  const query = normalize(state.query);
  const mainSection = document.createElement("section");
  mainSection.className = "catalog-section";
  mainSection.innerHTML = `<h2>Роллы</h2>`;

  for (const category of rollTabCategories) {
    const recipes = state.recipes
      .filter((recipe) => normalize(recipe.category) === normalize(category))
      .filter((recipe) => !query || normalize(recipe.name).includes(query))
      .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));

    if (!recipes.length && query) continue;

    const group = document.createElement("section");
    group.className = "category-section";
    group.innerHTML = `<h3></h3>`;
    group.querySelector("h3").textContent = category;
    const stack = document.createElement("div");
    stack.className = "recipe-stack";
    for (const recipe of recipes) stack.append(makeRollRecipePanel(recipe.name, "1", [recipe]));
    if (!recipes.length) stack.append(emptyState("Пока пусто", `В категории «${category}» пока нет рецептов.`));
    group.append(stack);
    mainSection.append(group);
  }

  const futureSection = document.createElement("section");
  futureSection.className = "catalog-section";
  futureSection.innerHTML = `
    <h2>Поке, суши-тако, ёнигири</h2>
  `;
  futureSection.append(emptyState("Пока пусто", "Рецепты для этого раздела можно добавить позже."));

  content.append(mainSection, futureSection);
}

function makeRollRecipePanel(rollName, quantity = "1", forcedRecipes = null) {
  const panel = document.createElement("article");
  panel.className = "roll-recipe-panel";
  const title = document.createElement("div");
  title.className = "roll-panel-title";
  title.innerHTML = `<span></span><b></b>`;
  title.querySelector("span").textContent = rollName;
  title.querySelector("b").textContent = quantity;
  panel.append(title);

  const warning = warningFor(rollName);
  if (warning) {
    const warningBox = document.createElement("div");
    warningBox.className = "recipe-warning panel-warning";
    warningBox.textContent = warning;
    panel.append(warningBox);
  }

  const recipes = forcedRecipes || recipeMatchesFor(rollName);
  if (!recipes.length) {
    panel.append(emptyState("Состав не найден", `Для «${rollName}» нет точного совпадения в recipes.json.`));
    return panel;
  }

  for (const recipe of recipes) panel.append(makeRecipeCard(recipe));
  return panel;
}

function makeRecipeCard(recipe) {
  const card = document.createElement("article");
  card.className = "recipe-card";
  card.innerHTML = `
    <header class="recipe-title"></header>
    <div class="recipe-layout">
      <aside class="recipe-visual" aria-hidden="true">
        <img src="assets/roll-mark.svg" alt="">
        <div class="recipe-stamp"></div>
      </aside>
      <div class="recipe-tables"></div>
    </div>
  `;
  card.querySelector(".recipe-title").textContent = recipe.name;
  card.querySelector(".recipe-stamp").textContent = recipe.category;
  const recipeImage = card.querySelector(".recipe-visual img");
  recipeImage.src = recipe.image || "assets/roll-mark.svg";
  recipeImage.alt = recipe.image ? recipe.name : "";

  const tables = card.querySelector(".recipe-tables");
  const groups = groupedIngredients(recipe);
  for (const sectionName of ["Состав", "Обвалка", "Украшение"]) {
    const rows = groups[sectionName];
    if (!rows.length) continue;

    const table = document.createElement("table");
    table.className = "recipe-table";
    table.innerHTML = `
      <thead>
        <tr><th colspan="2"></th></tr>
      </thead>
      <tbody></tbody>
    `;
    table.querySelector("th").textContent = sectionName;
    const tbody = table.querySelector("tbody");

    for (const row of rows) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      const amount = document.createElement("td");
      name.textContent = row.name;
      amount.textContent = row.amount;
      tr.append(name, amount);
      tbody.append(tr);
    }
    tables.append(table);
  }

  const outputTable = document.createElement("table");
  outputTable.className = "recipe-table output-table";
  outputTable.innerHTML = `
    <tbody>
      <tr>
        <td>Выход</td>
        <td></td>
      </tr>
    </tbody>
  `;
  outputTable.querySelector("td:last-child").textContent = recipe.output || "-";
  tables.append(outputTable);

  if (recipe.page) {
    const source = document.createElement("p");
    source.className = "recipe-source";
    source.textContent = `Источник: ${recipe.category}, стр. ${recipe.page}`;
    tables.append(source);
  }

  return card;
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
  history.pushState(route, "", route.name === "sets" ? "#sets" : `#${route.name}`);
  render();
}

function render() {
  if (state.route.name === "set") renderSet(state.route.set);
  else if (state.route.name === "rolls") renderRollsTab();
  else renderSetsTab();
}

async function init() {
  ensureTabs();
  const [sets, recipes] = await Promise.all([
    fetch("sets.json").then((response) => response.json()),
    fetch("recipes.json").then((response) => response.json())
  ]);
  state.sets = sets;
  state.recipes = recipes;
  setsCount.textContent = `${sets.length} сетов`;
  recipesCount.textContent = `${recipes.length} рецептов`;
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  if (state.route.name === "set") return;
  state.route = { name: state.tab };
  render();
});

backButton.addEventListener("click", () => {
  state.route = { name: "sets" };
  history.pushState(state.route, "", "#sets");
  render();
});

window.addEventListener("popstate", () => {
  state.route = { name: "sets" };
  state.tab = "sets";
  render();
});

init().catch(() => {
  content.append(emptyState("Не удалось загрузить данные", "Проверьте, что рядом с index.html лежат sets.json и recipes.json."));
});
