const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.json');
const JWT_SECRET = process.env.JWT_SECRET || 'compra-dolares-secret-key-2026';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Servir frontend en producción
const posiblesPaths = [
  path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'browser'),
  path.join(__dirname, '..', 'frontend', 'dist', 'frontend'),
  path.join(__dirname, 'dist', 'frontend')
];
let frontendPath = posiblesPaths.find(p => require('fs').existsSync(path.join(p, 'index.html')));
if (!frontendPath) {
  frontendPath = posiblesPaths[0];
  console.log('⚠️ Frontend no encontrado, sirviendo solo API');
} else {
  console.log('📁 Frontend encontrado en:', frontendPath);
}
app.use(express.static(frontendPath));

// ── Helpers ──────────────────────────────────────────────
function leerDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('⚠️ data.json no existe, creando nuevo...');
      const inicial = { usuarios: [], operaciones: [], config: { comision_zinli_porcentaje: 2.5, comision_divisas_porcentaje: 0.5, tasa_bcv_manual: null, tasa_binance_manual: null, margen_minimo_ganancia: 1.5, fecha_actualizacion: null } };
      fs.writeFileSync(DB_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
      return inicial;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    if (!raw || raw.trim() === '') {
      throw new Error('data.json está vacío');
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ Error al leer data.json:', err.message);
    // Si hay error de parseo, respaldar el archivo dañado y crear uno nuevo
    if (fs.existsSync(DB_PATH)) {
      const backupPath = DB_PATH + '.backup-' + Date.now();
      try {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log('📋 Backup guardado en:', backupPath);
      } catch (e) { /* no se pudo respaldar */ }
    }
    const inicial = { usuarios: [], operaciones: [], config: { comision_zinli_porcentaje: 2.5, comision_divisas_porcentaje: 0.5, tasa_bcv_manual: null, tasa_binance_manual: null, margen_minimo_ganancia: 1.5, fecha_actualizacion: null } };
    fs.writeFileSync(DB_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
    console.log('📄 Nuevo data.json creado');
    return inicial;
  }
}

function guardarDB(data) {
  try {
    // Escribir primero a archivo temporal y luego renombrar (escritura atómica)
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.error('❌ Error al guardar data.json:', err.message);
    throw err;
  }
}

// ── Obtener tasas (múltiples fuentes) ────────────────────

// BCV - Intenta varias fuentes
async function obtenerTasaBCV() {
  const db = leerDB();

  // Fuente 1: dolarapi.com
  try {
    const res = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', { timeout: 8000 });
    if (res.data && res.data.promedio) {
      return {
        tasa: res.data.promedio,
        fuente: 'BCV (dolarapi.com)',
        fecha: res.data.fechaActualizacion || new Date().toISOString().split('T')[0]
      };
    }
  } catch (e) { /* continuar */ }

  // Fuente 2: exchangerate-api
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 });
    if (res.data?.rates?.VES) {
      return {
        tasa: res.data.rates.VES,
        fuente: 'ExchangeRate-API',
        fecha: res.data.date || new Date().toISOString().split('T')[0]
      };
    }
  } catch (e) { /* continuar */ }

  // Fallback manual
  const manual = db.config.tasa_bcv_manual || 55.32;
  return { tasa: manual, fuente: 'Manual (configurada)', fecha: new Date().toISOString().split('T')[0] };
}

