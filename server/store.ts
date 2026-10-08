// Share snapshot storage. Swappable: the API only talks to `ShareStore`.
// Dev/preview: JSON files in `.data/shares/` (gitignored). Tests: in-memory.
// Production: implement this interface on Postgres/Supabase (see docs/phase-3/export-share.md).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ShareRecord {
  id: string;
  title: string;
  /** Snapshot of the BoardDoc. `null` once revoked (data is dropped, a tombstone remains). */
  doc: unknown;
  /** sha256 (hex) of the edit token — the token itself is never stored. */
  tokenHash: string;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number;
}

export interface ShareStore {
  get(id: string): Promise<ShareRecord | undefined>;
  put(record: ShareRecord): Promise<void>;
}

export class MemoryShareStore implements ShareStore {
  private records = new Map<string, ShareRecord>();
  async get(id: string) {
    const r = this.records.get(id);
    return r ? structuredClone(r) : undefined;
  }
  async put(record: ShareRecord) {
    this.records.set(record.id, structuredClone(record));
  }
}

/** Ids are validated by the API (`[A-Za-z0-9_-]{22}`) before they reach the store; checked again here. */
const SAFE_ID = /^[A-Za-z0-9_-]{22}$/;

export class FileShareStore implements ShareStore {
  private dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  private file(id: string) {
    if (!SAFE_ID.test(id)) throw new Error('Invalid share id');
    return path.join(this.dir, `${id}.json`);
  }

  async get(id: string) {
    try {
      return JSON.parse(await readFile(this.file(id), 'utf8')) as ShareRecord;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw e;
    }
  }

  async put(record: ShareRecord) {
    await mkdir(this.dir, { recursive: true });
    const target = this.file(record.id);
    // Write-then-rename so a crash never leaves a half-written snapshot.
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(record));
    await rename(tmp, target);
  }
}
