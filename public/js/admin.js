const loginView = document.getElementById('login-view');
const pendingView = document.getElementById('pending-view');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const pendingList = document.getElementById('pending-list');

function showLoggedIn() {
  loginView.style.display = 'none';
  pendingView.style.display = 'block';
  loadPending();
}

function showLoggedOut() {
  loginView.style.display = 'block';
  pendingView.style.display = 'none';
}

async function checkStatus() {
  try {
    const status = await apiGet('/api/admin/status');
    if (status.authenticated) showLoggedIn();
    else showLoggedOut();
  } catch {
    showLoggedOut();
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  document.getElementById('field-password').classList.remove('has-error');
  loginMessage.className = 'form-message';

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  try {
    const res = await fetch((window.APP_CONFIG?.API_BASE_URL || '') + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Login failed.');
    loginForm.reset();
    showLoggedIn();
  } catch (err) {
    document.getElementById('field-password').classList.add('has-error');
    loginMessage.textContent = err.message;
    loginMessage.className = 'form-message error';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log in';
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await apiPost('/api/admin/logout');
  } catch { /* ignore — we're logging out regardless */ }
  showLoggedOut();
});

async function loadPending() {
  try {
    const rows = await apiGet('/api/admin/pending');
    if (rows.length === 0) {
      pendingList.innerHTML = '<p style="color:var(--ink-soft);">Nothing waiting for review.</p>';
      return;
    }
    pendingList.innerHTML = '';
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <div>
          <div class="title">${escapeHtml(r.title)}</div>
          <div class="meta">${r.prep_time ? r.prep_time + ' min · ' : ''}submitted ${escapeHtml(r.created_at)}</div>
        </div>
        <button class="btn btn-primary">Approve</button>
      `;
      row.querySelector('button').addEventListener('click', async (e) => {
        e.target.disabled = true;
        e.target.textContent = 'Approving…';
        try {
          await apiPost(`/api/admin/approve/${r.id}`);
          row.remove();
        } catch (err) {
          if (err.message.includes('logged in') || err.message.includes('Not logged in')) {
            showLoggedOut();
          } else {
            alert(err.message);
            e.target.disabled = false;
            e.target.textContent = 'Approve';
          }
        }
      });
      pendingList.appendChild(row);
    });
  } catch (err) {
    pendingList.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

checkStatus();
