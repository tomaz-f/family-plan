import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as db from './db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3456);
const isDev = process.argv.includes('--dev');

const app = express();
app.disable('x-powered-by');

// =========================================================
// SECURITY MIDDLEWARE (transparent to legitimate users)
// =========================================================

// --- 1. Host header allow-list (blocks DNS rebinding attacks) ---
const MACHINE_NAME = os.hostname().toLowerCase();
const EXTRA_ALLOWED_HOSTS = String(process.env.ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function parseHostname(hostValue) {
  const h = String(hostValue || '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    return end > 0 ? h.slice(1, end) : '';
  }
  return h.split(':')[0];
}

function isAllowedHostname(name) {
  if (!name) return false;
  if (name === 'localhost' || name.endsWith('.localhost')) return true;
  if (IPV4_RE.test(name)) return true; // LAN / Tailscale / loopback IPs
  if (name.includes(':')) return true; // IPv6 literal
  if (name === MACHINE_NAME || name === `${MACHINE_NAME}.local` || name === `${MACHINE_NAME}.lan`) return true;
  if (name.endsWith('.ts.net')) return true; // Tailscale MagicDNS
  return EXTRA_ALLOWED_HOSTS.includes(name);
}

app.use((req, res, next) => {
  if (!isAllowedHostname(parseHostname(req.headers.host))) {
    return res.status(403).type('text/plain').send('Forbidden host');
  }
  next();
});

// --- 2. Security headers ---
function computeInlineScriptHashes() {
  try {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'dist', 'index.html'), 'utf8');
    const hashes = [];
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (m[1].trim()) {
        hashes.push(`'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
      }
    }
    return hashes;
  } catch {
    return [];
  }
}

const CSP = [
  "default-src 'self'",
  `script-src 'self' ${computeInlineScriptHashes().join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (!isDev) res.setHeader('Content-Security-Policy', CSP);
  next();
});

// --- 3. Anti-CSRF guard for state-changing API calls ---
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use('/api', (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site request blocked' });
  }

  const origin = req.get('origin');
  if (origin) {
    let originUrl;
    try {
      originUrl = new URL(origin);
    } catch {
      return res.status(403).json({ error: 'Invalid origin' });
    }
    const sameHost = originUrl.host.toLowerCase() === String(req.headers.host || '').toLowerCase();
    const viteDevProxy = originUrl.port === '5173' && isAllowedHostname(originUrl.hostname.toLowerCase());
    if (!sameHost && !viteDevProxy) {
      return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
  }

  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
});

// --- 4. Body size limits ---
app.use('/api/import', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '2mb' }));

