import { cookies } from 'next/headers';
import { verifyToken } from './auth';

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch (error) {
    console.error('Session error:', error);
    return null;
  }
}