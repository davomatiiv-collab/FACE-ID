import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'litsey_faceid.sqlite');

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha256').toString('hex');
  return { hash, salt: generatedSalt };
}

export function saveDatabase(): void {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

export const STANDARD_GROUPS = [
  '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9',
  '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '2.10'
];

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('✓ SQLite database loaded from', DB_FILE);
      ensureTablesAndMigrations();
      applyStandardGroupsAndClearDemo();
      saveDatabase();
      return db;
    } catch (err) {
      console.warn('Failed to load existing SQLite file, creating fresh DB:', err);
    }
  }

  db = new SQL.Database();
  console.log('✓ Initializing fresh SQLite database...');
  ensureTablesAndMigrations();
  seedInitialData();
  saveDatabase();
  return db;
}

function ensureTablesAndMigrations(): void {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      patronymic TEXT,
      group_id TEXT NOT NULL,
      photo_url TEXT,
      face_descriptor TEXT,
      is_face_registered INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      status TEXT NOT NULL,
      method TEXT NOT NULL,
      match_confidence REAL DEFAULT 1.0,
      note TEXT,
      recorded_by TEXT DEFAULT 'Face ID Tizimi',
      created_at TEXT NOT NULL,
      UNIQUE(student_id, date),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      school_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      late_threshold_minutes INTEGER NOT NULL,
      face_match_threshold REAL NOT NULL,
      require_manual_confirm_on_low_confidence INTEGER NOT NULL,
      enable_liveness_check INTEGER NOT NULL,
      camera_device_id TEXT
    );
  `);
}

function applyStandardGroupsAndClearDemo(): void {
  if (!db) return;
  const now = new Date().toISOString();

  // Check if non-standard groups or demo students exist
  const standardSet = new Set(STANDARD_GROUPS);
  const currentGroups = queryAll<{ id: string; name: string }>("SELECT id, name FROM groups");
  const hasNonStandard = currentGroups.some(g => !standardSet.has(g.name));
  const hasDemoStudents = queryAll("SELECT id FROM students WHERE student_id IN ('L-1021', 'L-1022', 'L-1023', 'L-1024', 'L-2011')").length > 0;

  if (hasNonStandard || hasDemoStudents) {
    console.log('✓ Removing legacy non-standard groups and demo students...');
    db.run("DELETE FROM attendances");
    db.run("DELETE FROM students");
    db.run("DELETE FROM groups");
  }

  // Ensure all 19 standard groups exist
  for (const gName of STANDARD_GROUPS) {
    const gId = `grp-${gName.replace('.', '-')}`;
    const desc = gName.startsWith('1.')
      ? `1-bosqich ${gName}-guruh`
      : `2-bosqich ${gName}-guruh`;

    db.run(
      `INSERT OR IGNORE INTO groups (id, name, description, created_at, is_archived)
       VALUES (?, ?, ?, ?, 0)`,
      [gId, gName, desc, now]
    );
  }
  // Ensure settings has optimal recognition threshold
  db.run("UPDATE settings SET face_match_threshold = 0.58 WHERE face_match_threshold > 0.65");
}

function seedInitialData(): void {
  if (!db) return;

  const now = new Date().toISOString();

  // 1. Admin user
  const adminPwd = hashPassword('litsey2026');
  db.run(
    `INSERT OR IGNORE INTO admins (id, username, password_hash, salt, full_name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['adm-1', 'admin', adminPwd.hash, adminPwd.salt, 'Bosh Administrator', 'superadmin', now]
  );

  // 2. Settings (0.58 calibrated threshold for high recognition accuracy without false alarms)
  db.run(
    `INSERT OR IGNORE INTO settings (id, school_name, start_time, late_threshold_minutes, face_match_threshold, require_manual_confirm_on_low_confidence, enable_liveness_check, camera_device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'default',
      'Akademik Litsey — Face ID Davomat Tizimi',
      '08:30',
      15,
      0.58,
      1,
      1,
      ''
    ]
  );

  // 3. Groups: 1.1 to 1.9 (1-bosqich) and 2.1 to 2.10 (2-bosqich)
  for (const gName of STANDARD_GROUPS) {
    const gId = `grp-${gName.replace('.', '-')}`;
    const desc = gName.startsWith('1.')
      ? `1-bosqich ${gName}-guruh`
      : `2-bosqich ${gName}-guruh`;

    db.run(
      `INSERT OR IGNORE INTO groups (id, name, description, created_at, is_archived)
       VALUES (?, ?, ?, ?, 0)`,
      [gId, gName, desc, now]
    );
  }

  // 4. Students: 0 demo students. The user adds all their own students!

  // 5. Audit log
  db.run(
    `INSERT OR IGNORE INTO audit_logs (id, action, details, user_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ['log-1', 'system_init', 'Litsey Face ID tizimi ishga tushirildi. Guruhlar: 1.1-1.9 va 2.1-2.10 yaratildi', 'adm-1', now]
  );
}

// Helper queries
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function executeRun(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDatabase();
}

export function getDatabaseBinary(): Uint8Array {
  if (!db) throw new Error('Database not initialized');
  return db.export();
}

export async function restoreDatabaseBinary(buffer: Uint8Array): Promise<void> {
  if (!SQL) SQL = await initSqlJs();
  if (db) {
    db.close();
  }
  db = new SQL.Database(buffer);
  ensureTablesAndMigrations();
  saveDatabase();
}

export { hashPassword };
