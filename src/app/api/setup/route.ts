import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export const runtime = 'edge'; // D1 必须在 Edge Runtime 下运行

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    // Simple protection
    if (secret !== process.env.SETUP_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SQLite 语法调整: 
    // 1. SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT
    // 2. TIMESTAMP WITH TIME ZONE DEFAULT NOW() -> DATETIME DEFAULT CURRENT_TIMESTAMP
    // 3. CHECK (role IN (...)) 保持不变

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(url, user_id)
      );
    `;

    // SQLite 不支持 ADD COLUMN IF NOT EXISTS 这种写法，需要单独处理
    // 但 D1 环境通常是全新部署，直接在 CREATE TABLE 里写好即可
    // 如果是增量更新，建议使用 D1 的 migrations 机制

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

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_user ON app_settings(user_id);
    `;

    // Create default admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    const existingUsers = await sql`SELECT * FROM users WHERE email = ${adminEmail}`;
    
    if (existingUsers.rows.length === 0) {
      const passwordHash = await hashPassword(adminPassword);
      await sql`
        INSERT INTO users (email, password_hash, role)
        VALUES (${adminEmail}, ${passwordHash}, 'admin')
      `;
      return NextResponse.json({ 
        success: true, 
        message: 'Tables created and default admin user created successfully' 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Tables verified/created successfully' 
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup database', 
      details: error.message 
    }, { status: 500 });
  }
}
