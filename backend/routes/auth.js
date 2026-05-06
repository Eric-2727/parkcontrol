const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');

const SECRET = process.env.SESSION_SECRET || 'parkcontrol_secret';

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos.' });

    const [rows] = await db.query(
      `SELECT u.*, r.nombre AS rol FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const user = rows[0];
    if (!user.activo) return res.status(401).json({ error: 'Usuario inactivo.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const payload = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    const token   = jwt.sign(payload, SECRET, { expiresIn: '8h' });
    return res.json({ ok: true, token, user: payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

router.post('/logout', (req, res) => res.json({ ok: true }));

router.get('/me', (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'No autenticado.' });
  try {
    const user = jwt.verify(auth.split(' ')[1], SECRET);
    res.json({ ok: true, user });
  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
});

module.exports = router;