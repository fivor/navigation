import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'experimental-edge';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('token');

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });
}
