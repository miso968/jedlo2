const root = document.getElementById('recipe-root');
const params = new URLSearchParams(window.location.search);
const id = params.get('id');

async function load() {
  if (!id) {
    root.innerHTML = '<p>No recipe specified. <a href="/index.html">Back to search</a></p>';
    return;
  }
  try {
    const recipe = await apiGet(`/api/recipes/${encodeURIComponent(id)}`);
    document.title = `${recipe.title} — Pantry.Finder`;

    const ingredientItems = recipe.ingredients.map(ing => `
      <li>
        <span>${escapeHtml(ing.name)}</span>
        <span class="amount">${escapeHtml([ing.amount, ing.unit].filter(Boolean).join(' '))}</span>
      </li>
    `).join('');

    root.innerHTML = `
      <img class="hero-img" src="${escapeHtml(resolveImage(recipe.image))}" alt="${escapeHtml(recipe.title)}" onerror="this.onerror=null;this.src='uploads/default.png'">
      <h1>${escapeHtml(recipe.title)}</h1>
      <div class="prep-time">${recipe.prep_time ? recipe.prep_time + ' min prep time' : 'Prep time not listed'}</div>

      <h2>Ingredients</h2>
      <ul class="ingredient-list">${ingredientItems}</ul>

      <h2>Instructions</h2>
      <p class="instructions">${escapeHtml(recipe.instructions)}</p>

      <a href="/index.html" class="back-link">&larr; Back to search</a>
    `;
  } catch (err) {
    root.innerHTML = `<p>${escapeHtml(err.message)} — <a href="/index.html">back to search</a></p>`;
  }
}

load();
