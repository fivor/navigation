import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { upsertR2Config, getR2Config } from '@/lib/settings';
import { z } from 'zod';

export const runtime = 'experimental-edge';

const Schema = z.object({
  accessKeyId: z.string().min(1).optional().or(z.literal('')),
  secretAccessKey: z.string().min(1).optional().or(z.literal('')),
  bucket: z.string().min(1).optional().or(z.literal('')),
  endpoint: z.string().optional().or(z.literal('')),
  publicBase: z.string().optional().or(z.literal('')),
  iconMaxKB: z.number().int().min(16).max(2048).optional(),
  iconMaxSize: z.number().int().min(16).max(512).optional(),
});

export async function GET() {
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
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
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
