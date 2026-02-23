import { D1Database } from '@cloudflare/workers-types';
import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * Cloudflare D1 适配器
 * 用于在 Next.js (App Router) 中兼容 Cloudflare Pages 的 D1 绑定
 * 并在本地开发时提供 SQLite 回退
 */

// 本地开发使用的 SQLite 实例缓存
let localDb: any = null;

// 动态导入 better-sqlite3 (仅在 Node.js 环境)
async function getLocalDb() {
  if (localDb) return localDb;
  
  // 检查是否在 Node.js 环境 (非 Edge Runtime)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // 使用动态导入避免 Edge Runtime 打包问题
      const { default: Database } = await import('better-sqlite3');
      localDb = new Database('./local.db');
      console.log('Local SQLite database initialized');
      return localDb;
    } catch (e) {
      console.warn('Failed to load better-sqlite3:', e);
      return null;
    }
  }
  return null;
}

// 全局标记当前使用的数据库类型
let currentDbType: 'd1' | 'sqlite' | null = null;

/**
 * SQL 查询函数 - 自动适配 D1 (生产环境) 和 SQLite (本地开发)
 */
export const sql = async <T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[]; rowCount: number }> => {
  // 1. 构造 SQL 语句
  let query = strings[0];
  for (let i = 1; i < strings.length; i++) {
    query += '?' + strings[i];
  }

  // 2. 获取数据库实例
  let db: D1Database | null = null;

  // 尝试从 getRequestContext 获取 D1 绑定 (Edge Runtime)
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      db = (ctx.env as any).DB as D1Database;
    }
  } catch {
    // Ignore context error - expected in Node.js dev mode
  }

  // D1 绑定可用 - 使用 D1
  if (db) {
    if (currentDbType === 'sqlite') {
      console.warn('[DB] Switching from SQLite to D1 detected! This may cause data inconsistency.');
    }
    currentDbType = 'd1';

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
  }

  // 3. 本地开发回退 - 使用 better-sqlite3
  const isWrangler = typeof (globalThis as any).WebSocketPair !== 'undefined' ||
                     (typeof process !== 'undefined' && process.env.WRANGLER);

  if (!isWrangler) {
    const sqlite = await getLocalDb();
    if (sqlite) {
      if (currentDbType === 'd1') {
        console.warn('[DB] Switching from D1 to SQLite detected! This may cause data inconsistency.');
      }
      currentDbType = 'sqlite';

      const stmt = sqlite.prepare(query);
      const trimmedQuery = query.trim().toUpperCase();

      if (trimmedQuery.startsWith('SELECT')) {
        const results = stmt.all(...values) as T[];
        return { rows: results || [], rowCount: results?.length || 0 };
      } else {
        const result = stmt.run(...values);
        if (trimmedQuery.includes('RETURNING')) {
          const results = stmt.all(...values) as T[];
          return { rows: results || [], rowCount: results?.length || 0 };
        }
        return { rows: [], rowCount: result.changes || 0 };
      }
    }
  }

  throw new Error('D1 Database binding not found. Please ensure you are running with `wrangler pages dev`.');
};
