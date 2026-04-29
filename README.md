# 🅿 ParkControl — Sistema Web de Parqueadero
**SENA NODO TIC · ADSO-15**

Sistema web completo para control de entrada y salida de vehículos (autos y motos) con capacidad de 30 espacios para autos y 15 para motos.

---

## 🚀 Tecnologías

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express |
| Frontend | HTML5 + CSS3 + JavaScript (Vanilla) |
| Base de datos | MySQL |
| Seguridad | bcryptjs + express-session |
| Despliegue | Vercel |

---

## 📁 Estructura del proyecto

```
parkcontrol/
├── backend/
│   ├── config/
│   │   ├── db.js          ← Conexión MySQL (pool)
│   │   └── setup-db.js    ← Script de creación de BD y seed
│   ├── middleware/
│   │   └── auth.js        ← Autenticación y roles
│   ├── routes/
│   │   ├── auth.js        ← Login / logout / sesión
│   │   ├── registros.js   ← Entrada, salida, cupos, stats
│   │   ├── tarifas.js     ← CRUD de tarifas
│   │   ├── usuarios.js    ← CRUD de usuarios
│   │   └── reportes.js    ← Reportes por fecha
│   └── server.js          ← Servidor Express principal
├── frontend/
│   ├── css/
│   │   └── main.css       ← Estilos completos
│   ├── js/
│   │   └── app.js         ← Lógica SPA + API client
│   └── index.html         ← SPA principal
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## ⚙️ Instalación local

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/tu-usuario/parkcontrol.git
cd parkcontrol
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales de MySQL
```

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=parkcontrol
SESSION_SECRET=cambia_esto_en_produccion
PORT=3000
NODE_ENV=development
```

### 3. Crear la base de datos y datos iniciales

```bash
npm run setup-db
```

Esto crea automáticamente:
- Todas las tablas
- 30 espacios para autos (A01–A30)
- 15 espacios para motos (M01–M15)
- Tarifas por defecto
- 2 usuarios de prueba

### 4. Iniciar el servidor

```bash
npm run dev   # desarrollo con nodemon
npm start     # producción
```

Abrir en el navegador: **http://localhost:3000**

---

## 👤 Usuarios de prueba

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@park.com | admin123 | Administrador |
| operario@park.com | op123 | Operario |

---

## 📋 Funcionalidades

### Operario
- ✅ Registrar entrada (placa + tipo de vehículo)
- ✅ Validación de cupos disponibles en tiempo real
- ✅ Registrar salida con cálculo automático de costo
- ✅ Aplicar descuentos porcentuales o cortesía
- ✅ Generación de ticket al registrar salida
- ✅ Ver cupos disponibles y mapa de espacios

### Administrador
- ✅ Todo lo del operario
- ✅ Configurar tarifas por tipo de vehículo y tipo de cobro
- ✅ Gestionar usuarios y roles
- ✅ Reportes con filtro por fechas
- ✅ KPIs de ingresos, promedios y flujo vehicular

### Sistema
- ✅ Autenticación con bcrypt
- ✅ Control de sesiones por rol
- ✅ Auto-refresh del dashboard cada 15 segundos
- ✅ Reloj en tiempo real
- ✅ Botón flotante de WhatsApp
- ✅ Diseño responsive (móvil + tablet + desktop)
- ✅ Transacciones MySQL para operaciones críticas

---

## 💲 Tarifas por defecto

| Tipo | Tarifa/hora |
|------|------------|
| Sedán | $3.500 |
| Camioneta | $5.000 |
| Moto | $2.000 |

---

## 🗄️ Modelo de Base de Datos

```
roles → usuarios
tipos_vehiculo → espacios
tipos_vehiculo → tarifas
tipos_vehiculo → registros → tickets
espacios       → registros
usuarios       → registros (entrada y salida)
tarifas        → registros
```

---

## 🌐 Despliegue en Vercel

### Requisitos
- Cuenta en Vercel
- Base de datos MySQL accesible (PlanetScale, Railway, etc.)

### Pasos

```bash
npm install -g vercel
vercel login
vercel
```

Configura las variables de entorno en el panel de Vercel:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SESSION_SECRET`
- `NODE_ENV=production`

---

## 📡 API Endpoints

```
POST   /api/auth/login                ← Iniciar sesión
POST   /api/auth/logout               ← Cerrar sesión
GET    /api/auth/me                   ← Usuario actual

GET    /api/registros                 ← Vehículos EN_CURSO
GET    /api/registros/historial       ← Historial (filtrable)
GET    /api/registros/cupos           ← Disponibilidad
GET    /api/registros/espacios        ← Todos los espacios
GET    /api/registros/dashboard-stats ← KPIs del día
POST   /api/registros/entrada         ← Registrar entrada
POST   /api/registros/calcular-salida ← Previsualizar costo
POST   /api/registros/salida          ← Confirmar salida + ticket

GET    /api/tarifas                   ← Listar tarifas
POST   /api/tarifas                   ← Crear tarifa (admin)
PUT    /api/tarifas/:id               ← Editar tarifa (admin)
DELETE /api/tarifas/:id               ← Desactivar (admin)
GET    /api/tarifas/tipos-vehiculo    ← Tipos de vehículo

GET    /api/usuarios                  ← Listar usuarios (admin)
POST   /api/usuarios                  ← Crear usuario (admin)
PUT    /api/usuarios/:id              ← Editar usuario (admin)
DELETE /api/usuarios/:id              ← Desactivar (admin)

GET    /api/reportes/resumen          ← Reporte por fechas (admin)
```

---

*Desarrollado con ❤ para SENA NODO TIC – ADSO-15*
