import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export const runtime = 'edge';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Define public paths that don't require authentication
  const isPublicPath = path === '/admin/login';
  
  // Check if the path is a protected admin path
  const isAdminPath = path.startsWith('/admin');

  // Get the token from the cookies
  const token = request.cookies.get('token')?.value || '';

  // Verify the token
  const payload = token ? await verifyToken(token) : null;
  const isAuthenticated = !!payload;

  // Redirect logic
  if (isAdminPath && !isPublicPath && !isAuthenticated) {
    // Redirect to login if accessing protected admin route without auth
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (isPublicPath && isAuthenticated) {
    // Redirect to admin dashboard if already logged in and trying to access login page
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