// Binance P2P - API directa de Binance
async function obtenerTasaBinance() {
  const db = leerDB();

  try {
    // API oficial de Binance P2P - SELL (vendes USDT, recibes VES)
    const res = await axios.post(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        asset: 'USDT',
        fiat: 'VES',
        tradeType: 'SELL',  // SELL USDT → recibes VES
        page: 1,
        rows: 10
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (res.data?.data?.length > 0) {
      // Filtrar anuncios con cantidad razonable (>100 USDT disponibles)
      const anuncios = res.data.data
        .map(a => ({
          precio: parseFloat(a.adv.price),
          disponible: parseFloat(a.adv.surplusAmount),
          comerciante: a.advertiser?.nickName || 'Anónimo',
          metodos: a.adv.tradeMethods?.map(m => m.identifier).join(', ') || ''
        }))
        .filter(a => a.disponible > 50)
        .sort((a, b) => a.precio - b.precio);  // ordenar por precio (más barato primero)

      if (anuncios.length > 0) {
        // Calcular promedio de los primeros 5 (mejores precios)
        const top5 = anuncios.slice(0, 5);
        const promedio = top5.reduce((s, a) => s + a.precio, 0) / top5.length;

        return {
          tasa: +promedio.toFixed(2),
          fuente: 'Binance P2P (directo)',
          fecha: new Date().toISOString(),
          mejor_precio: top5[0].precio,
          num_anuncios: anuncios.length,
          spread_p2p: +(top5[top5.length - 1].precio - top5[0].precio).toFixed(2),
          top_anuncios: top5.slice(0, 3).map(a => ({
            precio: a.precio,
            disponible: a.disponible,
            metodos: a.metodos
          }))
        };
      }
    }
    throw new Error('Sin anuncios disponibles');
  } catch (e) {
    // Fallback 1: dolarapi paralelo
    try {
      const res = await axios.get('https://ve.dolarapi.com/v1/dolares/paralelo', { timeout: 8000 });
      if (res.data && res.data.promedio) {
        return {
          tasa: res.data.promedio,
          fuente: 'Paralelo (dolarapi.com)',
          fecha: res.data.fechaActualizacion || new Date().toISOString()
        };
      }
    } catch (e2) { /* continuar */ }
  }

  // Fallback manual
  const manual = db.config.tasa_binance_manual || 65.80;
  return { tasa: manual, fuente: 'Manual (configurada)', fecha: new Date().toISOString() };
}

// ── Auth Middleware ───────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Se requiere rol de administrador' });
  }
  next();
}

// ── Auth Routes ───────────────────────────────────────────

// POST registro
app.post('/api/auth/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!email || !password || password.length < 4) {
      return res.status(400).json({ ok: false, error: 'Email y contraseña (mín 4 caracteres) requeridos' });
    }
    const db = leerDB();
    if (db.usuarios.find(u => u.email === email)) {
      return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const usuario = {
      id: Date.now(),
      nombre: nombre || email.split('@')[0],
      email,
      password: hash,
      rol: 'user',
      creado: new Date().toISOString()
    };
    db.usuarios.push(usuario);
    guardarDB(db);

    const token = jwt.sign({ id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ ok: true, token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });
    }
    const db = leerDB();
    const usuario = db.usuarios.find(u => u.email === email);
    if (!usuario) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }
    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }
    const token = jwt.sign({ id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol || 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol || 'user' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET perfil (protegido)
app.get('/api/auth/perfil', authMiddleware, (req, res) => {
  const db = leerDB();
  const usuario = db.usuarios.find(u => u.id === req.usuario.id);
  if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  res.json({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol || 'user', creado: usuario.creado } });
});

// ── Admin Routes ──────────────────────────────────────────

// GET listar usuarios (admin)
app.get('/api/admin/usuarios', authMiddleware, adminMiddleware, (req, res) => {
  const db = leerDB();
  const usuarios = db.usuarios.map(u => ({
    id: u.id, nombre: u.nombre, email: u.email, rol: u.rol || 'user', creado: u.creado
  }));
  res.json({ ok: true, usuarios });
});

// PUT cambiar rol de usuario (admin)
app.put('/api/admin/usuarios/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db = leerDB();
  const usuario = db.usuarios.find(u => u.id === +req.params.id);
  if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  const { rol } = req.body;
  if (!['admin', 'user'].includes(rol)) {
    return res.status(400).json({ ok: false, error: 'Rol inválido. Use admin o user' });
  }
  usuario.rol = rol;
  guardarDB(db);
  res.json({ ok: true, mensaje: `Rol actualizado a ${rol}`, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
});

// PUT cambiar contraseña (propio usuario)
app.put('/api/auth/password', authMiddleware, async (req, res) => {
  const db = leerDB();
  const usuario = db.usuarios.find(u => u.id === req.usuario.id);
  if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva) {
    return res.status(400).json({ ok: false, error: 'Contraseña actual y nueva requeridas' });
  }
  if (password_nueva.length < 4) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' });
  }

  const valido = await bcrypt.compare(password_actual, usuario.password);
  if (!valido) {
    return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta' });
  }

  usuario.password = await bcrypt.hash(password_nueva, 10);
  guardarDB(db);
  res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
});

