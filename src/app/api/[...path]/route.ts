import { NextResponse } from 'next/server';
import { authHandlers } from '@/lib/api-handlers/auth';
import { categoriesHandlers } from '@/lib/api-handlers/categories';
import { linksHandlers } from '@/lib/api-handlers/links';
import { setupHandlers } from '@/lib/api-handlers/setup';
import { adminHandlers } from '@/lib/api-handlers/admin';
import { exportImportHandlers } from '@/lib/api-handlers/export-import';
import { metadataHandlers } from '@/lib/api-handlers/metadata';

export const runtime = 'edge';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const fullPath = path.join('/');

  // Setup route
  if (fullPath === 'setup') {
    return setupHandlers.setup(request);
  }

  // Categories routes
  if (fullPath === 'categories') {
    return categoriesHandlers.list();
  }

  // Links routes
  if (fullPath === 'links') {
    return linksHandlers.list(request);
  }
  
  // Admin settings
  if (fullPath === 'admin/settings') {
    return adminHandlers.getSettings();
  }
  
  // Export
  if (fullPath === 'export') {
    return exportImportHandlers.export(request);
  }

  return NextResponse.json({ success: false, message: 'Not Found' }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const fullPath = path.join('/');

  // Auth routes
  if (fullPath === 'auth/login') {
    return authHandlers.login(request);
  }
  if (fullPath === 'auth/logout') {
    return authHandlers.logout();
  }

  // Categories routes
  if (fullPath === 'categories') {
    return categoriesHandlers.create(request);
  }

  // Links routes
  if (fullPath === 'links') {
    return linksHandlers.create(request);
  }
  
  // Admin routes
  if (fullPath === 'admin/icons/clear') {
    return adminHandlers.clearIcons();
  }
  if (fullPath === 'admin/security') {
    return adminHandlers.security(request);
  }
  if (fullPath === 'admin/settings') {
    return adminHandlers.updateSettings(request);
  }
  
  // Import routes
  if (fullPath === 'import/chrome') {
    return exportImportHandlers.importChrome(request);
  }
  if (fullPath === 'import/safari') {
    return exportImportHandlers.importSafari(request);
  }
  
  // Metadata
  if (fullPath === 'fetch-metadata') {
    return metadataHandlers.fetchMetadata(request);
  }

  return NextResponse.json({ success: false, message: 'Not Found' }, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const fullPath = path.join('/');

  // Links routes
  if (fullPath === 'links/reorder') {
    return linksHandlers.reorder(request);
  }

  // Categories routes with ID
  if (path[0] === 'categories' && path.length === 2) {
    const id = parseInt(path[1]);
    if (!isNaN(id)) {
      return categoriesHandlers.update(request, id);
    }
  }

  // Links routes with ID
  if (path[0] === 'links' && path.length === 2) {
    const id = parseInt(path[1]);
    if (!isNaN(id)) {
      return linksHandlers.update(request, id);
    }
  }

  return NextResponse.json({ success: false, message: 'Not Found' }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  
  // Categories routes with ID
  if (path[0] === 'categories' && path.length === 2) {
    const id = parseInt(path[1]);
    if (!isNaN(id)) {
      return categoriesHandlers.delete(id);
    }
  }

  // Links routes with ID
  if (path[0] === 'links' && path.length === 2) {
    const id = parseInt(path[1]);
    if (!isNaN(id)) {
      return linksHandlers.delete(id);
    }
  }

  return NextResponse.json({ success: false, message: 'Not Found' }, { status: 404 });
}
