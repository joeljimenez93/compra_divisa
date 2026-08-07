/**
 * Tests para el endpoint GET /api/admin/export
 * 
 * Uso: node test-export.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3999;
const BASE_URL = `http://localhost:${PORT}`;

// ── Helpers ──────────────────────────────────────────────

function fetch(method, ruta, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(ruta, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function test(nombre, fn) {
  return fn()
    .then(() => { passed++; console.log(`  ✅ ${nombre}`); })
    .catch(err => { failed++; console.log(`  ❌ ${nombre}: ${err.message}`); });
}

function assert(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

// ── Iniciar servidor ─────────────────────────────────────

let server;

async function iniciarServidor() {
  return new Promise((resolve, reject) => {
    // Creamos un mini-servidor de test con los endpoints relevantes
    const express = require('express');
    const cors = require('cors');
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcryptjs');

    const testApp = express();
    const DB_PATH = path.join(__dirname, 'data.json');
    const JWT_SECRET = process.env.JWT_SECRET || 'efe41d48c90d1655e81f4e7087e00946e1350d08e863bf7495a8a5a89b5afd74da0cb6637c11a3f174a8ad0ffbe58ae9';

    testApp.use(cors({ origin: '*' }));
    testApp.use(express.json());

    function leerDB() {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }

    function authMiddleware(req, res, next) {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: 'Token requerido' });
      }
      try {
        req.usuario = jwt.verify(header.split(' ')[1], JWT_SECRET);
        next();
      } catch {
        return res.status(401).json({ ok: false, error: 'Token inválido' });
      }
    }

    function adminMiddleware(req, res, next) {
      if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Requiere admin' });
      }
      next();
    }

    // POST login
    testApp.post('/api/auth/login', async (req, res) => {
      const db = leerDB();
      const u = db.usuarios.find(u => u.email === req.body.email);
      if (!u || !(await bcrypt.compare(req.body.password, u.password))) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      const token = jwt.sign({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol || 'user' }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ ok: true, token, usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol || 'user' } });
    });

    // GET export (admin)
    testApp.get('/api/admin/export', authMiddleware, adminMiddleware, (req, res) => {
      const db = leerDB();
      const exportData = {
        exportado: new Date().toISOString(),
        usuarios: db.usuarios.map(u => ({
          id: u.id, nombre: u.nombre, email: u.email, rol: u.rol || 'user', creado: u.creado
        })),
        operaciones: db.operaciones,
        config: db.config
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="backup-test.json"`);
      res.json(exportData);
    });

    // GET perfil (para obtener info del token)
    testApp.get('/api/auth/perfil', authMiddleware, (req, res) => {
      res.json({ ok: true, usuario: req.usuario });
    });

    server = testApp.listen(PORT, '0.0.0.0', () => resolve());
  });
}

// ── Ejecutar tests ───────────────────────────────────────

async function ejecutarTests() {
  console.log('\n🧪 Tests Backend - GET /api/admin/export\n');

  let adminToken, userToken;

  // Login como admin
  await test('Login admin', async () => {
    const res = await fetch('POST', '/api/auth/login', {
      email: 'joeljim2293@gmail.com',
      password: 'Admin2024!'
    });
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.body.ok === true, 'No ok');
    assert(res.body.usuario.rol === 'admin', 'No es admin');
    adminToken = res.body.token;
  });

  // Login como user
  await test('Login user', async () => {
    const res = await fetch('POST', '/api/auth/login', {
      email: 'joel@gmail.com',
      password: 'Admin2024!'
    });
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.body.ok === true, 'No ok');
    assert(res.body.usuario.rol === 'user', 'No es user');
    userToken = res.body.token;
  });

  // ── Tests del endpoint export ──────────────────────────

  await test('GET /api/admin/export - Admin puede exportar', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.body.usuarios !== undefined, 'Falta usuarios');
    assert(res.body.operaciones !== undefined, 'Falta operaciones');
    assert(res.body.config !== undefined, 'Falta config');
    assert(res.body.exportado !== undefined, 'Falta fecha export');
  });

  await test('Export incluye todos los usuarios', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    assert(res.body.usuarios.length >= 2, `Solo ${res.body.usuarios.length} usuarios`);
  });

  await test('Export incluye todas las operaciones', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    assert(res.body.operaciones.length >= 1, `Solo ${res.body.operaciones.length} operaciones`);
  });

  await test('Export NO incluye contraseñas', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    for (const u of res.body.usuarios) {
      assert(!('password' in u), `Usuario ${u.email} tiene password!`);
    }
  });

  await test('Export incluye campos correctos de usuario', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    const u = res.body.usuarios[0];
    assert(typeof u.id === 'number', 'id no es number');
    assert(typeof u.nombre === 'string', 'nombre no es string');
    assert(typeof u.email === 'string', 'email no es string');
    assert(['admin', 'user'].includes(u.rol), `rol inválido: ${u.rol}`);
    assert(typeof u.creado === 'string', 'creado no es string');
  });

  await test('Export tiene Content-Disposition para descarga', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    const disposition = res.headers['content-disposition'];
    assert(disposition !== undefined, 'Falta Content-Disposition');
    assert(disposition.includes('attachment'), 'No es attachment');
    assert(disposition.includes('.json'), 'No contiene .json');
  });

  await test('Export tiene Content-Type application/json', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    const contentType = res.headers['content-type'];
    assert(contentType.includes('application/json'), `Content-Type: ${contentType}`);
  });

  await test('Export incluye config con campos requeridos', async () => {
    const res = await fetch('GET', '/api/admin/export', null, adminToken);
    const config = res.body.config;
    assert(typeof config.comision_zinli_porcentaje === 'number', 'Falta comision_zinli');
    assert(config.hasOwnProperty('tasa_bcv_manual'), 'Falta tasa_bcv_manual');
    assert(config.hasOwnProperty('tasa_binance_manual'), 'Falta tasa_binance_manual');
  });

  // ── Tests de seguridad ─────────────────────────────────

  await test('User NO admin no puede exportar (403)', async () => {
    const res = await fetch('GET', '/api/admin/export', null, userToken);
    assert(res.status === 403, `Status ${res.status} en vez de 403`);
    assert(res.body.error !== undefined, 'Sin mensaje de error');
  });

  await test('Sin token no puede exportar (401)', async () => {
    const res = await fetch('GET', '/api/admin/export');
    assert(res.status === 401, `Status ${res.status} en vez de 401`);
  });

  await test('Token inválido no puede exportar (401)', async () => {
    const res = await fetch('GET', '/api/admin/export', null, 'token_falso_123');
    assert(res.status === 401, `Status ${res.status} en vez de 401`);
  });

  // ────────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  ✅ ${passed} pasaron  |  ❌ ${failed} fallaron`);
  console.log(`${'─'.repeat(40)}\n`);
}

// ── Ejecutar ─────────────────────────────────────────────

iniciarServidor()
  .then(() => ejecutarTests())
  .then(() => {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  });
