// AI FIGHT production server: serves the built game (dist/) and the judge API.
// The judge is the built-in TEST MODE judge (server/mockJudge.js): it runs
// entirely on this server, with no external AI services and no API keys.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMatch } from './rules.js';
import { mockJudge } from './mockJudge.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '../dist');
const PORT = Number(process.env.PORT) || 8787;
const RATE = Number(process.env.RATE_LIMIT_PER_MIN) || 30;

const app = express();
app.disable('x-powered-by');
// Render (and most hosts) put a proxy in front: trust one hop so req.ip is the visitor.
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

// Small in-memory per-IP rate limit for the judge endpoint.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const list = (hits.get(req.ip) || []).filter((t) => now - t < 60_000);
  if (list.length >= RATE) return res.status(429).json({ error: 'rate_limited', message: 'Слишком много боёв подряд. Подождите минуту.' });
  list.push(now);
  hits.set(req.ip, list);
  next();
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k); }, 60_000).unref();

app.get('/api/health', (_req, res) => res.json({ ok: true, judge: 'test' }));

app.post('/api/judge', rateLimit, (req, res) => {
  const b = req.body || {};
  const match = {
    topic: String(b.topic ?? '').trim(),
    player1: { name: String(b.player1?.name ?? '').trim(), argument: String(b.player1?.argument ?? '').trim() },
    player2: { name: String(b.player2?.name ?? '').trim(), argument: String(b.player2?.argument ?? '').trim() },
  };
  const invalid = validateMatch(match);
  if (invalid) return res.status(400).json({ error: 'invalid_input', message: invalid });
  try {
    const verdict = mockJudge(match);
    console.log(`[judge] ${verdict.winner} ${verdict.player1_score}:${verdict.player2_score}`);
    res.json(verdict);
  } catch (err) {
    console.error('[judge] failed:', err);
    res.status(500).json({ error: 'internal', message: 'Внутренняя ошибка сервера.' });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

if (fs.existsSync(DIST)) {
  // hashed bundles can be cached for long; index.html must always be fresh
  app.use('/assets', express.static(path.join(DIST, 'assets'), { maxAge: '30d', immutable: true }));
  app.use(express.static(DIST, { maxAge: '1d', index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.status(503).send('Build not found. Run "npm run build" first.'));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI FIGHT server listening on port ${PORT} (test judge, no external APIs)`);
});
