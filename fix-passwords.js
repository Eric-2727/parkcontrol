// fix-passwords.js
// Ejecutar: node fix-passwords.js
// Corrige los hashes de contraseña en la BD

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function fixPasswords() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'parkcontrol',
  });

  console.log('✔ Conectado a MySQL');

  const usuarios = [
    { email: 'admin@park.com',    password: 'admin123' },
    { email: 'operario@park.com', password: 'op123'    },
  ];

  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.password, 10);
    await conn.query(
      'UPDATE usuarios SET password_hash = ? WHERE email = ?',
      [hash, u.email]
    );
    console.log(`✔ Contraseña actualizada: ${u.email}`);
  }

  console.log('\n─────────────────────────────────────');
  console.log(' Contraseñas corregidas exitosamente ');
  console.log('─────────────────────────────────────');
  console.log(' admin@park.com    →  admin123        ');
  console.log(' operario@park.com →  op123           ');
  console.log('─────────────────────────────────────');
  console.log('\nYa puedes iniciar sesión en http://localhost:5173');

  await conn.end();
}

fixPasswords().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
