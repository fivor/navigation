import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { hashPassword } from '@/lib/password';

/**
 * 执行数据库迁移
 * 添加新功能所需的字段
 */
async function runMigrations() {
  const results: { field: string; status: 'added' | 'exists' | 'error'; error?: string }[] = [];

  // 迁移：click_count
  try {
    await sql`ALTER TABLE links ADD COLUMN click_count INTEGER DEFAULT 0`;
    results.push({ field: 'click_count', status: 'added' });
  } catch (error: any) {
    if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
      results.push({ field: 'click_count', status: 'exists' });
    } else {
      results.push({ field: 'click_count', status: 'error', error: error.message });
    }
  }

  // 迁移：last_clicked_at
  try {
    await sql`ALTER TABLE links ADD COLUMN last_clicked_at DATETIME`;
    results.push({ field: 'last_clicked_at', status: 'added' });
  } catch (error: any) {
    if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
      results.push({ field: 'last_clicked_at', status: 'exists' });
    } else {
      results.push({ field: 'last_clicked_at', status: 'error', error: error.message });
    }
  }

  // 迁移：last_check_status
  try {
    await sql`ALTER TABLE links ADD COLUMN last_check_status INTEGER`;
    results.push({ field: 'last_check_status', status: 'added' });
  } catch (error: any) {
    if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
      results.push({ field: 'last_check_status', status: 'exists' });
    } else {
      results.push({ field: 'last_check_status', status: 'error', error: error.message });
    }
  }

  // 迁移：last_check_time
  try {
    await sql`ALTER TABLE links ADD COLUMN last_check_time DATETIME`;
    results.push({ field: 'last_check_time', status: 'added' });
  } catch (error: any) {
    if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
      results.push({ field: 'last_check_time', status: 'exists' });
    } else {
      results.push({ field: 'last_check_time', status: 'error', error: error.message });
    }
  }

  // 迁移：last_response_time
  try {
    await sql`ALTER TABLE links ADD COLUMN last_response_time INTEGER`;
    results.push({ field: 'last_response_time', status: 'added' });
  } catch (error: any) {
    if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
      results.push({ field: 'last_response_time', status: 'exists' });
    } else {
      results.push({ field: 'last_response_time', status: 'error', error: error.message });
    }
  }

  return results;
}

export const setupHandlers = {
  /**
   * 执行数据库迁移
   */
  migrate: async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const secret = searchParams.get('secret');
      
      // Simple protection
      if (secret !== process.env.SETUP_SECRET && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const results = await runMigrations();
      
      return NextResponse.json({
        success: true,
        message: 'Database migration completed',
        migrations: results
      });
    } catch (error: any) {
      console.error('Migration error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Migration failed' },
        { status: 500 }
      );
    }
  },

  setup: async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const secret = searchParams.get('secret');

      // Try to read SETUP_SECRET from Cloudflare Pages env bindings when available
      let envSetupSecret: string | undefined = process.env.SETUP_SECRET;
      try {
        const ctx = getRequestContext();
        if (ctx && ctx.env && (ctx.env as any).SETUP_SECRET) {
          envSetupSecret = (ctx.env as any).SETUP_SECRET as string;
        }
        if (process.env.NODE_ENV !== 'production') {
          const mask = (v: unknown) => typeof v === 'string' ? v.replace(/.(?=.{4})/g, '*') : v;
          // eslint-disable-next-line no-console
          console.log('[setup] env check', {
            ctxEnv: !!(ctx?.env as any)?.SETUP_SECRET,
            procEnv: !!process.env.SETUP_SECRET,
            received: mask(secret),
            nodeEnv: process.env.NODE_ENV
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          const mask = (v: unknown) => typeof v === 'string' ? v.replace(/.(?=.{4})/g, '*') : v;
          // eslint-disable-next-line no-console
          console.log('[setup] env check', {
            procEnv: !!process.env.SETUP_SECRET,
            received: mask(secret),
            nodeEnv: process.env.NODE_ENV
          });
        }
      }

      // Simple protection: if running in production-like mode, require matching secret
      const isProd = process.env.NODE_ENV === 'production';
      if (secret !== envSetupSecret && isProd) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Create users table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `;

      // Create categories table
      await sql`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(100) NOT NULL,
          icon VARCHAR(50),
          parent_id INTEGER REFERENCES categories(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
      `;
      // Ensure category names are unique per user to avoid duplicate creations (race conditions)
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name ON categories(user_id, name);
      `;

      // Create links table
      await sql`
        CREATE TABLE IF NOT EXISTS links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title VARCHAR(200) NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          icon_orig TEXT,
          category_id INTEGER NOT NULL REFERENCES categories(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          sort_order INTEGER DEFAULT 0,
          is_recommended BOOLEAN DEFAULT FALSE,
          click_count INTEGER DEFAULT 0,
          last_clicked_at DATETIME,
          last_check_status INTEGER,
          last_check_time DATETIME,
          last_response_time INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(url, user_id)
        );
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_links_category_id ON links(category_id);
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_links_sort_order ON links(sort_order);
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_links_user_category_sort ON links(user_id, category_id, sort_order);
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_categories_user_sort ON categories(user_id, sort_order);
      `;

      // Create app_settings table
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

      // 迁移：为现有 links 表添加新字段
      try {
        await sql`ALTER TABLE links ADD COLUMN click_count INTEGER DEFAULT 0`;
      } catch { /* 字段可能已存在 */ }
      try {
        await sql`ALTER TABLE links ADD COLUMN last_clicked_at DATETIME`;
      } catch { /* 字段可能已存在 */ }
      try {
        await sql`ALTER TABLE links ADD COLUMN last_check_status INTEGER`;
      } catch { /* 字段可能已存在 */ }
      try {
        await sql`ALTER TABLE links ADD COLUMN last_check_time DATETIME`;
      } catch { /* 字段可能已存在 */ }
      try {
        await sql`ALTER TABLE links ADD COLUMN last_response_time INTEGER`;
      } catch { /* 字段可能已存在 */ }

      // Create default admin user if not exists
      const email = 'admin@example.com';
      const password = 'admin'; // Should be changed after setup
      const passwordHash = await hashPassword(password);

      // Check if admin exists
      const userResult = await sql`SELECT id FROM users WHERE email = ${email}`;
      
      if (userResult.rows.length === 0) {
        await sql`
          INSERT INTO users (email, password_hash, role)
          VALUES (${email}, ${passwordHash}, 'admin')
        `;
        return NextResponse.json({ success: true, message: 'Database setup completed. Default admin created.' });
      }

      return NextResponse.json({ success: true, message: 'Database setup completed. Admin already exists.' });
    } catch (error: any) {
      console.error('Setup error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Setup failed' },
        { status: 500 }
      );
    }
  }
};
