// API_BASE is empty when the app is served by the same server it calls
// (normal web use). For the Capacitor mobile app, config.js sets this to
// the full URL of your hosted backend (e.g. https://your-api.example.com),
// since the app itself is not served from that server.
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';

// Small shared wrapper around fetch() so every page handles API errors the same way.
async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiPostForm(path, formData) {
  const res = await fetch(API_BASE + path, { method: 'POST', body: formData });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

async function apiPost(path) {
  const res = await fetch(API_BASE + path, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// Recipe photos live on the backend (e.g. "/uploads/img_123.jpg"). On the
// web this is served by the same origin, so a relative path just works.
// In the packaged mobile app there is no same origin — prefix with API_BASE.
function resolveImage(imagePath) {
  if (!imagePath) return 'uploads/default.png';
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  return API_BASE + imagePath;
}
