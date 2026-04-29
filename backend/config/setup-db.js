/**
 * ParkControl – Setup de Base de Datos
 * Ejecutar: node backend/config/setup-db.js
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setup() {
  // Conectar sin seleccionar BD para poder crearla
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  console.log('✔ Conectado a MySQL');

  // Crear base de datos
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'parkcontrol'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`USE \`${process.env.DB_NAME || 'parkcontrol'}\`;`);
  console.log('✔ Base de datos creada/verificada');

  // ── TABLAS ──────────────────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      nombre      VARCHAR(50) NOT NULL UNIQUE,
      descripcion VARCHAR(200)
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      nombre         VARCHAR(100) NOT NULL,
      email          VARCHAR(150) NOT NULL UNIQUE,
      password_hash  VARCHAR(255) NOT NULL,
      rol_id         INT NOT NULL,
      activo         TINYINT(1) NOT NULL DEFAULT 1,
      fecha_creacion DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rol_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS tipos_vehiculo (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      nombre      VARCHAR(50) NOT NULL UNIQUE,
      descripcion VARCHAR(200),
      es_moto     TINYINT(1) NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS espacios (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      codigo           VARCHAR(10) NOT NULL UNIQUE,
      tipo_vehiculo_id INT NOT NULL,
      disponible       TINYINT(1) NOT NULL DEFAULT 1,
      FOREIGN KEY (tipo_vehiculo_id) REFERENCES tipos_vehiculo(id)
    );

    CREATE TABLE IF NOT EXISTS tarifas (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      tipo_vehiculo_id INT NOT NULL,
      nombre           VARCHAR(100) NOT NULL,
      tipo_cobro       ENUM('POR_MINUTO','POR_HORA','POR_DIA','FRACCION') NOT NULL DEFAULT 'POR_HORA',
      valor            DECIMAL(10,2) NOT NULL,
      activo           TINYINT(1)   NOT NULL DEFAULT 1,
      fecha_inicio     DATE         NOT NULL,
      fecha_fin        DATE,
      FOREIGN KEY (tipo_vehiculo_id) REFERENCES tipos_vehiculo(id)
    );

    CREATE TABLE IF NOT EXISTS registros (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      placa               VARCHAR(10)   NOT NULL,
      tipo_vehiculo_id    INT           NOT NULL,
      espacio_id          INT           NOT NULL,
      fecha_hora_entrada  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_hora_salida   DATETIME,
      minutos_totales     INT,
      tarifa_id           INT,
      valor_calculado     DECIMAL(10,2),
      descuento_pct       DECIMAL(5,2)  DEFAULT 0,
      es_cortesia         TINYINT(1)    DEFAULT 0,
      estado              ENUM('EN_CURSO','FINALIZADO') NOT NULL DEFAULT 'EN_CURSO',
      usuario_entrada_id  INT           NOT NULL,
      usuario_salida_id   INT,
      FOREIGN KEY (tipo_vehiculo_id)   REFERENCES tipos_vehiculo(id),
      FOREIGN KEY (espacio_id)         REFERENCES espacios(id),
      FOREIGN KEY (tarifa_id)          REFERENCES tarifas(id),
      FOREIGN KEY (usuario_entrada_id) REFERENCES usuarios(id),
      FOREIGN KEY (usuario_salida_id)  REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      registro_id    INT          NOT NULL UNIQUE,
      codigo_ticket  VARCHAR(20)  NOT NULL UNIQUE,
      email_cliente  VARCHAR(150),
      enviado_email  TINYINT(1)   DEFAULT 0,
      fecha_emision  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (registro_id) REFERENCES registros(id)
    );
  `);
  console.log('✔ Tablas creadas');

  // ── SEED DATA ────────────────────────────────────────────────────────
  // Roles
  await conn.query(`
    INSERT IGNORE INTO roles (nombre, descripcion) VALUES
      ('admin',    'Administrador: gestiona tarifas, usuarios y reportes'),
      ('operario', 'Operario: registra entradas/salidas y genera tickets');
  `);

  // Tipos de vehículo
  await conn.query(`
    INSERT IGNORE INTO tipos_vehiculo (nombre, descripcion, es_moto) VALUES
      ('sedan',     'Automóvil tipo sedán',   0),
      ('camioneta', 'Camioneta o SUV',        0),
      ('moto',      'Motocicleta',            1);
  `);

  // Espacios: 30 autos (sedán + camioneta), 15 motos
  const [[sedan]]    = await conn.query(`SELECT id FROM tipos_vehiculo WHERE nombre='sedan'`);
  const [[camioneta]]= await conn.query(`SELECT id FROM tipos_vehiculo WHERE nombre='camioneta'`);
  const [[moto]]     = await conn.query(`SELECT id FROM tipos_vehiculo WHERE nombre='moto'`);

  // Primeros 15 = sedan, siguientes 15 = camioneta
  for (let i = 1; i <= 15; i++) {
    await conn.query(`INSERT IGNORE INTO espacios (codigo, tipo_vehiculo_id) VALUES (?,?)`,
      [`A${String(i).padStart(2,'0')}`, sedan.id]);
  }
  for (let i = 16; i <= 30; i++) {
    await conn.query(`INSERT IGNORE INTO espacios (codigo, tipo_vehiculo_id) VALUES (?,?)`,
      [`A${String(i).padStart(2,'0')}`, camioneta.id]);
  }
  for (let i = 1; i <= 15; i++) {
    await conn.query(`INSERT IGNORE INTO espacios (codigo, tipo_vehiculo_id) VALUES (?,?)`,
      [`M${String(i).padStart(2,'0')}`, moto.id]);
  }
  console.log('✔ Espacios creados (30 autos + 15 motos)');

  // Tarifas por defecto
  const hoy = new Date().toISOString().split('T')[0];
  await conn.query(`
    INSERT IGNORE INTO tarifas (tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio) VALUES
      (?, 'Tarifa Sedán',     'POR_HORA', 3500.00, ?),
      (?, 'Tarifa Camioneta', 'POR_HORA', 5000.00, ?),
      (?, 'Tarifa Moto',      'POR_HORA', 2000.00, ?);
  `, [sedan.id, hoy, camioneta.id, hoy, moto.id, hoy]);
  console.log('✔ Tarifas por defecto creadas');

  // Usuarios semilla
  const [[roleAdmin]] = await conn.query(`SELECT id FROM roles WHERE nombre='admin'`);
  const [[roleOp]]    = await conn.query(`SELECT id FROM roles WHERE nombre='operario'`);
  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashOp    = await bcrypt.hash('op123',    10);

  await conn.query(`
    INSERT IGNORE INTO usuarios (nombre, email, password_hash, rol_id) VALUES
      ('Administrador', 'admin@park.com',    ?, ?),
      ('Operario Juan', 'operario@park.com', ?, ?);
  `, [hashAdmin, roleAdmin.id, hashOp, roleOp.id]);
  console.log('✔ Usuarios semilla creados');
  console.log('');
  console.log('─────────────────────────────────');
  console.log(' Setup completado exitosamente ✅ ');
  console.log('─────────────────────────────────');
  console.log(' admin@park.com    / admin123     ');
  console.log(' operario@park.com / op123        ');
  console.log('─────────────────────────────────');

  await conn.end();
}

setup().catch(err => {
  console.error('❌ Error en setup:', err.message);
  process.exit(1);
});
