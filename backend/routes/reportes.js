const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/reportes/resumen
router.get('/resumen', requireAdmin, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const d = desde || new Date().toISOString().split('T')[0];
    const h = hasta || d;

    const [[ingresos]] = await db.query(`
      SELECT COALESCE(SUM(r.valor_calculado),0) AS total,
             COUNT(*) AS cantidad,
             AVG(r.valor_calculado) AS promedio,
             AVG(r.minutos_totales) AS promedio_min
      FROM registros r
      WHERE r.estado='FINALIZADO'
        AND DATE(r.fecha_hora_salida) BETWEEN ? AND ?
    `, [d, h]);

    const [porTipo] = await db.query(`
      SELECT tv.nombre AS tipo,
             COUNT(*) AS cantidad,
             COALESCE(SUM(r.valor_calculado),0) AS total
      FROM registros r
      JOIN tipos_vehiculo tv ON r.tipo_vehiculo_id = tv.id
      WHERE r.estado='FINALIZADO'
        AND DATE(r.fecha_hora_salida) BETWEEN ? AND ?
      GROUP BY tv.nombre
    `, [d, h]);

    const [porHora] = await db.query(`
      SELECT HOUR(r.fecha_hora_entrada) AS hora, COUNT(*) AS cantidad
      FROM registros r
      WHERE DATE(r.fecha_hora_entrada) BETWEEN ? AND ?
      GROUP BY hora ORDER BY hora
    `, [d, h]);

    res.json({
      resumen: {
        total:        parseFloat(ingresos.total),
        cantidad:     parseInt(ingresos.cantidad),
        promedio:     parseFloat(ingresos.promedio || 0),
        promedio_min: parseFloat(ingresos.promedio_min || 0)
      },
      por_tipo: porTipo,
      por_hora: porHora
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte.' });
  }
});

module.exports = router;
