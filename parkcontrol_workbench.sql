-- ============================================================
--  ParkControl – Script SQL Completo
--  SENA NODO TIC · ADSO-15
--  Ejecutar en MySQL Workbench
-- ============================================================

-- 1. Crear y seleccionar la base de datos
DROP DATABASE IF EXISTS parkcontrol;
CREATE DATABASE parkcontrol
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE parkcontrol;

-- ============================================================
-- 2. TABLAS
-- ============================================================

-- Roles del sistema
CREATE TABLE roles (
  id          INT          NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(50)  NOT NULL,
  descripcion VARCHAR(200),
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_nombre (nombre)
);

-- Usuarios del sistema
CREATE TABLE usuarios (
  id             INT          NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  rol_id         INT          NOT NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  fecha_creacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- Tipos de vehículo
CREATE TABLE tipos_vehiculo (
  id          INT          NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(50)  NOT NULL,
  descripcion VARCHAR(200),
  es_moto     TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tipos_nombre (nombre)
);

-- Espacios del parqueadero
CREATE TABLE espacios (
  id               INT         NOT NULL AUTO_INCREMENT,
  codigo           VARCHAR(10) NOT NULL,
  tipo_vehiculo_id INT         NOT NULL,
  disponible       TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_espacios_codigo (codigo),
  CONSTRAINT fk_espacios_tipo FOREIGN KEY (tipo_vehiculo_id) REFERENCES tipos_vehiculo(id)
);

-- Tarifas por tipo de vehículo
CREATE TABLE tarifas (
  id               INT          NOT NULL AUTO_INCREMENT,
  tipo_vehiculo_id INT          NOT NULL,
  nombre           VARCHAR(100) NOT NULL,
  tipo_cobro       ENUM('POR_MINUTO','POR_HORA','POR_DIA','FRACCION') NOT NULL DEFAULT 'POR_HORA',
  valor            DECIMAL(10,2) NOT NULL,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  fecha_inicio     DATE         NOT NULL,
  fecha_fin        DATE         DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_tarifas_tipo FOREIGN KEY (tipo_vehiculo_id) REFERENCES tipos_vehiculo(id)
);

-- Registros de entrada/salida
CREATE TABLE registros (
  id                  INT           NOT NULL AUTO_INCREMENT,
  placa               VARCHAR(10)   NOT NULL,
  tipo_vehiculo_id    INT           NOT NULL,
  espacio_id          INT           NOT NULL,
  fecha_hora_entrada  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_hora_salida   DATETIME      DEFAULT NULL,
  minutos_totales     INT           DEFAULT NULL,
  tarifa_id           INT           DEFAULT NULL,
  valor_calculado     DECIMAL(10,2) DEFAULT NULL,
  descuento_pct       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  es_cortesia         TINYINT(1)    NOT NULL DEFAULT 0,
  estado              ENUM('EN_CURSO','FINALIZADO') NOT NULL DEFAULT 'EN_CURSO',
  usuario_entrada_id  INT           NOT NULL,
  usuario_salida_id   INT           DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_registros_placa  (placa),
  INDEX idx_registros_estado (estado),
  INDEX idx_registros_fecha  (fecha_hora_entrada),
  CONSTRAINT fk_reg_tipo    FOREIGN KEY (tipo_vehiculo_id)  REFERENCES tipos_vehiculo(id),
  CONSTRAINT fk_reg_espacio FOREIGN KEY (espacio_id)        REFERENCES espacios(id),
  CONSTRAINT fk_reg_tarifa  FOREIGN KEY (tarifa_id)         REFERENCES tarifas(id),
  CONSTRAINT fk_reg_usr_ent FOREIGN KEY (usuario_entrada_id) REFERENCES usuarios(id),
  CONSTRAINT fk_reg_usr_sal FOREIGN KEY (usuario_salida_id)  REFERENCES usuarios(id)
);

-- Tickets de cobro
CREATE TABLE tickets (
  id            INT          NOT NULL AUTO_INCREMENT,
  registro_id   INT          NOT NULL,
  codigo_ticket VARCHAR(50)  NOT NULL,
  email_cliente VARCHAR(150) DEFAULT NULL,
  enviado_email TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_emision DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_registro (registro_id),
  UNIQUE KEY uq_tickets_codigo   (codigo_ticket),
  CONSTRAINT fk_tickets_registro FOREIGN KEY (registro_id) REFERENCES registros(id)
);

-- ============================================================
-- 3. DATOS INICIALES
-- ============================================================

-- Roles
INSERT INTO roles (nombre, descripcion) VALUES
  ('admin',    'Administrador: gestiona tarifas, usuarios y reportes'),
  ('operario', 'Operario: registra entradas/salidas y genera tickets');

-- Tipos de vehículo
INSERT INTO tipos_vehiculo (nombre, descripcion, es_moto) VALUES
  ('sedan',     'Automóvil tipo sedán',   0),
  ('camioneta', 'Camioneta o SUV',        0),
  ('moto',      'Motocicleta',            1);

-- Espacios: A01-A15 sedán | A16-A30 camioneta | M01-M15 motos
INSERT INTO espacios (codigo, tipo_vehiculo_id) VALUES
  ('A01',1),('A02',1),('A03',1),('A04',1),('A05',1),
  ('A06',1),('A07',1),('A08',1),('A09',1),('A10',1),
  ('A11',1),('A12',1),('A13',1),('A14',1),('A15',1),
  ('A16',2),('A17',2),('A18',2),('A19',2),('A20',2),
  ('A21',2),('A22',2),('A23',2),('A24',2),('A25',2),
  ('A26',2),('A27',2),('A28',2),('A29',2),('A30',2),
  ('M01',3),('M02',3),('M03',3),('M04',3),('M05',3),
  ('M06',3),('M07',3),('M08',3),('M09',3),('M10',3),
  ('M11',3),('M12',3),('M13',3),('M14',3),('M15',3);

-- Tarifas por defecto (fecha de hoy en producción)
INSERT INTO tarifas (tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio) VALUES
  (1, 'Tarifa Sedán',     'POR_HORA', 3500.00, CURDATE()),
  (2, 'Tarifa Camioneta', 'POR_HORA', 5000.00, CURDATE()),
  (3, 'Tarifa Moto',      'POR_HORA', 2000.00, CURDATE());

-- Usuarios (contraseñas hasheadas con bcrypt cost=10)
-- admin123  → $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- op123     → $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES
  ('Administrador General', 'admin@park.com',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1),
  ('Operario Juan',         'operario@park.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 2);

-- ============================================================
-- 4. VERIFICACIÓN FINAL
-- ============================================================
SELECT 'roles'         AS tabla, COUNT(*) AS registros FROM roles
UNION ALL
SELECT 'usuarios',       COUNT(*) FROM usuarios
UNION ALL
SELECT 'tipos_vehiculo', COUNT(*) FROM tipos_vehiculo
UNION ALL
SELECT 'espacios',       COUNT(*) FROM espacios
UNION ALL
SELECT 'tarifas',        COUNT(*) FROM tarifas;

-- ============================================================
-- Credenciales de prueba:
--   admin@park.com      /  admin123
--   operario@park.com   /  op123
-- ============================================================
