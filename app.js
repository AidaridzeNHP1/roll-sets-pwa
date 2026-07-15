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

  for (const ingredient of recipe.ingredients) {
    const row = parseIngredient(ingredient);
    groups[row.section].push(row);
  }

  return groups;
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
