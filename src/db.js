import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'santa.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS event (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'setup',
    started_at TEXT,
    ended_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS participants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    target_id  INTEGER,
    spun_at    TEXT,
    joined_at  TEXT,
    created_at TEXT NOT NULL
  );
`);

db.prepare('INSERT OR IGNORE INTO event (id, title, status) VALUES (1, ?, ?)')
  .run('Slaptasis Kalėdų senelis', 'setup');

db.prepare("UPDATE event SET title = ? WHERE id = 1 AND title = 'Christmas Secret Santa'")
  .run('Slaptasis Kalėdų senelis');

const now = () => new Date().toISOString();

export function getEvent() {
  return db.prepare('SELECT id, title, status, started_at, ended_at FROM event WHERE id = 1').get();
}

export function setStatus(status) {
  if (status === 'live') {
    db.prepare("UPDATE event SET status = 'live', started_at = COALESCE(started_at, ?), ended_at = NULL WHERE id = 1").run(now());
  } else if (status === 'ended') {
    db.prepare("UPDATE event SET status = 'ended', ended_at = ? WHERE id = 1").run(now());
  } else {
    db.prepare("UPDATE event SET status = 'setup', started_at = NULL, ended_at = NULL WHERE id = 1").run();
  }
}

export function listParticipants() {
  return db
    .prepare('SELECT id, name, token, target_id, spun_at, joined_at, created_at FROM participants ORDER BY id')
    .all();
}

export function countParticipants() {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM participants').get().n);
}

export function getParticipantById(id) {
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
}

export function getParticipantByToken(token) {
  return db.prepare('SELECT * FROM participants WHERE token = ?').get(token);
}

export function addParticipant(name) {
  const token = randomBytes(16).toString('hex');
  const info = db
    .prepare('INSERT INTO participants (name, token, created_at) VALUES (?, ?, ?)')
    .run(name, token, now());
  return getParticipantById(Number(info.lastInsertRowid));
}

export function renameParticipant(id, name) {
  db.prepare('UPDATE participants SET name = ? WHERE id = ?').run(name, id);
}

export function deleteParticipant(id) {
  db.prepare('UPDATE participants SET target_id = NULL WHERE target_id = ?').run(id);
  db.prepare('DELETE FROM participants WHERE id = ?').run(id);
}

export function regenerateToken(id) {
  const token = randomBytes(16).toString('hex');
  db.prepare('UPDATE participants SET token = ? WHERE id = ?').run(token, id);
  return token;
}

export function markJoined(id) {
  db.prepare('UPDATE participants SET joined_at = COALESCE(joined_at, ?) WHERE id = ?').run(now(), id);
}

export function recordSpin(id, targetId) {
  db.prepare('UPDATE participants SET target_id = ?, spun_at = ? WHERE id = ?').run(targetId, now(), id);
}

export function resetEvent() {
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE participants SET target_id = NULL, spun_at = NULL').run();
    db.prepare("UPDATE event SET status = 'setup', started_at = NULL, ended_at = NULL WHERE id = 1").run();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
