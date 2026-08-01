// For normal web use, leave this empty — the app is served by the same
// server it calls, so relative paths ("/api/...") already work.
//
// For the Capacitor mobile app, set this to the full URL of your hosted
// backend, e.g.:
//   window.APP_CONFIG = { API_BASE_URL: 'https://your-api.example.com' };
// The app bundle has no "same origin" to call, so every request needs the
// full address of a backend that's actually reachable from the phone.
window.APP_CONFIG = {
  API_BASE_URL: 'https://jedlo2.onrender.com',
};
