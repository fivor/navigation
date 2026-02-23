import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Link } from '@/types';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

/**
 * 获取链接列表
 * @param userId - 用户ID，null 表示获取所有用户的链接
 * @param options - 查询选项
 */
export async function getLinks(
  userId: number | null,
  options: {
    categoryId?: number | null;
    search?: string | null;
    limit?: number;
    offset?: number;
  } = {}
): Promise<(Link & { category_name: string })[]> {
  const { categoryId = null, search = null, limit = 100, offset = 0 } = options;
  const searchPattern = search ? `%${search}%` : null;

  const result = await sql<Link & { category_name: string }>`
    SELECT l.*, c.name as category_name
    FROM links l
    LEFT JOIN categories c ON l.category_id = c.id
    WHERE (${userId} IS NULL OR l.user_id = ${userId})
    AND (${categoryId} IS NULL OR l.category_id = ${categoryId})
    AND (${searchPattern} IS NULL OR l.title LIKE ${searchPattern} OR l.description LIKE ${searchPattern})
    ORDER BY l.sort_order ASC, l.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result.rows;
}

/**
 * URL 规范化函数 - 用于重复检测
 * 移除协议、www 前缀和尾部斜杠
 */
function normalizeUrl(inputUrl: string): string {
  try {
    const urlObj = new URL(inputUrl);
    const hostname = urlObj.hostname.replace(/^www\./i, '');
    const pathname = urlObj.pathname.replace(/\/$/, '');
    return (hostname + pathname).toLowerCase();
  } catch {
    return inputUrl.toLowerCase().replace(/\/$/, '');
  }
}

export const linksHandlers = {
  list: async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!) : null;
      const search = searchParams.get('search') || null;
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      const session = await getSession();
      const userId = (session?.id as number) ?? null;

      const rows = await getLinks(userId, { categoryId, search, limit, offset });

      const searchPattern = search ? `%${search}%` : null;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM links l
        WHERE (${userId} IS NULL OR l.user_id = ${userId})
        AND (${categoryId} IS NULL OR l.category_id = ${categoryId})
        AND (${searchPattern} IS NULL OR l.title LIKE ${searchPattern} OR l.description LIKE ${searchPattern})
      `;

      const total = parseInt(countResult.rows[0].total as string);

      return NextResponse.json({
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get links error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch links' },
        { status: 500 }
      );
    }
  },

  create: async (request: Request) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const body = await request.json() as Record<string, unknown>;

      // 数据验证
      const Schema = z.object({
        title: z.coerce.string().min(1).max(200),
        url: z.coerce.string().min(1),
        description: z.coerce.string().max(500).optional().nullable(),
        categoryId: z.coerce.number().int(),
        icon: z.coerce.string().optional().nullable(),
        icon_orig: z.coerce.string().optional().nullable(),
        sort_order: z.coerce.number().int().min(0).optional(),
        is_recommended: z.coerce.boolean().optional(),
      });

      const parse = Schema.safeParse(body);
      if (!parse.success) {
        return NextResponse.json({
          success: false,
          message: 'Invalid link data: ' + parse.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        }, { status: 400 });
      }

      const { title, url, description, categoryId, icon, icon_orig, sort_order, is_recommended } = parse.data;
      const userId = Number(session.id);

      // 检查链接是否已存在（精确匹配）
      const exactMatch = await sql<{ id: number; user_id: number }>`
        SELECT id, user_id FROM links WHERE LOWER(url) = LOWER(${url})
      `;

      const sameUserMatch = exactMatch.rows.find((row) => row.user_id === userId);
      if (sameUserMatch) {
        return NextResponse.json(
          { success: false, message: '该链接已存在，请勿重复添加' },
          { status: 409 }
        );
      }

      // 检查链接变体（www、尾部斜杠等）
      const allLinks = await sql<{ id: number; url: string; user_id: number }>`
        SELECT id, url, user_id FROM links WHERE user_id = ${userId}
      `;

      const normalizedNewUrl = normalizeUrl(url);
      const duplicate = allLinks.rows.find((row) => {
        return normalizeUrl(row.url) === normalizedNewUrl;
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, message: '该链接已存在，请勿重复添加' },
          { status: 409 }
        );
      }

      // 插入新链接
      try {
        const result = await sql<Link>`
          INSERT INTO links (title, url, description, category_id, icon, icon_orig, user_id, sort_order, is_recommended)
          VALUES (${title}, ${url}, ${description || null}, ${categoryId}, ${icon || null}, ${icon_orig || null}, ${userId}, ${sort_order || 0}, ${is_recommended || false})
          RETURNING *
        `;

        revalidatePath('/');
        revalidatePath('/admin');
        revalidatePath('/admin/links');
        return NextResponse.json({ success: true, data: result.rows[0] });
      } catch (insertError: any) {
        // D1 本地开发模式 workaround：处理唯一约束错误
        if (insertError.message?.includes('UNIQUE constraint failed')) {
          return NextResponse.json(
            { success: false, message: '该链接已存在，请勿重复添加' },
            { status: 409 }
          );
        }
        throw insertError;
      }
    } catch (error: any) {
      console.error('Create link error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to create link' },
        { status: 500 }
      );
    }
  },

  update: async (request: Request, id: number) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const body = await request.json() as Record<string, unknown>;

      // 数据预处理和验证
      const rawIsRecommended = body.is_recommended;
      let processedIsRecommended = false;
      if (typeof rawIsRecommended === 'boolean') {
        processedIsRecommended = rawIsRecommended;
      } else if (typeof rawIsRecommended === 'number') {
        processedIsRecommended = rawIsRecommended === 1;
      } else if (typeof rawIsRecommended === 'string') {
        processedIsRecommended = rawIsRecommended === 'true' || rawIsRecommended === '1';
      }

      const categoryId = Number(body.categoryId ?? body.category_id);
      if (!categoryId || isNaN(categoryId)) {
        return NextResponse.json({
          success: false,
          message: 'Invalid link data: categoryId: 请选择分类'
        }, { status: 400 });
      }

      const title = String(body.title ?? '').trim();
      const url = String(body.url ?? '').trim();

      if (!title) {
        return NextResponse.json({
          success: false,
          message: 'Invalid link data: title: 标题不能为空'
        }, { status: 400 });
      }

      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return NextResponse.json({
          success: false,
          message: 'Invalid link data: url: 无效的URL格式'
        }, { status: 400 });
      }

      const description = body.description ? String(body.description) : null;
      const icon = body.icon ? String(body.icon) : null;
      const icon_orig = body.icon_orig ? String(body.icon_orig) : null;
      const sort_order = Number(body.sort_order) || 0;
      const is_recommended = processedIsRecommended;
      const userId = Number(session.id);

      // 检查是否有其他链接使用相同的 URL
      const existingUrl = await sql<{ id: number }>`
        SELECT id FROM links WHERE LOWER(url) = LOWER(${url}) AND user_id = ${userId} AND id != ${id}
      `;

      if (existingUrl.rows.length > 0) {
        return NextResponse.json(
          { success: false, message: '该链接已存在，请勿重复添加' },
          { status: 409 }
        );
      }

      const result = await sql<Link>`
        UPDATE links
        SET title = ${title},
            url = ${url},
            description = ${description},
            category_id = ${categoryId},
            icon = ${icon},
            icon_orig = ${icon_orig},
            sort_order = ${sort_order},
            is_recommended = ${is_recommended},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;

      if (result.rows.length === 0) {
        // 检查链接是否存在（幂等性处理）
        const check = await sql`SELECT id FROM links WHERE id = ${id} AND user_id = ${userId}`;
        if (check.rows.length === 0) {
          return NextResponse.json({ success: true, id });
        }
        return NextResponse.json({ success: false, message: 'Link not found or permission denied' }, { status: 404 });
      }

      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/admin/links');
      return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Update link error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update link' },
        { status: 500 }
      );
    }
  },

  delete: async (id: number) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const userId = Number(session.id);
      const result = await sql`
        DELETE FROM links
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
      `;

      if (result.rows.length === 0) {
        // 幂等性处理：检查链接是否已不存在
        const check = await sql`SELECT id FROM links WHERE id = ${id}`;
        if (check.rows.length === 0) {
          return NextResponse.json({ success: true, id });
        }
        return NextResponse.json({ success: false, message: 'Link not found or permission denied' }, { status: 404 });
      }

      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/admin/links');
      return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Delete link error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to delete link' },
        { status: 500 }
      );
    }
  },

  reorder: async (request: Request) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const { linkIds } = await request.json() as { linkIds?: number[] };

      if (!Array.isArray(linkIds)) {
        return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
      }

      if (linkIds.length === 0) {
        return NextResponse.json({ success: true });
      }

      const userId = Number(session.id);

      // 使用事务批量更新排序
      await Promise.all(
        linkIds.map((id, index) =>
          sql`UPDATE links SET sort_order = ${index} WHERE id = ${id} AND user_id = ${userId}`
        )
      );

      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/admin/links');
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Reorder error:', error);
      return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
  },

  /**
   * 记录链接点击（增加点击计数）
   */
  trackClick: async (id: number) => {
    try {
      await sql`
        UPDATE links
        SET click_count = click_count + 1,
            last_clicked_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Track click error:', error);
      return NextResponse.json({ success: false, message: 'Failed to track click' }, { status: 500 });
    }
  },

  /**
   * 获取热门链接（按点击数排序）
   */
  getPopular: async (request: Request) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '10');
      const days = parseInt(searchParams.get('days') || '30');

      const result = await sql<Link & { category_name: string }>`
        SELECT l.*, c.name as category_name
        FROM links l
        LEFT JOIN categories c ON l.category_id = c.id
        WHERE l.click_count > 0
          AND (l.last_clicked_at IS NULL OR l.last_clicked_at > datetime('now', '-${days} days'))
        ORDER BY l.click_count DESC, l.last_clicked_at DESC
        LIMIT ${limit}
      `;

      return NextResponse.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Get popular links error:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch popular links' }, { status: 500 });
    }
  }
};
