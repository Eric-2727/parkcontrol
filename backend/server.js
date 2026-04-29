require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

const authRoutes      = require('./routes/auth');
const registrosRoutes = require('./routes/registros');
const tarifasRoutes   = require('./routes/tarifas');
const usuariosRoutes  = require('./routes/usuarios');
const reportesRoutes  = require('./routes/reportes');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev_secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   8 * 60 * 60 * 1000
  }
}));

app.use('/api/auth',      authRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/tarifas',   tarifasRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/reportes',  reportesRoutes);

const frontendDist = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`\n🚗 ParkControl → http://localhost:${PORT}`));
}

module.exports = app;