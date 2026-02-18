import { D1Database } from '@cloudflare/workers-types';
import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * Cloudflare D1 适配器
 * 用于在 Next.js (App Router) 中兼容 Cloudflare Pages 的 D1 绑定
 * 并在本地开发时提供 SQLite 回退
 */

const localDb: any = null;

export const sql = async <T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[]; rowCount: number }> => {
  // 1. 构造 SQL 语句
  let query = '';
  // Combine strings into query
  query = strings[0];
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
  } catch (e) {
    // Ignore context error
  }

  // 尝试从 process.env 获取 (Legacy / Custom setup)
  if (!db && process.env.DB) {
    db = (process.env.DB as unknown) as D1Database;
  }

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

  // 3. 这里的本地开发回退代码已被移除，因为我们使用 wrangler pages dev 进行本地开发
  // 并且 D1 绑定已经可用
  console.warn('D1 Database binding not found. Please ensure you are running with `wrangler pages dev` and have D1 binding configured.');
  return { rows: [], rowCount: 0 };
};
