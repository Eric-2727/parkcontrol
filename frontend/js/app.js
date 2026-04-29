/* ── ParkControl – API Client & Core ─────────────────────────────────────── */
'use strict';

const BASE = '';  // Same origin

// ── API Helper ───────────────────────────────────────────────────────────────
async function api(method, url, body) {
  try {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(BASE + url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  } catch (err) {
    throw err;
  }
}

const API = {
  get:    (url)        => api('GET',    url),
  post:   (url, body)  => api('POST',   url, body),
  put:    (url, body)  => api('PUT',    url, body),
  delete: (url)        => api('DELETE', url),
};

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
let refreshTimer = null;

// ── DOM Helpers ───────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showAlert(containerId, type, msg, timeout = 5000) {
  const icons = { success: '✔', error: '✖', info: 'ℹ', warn: '⚠' };
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}"><span>${icons[type]||''}</span><span>${msg}</span></div>`;
  if (timeout) setTimeout(() => { if (el) el.innerHTML = ''; }, timeout);
}

function clearAlert(id) { const el = $(id); if (el) el.innerHTML = ''; }

function fmtPesos(n) {
  return '$' + (parseFloat(n)||0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function badgeTipo(t) {
  const map = { sedan:'b-blue', camioneta:'b-purple', moto:'b-amber' };
  const label = { sedan:'Sedán', camioneta:'Camioneta', moto:'Moto' };
  return `<span class="badge ${map[t]||'b-muted'}">${label[t]||t}</span>`;
}

function tipoLabel(t) {
  return { sedan:'Sedán', camioneta:'Camioneta', moto:'Moto' }[t] || t;
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function startClock() {
  const el = $('topbar-clock');
  if (!el) return;
  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
                   + ' · ' + now.toLocaleDateString('es-CO', { weekday:'short', day:'2-digit', month:'short' });
  };
  update();
  setInterval(update, 1000);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function checkSession() {
  try {
    const data = await API.get('/api/auth/me');
    currentUser = data.user;
    showApp();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('login-screen').style.display = '';
  $('app-screen').style.display   = 'none';
}

function showApp() {
  $('login-screen').style.display = 'none';
  $('app-screen').style.display   = '';
  $('topbar-user').textContent    = currentUser.nombre;
  $('topbar-role').textContent    = currentUser.rol === 'admin' ? 'Administrador' : 'Operario';
  buildNav();
  navigateTo('dashboard');
  startClock();
  startAutoRefresh();
}

async function doLogin() {
  const email    = $('login-email').value.trim();
  const password = $('login-pass').value;
  const btn      = $('login-btn');
  clearAlert('login-alert');

  if (!email || !password) {
    showAlert('login-alert', 'error', 'Ingresa email y contraseña.');
    return;
  }
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Verificando...';

  try {
    const data = await API.post('/api/auth/login', { email, password });
    currentUser = data.user;
    showApp();
  } catch (err) {
    showAlert('login-alert', 'error', err.message);
    btn.disabled  = false;
    btn.innerHTML = 'Iniciar sesión →';
  }
}

async function doLogout() {
  try { await API.post('/api/auth/logout'); } catch {}
  currentUser = null;
  stopAutoRefresh();
  showLogin();
}

// ── Navigation ────────────────────────────────────────────────────────────────
const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard',  icon: '◈', roles: ['admin','operario'], section: 'Operación' },
  { id: 'entrada',   label: 'Entrada',    icon: '↓', roles: ['admin','operario'], section: 'Operación' },
  { id: 'salida',    label: 'Salida',     icon: '↑', roles: ['admin','operario'], section: 'Operación' },
  { id: 'cupos',     label: 'Cupos',      icon: '⊞', roles: ['admin','operario'], section: 'Operación' },
  { id: 'tarifas',   label: 'Tarifas',    icon: '◈', roles: ['admin'],            section: 'Administración' },
  { id: 'usuarios',  label: 'Usuarios',   icon: '◉', roles: ['admin'],            section: 'Administración' },
  { id: 'reportes',  label: 'Reportes',   icon: '▦', roles: ['admin'],            section: 'Administración' },
];

function buildNav() {
  const pages = ALL_PAGES.filter(p => p.roles.includes(currentUser.rol));
  const sidebar = $('sidebar-nav');
  const mobileTabs = $('mobile-tabs');
  let lastSection = '';
  let sidebarHTML = '';

  pages.forEach(p => {
    if (p.section !== lastSection) {
      sidebarHTML += `<div class="nav-section-label">${p.section}</div>`;
      lastSection = p.section;
    }
    sidebarHTML += `<div class="nav-item" id="nav-${p.id}" onclick="navigateTo('${p.id}')">
      <span class="nav-icon">${p.icon}</span>${p.label}
    </div>`;
  });
  sidebar.innerHTML = sidebarHTML;
  mobileTabs.innerHTML = pages.map(p =>
    `<div class="mobile-tab" id="mtab-${p.id}" onclick="navigateTo('${p.id}')">${p.icon} ${p.label}</div>`
  ).join('');
}

function navigateTo(id) {
  $$('.nav-item').forEach(el  => el.classList.toggle('active', el.id === `nav-${id}`));
  $$('.mobile-tab').forEach(el => el.classList.toggle('active', el.id === `mtab-${id}`));
  $$('.page').forEach(el      => el.classList.toggle('active', el.id === `page-${id}`));

  const loaders = {
    dashboard: loadDashboard,
    entrada:   loadEntrada,
    salida:    loadSalidaPage,
    cupos:     loadCupos,
    tarifas:   loadTarifas,
    usuarios:  loadUsuarios,
    reportes:  loadReportes,
  };
  if (loaders[id]) loaders[id]();
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
function startAutoRefresh() {
  refreshTimer = setInterval(() => {
    const active = document.querySelector('.page.active');
    if (!active) return;
    const id = active.id.replace('page-', '');
    if (id === 'dashboard') loadDashboard(true);
    if (id === 'cupos')     loadCupos(true);
  }, 15000);
}
function stopAutoRefresh() { if (refreshTimer) clearInterval(refreshTimer); }

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadDashboard(silent = false) {
  try {
    const [stats, activos, cupos] = await Promise.all([
      API.get('/api/registros/dashboard-stats'),
      API.get('/api/registros'),
      API.get('/api/registros/cupos'),
    ]);

    // KPIs
    const carsIn   = stats.activos?.sedan   || 0 + stats.activos?.camioneta || 0;
    const motosIn  = stats.activos?.moto    || 0;
    let totalCars  = 0, totalMotos = 0;

    cupos.forEach(c => {
      if (c.tipo === 'sedan' || c.tipo === 'camioneta') totalCars  += parseInt(c.total);
      if (c.tipo === 'moto')  totalMotos += parseInt(c.total);
    });

    // Activos por tipo
    let sedanIn = 0, camIn = 0, motoIn = 0;
    (stats.activos && Object.entries(stats.activos)).forEach(([t, v]) => {
      if (t === 'sedan')     sedanIn  = v;
      if (t === 'camioneta') camIn    = v;
      if (t === 'moto')      motoIn   = v;
    });
    const autosIn = sedanIn + camIn;

    $('kpi-cars').textContent   = autosIn;
    $('kpi-motos').textContent  = motoIn;
    $('kpi-income').textContent = fmtPesos(stats.ingresos_hoy);
    $('kpi-total').textContent  = stats.total_hoy;

    $('kpi-cars-sub').textContent  = `${30 - autosIn} cupos libres de 30`;
    $('kpi-motos-sub').textContent = `${15 - motoIn} cupos libres de 15`;

    // Bars
    updateBar('prog-cars',  autosIn, 30);
    updateBar('prog-motos', motoIn,  15);

    // Tabla activos
    const tbody = $('dash-table');
    if (!activos.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Sin vehículos activos</td></tr>`;
    } else {
      tbody.innerHTML = activos.map(r => {
        const mins = Math.max(1, Math.round((Date.now() - new Date(r.fecha_hora_entrada)) / 60000));
        return `<tr>
          <td class="mono">${r.placa}</td>
          <td>${badgeTipo(r.tipo)}</td>
          <td class="mono">${r.espacio}</td>
          <td>${fmtTime(r.fecha_hora_entrada)}</td>
          <td class="mono">${mins} min</td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    if (!silent) showAlert('dash-alert', 'error', err.message);
  }
}

function updateBar(id, cur, max) {
  const pct = Math.round((cur / max) * 100);
  const fill = $(id + '-fill');
  const pctEl = $(id + '-pct');
  const numEl = $(id + '-num');
  if (fill)  fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (numEl) numEl.textContent = `${cur} / ${max} ocupados`;
}

// ── ENTRADA ───────────────────────────────────────────────────────────────────
async function loadEntrada() {
  clearAlert('entrada-alert');
  await loadEntradaHistorial();
}

async function loadEntradaHistorial() {
  try {
    const rows = await API.get('/api/registros');
    const tbody = $('entrada-table');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Sin vehículos activos</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `<tr>
      <td class="mono">${r.placa}</td>
      <td>${badgeTipo(r.tipo)}</td>
      <td class="mono">${r.espacio}</td>
      <td>${fmtDateTime(r.fecha_hora_entrada)}</td>
      <td><span class="badge b-green">En curso</span></td>
    </tr>`).join('');
  } catch {}
}

async function registrarEntrada() {
  const placa = $('ent-placa').value.trim().toUpperCase();
  const tipo  = $('ent-tipo').value;
  const btn   = $('ent-btn');
  clearAlert('entrada-alert');

  if (!placa || !tipo) {
    showAlert('entrada-alert', 'error', 'Completa todos los campos (placa y tipo de vehículo).');
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Registrando...';

  try {
    const data = await API.post('/api/registros/entrada', { placa, tipo_vehiculo: tipo });
    showAlert('entrada-alert', 'success', `✔ ${data.mensaje}`);
    $('ent-placa').value = '';
    $('ent-tipo').value  = '';
    await loadEntradaHistorial();
  } catch (err) {
    showAlert('entrada-alert', 'error', err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '↓ Registrar entrada';
  }
}

// ── SALIDA ────────────────────────────────────────────────────────────────────
let salidaData = null;

async function loadSalidaPage() {
  clearAlert('salida-alert');
  salidaData = null;
  $('cobro-preview').style.display = 'none';
  await loadSalidaHistorial();
}

async function loadSalidaHistorial() {
  try {
    const rows = await API.get('/api/registros/historial');
    const tbody = $('salida-table');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Sin salidas registradas</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.slice(0, 20).map(r => `<tr>
      <td class="mono">${r.placa}</td>
      <td>${badgeTipo(r.tipo)}</td>
      <td>${fmtDateTime(r.fecha_hora_entrada)}</td>
      <td>${fmtDateTime(r.fecha_hora_salida)}</td>
      <td class="mono">${r.minutos_totales} min</td>
      <td style="color:var(--green);font-weight:700">${fmtPesos(r.valor_calculado)}</td>
    </tr>`).join('');
  } catch {}
}

async function buscarSalida() {
  const placa = $('sal-placa').value.trim().toUpperCase();
  const btn   = $('sal-buscar-btn');
  clearAlert('salida-alert');
  $('cobro-preview').style.display = 'none';
  salidaData = null;

  if (!placa) {
    showAlert('salida-alert', 'error', 'Ingresa la placa del vehículo.');
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Buscando...';

  try {
    const data = await API.post('/api/registros/calcular-salida', { placa });
    salidaData  = data;
    renderCobroPreview(data);
  } catch (err) {
    showAlert('salida-alert', 'error', err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '🔍 Buscar vehículo';
  }
}

function renderCobroPreview(d) {
  const desc     = parseFloat($('sal-desc').value) || 0;
  const cortesia = $('sal-cortesia').checked;
  let costo      = 0;

  if (!cortesia) {
    // Calcular según tipo_cobro
    const hrs = d.minutos / 60;
    if (d.tipo_cobro === 'POR_MINUTO')  costo = Math.ceil(d.minutos * (d.tarifa_valor / 60));
    else if (d.tipo_cobro === 'FRACCION') costo = Math.ceil(d.minutos / 30) * (d.tarifa_valor / 2);
    else costo = Math.ceil(hrs) * d.tarifa_valor;
    if (desc > 0) costo = Math.round(costo * (1 - desc / 100));
  }

  $('cobro-detail').innerHTML = `
    <div class="ticket-row"><span class="tk-lbl">Placa</span><span>${d.placa}</span></div>
    <div class="ticket-row"><span class="tk-lbl">Tipo</span><span>${tipoLabel(d.tipo)}</span></div>
    <div class="ticket-row"><span class="tk-lbl">Espacio</span><span>${d.espacio}</span></div>
    <hr class="ticket-hr">
    <div class="ticket-row"><span class="tk-lbl">Entrada</span><span>${fmtDateTime(d.entrada)}</span></div>
    <div class="ticket-row"><span class="tk-lbl">Salida est.</span><span>${fmtDateTime(new Date())}</span></div>
    <div class="ticket-row"><span class="tk-lbl">Tiempo</span><span>${d.minutos} minutos</span></div>
    <div class="ticket-row"><span class="tk-lbl">Tarifa</span><span>${fmtPesos(d.tarifa_valor)}/hora</span></div>
    ${desc > 0 ? `<div class="ticket-row"><span class="tk-lbl">Descuento</span><span style="color:var(--green)">${desc}%</span></div>` : ''}
    ${cortesia ? `<div class="ticket-row"><span class="tk-lbl" style="color:var(--amber)">Cortesía</span><span style="color:var(--amber)">Cobro exonerado</span></div>` : ''}
    <hr class="ticket-hr">
    <div class="ticket-row cobro-total"><span>TOTAL A COBRAR</span><span>${fmtPesos(costo)}</span></div>
  `;
  $('cobro-preview').style.display = 'block';
}

async function confirmarSalida() {
  if (!salidaData) return;
  const placa    = salidaData.placa;
  const desc     = parseFloat($('sal-desc').value) || 0;
  const cortesia = $('sal-cortesia').checked;
  const btn      = $('sal-confirm-btn');

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Procesando...';

  try {
    const res = await API.post('/api/registros/salida', { placa, descuento_pct: desc, es_cortesia: cortesia });
    $('cobro-preview').style.display = 'none';
    $('sal-placa').value  = '';
    $('sal-desc').value   = '0';
    $('sal-cortesia').checked = false;
    salidaData = null;
    showTicket(res.ticket);
    await loadSalidaHistorial();
  } catch (err) {
    showAlert('salida-alert', 'error', err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '✔ Confirmar cobro y salida';
  }
}

function cancelarSalida() {
  $('cobro-preview').style.display = 'none';
  salidaData = null;
}

// ── TICKET MODAL ──────────────────────────────────────────────────────────────
function showTicket(t) {
  $('ticket-content').innerHTML = `
    <div class="ticket-brand">PARKCONTROL</div>
    <div style="text-align:center;font-size:.7rem;color:var(--muted);margin-bottom:16px;letter-spacing:.1em">SISTEMA DE PARQUEADERO</div>
    <div class="ticket-row"><span class="tk-lbl">Ticket N°</span><span>${t.codigo}</span></div>
    <hr class="ticket-hr">
    <div class="ticket-row"><span class="tk-lbl">Placa</span><span>${t.placa}</span></div>
    <hr class="ticket-hr">
    <div class="ticket-row"><span class="tk-lbl">Entrada</span><span>${fmtDateTime(t.entrada)}</span></div>
    <div class="ticket-row"><span class="tk-lbl">Salida</span><span>${fmtDateTime(t.salida)}</span></div>
    <div class="ticket-row"><span class="tk-lbl">Tiempo</span><span>${t.minutos} minutos</span></div>
    ${t.descuento_pct > 0 ? `<div class="ticket-row"><span class="tk-lbl">Descuento</span><span>${t.descuento_pct}%</span></div>` : ''}
    ${t.es_cortesia ? `<div class="ticket-row"><span class="tk-lbl">Cortesía</span><span>Sí</span></div>` : ''}
    <hr class="ticket-hr">
    <div class="ticket-row ticket-total"><span>TOTAL PAGADO</span><span>${fmtPesos(t.costo)}</span></div>
    <hr class="ticket-hr">
    <div style="text-align:center;color:var(--muted);font-size:.68rem;margin-top:10px">Gracias por usar ParkControl · SENA NODO TIC</div>
  `;
  openModal('ticket-modal');
}

function printTicket() { window.print(); }

// ── CUPOS ─────────────────────────────────────────────────────────────────────
async function loadCupos(silent = false) {
  try {
    const [cupos, espacios] = await Promise.all([
      API.get('/api/registros/cupos'),
      API.get('/api/registros/espacios'),
    ]);

    // Cards
    let autosTotal = 0, autosDispo = 0, motosTotal = 0, motosDispo = 0;
    cupos.forEach(c => {
      if (c.tipo !== 'moto') {
        autosTotal += parseInt(c.total);
        autosDispo += parseInt(c.disponibles);
      } else {
        motosTotal += parseInt(c.total);
        motosDispo += parseInt(c.disponibles);
      }
    });

    $('cupos-cars-avail').textContent = autosDispo;
    $('cupos-cars-occ').textContent   = autosTotal - autosDispo;
    $('cupos-motos-avail').textContent = motosDispo;
    $('cupos-motos-occ').textContent   = motosTotal - motosDispo;
    updateBar('cupos-cars',  autosTotal - autosDispo, autosTotal);
    updateBar('cupos-motos', motosTotal - motosDispo, motosTotal);

    // Espacios visual
    const carsGrid  = $('espacios-cars-grid');
    const motosGrid = $('espacios-motos-grid');

    const carsEsp  = espacios.filter(e => e.tipo !== 'moto');
    const motosEsp = espacios.filter(e => e.tipo === 'moto');

    carsGrid.innerHTML = carsEsp.map(e => `
      <div class="espacio-slot ${e.disponible ? 'espacio-libre' : 'espacio-ocupado'}" 
           data-tip="${e.disponible ? 'Libre' : e.placa}">
        <span class="esp-icon">${e.tipo === 'moto' ? '🏍' : '🚗'}</span>
        <span>${e.codigo}</span>
        ${!e.disponible ? `<span class="esp-placa">${e.placa}</span>` : ''}
      </div>`).join('');

    motosGrid.innerHTML = motosEsp.map(e => `
      <div class="espacio-slot ${e.disponible ? 'espacio-libre' : 'espacio-ocupado'}"
           data-tip="${e.disponible ? 'Libre' : e.placa}">
        <span class="esp-icon">🏍</span>
        <span>${e.codigo}</span>
        ${!e.disponible ? `<span class="esp-placa">${e.placa}</span>` : ''}
      </div>`).join('');

  } catch (err) {
    if (!silent) showAlert('cupos-alert', 'error', err.message);
  }
}

// ── TARIFAS ───────────────────────────────────────────────────────────────────
async function loadTarifas() {
  try {
    const [tarifas, tipos] = await Promise.all([
      API.get('/api/tarifas'),
      API.get('/api/tarifas/tipos-vehiculo'),
    ]);

    const sel = $('tar-tipo');
    sel.innerHTML = tipos.map(t => `<option value="${t.id}">${tipoLabel(t.nombre)}</option>`).join('');

    const tbody = $('tarifas-table');
    if (!tarifas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Sin tarifas configuradas</td></tr>`;
      return;
    }
    tbody.innerHTML = tarifas.map(t => `<tr>
      <td>${badgeTipo(t.tipo_vehiculo)}</td>
      <td>${t.nombre}</td>
      <td class="mono">${t.tipo_cobro.replace(/_/g,' ')}</td>
      <td style="color:var(--green);font-weight:700">${fmtPesos(t.valor)}</td>
      <td>${t.fecha_inicio} → ${t.fecha_fin || '∞'}</td>
      <td>
        <span class="badge ${t.activo ? 'b-green' : 'b-muted'}">${t.activo ? 'Activa' : 'Inactiva'}</span>
        ${t.activo ? `<button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="desactivarTarifa(${t.id})">✖</button>` : ''}
      </td>
    </tr>`).join('');
  } catch (err) {
    showAlert('tar-alert', 'error', err.message);
  }
}

async function guardarTarifa() {
  const tipo_vehiculo_id = $('tar-tipo').value;
  const nombre           = $('tar-nombre').value.trim();
  const tipo_cobro       = $('tar-cobro').value;
  const valor            = $('tar-valor').value;
  const fecha_inicio     = $('tar-finicio').value;
  const fecha_fin        = $('tar-ffin').value;

  if (!tipo_vehiculo_id || !nombre || !tipo_cobro || !valor || !fecha_inicio) {
    showAlert('tar-alert', 'error', 'Completa todos los campos obligatorios.');
    return;
  }
  try {
    await API.post('/api/tarifas', { tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio, fecha_fin });
    showAlert('tar-alert', 'success', '✔ Tarifa guardada correctamente.');
    $('tar-nombre').value = '';
    $('tar-valor').value  = '';
    await loadTarifas();
  } catch (err) {
    showAlert('tar-alert', 'error', err.message);
  }
}

async function desactivarTarifa(id) {
  if (!confirm('¿Desactivar esta tarifa?')) return;
  try {
    await API.delete(`/api/tarifas/${id}`);
    await loadTarifas();
  } catch (err) {
    showAlert('tar-alert', 'error', err.message);
  }
}

// ── USUARIOS ──────────────────────────────────────────────────────────────────
async function loadUsuarios() {
  try {
    const rows = await API.get('/api/usuarios');
    const tbody = $('usuarios-table');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Sin usuarios</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(u => `<tr>
      <td>${u.nombre}</td>
      <td class="mono" style="font-size:.78rem">${u.email}</td>
      <td><span class="badge ${u.rol === 'admin' ? 'b-blue' : 'b-amber'}">${u.rol}</span></td>
      <td><span class="badge ${u.activo ? 'b-green' : 'b-muted'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        ${u.activo && u.email !== currentUser.email
          ? `<button class="btn btn-ghost btn-sm" onclick="desactivarUsuario(${u.id})">Desactivar</button>`
          : '—'}
      </td>
    </tr>`).join('');
  } catch (err) {
    showAlert('usr-alert', 'error', err.message);
  }
}

async function crearUsuario() {
  const nombre   = $('usr-nombre').value.trim();
  const email    = $('usr-email').value.trim();
  const password = $('usr-pass').value;
  const rol      = $('usr-rol').value;

  if (!nombre || !email || !password || !rol) {
    showAlert('usr-alert', 'error', 'Completa todos los campos.');
    return;
  }
  try {
    await API.post('/api/usuarios', { nombre, email, password, rol });
    showAlert('usr-alert', 'success', `✔ Usuario ${nombre} creado correctamente.`);
    $('usr-nombre').value = '';
    $('usr-email').value  = '';
    $('usr-pass').value   = '';
    await loadUsuarios();
  } catch (err) {
    showAlert('usr-alert', 'error', err.message);
  }
}

async function desactivarUsuario(id) {
  if (!confirm('¿Desactivar este usuario?')) return;
  try {
    await API.delete(`/api/usuarios/${id}`);
    await loadUsuarios();
  } catch (err) {
    showAlert('usr-alert', 'error', err.message);
  }
}

// ── REPORTES ──────────────────────────────────────────────────────────────────
async function loadReportes() {
  const desde = $('rep-desde').value || new Date().toISOString().split('T')[0];
  const hasta = $('rep-hasta').value || desde;
  try {
    const data = await API.get(`/api/reportes/resumen?desde=${desde}&hasta=${hasta}`);
    const h    = await API.get(`/api/registros/historial?desde=${desde}&hasta=${hasta}`);

    $('rep-total').textContent   = fmtPesos(data.resumen.total);
    $('rep-count').textContent   = data.resumen.cantidad;
    $('rep-avg').textContent     = fmtPesos(data.resumen.promedio);
    $('rep-avgmin').textContent  = Math.round(data.resumen.promedio_min || 0) + ' min';

    // Por tipo
    const porTipo = $('rep-tipo');
    porTipo.innerHTML = data.por_tipo.map(t => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <span>${badgeTipo(t.tipo)} <span style="margin-left:8px;font-size:.82rem;color:var(--muted)">${t.cantidad} vehículos</span></span>
        <span style="color:var(--green);font-weight:700">${fmtPesos(t.total)}</span>
      </div>
    `).join('') || '<p style="color:var(--muted);font-size:.85rem">Sin datos para el período.</p>';

    // Historial tabla
    const tbody = $('rep-hist-table');
    if (!h.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="td-empty">Sin registros en el período seleccionado</td></tr>`;
      return;
    }
    tbody.innerHTML = h.slice(0, 50).map(r => `<tr>
      <td class="mono">${r.placa}</td>
      <td>${badgeTipo(r.tipo)}</td>
      <td>${fmtDateTime(r.fecha_hora_entrada)}</td>
      <td>${fmtDateTime(r.fecha_hora_salida)}</td>
      <td class="mono">${r.minutos_totales} min</td>
      <td style="color:var(--green);font-weight:700">${fmtPesos(r.valor_calculado)}</td>
    </tr>`).join('');

  } catch (err) {
    showAlert('rep-alert', 'error', err.message);
  }
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(id)  { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  // Login enter
  $('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  // Descuento change re-render preview
  $('sal-desc') && $('sal-desc').addEventListener('input', () => {
    if (salidaData) renderCobroPreview(salidaData);
  });
  $('sal-cortesia') && $('sal-cortesia').addEventListener('change', () => {
    if (salidaData) renderCobroPreview(salidaData);
  });

  // Hoy por defecto en reportes
  const hoy = new Date().toISOString().split('T')[0];
  const rd = $('rep-desde'); if (rd) rd.value = hoy;
  const rh = $('rep-hasta'); if (rh) rh.value = hoy;
  const tf = $('tar-finicio'); if (tf) tf.value = hoy;

  // Close modal on bg click
  $$('.modal-bg').forEach(m => m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('open');
  }));
});
