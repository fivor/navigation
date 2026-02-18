import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { comparePassword } from '@/lib/password';
import { signToken } from '@/lib/auth';
import { User } from '@/types';
import { z } from 'zod';

// Extend User type to include password_hash for internal use
interface DBUser extends User {
  password_hash: string;
}

// Simple in-memory rate limiter per IP
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const attemptStore = new Map<string, { count: number; start: number }>();

function getClientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  return 'unknown';
}

function checkRateLimit(request: Request) {
  const ip = getClientIp(request);
  const now = Date.now();
  const rec = attemptStore.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    attemptStore.set(ip, { count: 1, start: now });
    return { ok: true };
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return { ok: false };
  }
  rec.count += 1;
  attemptStore.set(ip, rec);
  return { ok: true };
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(5).max(128),
});

export const authHandlers = {
  login: async (request: Request) => {
    try {
      const rl = checkRateLimit(request);
      if (!rl.ok) {
        return NextResponse.json(
          { success: false, message: 'Too many attempts, please try later' },
          { status: 429 }
        );
      }

      const parsed = LoginSchema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: 'Invalid email or password format' },
          { status: 400 }
        );
      }
      const { email, password } = parsed.data;

      if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, message: 'Server auth misconfiguration' },
          { status: 500 }
        );
      }

      const result = await sql<DBUser>`
        SELECT * FROM users WHERE email = ${email}
      `;

      const user = result.rows[0];

      if (!user) {
        return NextResponse.json(
          { success: false, message: 'Invalid credentials' },
          { status: 401 }
        );
      }

      const isValid = await comparePassword(password, user.password_hash);

      if (!isValid) {
        return NextResponse.json(
          { success: false, message: 'Invalid credentials' },
          { status: 401 }
        );
      }

      console.log('User role before signing token:', user.role); // Add this line for debugging

      const token = await signToken({ 
        id: user.id, 
        email: user.email, 
        role: user.role 
      });

      const cookieStore = await cookies();
      cookieStore.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      const { password_hash, ...userWithoutPassword } = user;
      
      return NextResponse.json({
        success: true,
        token,
        user: userWithoutPassword
      });

    } catch (error) {
      console.error('Login error:', error);
      return NextResponse.json(
        { success: false, message: 'Internal server error' },
        { status: 500 }
      );
    }
  },

  logout: async () => {
    const cookieStore = await cookies();
    cookieStore.delete('token');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};