// --- 5. Generic error responses ---
function sendServerError(res, err) {
  console.error('[FamilyPlan API error]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// --- 6. Family code resolver ---
async function resolveFamilyId(req) {
  const rawId = req.headers['x-family-id'] || req.query.familyId || req.body?.familyId;
  const fid = db.sanitizeFamilyCode(rawId);
  if (fid && (await db.verifyFamily(fid))) {
    return fid;
  }
  // Check if any family exists in Turso
  const fallback = await db.turso.execute('SELECT family_id FROM families ORDER BY created_at ASC LIMIT 1');
  if (fallback.rows.length > 0) {
    return fallback.rows[0].family_id;
  }
  // Auto-seed default initial family if empty
  const initial = await db.createFamily();
  return initial.familyId;
}

// =========================================================
// FAMILY ONBOARDING & MANAGEMENT ENDPOINTS
// =========================================================

// POST create a new family space with unique 6-character code
app.post('/api/families/create', async (req, res) => {
  try {
    const family = await db.createFamily(req.body?.familyId);
    res.json(family);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST join an existing family with 6-character code
app.post('/api/families/join', async (req, res) => {
  try {
    const result = await db.joinFamily(req.body?.familyId);
    if (!result.valid) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    sendServerError(res, err);
  }
});

// GET verify if a family code exists
app.get('/api/families/:id/verify', async (req, res) => {
  try {
    const valid = await db.verifyFamily(req.params.id);
    res.json({ valid, familyId: req.params.id });
  } catch (err) {
    sendServerError(res, err);
  }
});

// =========================================================
// CORE APP DATA ENDPOINTS (SCOPED BY FAMILY_ID)
// =========================================================

// GET full application state for family
app.get('/api/state', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.getFullState(familyId, PORT);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PUT settings
app.put('/api/settings', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.updateSettings(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST create transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.saveTransaction(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PUT update transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const scope = req.body?.scope || req.query.scope || 'single';
    const state = await db.updateTransaction(familyId, req.params.id, req.body, scope);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PATCH toggle or set transaction payment status
app.patch('/api/transactions/:id/status', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.updateTransactionStatus(familyId, req.params.id, req.body?.status);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// DELETE transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const scope = req.query.scope || req.body?.scope || 'single';
    const state = await db.deleteTransaction(familyId, req.params.id, scope);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST credit card
app.post('/api/cards', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.saveCreditCard(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PUT credit card
app.put('/api/cards/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.updateCreditCard(familyId, req.params.id, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// DELETE credit card
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.deleteCreditCard(familyId, req.params.id);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST settle credit card monthly invoice
app.post('/api/cards/:id/pay-invoice', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const { invoiceMonth, markAsPaid = false } = req.body || {};
    const state = await db.payCreditCardInvoice(familyId, req.params.id, invoiceMonth, markAsPaid);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST category
app.post('/api/categories', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.saveCategory(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PUT category
app.put('/api/categories/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.updateCategory(familyId, req.params.id, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// DELETE category
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.deleteCategory(familyId, req.params.id);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST recurring template
app.post('/api/recurring', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.saveRecurring(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PUT recurring template
app.put('/api/recurring/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.updateRecurring(familyId, req.params.id, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// DELETE recurring template
app.delete('/api/recurring/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.deleteRecurring(familyId, req.params.id);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST apply single recurring template
app.post('/api/recurring/:id/apply', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.applyRecurring(familyId, req.params.id, req.body?.month);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST apply all recurring templates
app.post('/api/recurring/apply-all', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.applyAllRecurring(familyId, req.body?.month);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST fuel log
app.post('/api/fuel', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.saveFuelLog(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// PUT fuel log
app.put('/api/fuel/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.updateFuelLog(familyId, req.params.id, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// DELETE fuel log
app.delete('/api/fuel/:id', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.deleteFuelLog(familyId, req.params.id);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST sync pending offline transactions
app.post('/api/sync', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.syncPendingTransactions(familyId, req.body?.pendingTransactions || []);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST import full backup
app.post('/api/import', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.importData(familyId, req.body);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// POST reset family data
app.post('/api/reset', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req);
    const state = await db.resetData(familyId);
    res.json(state);
  } catch (err) {
    sendServerError(res, err);
  }
});

// =========================================================
// SPA STATIC SERVING / VITE INTEGRATION
// =========================================================
async function startServer() {
  await db.initDb();

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    if (fs.existsSync(distPath)) {
      app.use((req, res, next) => {
        if (
          req.path === '/' ||
          req.path === '/index.html' ||
          req.path === '/sw.js' ||
          req.path === '/family-plan/' ||
          req.path.startsWith('/family-plan/sw.js')
        ) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      });
      app.use('/family-plan', express.static(distPath));
      app.use(express.static(distPath));
      app.get(['/family-plan', '/family-plan/*'], (_req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Final error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    console.error('[FamilyPlan error]', err);
    if (res.headersSent) return;
    res.status(err?.status && err.status >= 400 && err.status < 600 ? err.status : 500).json({
      error: 'Internal server error',
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================================');
    console.log('  FamilyPlan — Turso libSQL Cloud DB Server Running!');
    console.log('========================================================');
    console.log(`  Local URL      : http://localhost:${PORT}`);
    console.log('========================================================\n');
  });
}

startServer();
