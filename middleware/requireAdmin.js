// Blocks a request unless the current session was authenticated via
// POST /api/admin/login. Used in front of every admin-only route.
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ error: 'Not logged in.' });
}

module.exports = requireAdmin;
