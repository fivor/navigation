import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { comparePassword, hashPassword } from '@/lib/password';
import { cookies } from 'next/headers';
import { z } from 'zod';

export const runtime = 'edge';

const Schema = z.object({
  currentPassword: z.string().min(5).max(128),
  newEmail: z.string().email().optional(),
  newPassword: z.string().min(5).max(128).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id as number;
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
    
    // SQLite COALESCE works the same way
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
}
