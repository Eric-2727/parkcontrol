// ============================================================
//  ParkControl – Conexión a MySQL
// ============================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

// Solo validar host, user y name (password puede ser vacía en dev)
const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
required.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Variable de entorno faltante: ${key}`);
    console.error('   Revisa el archivo .env');
    process.exit(1);
  }
});

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',   // vacío = sin contraseña
  database:           process.env.DB_NAME     || 'parkcontrol',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '-05:00',
});

// Verificar conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log(`✔ MySQL conectado → ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error al conectar con MySQL:', err.message);
    console.error('   Verifica: host, usuario, contraseña y que MySQL esté corriendo.');
    process.exit(1);
  });

module.exports = pool;