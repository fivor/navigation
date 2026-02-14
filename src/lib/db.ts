import { D1Database } from '@cloudflare/workers-types';

/**
 * Cloudflare D1 适配器
 * 用于在 Next.js (App Router) 中兼容 Cloudflare Pages 的 D1 绑定
 * 并在本地开发时提供 SQLite 回退
 */

let localDb: any = null;

export const sql = async <T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[]; rowCount: number }> => {
  // 1. 构造 SQL 语句
  let query = '';
  const isSQLite = true; // D1 和 better-sqlite3 都使用 ? 占位符

  if (isSQLite) {
    query = strings[0];
    for (let i = 1; i < strings.length; i++) {
      query += '?' + strings[i];
    }
  }

  // 2. 获取数据库实例
  // 在 Cloudflare Pages 中，DB 绑定在 process.env.DB
  const db = (process.env.DB as unknown) as D1Database;

  if (db) {
    try {
      const stmt = db.prepare(query).bind(...values);
      const trimmedQuery = query.trim().toUpperCase();
      
      if (trimmedQuery.startsWith('SELECT')) {
        const { results } = await stmt.all<T>();
        return { rows: results || [], rowCount: results?.length || 0 };
      } else {
        const result = await stmt.run();
        if (trimmedQuery.includes('RETURNING')) {
          const { results } = await stmt.all<T>();
          return { rows: results || [], rowCount: results?.length || 0 };
        }
        return { rows: [], rowCount: result.meta?.changes || 0 };
      }
    } catch (error) {
      console.error('D1 Query Error:', error);
      throw error;
    }
  }

  // 3. 本地开发回退 (Node.js 环境)
  // 注意：在 next dev 中如果设置了 runtime = 'edge'，原生模块无法加载
  // 仅当非 Edge Runtime 时才尝试加载本地数据库
  if (process.env.NODE_ENV === 'development' && typeof process !== 'undefined' && process.release?.name === 'node') {
    try {
      // 尝试加载 better-sqlite3
      let Database;
      try {
        Database = require('better-sqlite3');
      } catch (e) {
        // 在 Edge Runtime 下，require('better-sqlite3') 会抛出错误
        throw e;
      }

      if (!localDb) {
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'local.db');
        localDb = new Database(dbPath);
      }

      const stmt = localDb.prepare(query);
      const trimmedQuery = query.trim().toUpperCase();

      if (trimmedQuery.startsWith('SELECT')) {
        const rows = stmt.all(...values) as T[];
        return { rows: rows || [], rowCount: rows?.length || 0 };
      } else {
        const result = stmt.run(...values);
        if (trimmedQuery.includes('RETURNING')) {
          const rows = localDb.prepare(query).all(...values) as T[];
          return { rows: rows || [], rowCount: rows?.length || 0 };
        }
        return { rows: [], rowCount: result.changes || 0 };
      }
    } catch (error) {
      // 如果是在 Edge Runtime 下尝试运行此代码，会进入这里
      console.warn('Local SQLite fallback failed. If you are in Edge Runtime, this is expected.');
    }
  }

  console.error('D1 Database binding "DB" not found.');
  throw new Error('D1 Database not bound. If you are developing locally, please ensure you are not using Edge Runtime for local testing with SQLite, or use "wrangler pages dev" which supports D1 bindings.');
};
