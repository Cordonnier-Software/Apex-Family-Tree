import Database from 'better-sqlite3';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let db: Database.Database;
vi.mock('./connection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./connection.js')>();
  return { ...actual, getDatabase: () => db };
});

const { registerCustomFunctions } = await import('./connection.js');
const { runMigrations } = await import('./migrator.js');
const { backfillArtifactBridge } = await import('./backfill.js');
const { MediaRepository } = await import('../repositories/MediaRepository.js');
const { PersonRepository } = await import('../repositories/PersonRepository.js');

const migrationsDir = path.resolve(process.cwd(), 'src/migrations');
const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

let alice: string;

beforeEach(() => {
  db = new Database(':memory:');
  registerCustomFunctions(db);
  runMigrations(db, migrationsDir, logger);
  db.pragma('foreign_keys = ON');
  alice = new PersonRepository().create({ display_name: 'Alice Hodgson', sex: 'F' }).id;
});

afterEach(() => db.close());

/** A media_items row as a direct `INSERT` (a bulk import, not create()) leaves it: a file row with nothing in archive_objects. */
const importedMedia = (id: string) => {
  db.prepare(
    `INSERT INTO media_items (id, filename, original_filename, mime_type, file_size, file_path, is_external, created_at, updated_at)
     VALUES (?, ?, ?, 'image/jpeg', 1024, ?, 1, datetime('now'), datetime('now'))`,
  ).run(id, `${id}.jpg`, `${id}.jpg`, `/media/ancestry/photos/${id}.jpg`);
};

const hasArtifact = (id: string) =>
  !!db.prepare("SELECT 1 FROM archive_objects WHERE id = ? AND object_type = 'artifact'").get(id);

const appearsInSubject = (mediaId: string, personId: string) =>
  !!db
    .prepare(
      `SELECT 1 FROM relationship_members
        WHERE relationship_id = ? AND object_id = ? AND role = 'subject'`,
    )
    .get(`rel_appears_in_media_${mediaId}`, personId);

describe('backfilling the artifact bridge', () => {
  it('gives a directly-inserted media row the artifact identity it never got', () => {
    importedMedia('media-imported');

    backfillArtifactBridge(logger);

    expect(hasArtifact('media-imported')).toBe(true);
    const files = db.prepare('SELECT storage_path FROM artifact_files WHERE artifact_id = ?').all('media-imported');
    expect(files).toEqual([{ storage_path: '/media/ancestry/photos/media-imported.jpg' }]);
  });

  it('repairs the appears-in relationship for a person_media link made directly, once the artifact exists', () => {
    importedMedia('media-imported');
    db.prepare(
      `INSERT INTO person_media (person_id, media_id, is_primary, sort_order, created_at)
       VALUES (?, ?, 0, 0, datetime('now'))`,
    ).run(alice, 'media-imported');

    backfillArtifactBridge(logger);

    expect(appearsInSubject('media-imported', alice)).toBe(true);
  });

  it('leaves a media item that already went through create() alone', () => {
    const media = new MediaRepository().create({
      filename: 'portrait.jpg',
      original_filename: 'portrait.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048,
      file_path: '/media/ancestry/photos/portrait.jpg',
    });

    backfillArtifactBridge(logger);

    const artifact = db.prepare('SELECT title FROM archive_objects WHERE id = ?').get(media.id) as { title: string };
    expect(artifact.title).toBe('portrait.jpg');
  });

  it('does nothing twice', () => {
    importedMedia('media-imported');
    db.prepare(
      `INSERT INTO person_media (person_id, media_id, is_primary, sort_order, created_at)
       VALUES (?, ?, 0, 0, datetime('now'))`,
    ).run(alice, 'media-imported');

    backfillArtifactBridge(logger);
    const firstPass = db.prepare('SELECT COUNT(*) AS n FROM relationship_members').get() as { n: number };

    backfillArtifactBridge(logger);
    const secondPass = db.prepare('SELECT COUNT(*) AS n FROM relationship_members').get() as { n: number };

    expect(secondPass.n).toBe(firstPass.n);
  });

  it('leaves a dangling person_media link with no media_items row alone', () => {
    // A link whose media_items row went missing (its own direct-write bug,
    // or a row restored from a backup that doesn't agree with this one) --
    // the same raw-write path that creates the bridge gap can leave this
    // too, so it's only reachable with foreign keys off, same as it was
    // when the row was written.
    db.pragma('foreign_keys = OFF');
    db.prepare(
      `INSERT INTO person_media (person_id, media_id, is_primary, sort_order, created_at)
       VALUES (?, 'media-missing', 0, 0, datetime('now'))`,
    ).run(alice);

    expect(() => backfillArtifactBridge(logger)).not.toThrow();
    expect(appearsInSubject('media-missing', alice)).toBe(false);
  });
});
