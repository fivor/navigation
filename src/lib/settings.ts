import { sql } from '@/lib/db';
import crypto from 'node:crypto';

export interface R2Config {
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  endpoint?: string;
  publicBase?: string;
  iconMaxKB?: number;
  iconMaxSize?: number;
}

function getKey(): Buffer | null {
  const base = process.env.SETTINGS_ENC_KEY || process.env.AUTH_SECRET || 'fallback-key-for-navigation';
  return crypto.createHash('sha256').update(base).digest();
}

function encrypt(plain: string): string {
  const key = getKey();
  if (!key) throw new Error('Missing SETTINGS_ENC_KEY');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(encB64: string): string {
  const key = getKey();
  if (!key) throw new Error('Missing SETTINGS_ENC_KEY');
  const buf = Buffer.from(encB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export async function ensureSettingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      r2_access_key_id_enc TEXT,
      r2_secret_access_key_enc TEXT,
      r2_bucket_enc TEXT,
      r2_endpoint_enc TEXT,
      r2_public_base_enc TEXT,
      icon_max_kb INTEGER DEFAULT 128,
      icon_max_size INTEGER DEFAULT 128,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_user ON app_settings(user_id);`;
}

export async function getR2Config(userId: number): Promise<R2Config | null> {
  const res = await sql`
    SELECT * FROM app_settings WHERE user_id = ${userId} LIMIT 1
  `;
  interface SettingsRow {
    r2_access_key_id_enc: string | null;
    r2_secret_access_key_enc: string | null;
    r2_bucket_enc: string | null;
    r2_endpoint_enc: string | null;
    r2_public_base_enc: string | null;
    icon_max_kb: number | null;
    icon_max_size: number | null;
  }
  const row = res.rows[0] as SettingsRow | undefined;
  if (!row) return null;
  const cfg: R2Config = {};
  try { if (row.r2_access_key_id_enc) cfg.accessKeyId = decrypt(row.r2_access_key_id_enc); } catch {}
  try { if (row.r2_secret_access_key_enc) cfg.secretAccessKey = decrypt(row.r2_secret_access_key_enc); } catch {}
  try { if (row.r2_bucket_enc) cfg.bucket = decrypt(row.r2_bucket_enc); } catch {}
  try { if (row.r2_endpoint_enc) cfg.endpoint = decrypt(row.r2_endpoint_enc); } catch {}
  try { if (row.r2_public_base_enc) cfg.publicBase = decrypt(row.r2_public_base_enc); } catch {}
  if (typeof row.icon_max_kb === 'number') cfg.iconMaxKB = row.icon_max_kb;
  if (typeof row.icon_max_size === 'number') cfg.iconMaxSize = row.icon_max_size;
  return cfg;
}

export async function upsertR2Config(userId: number, input: R2Config) {
  const rows = await sql`SELECT id FROM app_settings WHERE user_id = ${userId} LIMIT 1`;
  const payload = {
    r2_access_key_id_enc: input.accessKeyId ? encrypt(input.accessKeyId) : null,
    r2_secret_access_key_enc: input.secretAccessKey ? encrypt(input.secretAccessKey) : null,
    r2_bucket_enc: input.bucket ? encrypt(input.bucket) : null,
    r2_endpoint_enc: input.endpoint ? encrypt(input.endpoint) : null,
    r2_public_base_enc: input.publicBase ? encrypt(input.publicBase) : null,
    icon_max_kb: input.iconMaxKB ?? 128,
    icon_max_size: input.iconMaxSize ?? 128,
  };
  if (rows.rowCount && (rows.rows[0] as { id: number } | undefined)?.id) {
    await sql`
      UPDATE app_settings SET
        r2_access_key_id_enc = ${payload.r2_access_key_id_enc},
        r2_secret_access_key_enc = ${payload.r2_secret_access_key_enc},
        r2_bucket_enc = ${payload.r2_bucket_enc},
        r2_endpoint_enc = ${payload.r2_endpoint_enc},
        r2_public_base_enc = ${payload.r2_public_base_enc},
        icon_max_kb = ${payload.icon_max_kb},
        icon_max_size = ${payload.icon_max_size},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `;
  } else {
    await sql`
      INSERT INTO app_settings (
        user_id, r2_access_key_id_enc, r2_secret_access_key_enc, r2_bucket_enc, r2_endpoint_enc, r2_public_base_enc,
        icon_max_kb, icon_max_size
      ) VALUES (
        ${userId}, ${payload.r2_access_key_id_enc}, ${payload.r2_secret_access_key_enc}, ${payload.r2_bucket_enc},
        ${payload.r2_endpoint_enc}, ${payload.r2_public_base_enc}, ${payload.icon_max_kb}, ${payload.icon_max_size}
      )
    `;
  }
}
