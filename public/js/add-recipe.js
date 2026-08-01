// Handles the dynamic ingredient rows and form submission for add-recipe.html.

const rowsWrap = document.getElementById('ingredient-rows');
const addRowBtn = document.getElementById('add-row-btn');
const form = document.getElementById('recipe-form');
const messageEl = document.getElementById('form-message');
const submitBtn = document.getElementById('submit-btn');

let rowId = 0;

function addIngredientRow(prefill = {}) {
  rowId += 1;
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <input type="text" placeholder="Ingredient (e.g. garlic)" class="ing-name" value="${escapeHtml(prefill.name || '')}" />
    <input type="text" placeholder="Amount (e.g. 2)" class="ing-amount" value="${escapeHtml(prefill.amount || '')}" />
    <input type="text" placeholder="Unit (e.g. cloves)" class="ing-unit" value="${escapeHtml(prefill.unit || '')}" />
    <button type="button" class="remove-row" title="Remove ingredient">&times;</button>
  `;
  row.querySelector('.remove-row').addEventListener('click', () => {
    // Always keep at least one row on screen
    if (rowsWrap.children.length > 1) row.remove();
  });
  rowsWrap.appendChild(row);
}

addRowBtn.addEventListener('click', () => addIngredientRow());
addIngredientRow(); // start with one empty row

function collectIngredients() {
  return Array.from(rowsWrap.querySelectorAll('.ingredient-row')).map(row => ({
    name: row.querySelector('.ing-name').value.trim(),
    amount: row.querySelector('.ing-amount').value.trim(),
    unit: row.querySelector('.ing-unit').value.trim(),
  })).filter(i => i.name);
}

function setFieldError(fieldId, hasError) {
  document.getElementById(fieldId).classList.toggle('has-error', hasError);
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message ${type}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.className = 'form-message';

  const title = document.getElementById('title').value.trim();
  const instructions = document.getElementById('instructions').value.trim();
  const ingredients = collectIngredients();
  const ingredientsErrorEl = document.getElementById('ingredients-error');

  let valid = true;
  setFieldError('field-title', !title);
  if (!title) valid = false;

  setFieldError('field-instructions', !instructions);
  if (!instructions) valid = false;

  const noIngredients = ingredients.length === 0;
  ingredientsErrorEl.style.display = noIngredients ? 'block' : 'none';
  if (noIngredients) valid = false;

  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('instructions', instructions);
    formData.append('website', document.getElementById('website').value); // honeypot
    const prepTime = document.getElementById('prep_time').value;
    if (prepTime) formData.append('prep_time', prepTime);
    formData.append('ingredients', JSON.stringify(ingredients));
    const imageFile = document.getElementById('image').files[0];
    if (imageFile) formData.append('image', imageFile);

    const result = await apiPostForm('/api/recipes', formData);
    showMessage(result.message || 'Recipe submitted for review!', 'success');
    form.reset();
    rowsWrap.innerHTML = '';
    addIngredientRow();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit recipe';
  }
});
