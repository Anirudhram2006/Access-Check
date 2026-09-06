const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'access-check.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Create index on email for fast lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
`);

// Create audits table for audit history
db.exec(`
  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scanned_url TEXT NOT NULL,
    score INTEGER NOT NULL,
    violation_count INTEGER NOT NULL,
    violations TEXT NOT NULL,
    screenshot_url TEXT,
    indic_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create index on user_id for fast history lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id)
`);

// Create index on created_at for sorting
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at)
`);

// Backward-compatible schema migration:
// Add an audit type column so source-code analyses and website audits can be
// stored in the same history table while remaining distinguishable. Existing
// website audit records default to 'website' and keep working unchanged.
const auditCols = db.prepare(`PRAGMA table_info(audits)`).all().map(c => c.name);
if (!auditCols.includes('audit_type')) {
  db.exec(`ALTER TABLE audits ADD COLUMN audit_type TEXT NOT NULL DEFAULT 'website'`);
}
// Stores the list of analyzed source files (JSON) for source-code audits.
if (!auditCols.includes('source_files')) {
  db.exec(`ALTER TABLE audits ADD COLUMN source_files TEXT`);
}

// GitHub OAuth connections, one per authenticated Access Check user. Stores the
// minimum required to serve GitHub-backed requests: the GitHub user identity and
// an ENCRYPTED access token (never stored or returned in plain text).
db.exec(`
  CREATE TABLE IF NOT EXISTS github_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    github_user_id TEXT NOT NULL,
    github_username TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

module.exports = db;
