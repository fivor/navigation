import { sql } from '@/lib/db';

export interface R2Config {
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  endpoint?: string;
  publicBase?: string;
  iconMaxKB?: number;
  iconMaxSize?: number;
}

// Web Crypto API 兼容的加密工具函数
async function getEncryptionKey(): Promise<CryptoKey> {
  const base = process.env.SETTINGS_ENC_KEY || process.env.AUTH_SECRET || 'fallback-key-for-navigation';
  const encoder = new TextEncoder();
  const data = encoder.encode(base);
  
  // 使用 SHA-256 生成 256 位密钥
  const hash = await crypto.subtle.digest('SHA-256', data);
  
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(plain: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // 拼接 IV + EncryptedData
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...result));
}

async function decrypt(encB64: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
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
  try { if (row.r2_access_key_id_enc) cfg.accessKeyId = await decrypt(row.r2_access_key_id_enc); } catch {}
  try { if (row.r2_secret_access_key_enc) cfg.secretAccessKey = await decrypt(row.r2_secret_access_key_enc); } catch {}
  try { if (row.r2_bucket_enc) cfg.bucket = await decrypt(row.r2_bucket_enc); } catch {}
  try { if (row.r2_endpoint_enc) cfg.endpoint = await decrypt(row.r2_endpoint_enc); } catch {}
  try { if (row.r2_public_base_enc) cfg.publicBase = await decrypt(row.r2_public_base_enc); } catch {}
  if (typeof row.icon_max_kb === 'number') cfg.iconMaxKB = row.icon_max_kb;
  if (typeof row.icon_max_size === 'number') cfg.iconMaxSize = row.icon_max_size;
  return cfg;
}

export async function upsertR2Config(userId: number, input: R2Config) {
  const rows = await sql`SELECT id FROM app_settings WHERE user_id = ${userId} LIMIT 1`;
  const payload = {
    r2_access_key_id_enc: input.accessKeyId ? await encrypt(input.accessKeyId) : null,
    r2_secret_access_key_enc: input.secretAccessKey ? await encrypt(input.secretAccessKey) : null,
    r2_bucket_enc: input.bucket ? await encrypt(input.bucket) : null,
    r2_endpoint_enc: input.endpoint ? await encrypt(input.endpoint) : null,
    r2_public_base_enc: input.publicBase ? await encrypt(input.publicBase) : null,
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
