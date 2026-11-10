import type Database from 'better-sqlite3';
import { EXERCISE_SEED } from './domain/exercises.seed.js';

/** Schéma et catalogue, indépendants du pilote : utilisés par le serveur (better-sqlite3) et par le mode navigateur (sql.js). */
export type DB = Database.Database;

/**
 * Migrations versionnées via PRAGMA user_version.
 * Pour faire évoluer le schéma : AJOUTER une entrée à la fin, ne jamais modifier une entrée existante.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    sex TEXT CHECK (sex IN ('male','female')),
    height_cm REAL,
    birth_year INTEGER,
    goal TEXT NOT NULL DEFAULT 'hypertrophy',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = exercice du catalogue
    slug TEXT,
    name TEXT NOT NULL,
    muscle TEXT NOT NULL,              -- groupe musculaire principal
    secondary TEXT NOT NULL DEFAULT '[]', -- JSON: groupes secondaires
    equipment TEXT NOT NULL,           -- barbell|dumbbell|machine|cable|bodyweight|kettlebell|band
    pattern TEXT NOT NULL,             -- schéma moteur (squat, hinge, h_push...)
    compound INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX idx_exercises_slug ON exercises(slug) WHERE slug IS NOT NULL;

  CREATE TABLE programs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    config TEXT NOT NULL,     -- JSON: paramètres du générateur
    rationale TEXT NOT NULL,  -- JSON: justification + sources
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE program_days (
    id INTEGER PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    focus TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE program_day_exercises (
    id INTEGER PRIMARY KEY,
    program_day_id INTEGER NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    sets INTEGER NOT NULL,
    reps_min INTEGER NOT NULL,
    reps_max INTEGER NOT NULL,
    rir INTEGER NOT NULL,
    rest_sec INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'accessory'
  );

  CREATE TABLE workouts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TEXT NOT NULL,               -- YYYY-MM-DD (date locale de l'utilisateur)
    status TEXT NOT NULL CHECK (status IN ('planned','in_progress','done')),
    started_at TEXT,
    finished_at TEXT,
    notes TEXT NOT NULL DEFAULT '',
    program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
    deload INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_workouts_user_date ON workouts(user_id, date);

  CREATE TABLE workout_exercises (
    id INTEGER PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    target_sets INTEGER,
    reps_min INTEGER,
    reps_max INTEGER,
    rir INTEGER,
    rest_sec INTEGER,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_we_workout ON workout_exercises(workout_id);
  CREATE INDEX idx_we_exercise ON workout_exercises(exercise_id);

  CREATE TABLE sets (
    id INTEGER PRIMARY KEY,
    workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 0,   -- kg (0 = poids du corps)
    reps INTEGER NOT NULL DEFAULT 0,
    rpe REAL,
    warmup INTEGER NOT NULL DEFAULT 0,
    done INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_sets_we ON sets(workout_exercise_id);

  CREATE TABLE body_metrics (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    weight_kg REAL,
    body_fat_pct REAL,
    waist_cm REAL,
    neck_cm REAL,
    hip_cm REAL,
    chest_cm REAL,
    arm_cm REAL,
    thigh_cm REAL,
    notes TEXT NOT NULL DEFAULT '',
    UNIQUE (user_id, date)
  );
  `,
];

/** Applique les migrations manquantes puis synchronise le catalogue d'exercices. */
export function initSchema(db: DB) {
  migrate(db);
  seedExercises(db);
}

function migrate(db: DB) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/** Catalogue idempotent : upsert par slug, donc ajouter un exercice au seed suffit à le déployer. */
function seedExercises(db: DB) {
  const stmt = db.prepare(`
    INSERT INTO exercises (slug, name, muscle, secondary, equipment, pattern, compound)
    VALUES (@slug, @name, @muscle, @secondary, @equipment, @pattern, @compound)
    ON CONFLICT(slug) WHERE slug IS NOT NULL DO UPDATE SET
      name = excluded.name, muscle = excluded.muscle, secondary = excluded.secondary,
      equipment = excluded.equipment, pattern = excluded.pattern, compound = excluded.compound
  `);
  db.transaction(() => {
    for (const e of EXERCISE_SEED) {
      stmt.run({ ...e, secondary: JSON.stringify(e.secondary), compound: e.compound ? 1 : 0 });
    }
  })();
}
