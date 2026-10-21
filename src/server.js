import './env.js';

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pickRandomTarget } from './assign.js';
import { checkPassword, createSession, destroySession, usingDefaultPassword, validSession } from './auth.js';
import * as db from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE = 'santa_session';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const sendJson = (res, status, data, headers = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(data));
};

const sendText = (res, status, text, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(text);
};

const sendHtml = (res, status, html) => {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Neteisingas JSON turinys.'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

const sessionCookie = (token) => `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax`;
const clearCookie = () => `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
const isOwner = (req) => validSession(parseCookies(req)[SESSION_COOKIE]);
const cleanName = (value) => String(value ?? '').trim();

async function serveStatic(res, pathname) {
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendText(res, 400, 'Bloga užklausa');
  }
  const safe = normalize(decoded).replace(/^([/\\])+/, '');
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Draudžiama');
  const ext = extname(filePath).toLowerCase();
  const cache = ['.html', '.js', '.css'].includes(ext) ? 'no-store' : 'public, max-age=86400';
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cache,
    });
    res.end(data);
  } catch {
    sendText(res, 404, 'Nerasta');
  }
}

async function handleApi(req, res, pathname) {
  const method = req.method || 'GET';

  /* ---------------- Auth ---------------- */

  if (pathname === '/api/owner/login' && method === 'POST') {
    const body = await readBody(req);
    if (!checkPassword(body.password)) return sendJson(res, 401, { error: 'Neteisingas slaptažodis.' });
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(createSession()) });
  }

  if (pathname === '/api/owner/logout' && method === 'POST') {
    destroySession(parseCookies(req)[SESSION_COOKIE]);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }

  if (pathname === '/api/owner/session' && method === 'GET') {
    return sendJson(res, 200, { owner: isOwner(req) });
  }

  /* ---------------- Player (invitation token) ---------------- */

  const playerMatch = /^\/api\/player\/([a-f0-9]{16,})(?:\/(spin))?$/.exec(pathname);
  if (playerMatch) {
    const [, token, action] = playerMatch;
    const player = db.getParticipantByToken(token);
    if (!player) return sendJson(res, 404, { error: 'Ši kvietimo nuoroda negalioja.' });

    if (!action && method === 'GET') {
      db.markJoined(player.id);
      const event = db.getEvent();
      const all = db.listParticipants();
      const taken = new Set(all.filter((p) => p.target_id).map((p) => p.target_id));
      const candidates = all
        .filter((p) => p.id !== player.id && !taken.has(p.id))
        .map((p) => p.name);
      const target = player.target_id ? db.getParticipantById(player.target_id) : null;
      return sendJson(res, 200, {
        name: player.name,
        eventTitle: event.title,
        status: event.status,
        candidates,
        spun: Boolean(player.spun_at),
        target: player.spun_at && target ? target.name : null,
      });
    }

    if (action === 'spin' && method === 'POST') {
      const event = db.getEvent();
      if (event.status === 'setup') {
        return sendJson(res, 409, { error: 'Renginys dar neprasidėjo. Palauk organizatoriaus.' });
      }
      if (event.status === 'ended') {
        return sendJson(res, 409, { error: 'Šis žaidimas jau baigtas.' });
      }
      if (player.spun_at) {
        return sendJson(res, 409, { error: 'Jau ištraukei vardą!' });
      }

      // Everything below is synchronous, so concurrent spins can't collide.
      const all = db.listParticipants();
      const taken = new Set(all.filter((p) => p.target_id).map((p) => p.target_id));
      const givers = all.filter((p) => !p.spun_at).map((p) => p.id);
      const targets = all.filter((p) => !taken.has(p.id)).map((p) => p.id);
      const targetId = pickRandomTarget(player.id, givers, targets);
      if (targetId === null) {
        return sendJson(res, 409, { error: 'Šiuo metu nėra laisvo dovanos gavėjo.' });
      }
      db.recordSpin(player.id, targetId);
      const target = db.getParticipantById(targetId);
      return sendJson(res, 200, { target: target.name });
    }

    return sendJson(res, 405, { error: 'Metodas negalimas.' });
  }

  /* ---------------- Owner only ---------------- */

  if (!isOwner(req)) return sendJson(res, 401, { error: 'Neprisijungta.' });

  if (pathname === '/api/state' && method === 'GET') {
    const event = db.getEvent();
    const participants = db.listParticipants();
    const byId = new Map(participants.map((p) => [p.id, p]));
    return sendJson(res, 200, {
      eventTitle: event.title,
      status: event.status,
      startedAt: event.started_at,
      endedAt: event.ended_at,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        token: p.token,
        link: `/join/${p.token}`,
        joined: Boolean(p.joined_at),
        spun: Boolean(p.spun_at),
        target: p.target_id && byId.has(p.target_id) ? byId.get(p.target_id).name : null,
      })),
    });
  }

  if (pathname === '/api/event/start' && method === 'POST') {
    if (db.countParticipants() < 2) {
      return sendJson(res, 400, { error: 'Pridėk bent 2 dalyvius prieš pradėdamas renginį.' });
    }
    db.setStatus('live');
    return sendJson(res, 200, { status: 'live' });
  }

  if (pathname === '/api/event/end' && method === 'POST') {
    db.setStatus('ended');
    return sendJson(res, 200, { status: 'ended' });
  }

  if (pathname === '/api/event/reopen' && method === 'POST') {
    db.setStatus('live');
    return sendJson(res, 200, { status: 'live' });
  }

  if (pathname === '/api/event/reset' && method === 'POST') {
    db.resetEvent();
    return sendJson(res, 200, { status: 'setup' });
  }

  if (pathname === '/api/participants' && method === 'POST') {
    if (db.getEvent().status !== 'setup') {
      return sendJson(res, 409, { error: 'Dalyvius galima keisti tik prieš renginio pradžią.' });
    }
    const body = await readBody(req);
    const name = cleanName(body.name);
    if (!name || name.length > 40) return sendJson(res, 400, { error: 'Įvesk vardą (1–40 simbolių).' });
    const created = db.addParticipant(name);
    return sendJson(res, 201, { id: created.id, name: created.name, link: `/join/${created.token}` });
  }

  const partMatch = /^\/api\/participants\/(\d+)(?:\/(link|name))?$/.exec(pathname);
  if (partMatch) {
    const id = Number(partMatch[1]);
    const action = partMatch[2];
    if (!db.getParticipantById(id)) return sendJson(res, 404, { error: 'Dalyvis nerastas.' });

    if (!action && method === 'DELETE') {
      if (db.getEvent().status !== 'setup') {
        return sendJson(res, 409, { error: 'Dalyvius galima keisti tik prieš renginio pradžią.' });
      }
      db.deleteParticipant(id);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'link' && method === 'POST') {
      return sendJson(res, 200, { link: `/join/${db.regenerateToken(id)}` });
    }
    if (action === 'name' && method === 'POST') {
      const body = await readBody(req);
      const name = cleanName(body.name);
      if (!name || name.length > 40) return sendJson(res, 400, { error: 'Įvesk vardą (1–40 simbolių).' });
      db.renameParticipant(id, name);
      return sendJson(res, 200, { name });
    }
    return sendJson(res, 405, { error: 'Metodas negalimas.' });
  }

  return sendJson(res, 404, { error: 'Nerasta.' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    if (pathname === '/owner' || pathname === '/owner/') {
      return sendHtml(res, 200, await readFile(join(PUBLIC_DIR, 'owner.html')));
    }
    if (/^\/join\/[a-f0-9]{16,}\/?$/.test(pathname)) {
      return sendHtml(res, 200, await readFile(join(PUBLIC_DIR, 'player.html')));
    }
    return await serveStatic(res, pathname);
  } catch (err) {
    console.error('[error]', err);
    if (!res.headersSent) return sendJson(res, 500, { error: 'Serveryje kažkas sutriko.' });
    res.end();
  }
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('');
  console.log('  Slaptasis Kalėdų senelis veikia');
  console.log(`  Organizatoriaus skydas : ${base}/owner`);
  console.log(`  Pradžios puslapis      : ${base}/`);
  if (usingDefaultPassword()) {
    console.log('');
    console.log('  ĮSPĖJIMAS: naudojamas numatytasis slaptažodis "admin".');
    console.log('  Susikurk .env failą su OWNER_PASSWORD=tavo-slaptažodis.');
  }
  console.log('');
});
