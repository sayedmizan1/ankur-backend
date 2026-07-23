import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'soapveda.sqlite'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Each table stores its full record as a JSON blob in `data`, plus a couple of indexed columns
// for fast lookups (slug/code/email/userId). This keeps the schema simple while still giving us
// a real, persistent, multi-client-safe SQL database (transactions, file-backed, shared by every
// request) instead of per-browser localStorage.
const SCHEMA = {
  products: 'id TEXT PRIMARY KEY, slug TEXT UNIQUE, data TEXT NOT NULL',
  coupons: 'id TEXT PRIMARY KEY, code TEXT UNIQUE, data TEXT NOT NULL',
  banners: 'id TEXT PRIMARY KEY, data TEXT NOT NULL',
  blog_posts: 'id TEXT PRIMARY KEY, slug TEXT UNIQUE, data TEXT NOT NULL',
  orders: 'id TEXT PRIMARY KEY, data TEXT NOT NULL',
  users: 'id TEXT PRIMARY KEY, email TEXT UNIQUE, data TEXT NOT NULL',
  addresses: 'id TEXT PRIMARY KEY, userId TEXT NOT NULL, data TEXT NOT NULL',
  contact_messages: 'id TEXT PRIMARY KEY, data TEXT NOT NULL',
  images: 'id TEXT PRIMARY KEY, data TEXT NOT NULL',
};

for (const [table, cols] of Object.entries(SCHEMA)) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${cols})`);
}

function rowToEntity(row) {
  return row ? JSON.parse(row.data) : undefined;
}

export function createRepo(table, extraColumns = []) {
  return {
    all() {
      return db
        .prepare(`SELECT data FROM ${table}`)
        .all()
        .map((r) => JSON.parse(r.data));
    },
    count() {
      return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    },
    getById(id) {
      return rowToEntity(db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id));
    },
    getBy(column, value) {
      return rowToEntity(db.prepare(`SELECT data FROM ${table} WHERE ${column} = ?`).get(value));
    },
    allBy(column, value) {
      return db
        .prepare(`SELECT data FROM ${table} WHERE ${column} = ?`)
        .all(value)
        .map((r) => JSON.parse(r.data));
    },
    insert(entity) {
      const cols = ['id', 'data', ...extraColumns];
      const values = [entity.id, JSON.stringify(entity), ...extraColumns.map((c) => entity[c] ?? null)];
      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...values);
      return entity;
    },
    update(id, entity) {
      const setCols = ['data = ?', ...extraColumns.map((c) => `${c} = ?`)];
      const values = [JSON.stringify(entity), ...extraColumns.map((c) => entity[c] ?? null), id];
      db.prepare(`UPDATE ${table} SET ${setCols.join(', ')} WHERE id = ?`).run(...values);
      return entity;
    },
    remove(id) {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    },
  };
}

export function transaction(fn) {
  db.exec('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
