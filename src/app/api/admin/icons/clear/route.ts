import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const runtime = 'experimental-edge';

export async function POST() {
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
}
