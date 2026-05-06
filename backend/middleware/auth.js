const jwt    = require('jsonwebtoken');
const SECRET = process.env.SESSION_SECRET || 'parkcontrol_secret';

function getToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.split(' ')[1];
  return null;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token inválido.' }); }
}

function requireAdmin(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No autorizado.' });
  try {
    const user = jwt.verify(token, SECRET);
    if (user.rol !== 'admin') return res.status(403).json({ error: 'Se requiere administrador.' });
    req.user = user;
    next();
  } catch { return res.status(401).json({ error: 'Token inválido.' }); }
}

module.exports = { requireAuth, requireAdmin };