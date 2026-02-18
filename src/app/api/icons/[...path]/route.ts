import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const filename = path.join('/');
    const objectKey = `icons/${filename}`;

    const { env } = getRequestContext();
    const R2 = (env as any).R2;

    if (!R2) {
      return NextResponse.json({ success: false, message: 'R2 binding not found' }, { status: 500 });
    }

    const object = await R2.get(objectKey);

    if (object === null) {
      return NextResponse.json({ success: false, message: 'Object Not Found' }, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error('Error fetching from R2:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
