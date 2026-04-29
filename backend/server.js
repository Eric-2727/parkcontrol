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

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProd
    ? process.env.FRONTEND_URL || true
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'parkcontrol_dev_secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge:   8 * 60 * 60 * 1000
  }
}));

app.use('/api/auth',      authRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/tarifas',   tarifasRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/reportes',  reportesRoutes);

// Production: serve React build
const frontendDist = path.join(__dirname, '..', 'dist');
if (isProd) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({
    message: 'ParkControl API – development mode',
    frontend: 'http://localhost:5173'
  }));
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`\n🚗 ParkControl API → http://localhost:${PORT}`);
  console.log(`   Modo: ${isProd ? 'producción' : 'desarrollo'}`);
  if (!isProd) console.log(`   React: http://localhost:5173`);
  console.log('');
});

module.exports = app;
