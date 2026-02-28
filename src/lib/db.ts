import { D1Database } from '@cloudflare/workers-types';
import { getRequestContext } from '@cloudflare/next-on-pages';

/**
 * Cloudflare D1 适配器
 * 用于在 Next.js (App Router) 中兼容 Cloudflare Pages 的 D1 绑定
 * 并在本地开发时提供 SQLite 回退或模拟数据库
 */

// 本地开发使用的 SQLite 实例缓存
let localDb: any = null;

// 模拟数据库，用于本地开发环境
let mockUsers: any[] = [];
let mockCategories: any[] = [];
let mockLinks: any[] = [];
let mockSettings: any[] = [];
let nextId = 1;
let lastInsertedRecord: any = null;

function extractValueFromQuery(query: string, values: any[], fieldName: string): any {
  const regex = new RegExp(`${fieldName}\\s*=\\s*\\?`, 'i');
  const match = query.match(regex);
  if (match) {
    const index = query.substring(0, query.indexOf(match[0])).split('?').length - 1;
    return values[index];
  }
  return undefined;
}

const mockDb = {
  prepare: (query: string) => {
    return {
      bind: (...values: any[]) => {
        return {
          all: async <T = any>() => {
            if (query.includes('RETURNING')) {
              if (lastInsertedRecord) {
                return { results: [lastInsertedRecord] as T[] };
              }
              return { results: [] as T[] };
            }
            
            if (query.includes('SELECT * FROM users WHERE email =')) {
              const email = values[0];
              if (email === 'admin@example.com') {
                return { 
                  results: [{ 
                    id: 1, 
                    email: 'admin@example.com', 
                    password_hash: '$pbkdf2$100000$e8e1c2a0b9d8f7c6e5d4c3b2a1f0e9d8$a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
                    role: 'admin',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }] as T[] 
                };
              }
              return { results: [] as T[] };
            }
            
            if (query.includes('SELECT * FROM categories') || query.includes('SELECT id FROM categories')) {
              console.log('[MOCK DB] Query categories, mockCategories length:', mockCategories.length);
              let filteredCategories = [...mockCategories];
              
              // 检查是否有 user_id 过滤条件
              // 处理 "(NULL IS NULL OR user_id = NULL)" 或 "user_id = 1" 等模式
              if (query.includes('user_id')) {
                // 尝试匹配 user_id = 数值 或 user_id = NULL
                const userIdMatch = query.match(/user_id\s*=\s*(\d+)/i);
                if (userIdMatch) {
                  const userId = parseInt(userIdMatch[1]);
                  filteredCategories = filteredCategories.filter(cat => cat.user_id === userId);
                }
                // 如果是 NULL (表示没有 session，返回所有分类)，不过滤
              }
              
              const name = extractValueFromQuery(query, values, 'name');
              if (name !== undefined) {
                filteredCategories = filteredCategories.filter(cat => cat.name === name);
              }
              
              const id = extractValueFromQuery(query, values, 'id');
              if (id !== undefined) {
                filteredCategories = filteredCategories.filter(cat => cat.id === id);
              }
              
              if (query.includes('ORDER BY')) {
                if (query.includes('sort_order ASC')) {
                  filteredCategories.sort((a, b) => a.sort_order - b.sort_order);
                }
                if (query.includes('created_at DESC')) {
                  filteredCategories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
              }
              
              return { results: filteredCategories as T[] };
            }
            
            if (query.includes('SELECT * FROM links')) {
              return { results: mockLinks as T[] };
            }
            
            if (query.includes('SELECT * FROM app_settings')) {
              return { results: mockSettings as T[] };
            }
            
            if (query.includes('SELECT id FROM users WHERE email =')) {
              const email = values[0];
              if (email === 'admin@example.com') {
                return { results: [{ id: 1 }] as T[] };
              }
              return { results: [] as T[] };
            }
            
            // 处理 COUNT 查询
            if (query.includes('COUNT(*)') || query.includes('count(*)')) {
              if (query.includes('FROM links')) {
                return { results: [{ total: mockLinks.length, count: mockLinks.length }] as T[] };
              }
              if (query.includes('FROM categories')) {
                return { results: [{ total: mockCategories.length, count: mockCategories.length }] as T[] };
              }
              return { results: [{ total: 0, count: 0 }] as T[] };
            }
            
            return { results: [] as T[] };
          },
          run: async () => {
            if (query.includes('UPDATE categories')) {
              let whereId: number | undefined;
              const whereIdRegex = /WHERE\s+id\s*=\s*\?/i;
              const whereIdMatch = query.match(whereIdRegex);
              if (whereIdMatch) {
                const index = query.substring(0, query.indexOf(whereIdMatch[0])).split('?').length - 1;
                whereId = values[index];
              }
              
              if (whereId !== undefined) {
                const categoryIndex = mockCategories.findIndex(c => c.id === whereId);
                if (categoryIndex !== -1) {
                  const category = { ...mockCategories[categoryIndex] };
                  
                  const setClauseStart = query.indexOf('SET');
                  const whereClauseStart = query.indexOf('WHERE');
                  const setClause = query.substring(setClauseStart, whereClauseStart);
                  
                  const setMatches = setClause.match(/(\w+)\s*=\s*\?/g);
                  if (setMatches) {
                    let paramIndex = 0;
                    for (const m of setMatches) {
                      const fieldName = m.split('=')[0].trim();
                      const value = values[paramIndex];
                      if (fieldName === 'name') category.name = value;
                      if (fieldName === 'icon') category.icon = value;
                      if (fieldName === 'parent_id') category.parent_id = value;
                      if (fieldName === 'sort_order') category.sort_order = value;
                      paramIndex++;
                    }
                  }
                  
                  category.updated_at = new Date().toISOString();
                  mockCategories[categoryIndex] = category;
                  lastInsertedRecord = category;
                  return { meta: { changes: 1 } };
                }
              }
              return { meta: { changes: 0 } };
            }
            
            if (query.includes('INSERT INTO users')) {
              const user = {
                id: nextId++,
                email: values[0],
                password_hash: values[1],
                role: values[2],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              mockUsers.push(user);
              lastInsertedRecord = user;
              return { meta: { changes: 1 } };
            }
            
            if (query.includes('INSERT INTO categories')) {
              const category = {
                id: nextId++,
                name: values[0],
                icon: values[1],
                parent_id: values[2],
                user_id: values[3],
                sort_order: values[4],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              mockCategories.push(category);
              lastInsertedRecord = category;
              return { meta: { changes: 1 } };
            }
            
            if (query.includes('INSERT INTO links')) {
              const link = {
                id: nextId++,
                title: values[0],
                url: values[1],
                description: values[2],
                icon: values[3],
                icon_orig: values[4],
                category_id: values[5],
                user_id: values[6],
                sort_order: values[7],
                is_recommended: values[8],
                click_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              mockLinks.push(link);
              lastInsertedRecord = link;
              return { meta: { changes: 1 } };
            }
            
            if (query.includes('INSERT INTO app_settings')) {
              const setting = {
                id: nextId++,
                user_id: values[0],
                r2_access_key_id_enc: values[1],
                r2_secret_access_key_enc: values[2],
                r2_bucket_enc: values[3],
                r2_endpoint_enc: values[4],
                r2_public_base_enc: values[5],
                icon_max_kb: values[6],
                icon_max_size: values[7],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              mockSettings.push(setting);
              lastInsertedRecord = setting;
              return { meta: { changes: 1 } };
            }
            
            return { meta: { changes: 1 } };
          }
        };
      }
    };
  }
};

async function getLocalDb() {
  if (localDb) {
    console.log('[DB] Returning cached localDb');
    return localDb;
  }
  
  console.log('[DB] process.versions:', typeof process !== 'undefined' ? process.versions : 'no process');
  
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    console.log('[DB] Trying to load better-sqlite3...');
    try {
      const Database = require('./db-helper.cjs');
      console.log('[DB] Database type:', typeof Database);
      if (Database && typeof Database === 'function') {
        localDb = new Database('./local.db');
        console.log('[DB] Local SQLite database initialized successfully!');
        return localDb;
      }
    } catch (e) {
      console.warn('[DB] Failed to load better-sqlite3:', e);
    }
  }
  console.log('[DB] Using mock database');
  return mockDb;
}

let currentDbType: 'd1' | 'sqlite' | 'mock' | null = null;

export const sql = async <T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<{ rows: T[]; rowCount: number }> => {
  // 构建参数化查询 - 使用模板字符串正确构建带 ? 占位符的查询
  let query = '';
  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      query += '?';
    }
  }

  let db: D1Database | null = null;
  
  // 检测是否在 Cloudflare Pages 环境中
  const isCloudflarePages = typeof process !== 'undefined' && process.env.CF_PAGES === 'true';
  console.log('[DB] Is Cloudflare Pages:', isCloudflarePages);
  
  // 尝试从多种方式获取 D1 绑定
  try {
    // 方法1: 使用 getRequestContext
    const ctx = getRequestContext();
    console.log('[DB] getRequestContext result:', ctx);
    if (ctx && ctx.env && (ctx.env as any).DB) {
      db = (ctx.env as any).DB as D1Database;
      console.log('[DB] D1 database found via getRequestContext!');
    }
  } catch (e) {
    console.log('[DB] getRequestContext error:', e);
  }
  
  // 方法2: 如果在 Cloudflare 环境中但 ctx 没有，尝试从全局 context 获取
  if (!db && isCloudflarePages && typeof globalThis !== 'undefined') {
    console.log('[DB] Trying to get D1 from global context');
    // Cloudflare Workers 环境会有 context 对象
  }

  if (db) {
    if (currentDbType === 'sqlite' || currentDbType === 'mock') {
      console.warn('[DB] Switching from local to D1 detected! This may cause data inconsistency.');
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

  const isWrangler = (typeof process !== 'undefined' && process.env.WRANGLER) ||
                     (typeof window === 'undefined' && typeof (globalThis as any).WebSocketPair !== 'undefined' && 
                      !process?.env?.NEXT_PUBLIC_VERCEL_ENV);

  const localDatabase = await getLocalDb();
  if (localDatabase && !isWrangler) {
    if (currentDbType === 'd1') {
      console.warn('[DB] Switching from D1 to local database detected! This may cause data inconsistency.');
    }
    currentDbType = localDatabase === mockDb ? 'mock' : 'sqlite';

    // 修复 SQL 查询中的 NULL 比较问题
    // 当第一个参数是 NULL 时 (表示没有 session)，需要返回所有分类
    let fixedQuery = query;
    let fixedValues = [...values];
    if (values[0] === null) {
      // 移除整个 WHERE 条件中的 (? IS NULL OR user_id = ?) 部分
      // 保留其他部分
      fixedQuery = query.replace(/\(\?\s+IS\s+NULL\s+OR\s+user_id\s*=\s*\?\)/gi, '1=1');
      // 只保留非 null 的参数
      fixedValues = values.slice(1).filter(v => v !== null);
    }
    
    const trimmedQuery = fixedQuery.trim().toUpperCase();
    const finalStmt = localDatabase.prepare(fixedQuery);
    console.log('[SQLITE] Executing query:', fixedQuery);
    console.log('[SQLITE] Values:', fixedValues);

    // 统一处理结果格式
    const getResults = (res: any) => {
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.results)) return res.results;
      return [];
    };
    
    if (trimmedQuery.startsWith('SELECT')) {
      const results = await finalStmt.bind(...fixedValues).all();
      const rows = getResults(results);
      return { rows, rowCount: rows.length };
    } else {
      const result = await finalStmt.bind(...fixedValues).run();
      if (trimmedQuery.includes('RETURNING')) {
        const results = await finalStmt.bind(...fixedValues).all();
        const rows = getResults(results);
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: result.changes || 0 };
    }
  }

  throw new Error('D1 Database binding not found. Please ensure you are running with `wrangler pages dev`.');
};
