import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Link } from '@/types';

export interface LinkHealthStatus {
  id: number;
  url: string;
  title: string;
  status: 'ok' | 'error' | 'redirect' | 'timeout';
  statusCode?: number;
  responseTime?: number;
  errorMessage?: string;
  lastChecked: string;
}

/**
 * 检查单个链接的健康状态
 */
async function checkLinkHealth(link: Link): Promise<LinkHealthStatus> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(link.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // 更新数据库中的检查状态
    await sql`
      UPDATE links
      SET last_check_status = ${response.status},
          last_check_time = CURRENT_TIMESTAMP,
          last_response_time = ${responseTime}
      WHERE id = ${link.id}
    `;

    if (response.status >= 200 && response.status < 300) {
      return {
        id: link.id,
        url: link.url,
        title: link.title,
        status: 'ok',
        statusCode: response.status,
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } else if (response.status >= 300 && response.status < 400) {
      return {
        id: link.id,
        url: link.url,
        title: link.title,
        status: 'redirect',
        statusCode: response.status,
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        id: link.id,
        url: link.url,
        title: link.title,
        status: 'error',
        statusCode: response.status,
        responseTime,
        errorMessage: `HTTP ${response.status}`,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.name === 'AbortError' ? '请求超时' : error.message;

    // 更新数据库中的检查状态
    await sql`
      UPDATE links
      SET last_check_status = ${0},
          last_check_time = CURRENT_TIMESTAMP,
          last_response_time = ${responseTime}
      WHERE id = ${link.id}
    `;

    return {
      id: link.id,
      url: link.url,
      title: link.title,
      status: 'timeout',
      errorMessage,
      responseTime,
      lastChecked: new Date().toISOString()
    };
  }
}

export const healthCheckHandlers = {
  /**
   * 检查所有链接的健康状态
   */
  checkAll: async (request: Request) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '50');
      const userId = session.id as number;

      // 获取需要检查的链接（优先检查很久没有检查的）
      const linksResult = await sql<Link>`
        SELECT * FROM links
        WHERE user_id = ${userId}
        ORDER BY 
          CASE WHEN last_check_time IS NULL THEN 0 ELSE 1 END,
          last_check_time ASC
        LIMIT ${limit}
      `;

      const results: LinkHealthStatus[] = [];
      
      // 串行检查，避免并发过多请求
      for (const link of linksResult.rows) {
        const status = await checkLinkHealth(link);
        results.push(status);
      }

      const summary = {
        total: results.length,
        ok: results.filter(r => r.status === 'ok').length,
        error: results.filter(r => r.status === 'error').length,
        redirect: results.filter(r => r.status === 'redirect').length,
        timeout: results.filter(r => r.status === 'timeout').length
      };

      return NextResponse.json({
        success: true,
        data: results,
        summary
      });
    } catch (error) {
      console.error('Health check error:', error);
      return NextResponse.json(
        { success: false, message: '健康检查失败' },
        { status: 500 }
      );
    }
  },

  /**
   * 检查单个链接
   */
  checkOne: async (id: number) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const linkResult = await sql<Link>`
        SELECT * FROM links WHERE id = ${id} AND user_id = ${session.id as number}
      `;

      if (linkResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Link not found' },
          { status: 404 }
        );
      }

      const status = await checkLinkHealth(linkResult.rows[0]);
      return NextResponse.json({ success: true, data: status });
    } catch (error) {
      console.error('Health check single error:', error);
      return NextResponse.json(
        { success: false, message: '健康检查失败' },
        { status: 500 }
      );
    }
  },

  /**
   * 获取链接健康状态统计
   */
  getStats: async () => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const userId = session.id as number;

      const stats = await sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN last_check_status >= 200 AND last_check_status < 300 THEN 1 ELSE 0 END) as healthy,
          SUM(CASE WHEN last_check_status >= 400 OR last_check_status = 0 THEN 1 ELSE 0 END) as unhealthy,
          SUM(CASE WHEN last_check_time IS NULL THEN 1 ELSE 0 END) as unchecked,
          AVG(last_response_time) as avg_response_time
        FROM links
        WHERE user_id = ${userId}
      `;

      return NextResponse.json({
        success: true,
        data: stats.rows[0]
      });
    } catch (error) {
      console.error('Health check stats error:', error);
      return NextResponse.json(
        { success: false, message: '获取统计失败' },
        { status: 500 }
      );
    }
  }
};
