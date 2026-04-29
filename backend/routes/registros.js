const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcularCosto(tarifa, minutos) {
  const valor = parseFloat(tarifa.valor);
  if (tarifa.tipo_cobro === 'POR_MINUTO') {
    return Math.ceil(minutos * (valor / 60));
  }
  if (tarifa.tipo_cobro === 'FRACCION') {
    return Math.ceil(minutos / 30) * (valor / 2);
  }
  if (tarifa.tipo_cobro === 'POR_DIA') {
    return Math.ceil(minutos / 1440) * valor;
  }
  // POR_HORA (default)
  return Math.ceil(minutos / 60) * valor;
}

// ── GET /api/registros ── lista vehículos EN_CURSO
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.id, r.placa, tv.nombre AS tipo, e.codigo AS espacio,
             r.fecha_hora_entrada, r.estado
      FROM registros r
      JOIN tipos_vehiculo tv ON r.tipo_vehiculo_id = tv.id
      JOIN espacios e        ON r.espacio_id        = e.id
      WHERE r.estado = 'EN_CURSO'
      ORDER BY r.fecha_hora_entrada DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener registros.' });
  }
});

// ── GET /api/registros/historial ── todos los finalizados
router.get('/historial', requireAuth, async (req, res) => {
  try {
    const { desde, hasta, tipo } = req.query;
    let sql = `
      SELECT r.id, r.placa, tv.nombre AS tipo, e.codigo AS espacio,
             r.fecha_hora_entrada, r.fecha_hora_salida,
             r.minutos_totales, r.valor_calculado, r.descuento_pct,
             r.es_cortesia, r.estado,
             t.codigo_ticket
      FROM registros r
      JOIN tipos_vehiculo tv ON r.tipo_vehiculo_id = tv.id
      JOIN espacios e        ON r.espacio_id        = e.id
      LEFT JOIN tickets t   ON t.registro_id       = r.id
      WHERE r.estado = 'FINALIZADO'
    `;
    const params = [];
    if (desde)  { sql += ' AND DATE(r.fecha_hora_entrada) >= ?'; params.push(desde); }
    if (hasta)  { sql += ' AND DATE(r.fecha_hora_entrada) <= ?'; params.push(hasta); }
    if (tipo)   { sql += ' AND tv.nombre = ?'; params.push(tipo); }
    sql += ' ORDER BY r.fecha_hora_salida DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial.' });
  }
});

// ── GET /api/registros/cupos ── disponibilidad en tiempo real
router.get('/cupos', requireAuth, async (req, res) => {
  try {
    const [totales] = await db.query(`
      SELECT tv.nombre AS tipo, COUNT(e.id) AS total,
             SUM(e.disponible) AS disponibles
      FROM espacios e
      JOIN tipos_vehiculo tv ON e.tipo_vehiculo_id = tv.id
      GROUP BY tv.nombre, tv.id
    `);
    res.json(totales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cupos.' });
  }
});

// ── GET /api/registros/espacios ── todos los espacios con estado
router.get('/espacios', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.id, e.codigo, tv.nombre AS tipo, e.disponible,
             r.placa, r.fecha_hora_entrada
      FROM espacios e
      JOIN tipos_vehiculo tv ON e.tipo_vehiculo_id = tv.id
      LEFT JOIN registros r ON r.espacio_id = e.id AND r.estado = 'EN_CURSO'
      ORDER BY e.codigo
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener espacios.' });
  }
});

