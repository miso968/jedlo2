// Ingredient checklist search with live autocomplete + ranked results.
const selectedIngredients = [];

const chipWrap = document.getElementById('checklist');
const input = document.getElementById('ingredient-input');
const autocompleteList = document.getElementById('autocomplete-list');
const resultsEl = document.getElementById('recipes-list');
const searchBtn = document.getElementById('search-btn');

function renderChips() {
  chipWrap.innerHTML = '';
  selectedIngredients.forEach((name, idx) => {
    const row = document.createElement('div');
    row.className = 'check-row';
    row.innerHTML = `<span class="mark">✓</span><span class="name">${escapeHtml(name)}</span><button type="button" aria-label="Remove ${escapeHtml(name)}">&times;</button>`;
    row.querySelector('button').addEventListener('click', () => {
      selectedIngredients.splice(idx, 1);
      renderChips();
    });
    chipWrap.appendChild(row);
  });
}

function addIngredient(name) {
  const clean = name.trim();
  if (!clean) return;
  if (!selectedIngredients.includes(clean.toLowerCase())) {
    selectedIngredients.push(clean.toLowerCase());
  }
  input.value = '';
  autocompleteList.innerHTML = '';
  renderChips();
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addIngredient(input.value);
  } else if (e.key === 'Backspace' && input.value === '' && selectedIngredients.length) {
    selectedIngredients.pop();
    renderChips();
  }
});

let debounceTimer;
input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();
  if (!q) { autocompleteList.innerHTML = ''; return; }
  debounceTimer = setTimeout(async () => {
    try {
      const suggestions = await apiGet(`/api/ingredients/suggest?q=${encodeURIComponent(q)}`);
      autocompleteList.innerHTML = '';
      suggestions.forEach(name => {
        const item = document.createElement('div');
        item.textContent = name;
        item.addEventListener('click', () => addIngredient(name));
        autocompleteList.appendChild(item);
      });
    } catch {
      autocompleteList.innerHTML = '';
    }
  }, 200);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.chip-input-wrap') && !e.target.closest('.autocomplete-items')) {
    autocompleteList.innerHTML = '';
  }
});

function renderMatchMeter(matched, total) {
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const ringColor = pct >= 100 ? 'var(--herb)' : 'var(--turmeric)';
  return `
    <div class="jar-cap" style="background:conic-gradient(${ringColor} ${pct}%, var(--surface-hi) 0)">
      <div class="jar-cap-inner">${matched}/${total}</div>
    </div>`;
}

function renderRecipes(recipes, { withMatch } = {}) {
  if (recipes.length === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="14" y="18" width="24" height="26" rx="4" stroke="var(--ink-soft)" stroke-width="2"/>
          <path d="M20 18v-4a6 6 0 0 1 12 0v4" stroke="var(--ink-soft)" stroke-width="2"/>
          <circle cx="26" cy="30" r="4" stroke="var(--turmeric)" stroke-width="2"/>
        </svg>
        <div>No recipes found for those ingredients yet. Try removing one, or <a href="/add-recipe.html">add your own</a>.</div>
      </div>`;
    return;
  }
  resultsEl.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'recipe-grid';

  recipes.forEach(r => {
    const card = document.createElement('a');
    card.className = 'recipe-card';
    card.href = `/recipe.html?id=${r.id}`;
    card.innerHTML = `
      <div class="img-wrap">
        <img src="${escapeHtml(resolveImage(r.image))}" alt="${escapeHtml(r.title)}" onerror="this.onerror=null;this.src='uploads/default.png'">
        ${withMatch ? renderMatchMeter(r.matched_count, r.total_count) : ''}
      </div>
      <div class="body">
        <h3>${escapeHtml(r.title)}</h3>
        <div class="meta">${r.prep_time ? r.prep_time + ' min' : 'Prep time not listed'}</div>
      </div>
    `;
    grid.appendChild(card);
  });
  resultsEl.appendChild(grid);
}

async function runSearch() {
  if (selectedIngredients.length === 0) {
    loadAllRecipes();
    return;
  }
  resultsEl.innerHTML = '<div class="empty-state">Searching…</div>';
  try {
    const recipes = await apiGet(`/api/recipes?ingredients=${encodeURIComponent(selectedIngredients.join(','))}`);
    renderRecipes(recipes, { withMatch: true });
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadAllRecipes() {
  try {
    const recipes = await apiGet('/api/recipes');
    renderRecipes(recipes, { withMatch: false });
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

searchBtn.addEventListener('click', runSearch);

// Support ?ingredients=a,b,c deep links (e.g. shared search results)
const params = new URLSearchParams(window.location.search);
const preset = params.get('ingredients');
if (preset) {
  preset.split(',').forEach(name => addIngredient(name));
  runSearch();
} else {
  loadAllRecipes();
}
