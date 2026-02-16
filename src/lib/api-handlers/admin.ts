import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { comparePassword, hashPassword } from '@/lib/password';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { upsertR2Config, getR2Config } from '@/lib/settings';

export const adminHandlers = {
  clearIcons: async () => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      return NextResponse.json({ 
        success: true, 
        message: '在 Edge Runtime (Cloudflare) 环境下，本地文件系统是只读的，无需手动清除。请在 R2 控制台管理您的图标。',
        count: 0 
      });
    } catch (error) {
      console.error('Clear icons error:', error);
      return NextResponse.json({ 
        success: false, 
        message: '清除失败' 
      }, { status: 500 });
    }
  },

  security: async (request: Request) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const userId = session.id as number;
      
      const Schema = z.object({
        currentPassword: z.string().min(5).max(128),
        newEmail: z.string().email().optional(),
        newPassword: z.string().min(5).max(128).optional(),
      });

      const parsed = Schema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
      }
      const { currentPassword, newEmail, newPassword } = parsed.data;
      if (!newEmail && !newPassword) {
        return NextResponse.json({ success: false, message: 'No changes provided' }, { status: 400 });
      }
      const res = await sql<{ password_hash: string }>`SELECT password_hash FROM users WHERE id = ${userId}`;
      const user = res.rows[0];
      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }
      const ok = await comparePassword(currentPassword, user.password_hash);
      if (!ok) {
        return NextResponse.json({ success: false, message: 'Current password incorrect' }, { status: 400 });
      }
      const newHash = newPassword ? await hashPassword(newPassword) : null;
      
      await sql`
        UPDATE users
        SET email = COALESCE(${newEmail || null}, email),
            password_hash = COALESCE(${newHash || null}, password_hash),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
      const cookieStore = await cookies();
      cookieStore.delete('token');
      return NextResponse.json({ success: true, requireReLogin: true });
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
    }
  },

  getSettings: async () => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const cfg = await getR2Config(session.id as number);
      // mask secrets
      const masked = cfg
        ? {
            accessKeyId: cfg.accessKeyId ? '****' + cfg.accessKeyId.slice(-4) : undefined,
            secretAccessKey: cfg.secretAccessKey ? '****' : undefined,
            bucket: cfg.bucket ? '****' + cfg.bucket.slice(-4) : undefined,
            endpoint: cfg.endpoint,
            publicBase: cfg.publicBase,
            iconMaxKB: cfg.iconMaxKB,
            iconMaxSize: cfg.iconMaxSize,
          }
        : null;
      return NextResponse.json({ success: true, data: masked });
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Failed to load settings' }, { status: 500 });
    }
  },

  getStats: async () => {
    try {
      const session = await getSession();
      const userId = (session?.id as number) ?? null;
      
      const [linksCount, categoriesCount, recommendedCount, recentLinks] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM links WHERE (${userId} IS NULL OR user_id = ${userId})`,
        sql`SELECT COUNT(*) as count FROM categories WHERE (${userId} IS NULL OR user_id = ${userId})`,
        sql`SELECT COUNT(*) as count FROM links WHERE (${userId} IS NULL OR user_id = ${userId}) AND is_recommended = 1`,
        sql`SELECT * FROM links WHERE (${userId} IS NULL OR user_id = ${userId}) ORDER BY created_at DESC LIMIT 5`
      ]);
      
      const stats = {
        links: Number(linksCount.rows[0].count),
        categories: Number(categoriesCount.rows[0].count),
        recommended: Number(recommendedCount.rows[0].count),
        recentLinks: recentLinks.rows
      };
      
      return NextResponse.json({ success: true, data: stats });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch stats' }, { status: 500 });
    }
  },

  updateSettings: async (request: Request) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      
      const Schema = z.object({
        accessKeyId: z.string().min(1).optional().or(z.literal('')),
        secretAccessKey: z.string().min(1).optional().or(z.literal('')),
        bucket: z.string().min(1).optional().or(z.literal('')),
        endpoint: z.string().optional().or(z.literal('')),
        publicBase: z.string().optional().or(z.literal('')),
        iconMaxKB: z.number().int().min(16).max(2048).optional(),
        iconMaxSize: z.number().int().min(16).max(512).optional(),
      });

      const body = await request.json();
      const parsed = Schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: 'Invalid settings' }, { status: 400 });
      }
      await upsertR2Config(session.id as number, parsed.data);
      return NextResponse.json({ success: true });
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Failed to save settings' }, { status: 500 });
    }
  }
};