// ── Rutas Protegidas (middleware primero) ──────────────────
app.use('/api/operaciones', authMiddleware);
app.use('/api/config', authMiddleware);

// GET tasas actuales + simulación (pública)
app.get('/api/tasas', async (req, res) => {
  try {
    const [tasaBCV, tasaBinance] = await Promise.all([obtenerTasaBCV(), obtenerTasaBinance()]);
    const db = leerDB();
    const comisionZinli = db.config.comision_zinli_porcentaje;
    const comisionDivisas = db.config.comision_divisas_porcentaje || 0.5;

    // Tasa BCV efectiva = BCV + comisión de divisas
    const tasaBcvEfectiva = tasaBCV.tasa * (1 + comisionDivisas / 100);

    // Simular compra de $100 para mostrar ejemplo
    const montoEjemplo = 100;
    const costoBs = montoEjemplo * tasaBcvEfectiva;
    const comisionDivisasBs = montoEjemplo * tasaBCV.tasa * (comisionDivisas / 100);
    const comisionZinliUSD = montoEjemplo * (comisionZinli / 100);
    const usdDisponible = montoEjemplo - comisionZinliUSD;
    const ventaBinance = usdDisponible * tasaBinance.tasa;
    const ganancia = ventaBinance - costoBs;
    const gananciaPorcentaje = (ganancia / costoBs) * 100;
    const spread = tasaBinance.tasa - tasaBCV.tasa;

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      tasas: {
        bcv: { ...tasaBCV, simbolo: 'Bs/USD' },
        bcv_efectiva: { tasa: +tasaBcvEfectiva.toFixed(4), simbolo: 'Bs/USD', descripcion: `BCV + ${comisionDivisas}% comisión divisas` },
        binance_p2p: { ...tasaBinance, simbolo: 'Bs/USD' },
      },
      comisiones: {
        divisas: { porcentaje: comisionDivisas, descripcion: 'Comisión adquisición divisas' },
        zinli: { porcentaje: comisionZinli, descripcion: 'Comisión Zinli (en USD)' }
      },
      spread: {
        bs: +spread.toFixed(2),
        porcentaje: +((spread / tasaBCV.tasa) * 100).toFixed(2),
        descripcion: 'Diferencia BCV vs Binance P2P'
      },
      ejemplo_100usd: {
        monto_usd: montoEjemplo,
        tasa_bcv: +tasaBCV.tasa.toFixed(2),
        tasa_bcv_efectiva: +tasaBcvEfectiva.toFixed(2),
        costo_divisas_bs: +comisionDivisasBs.toFixed(2),
        costo_base_bs: +(montoEjemplo * tasaBCV.tasa).toFixed(2),
        costo_total_bs: +costoBs.toFixed(2),
        comision_zinli_usd: +comisionZinliUSD.toFixed(2),
        usd_disponible: +usdDisponible.toFixed(2),
        venta_binance_bs: +ventaBinance.toFixed(2),
        ganancia_bs: +ganancia.toFixed(2),
        ganancia_usd: +(ganancia / tasaBCV.tasa).toFixed(2),
        ganancia_porcentaje: +gananciaPorcentaje.toFixed(2),
        spread: +spread.toFixed(2)
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST crear operación
app.post('/api/operaciones', async (req, res) => {
  try {
    const { monto_usd, tasa_bcv_manual, tasa_binance_manual, fecha_operacion, foto_compra, foto_venta } = req.body;

    if (!monto_usd || monto_usd <= 0) {
      return res.status(400).json({ ok: false, error: 'Monto en USD requerido y debe ser mayor a 0' });
    }

    // Si no se envían tasas manuales, obtener automáticas
    let fuenteBcv = 'Manual';
    let fuenteBinance = 'Manual';
    let tasaBcvUsar = tasa_bcv_manual;
    let tasaBinanceUsar = tasa_binance_manual;

    if (!tasa_bcv_manual || !tasa_binance_manual) {
      const [tasaBCV, tasaBinance] = await Promise.all([obtenerTasaBCV(), obtenerTasaBinance()]);
      if (!tasa_bcv_manual) {
        tasaBcvUsar = tasaBCV.tasa;
        fuenteBcv = tasaBCV.fuente;
      }
      if (!tasa_binance_manual) {
        tasaBinanceUsar = tasaBinance.tasa;
        fuenteBinance = tasaBinance.fuente;
      }
    }

    const db = leerDB();
    const comisionZinliPct = db.config.comision_zinli_porcentaje;
    const comisionDivisasPct = db.config.comision_divisas_porcentaje || 0.5;

    // Fecha de la operación: la proporcionada o la actual
    const fechaOperacion = fecha_operacion ? new Date(fecha_operacion).toISOString() : new Date().toISOString();

    // Tasa BCV efectiva = BCV + comisión divisas
    const tasaBcvEfectiva = tasaBcvUsar * (1 + comisionDivisasPct / 100);
    const costoBaseBs = monto_usd * tasaBcvUsar;
    const comisionDivisasBs = monto_usd * tasaBcvUsar * (comisionDivisasPct / 100);
    const costoBs = monto_usd * tasaBcvEfectiva;  // costo con comisión divisas
    // Zinli cobra en USD, reduce el monto disponible para vender
    const comisionZinliUSD = monto_usd * (comisionZinliPct / 100);
    const usdDisponible = monto_usd - comisionZinliUSD;
    const ventaBinanceBs = usdDisponible * tasaBinanceUsar;
    const gananciaBs = ventaBinanceBs - costoBs;
    const gananciaPorcentaje = (gananciaBs / costoBs) * 100;
    const spread = tasaBinanceUsar - tasaBcvUsar;

    const operacion = {
      id: Date.now(),
      fecha: fechaOperacion,
      fecha_registro: new Date().toISOString(),
      monto_usd,
      tasa_bcv: +tasaBcvUsar.toFixed(4),
      tasa_bcv_efectiva: +tasaBcvEfectiva.toFixed(4),
      fuente_bcv: fuenteBcv,
      tasa_binance: +tasaBinanceUsar.toFixed(4),
      fuente_binance: fuenteBinance,
      comision_divisas_porcentaje: comisionDivisasPct,
      comision_zinli_porcentaje: comisionZinliPct,
      foto_compra: foto_compra || null,
      foto_venta: foto_venta || null,
      estado: 'pendiente',
      detalle: {
        costo_base_bs: +costoBaseBs.toFixed(2),
        comision_divisas_bs: +comisionDivisasBs.toFixed(2),
        costo_bs: +costoBs.toFixed(2),
        comision_zinli_usd: +comisionZinliUSD.toFixed(2),
        usd_disponible: +usdDisponible.toFixed(2),
        venta_binance_bs: +ventaBinanceBs.toFixed(2),
        ganancia_bs: +gananciaBs.toFixed(2),
        ganancia_usd: +(gananciaBs / tasaBcvUsar).toFixed(2),
        ganancia_porcentaje: +gananciaPorcentaje.toFixed(2),
        spread: +spread.toFixed(4)
      },
      flujo: [
        { paso: 1, descripcion: 'Compra USD a tasa BCV', monto_usd, tasa: +tasaBcvUsar.toFixed(2), costo_bs: +costoBaseBs.toFixed(2), fuente: fuenteBcv },
        { paso: 2, descripcion: 'Comisión adquisición divisas', porcentaje: comisionDivisasPct, tasa_efectiva: +tasaBcvEfectiva.toFixed(2), costo_bs: +comisionDivisasBs.toFixed(2) },
        { paso: 3, descripcion: 'Transferencia a Zinli', comision_porcentaje: comisionZinliPct, usd_recibidos: monto_usd, comision_usd: +comisionZinliUSD.toFixed(2), usd_restantes: +usdDisponible.toFixed(2) },
        { paso: 4, descripcion: 'Transferencia a Binance', usd_disponible: +usdDisponible.toFixed(2) },
        { paso: 5, descripcion: 'Venta en Binance P2P', usd: +usdDisponible.toFixed(2), tasa: +tasaBinanceUsar.toFixed(2), ingreso_bs: +ventaBinanceBs.toFixed(2), fuente: fuenteBinance },
        { paso: 6, descripcion: 'Ganancia neta', ganancia_bs: +gananciaBs.toFixed(2), ganancia_porcentaje: +gananciaPorcentaje.toFixed(2) }
      ]
    };

    db.operaciones.push(operacion);
    db.config.fecha_actualizacion = new Date().toISOString();
    guardarDB(db);

    res.status(201).json({ ok: true, operacion });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET todas las operaciones
app.get('/api/operaciones', (req, res) => {
  try {
    const db = leerDB();
    const operaciones = [...(db.operaciones || [])].reverse();

    const totalUSD = operaciones.reduce((s, o) => s + (o.monto_usd || 0), 0);
    const totalInvertido = operaciones.reduce((s, o) => s + (o.detalle?.costo_bs || o.detalle?.costo_total_bs || 0), 0);
    const totalVendido = operaciones.reduce((s, o) => s + (o.detalle?.venta_binance_bs || 0), 0);
    const totalGanancia = operaciones.reduce((s, o) => s + (o.detalle?.ganancia_bs || 0), 0);
    const totalGananciaUSD = operaciones.reduce((s, o) => s + (o.detalle?.ganancia_usd || 0), 0);
    const gananciaPromedio = totalInvertido > 0 ? (totalGanancia / totalInvertido) * 100 : 0;

    res.json({
      ok: true,
      total_operaciones: operaciones.length,
      resumen: {
        total_usd_comprados: +totalUSD.toFixed(2),
        total_bs_invertidos: +totalInvertido.toFixed(2),
        total_bs_vendidos: +totalVendido.toFixed(2),
        total_ganancia_bs: +totalGanancia.toFixed(2),
        total_ganancia_usd: +totalGananciaUSD.toFixed(2),
        ganancia_promedio_porcentaje: +gananciaPromedio.toFixed(2)
      },
      operaciones
    });
  } catch (err) {
    console.error('❌ Error en GET /api/operaciones:', err.message);
    res.status(500).json({ ok: false, error: 'Error al leer el historial: ' + err.message });
  }
});

// GET operación por ID
app.get('/api/operaciones/:id', (req, res) => {
  const db = leerDB();
  const op = db.operaciones.find(o => o.id === +req.params.id);
  if (!op) return res.status(404).json({ ok: false, error: 'Operación no encontrada' });
  res.json({ ok: true, operacion: op });
});

// DELETE operación
app.delete('/api/operaciones/:id', (req, res) => {
  const db = leerDB();
  const idx = db.operaciones.findIndex(o => o.id === +req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Operación no encontrada' });
  const eliminada = db.operaciones.splice(idx, 1)[0];
  guardarDB(db);
  res.json({ ok: true, mensaje: 'Operación eliminada', operacion: eliminada });
});

// PUT cambiar estado (pendiente/confirmada)
app.put('/api/operaciones/:id/estado', authMiddleware, (req, res) => {
  const db = leerDB();
  const op = db.operaciones.find(o => o.id === +req.params.id);
  if (!op) return res.status(404).json({ ok: false, error: 'Operación no encontrada' });
  op.estado = op.estado === 'confirmada' ? 'pendiente' : 'confirmada';
  guardarDB(db);
  res.json({ ok: true, estado: op.estado });
});

// PUT actualizar comisión Zinli de una operación
app.put('/api/operaciones/:id', (req, res) => {
  const db = leerDB();
  const idx = db.operaciones.findIndex(o => o.id === +req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Operación no encontrada' });

  const op = db.operaciones[idx];
  const { comision_zinli_porcentaje, comision_zinli_bs, venta_binance_bs, tasa_binance, foto_compra, foto_venta } = req.body;

  // Recalcular con nueva comisión Zinli
  if (comision_zinli_porcentaje !== undefined) {
    op.comision_zinli_porcentaje = +comision_zinli_porcentaje;
  }

  const comisionDivisasPct = op.comision_divisas_porcentaje != null ? op.comision_divisas_porcentaje : 0.5;
  const tasaBcvEf = op.tasa_bcv * (1 + comisionDivisasPct / 100);
  const costoBaseBs = op.monto_usd * op.tasa_bcv;
  const comisionDivBs = op.monto_usd * op.tasa_bcv * (comisionDivisasPct / 100);
  const costoBs = op.monto_usd * tasaBcvEf;

  // Zinli en USD: comision_zinli_bs ahora es comision_zinli_usd
  let comisionZinliUSD = comision_zinli_bs !== undefined
    ? +comision_zinli_bs
    : op.monto_usd * (op.comision_zinli_porcentaje / 100);

  const usdDisponible = op.monto_usd - comisionZinliUSD;

  // Actualizar tasa_binance si se envía
  if (tasa_binance !== undefined) {
    op.tasa_binance = +tasa_binance;
  }
  // Usar venta_binance_bs manual si se envía, sino calcular con tasa
  let ventaBinanceBs, tasaBinanceEf;
  if (venta_binance_bs !== undefined) {
    ventaBinanceBs = +venta_binance_bs;
    tasaBinanceEf = ventaBinanceBs / usdDisponible;
    op.tasa_binance_efectiva = +tasaBinanceEf.toFixed(4);
  } else {
    ventaBinanceBs = usdDisponible * op.tasa_binance;
    tasaBinanceEf = op.tasa_binance;
    op.tasa_binance_efectiva = undefined;
  }
  // Actualizar fotos si se envían
  if (foto_compra !== undefined) op.foto_compra = foto_compra || null;
  if (foto_venta !== undefined) op.foto_venta = foto_venta || null;
  const gananciaBs = ventaBinanceBs - costoBs;
  const gananciaPct = (gananciaBs / costoBs) * 100;

  // Actualizar detalle
  op.tasa_bcv_efectiva = +tasaBcvEf.toFixed(4);
  op.detalle = {
    costo_base_bs: +costoBaseBs.toFixed(2),
    comision_divisas_bs: +comisionDivBs.toFixed(2),
    costo_bs: +costoBs.toFixed(2),
    comision_zinli_usd: +comisionZinliUSD.toFixed(2),
    usd_disponible: +usdDisponible.toFixed(2),
    venta_binance_bs: +ventaBinanceBs.toFixed(2),
    ganancia_bs: +gananciaBs.toFixed(2),
    ganancia_usd: +(gananciaBs / op.tasa_bcv).toFixed(2),
    ganancia_porcentaje: +gananciaPct.toFixed(2),
    spread: +(op.tasa_binance - op.tasa_bcv).toFixed(4)
  };

  // Actualizar flujo
  op.flujo = [
    { paso: 1, descripcion: 'Compra USD a tasa BCV', monto_usd: op.monto_usd, tasa: +op.tasa_bcv.toFixed(2), costo_bs: +costoBaseBs.toFixed(2), fuente: op.fuente_bcv },
    { paso: 2, descripcion: 'Comisión adquisición divisas', porcentaje: comisionDivisasPct, tasa_efectiva: +tasaBcvEf.toFixed(2), costo_bs: +comisionDivBs.toFixed(2) },
    { paso: 3, descripcion: 'Transferencia a Zinli', comision_porcentaje: op.comision_zinli_porcentaje, usd_recibidos: op.monto_usd, comision_usd: +comisionZinliUSD.toFixed(2), usd_restantes: +usdDisponible.toFixed(2) },
    { paso: 4, descripcion: 'Transferencia a Binance', usd_disponible: +usdDisponible.toFixed(2) },
    { paso: 5, descripcion: 'Venta en Binance P2P', usd: +usdDisponible.toFixed(2), tasa: +tasaBinanceEf.toFixed(2), ingreso_bs: +ventaBinanceBs.toFixed(2), fuente: venta_binance_bs !== undefined ? 'Manual (editado)' : op.fuente_binance },
    { paso: 6, descripcion: 'Ganancia neta', ganancia_bs: +gananciaBs.toFixed(2), ganancia_porcentaje: +gananciaPct.toFixed(2) }
  ];

  guardarDB(db);
  res.json({ ok: true, mensaje: 'Operación actualizada', operacion: op });
});

// PUT actualizar configuración
app.put('/api/config', (req, res) => {
  const db = leerDB();
  const { comision_zinli_porcentaje, comision_divisas_porcentaje, tasa_bcv_manual, tasa_binance_manual } = req.body;

  if (comision_zinli_porcentaje !== undefined) {
    if (comision_zinli_porcentaje < 0 || comision_zinli_porcentaje > 20) {
      return res.status(400).json({ ok: false, error: 'Comisión Zinli debe estar entre 0% y 20%' });
    }
    db.config.comision_zinli_porcentaje = +comision_zinli_porcentaje;
  }
  if (comision_divisas_porcentaje !== undefined) {
    if (comision_divisas_porcentaje < 0 || comision_divisas_porcentaje > 10) {
      return res.status(400).json({ ok: false, error: 'Comisión divisas debe estar entre 0% y 10%' });
    }
    db.config.comision_divisas_porcentaje = +comision_divisas_porcentaje;
  }
  if (tasa_bcv_manual !== undefined) db.config.tasa_bcv_manual = tasa_bcv_manual === null ? null : +tasa_bcv_manual;
  if (tasa_binance_manual !== undefined) db.config.tasa_binance_manual = tasa_binance_manual === null ? null : +tasa_binance_manual;

  db.config.fecha_actualizacion = new Date().toISOString();
  guardarDB(db);

  res.json({ ok: true, config: db.config });
});

// GET configuración
app.get('/api/config', (req, res) => {
  const db = leerDB();
  res.json({ ok: true, config: db.config });
});

// ── Start ────────────────────────────────────────────────
// Ruta catch-all para Angular (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Endpoints:`);
  console.log(`   GET  /api/tasas        - Tasas actuales + simulación`);
  console.log(`   GET  /api/operaciones   - Historial de operaciones`);
  console.log(`   POST /api/operaciones   - Nueva compra (body: {monto_usd})`);
  console.log(`   GET  /api/operaciones/:id`);
  console.log(`   DELETE /api/operaciones/:id`);
  console.log(`   GET  /api/config         - Configuración`);
  console.log(`   PUT  /api/config         - Actualizar configuración`);
});