// ── POST /api/registros/entrada ──────────────────────────────────────────────
router.post('/entrada', requireAuth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { placa, tipo_vehiculo } = req.body;
    if (!placa || !tipo_vehiculo) {
      return res.status(400).json({ error: 'Placa y tipo de vehículo son requeridos.' });
    }

    const placaUp = placa.toUpperCase().trim();

    // Verificar que no tenga registro activo
    const [activo] = await conn.query(
      `SELECT id FROM registros WHERE placa = ? AND estado = 'EN_CURSO' LIMIT 1`,
      [placaUp]
    );
    if (activo.length) {
      await conn.rollback();
      return res.status(400).json({ error: `El vehículo ${placaUp} ya tiene un registro activo.` });
    }

    // Obtener tipo de vehículo
    const [tvRows] = await conn.query(
      `SELECT id, es_moto FROM tipos_vehiculo WHERE nombre = ? LIMIT 1`,
      [tipo_vehiculo]
    );
    if (!tvRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Tipo de vehículo no válido.' });
    }
    const tipoVehiculo = tvRows[0];

    // Buscar espacio disponible del mismo tipo
    const [espacioRows] = await conn.query(
      `SELECT e.id, e.codigo FROM espacios e
       WHERE e.tipo_vehiculo_id = ? AND e.disponible = 1
       LIMIT 1 FOR UPDATE`,
      [tipoVehiculo.id]
    );
    if (!espacioRows.length) {
      await conn.rollback();
      return res.status(400).json({
        error: `No hay cupos disponibles para ${tipo_vehiculo}. El parqueadero está lleno.`
      });
    }
    const espacio = espacioRows[0];

    // Obtener tarifa activa
    const [tarifaRows] = await conn.query(
      `SELECT id FROM tarifas
       WHERE tipo_vehiculo_id = ? AND activo = 1
       AND fecha_inicio <= CURDATE()
       AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
       ORDER BY fecha_inicio DESC LIMIT 1`,
      [tipoVehiculo.id]
    );
    const tarifaId = tarifaRows.length ? tarifaRows[0].id : null;

    // Crear registro
    const [result] = await conn.query(
      `INSERT INTO registros (placa, tipo_vehiculo_id, espacio_id, tarifa_id, usuario_entrada_id)
       VALUES (?, ?, ?, ?, ?)`,
      [placaUp, tipoVehiculo.id, espacio.id, tarifaId, req.session.user.id]
    );

    // Marcar espacio como ocupado
    await conn.query(`UPDATE espacios SET disponible = 0 WHERE id = ?`, [espacio.id]);

    await conn.commit();

    res.json({
      ok: true,
      mensaje: `Vehículo ${placaUp} registrado en espacio ${espacio.codigo}`,
      registro: {
        id:       result.insertId,
        placa:    placaUp,
        tipo:     tipo_vehiculo,
        espacio:  espacio.codigo,
        entrada:  new Date()
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al registrar entrada.' });
  } finally {
    conn.release();
  }
});

// ── POST /api/registros/calcular-salida ── previsualizar costo
router.post('/calcular-salida', requireAuth, async (req, res) => {
  try {
    const { placa } = req.body;
    if (!placa) return res.status(400).json({ error: 'Placa requerida.' });

    const [rows] = await db.query(`
      SELECT r.*, tv.nombre AS tipo, e.codigo AS espacio, ta.tipo_cobro, ta.valor AS tarifa_valor
      FROM registros r
      JOIN tipos_vehiculo tv ON r.tipo_vehiculo_id = tv.id
      JOIN espacios e        ON r.espacio_id        = e.id
      LEFT JOIN tarifas ta   ON ta.id = r.tarifa_id
      WHERE r.placa = ? AND r.estado = 'EN_CURSO' LIMIT 1
    `, [placa.toUpperCase().trim()]);

    if (!rows.length) {
      return res.status(404).json({ error: `No se encontró registro activo para la placa ${placa}.` });
    }

    const reg   = rows[0];
    const ahora = new Date();
    const minutos = Math.max(1, Math.round((ahora - new Date(reg.fecha_hora_entrada)) / 60000));
    const tarifa  = { tipo_cobro: reg.tipo_cobro || 'POR_HORA', valor: reg.tarifa_valor || 3500 };
    const costoBase = calcularCosto(tarifa, minutos);

    res.json({
      registro_id:    reg.id,
      placa:          reg.placa,
      tipo:           reg.tipo,
      espacio:        reg.espacio,
      entrada:        reg.fecha_hora_entrada,
      salida_est:     ahora,
      minutos,
      tarifa_valor:   tarifa.valor,
      tipo_cobro:     tarifa.tipo_cobro,
      costo_base:     costoBase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular costo.' });
  }
});

// ── POST /api/registros/salida ────────────────────────────────────────────────
router.post('/salida', requireAuth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { placa, descuento_pct = 0, es_cortesia = false } = req.body;
    if (!placa) {
      return res.status(400).json({ error: 'Placa requerida.' });
    }

    const [rows] = await conn.query(`
      SELECT r.*, ta.tipo_cobro, ta.valor AS tarifa_valor
      FROM registros r
      LEFT JOIN tarifas ta ON ta.id = r.tarifa_id
      WHERE r.placa = ? AND r.estado = 'EN_CURSO' LIMIT 1 FOR UPDATE
    `, [placa.toUpperCase().trim()]);

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: `No hay registro activo para ${placa}.` });
    }

    const reg    = rows[0];
    const ahora  = new Date();
    const minutos = Math.max(1, Math.round((ahora - new Date(reg.fecha_hora_entrada)) / 60000));
    const tarifa  = { tipo_cobro: reg.tipo_cobro || 'POR_HORA', valor: reg.tarifa_valor || 3500 };
    let costo = es_cortesia ? 0 : calcularCosto(tarifa, minutos);
    if (!es_cortesia && descuento_pct > 0) {
      costo = Math.round(costo * (1 - descuento_pct / 100));
    }

    // Actualizar registro
    await conn.query(`
      UPDATE registros SET
        fecha_hora_salida  = ?,
        minutos_totales    = ?,
        valor_calculado    = ?,
        descuento_pct      = ?,
        es_cortesia        = ?,
        estado             = 'FINALIZADO',
        usuario_salida_id  = ?
      WHERE id = ?
    `, [ahora, minutos, costo, descuento_pct, es_cortesia ? 1 : 0, req.session.user.id, reg.id]);

    // Liberar espacio
    await conn.query(`UPDATE espacios SET disponible = 1 WHERE id = ?`, [reg.espacio_id]);

    // Generar ticket
    const codTicket = `TK-${String(reg.id).padStart(6,'0')}-${Date.now().toString(36).toUpperCase()}`;
    await conn.query(
      `INSERT INTO tickets (registro_id, codigo_ticket, fecha_emision) VALUES (?, ?, ?)`,
      [reg.id, codTicket, ahora]
    );

    await conn.commit();

    res.json({
      ok: true,
      ticket: {
        codigo:           codTicket,
        placa:            reg.placa,
        entrada:          reg.fecha_hora_entrada,
        salida:           ahora,
        minutos,
        costo,
        descuento_pct,
        es_cortesia
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al registrar salida.' });
  } finally {
    conn.release();
  }
});

// ── GET /api/registros/dashboard-stats ──────────────────────────────────────
router.get('/dashboard-stats', requireAuth, async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    const [[ingresos]] = await db.query(
      `SELECT COALESCE(SUM(valor_calculado),0) AS total
       FROM registros WHERE estado='FINALIZADO' AND DATE(fecha_hora_salida)=?`, [hoy]);

    const [[totalHoy]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM registros WHERE DATE(fecha_hora_entrada)=?`, [hoy]);

    const [activos] = await db.query(
      `SELECT tv.nombre AS tipo, COUNT(*) AS cant
       FROM registros r JOIN tipos_vehiculo tv ON r.tipo_vehiculo_id=tv.id
       WHERE r.estado='EN_CURSO' GROUP BY tv.nombre`);

    const cupos = {};
    activos.forEach(a => { cupos[a.tipo] = parseInt(a.cant); });

    res.json({
      ingresos_hoy: parseFloat(ingresos.total),
      total_hoy:    parseInt(totalHoy.cnt),
      activos:      cupos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

module.exports = router;
