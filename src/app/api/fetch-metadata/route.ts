import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getR2Config } from '@/lib/settings';
import { uploadToR2 } from '@/lib/r2';

export const runtime = 'edge';

function extractMetadata(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const getMetaTag = (nameOrProperty: string) => {
    const regex = new RegExp(`<meta[^>]*(?:name|property)=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];
    
    // Try reverse order: content then name/property
    const regexRev = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProperty}["']`, 'i');
    const matchRev = html.match(regexRev);
    return matchRev ? matchRev[1] : '';
  };

  const description = getMetaTag('description') || getMetaTag('og:description') || '';
  const ogTitle = getMetaTag('og:title') || '';
  const ogImage = getMetaTag('og:image') || '';

  // Extract icons
  const icons: { href: string; sizeScore: number; priority: number }[] = [];
  const linkRegex = /<link[^>]*rel=["']([^"']*)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const rel = match[1].toLowerCase();
    
    if (rel.includes('icon')) {
      const hrefMatch = fullTag.match(/href=["']([^"']*)["']/i);
      const sizesMatch = fullTag.match(/sizes=["']([^"']*)["']/i);
      
      if (hrefMatch) {
        const href = hrefMatch[1];
        const sizes = sizesMatch ? sizesMatch[1] : '';
        let sizeScore = 48;
        
        const sMatch = sizes.match(/(\d+)\s*x\s*(\d+)/i);
        if (sMatch) {
          sizeScore = Math.max(parseInt(sMatch[1]), parseInt(sMatch[2]));
        } else if (/apple-touch-icon/i.test(rel)) {
          sizeScore = 180;
        } else if (href.toLowerCase().endsWith('.ico')) {
          sizeScore = 64;
        }
        
        const priority = rel.includes('apple-touch-icon') ? 3 : rel.includes('shortcut') ? 1 : 2;
        icons.push({ href, sizeScore, priority });
      }
    }
  }

  if (ogImage) {
    icons.push({ href: ogImage, sizeScore: 300, priority: 0 });
  }

  icons.sort((a, b) => b.sizeScore - a.sizeScore || b.priority - a.priority);

  return {
    title: title || ogTitle,
    description,
    icon: icons.length > 0 ? icons[0].href : ''
  };
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id as number;

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ success: false, message: 'URL is required' }, { status: 400 });
    }

    // Basic SSRF guards
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid URL' }, { status: 400 });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return NextResponse.json({ success: false, message: 'Unsupported protocol' }, { status: 400 });
    }
    const hostname = parsed.hostname.toLowerCase();
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    const isPrivate =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      (isIp &&
        ((hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          (hostname.startsWith('172.') && (() => {
            const seg = Number(hostname.split('.')[1] || '0');
            return seg >= 16 && seg <= 31;
          })()))));
    if (isPrivate) {
      return NextResponse.json({ success: false, message: 'Private addresses are not allowed' }, { status: 400 });
    }

    // Try to fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error('Failed to fetch page');
    }

    const html = await response.text();
    const metadata = extractMetadata(html);

    let title = metadata.title;
    let description = metadata.description;
    let icon = metadata.icon;

    // Resolve relative URLs
    if (icon && !icon.startsWith('http')) {
        try {
            const baseUrl = new URL(url);
            icon = new URL(icon, baseUrl.href).href;
        } catch {
            // Ignore
        }
    }

    // If still no icon, try default favicon.ico
    if (!icon) {
        try {
            const baseUrl = new URL(url);
            icon = `https://www.google.com/s2/favicons?sz=128&domain=${baseUrl.hostname}`;
        } catch {
            // Fallback
        }
    }

    // Download icon; if配置存在R2则上传R2，否则落地到本地
    let localIcon = icon;
    let r2Error = null;

    try {
      const dbCfg = await getR2Config(userId);
      const r2AccessKey = dbCfg?.accessKeyId || process.env.R2_ACCESS_KEY_ID;
      const r2Secret = dbCfg?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
      const r2Bucket = dbCfg?.bucket || process.env.R2_BUCKET;
      const r2Endpoint = dbCfg?.endpoint || process.env.R2_ENDPOINT;
      const r2PublicBase = dbCfg?.publicBase || process.env.R2_PUBLIC_BASE;

      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 5000);
      const iconRes = await fetch(icon, { signal: ctrl.signal });
      clearTimeout(tId);
      
      if (iconRes.ok) {
        const contentType = iconRes.headers.get('content-type') || '';
        const ab = await iconRes.arrayBuffer();
        const buf = new Uint8Array(ab);
        
        let ext = 'png';
        if (contentType.includes('svg')) ext = 'svg';
        else if (contentType.includes('x-icon') || contentType.includes('vnd.microsoft.icon') || icon.toLowerCase().endsWith('.ico')) ext = 'ico';
        else if (contentType.includes('jpeg') || icon.toLowerCase().endsWith('.jpg') || icon.toLowerCase().endsWith('.jpeg')) ext = 'jpg';
        else if (contentType.includes('webp') || icon.toLowerCase().endsWith('.webp')) ext = 'webp';
        
        const base = new URL(url);
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(icon));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
        const fileName = `${base.hostname.replace(/[:/]/g, '_')}_${hash}.${ext}`;

        if (r2AccessKey && r2Secret && r2Bucket && r2Endpoint && r2PublicBase) {
          try {
            const key = `site-icons/${fileName}`;
            await uploadToR2({
              bucket: r2Bucket,
              key: key,
              body: buf,
              contentType: contentType || 'application/octet-stream',
              endpoint: r2Endpoint,
              accessKeyId: r2AccessKey,
              secretAccessKey: r2Secret,
            });
            
            localIcon = `${r2PublicBase.replace(/\/+$/,'')}/${key}`;
          } catch (r2Err: any) {
            console.error('R2 Upload Failed:', r2Err);
            r2Error = r2Err?.message || String(r2Err);
          }
        }
      }
    } catch (err: any) {
      console.error('Process icon error:', err);
    }

    return NextResponse.json({
        success: true,
        data: {
            title: (title || '').trim(),
            description: (description || '').trim(),
            icon: localIcon || '',
            icon_orig: icon || '',
            r2_status: r2Error ? `Fallback to local: ${r2Error}` : 'Success'
        }
    });

  } catch (error) {
    console.error('Fetch metadata error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch metadata' });
  }
}
