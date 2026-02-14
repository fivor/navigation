import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { getSession } from '@/lib/session';
import { getR2Config } from '@/lib/settings';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'edge';

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
    // Set a timeout
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
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
    
    // Extract description
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

    // Extract best favicon (prefer highest resolution)
    let icon = '';
    type IconCandidate = { href: string; sizeScore: number; priority: number };
    const candidates: IconCandidate[] = [];

    $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      const sizes = $(el).attr('sizes') || '';
      let sizeScore = 0;
      const match = sizes.match(/(\d+)\s*x\s*(\d+)/i);
      if (match) {
        const w = parseInt(match[1], 10);
        const h = parseInt(match[2], 10);
        sizeScore = Math.max(w, h);
      } else {
        // Heuristic: filename hints
        if (/(\d{2,4})\.png$/i.test(href)) {
          sizeScore = parseInt(RegExp.$1, 10);
        } else if (/apple-touch-icon/i.test(href)) {
          sizeScore = 180;
        } else if (/favicon\.ico$/i.test(href)) {
          sizeScore = 64;
        } else {
          sizeScore = 48;
        }
      }
      const rel = ($(el).attr('rel') || '').toLowerCase();
      const priority = rel.includes('apple-touch-icon') ? 3 : rel.includes('icon') ? 2 : 1;
      candidates.push({ href, sizeScore, priority });
    });

    // Also consider og:image but with lower priority as it can be large photos
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      candidates.push({ href: ogImage, sizeScore: 300, priority: 0 });
    }

    candidates.sort((a, b) => b.sizeScore - a.sizeScore || b.priority - a.priority);
    if (candidates.length > 0) {
      icon = candidates[0].href;
    }

    // Resolve relative URLs
    if (icon && !icon.startsWith('http')) {
        try {
            const baseUrl = new URL(url);
            // Handle absolute path /icon.png or relative path icon.png
            if (icon.startsWith('/')) {
                icon = `${baseUrl.origin}${icon}`;
            } else {
                // Determine base path from URL if it has path
                // Simple join
                icon = new URL(icon, baseUrl.href).href;
            }
        } catch {
            // Ignore invalid URL construction
        }
    }

    // If still no icon, try default favicon.ico
    if (!icon) {
        try {
            const baseUrl = new URL(url);
            // Prefer high-res via Google s2 as last fallback
            icon = `https://www.google.com/s2/favicons?sz=128&domain=${baseUrl.hostname}`;
        } catch {
            // Fallback
        }
    }

    // Download icon; if配置存在R2则上传R2，否则落地到本地
    let localIcon = icon;
    let r2Error = null;

    try {
      // Load R2 config (DB overrides env)
      const dbCfg = await getR2Config(userId);
      console.log('Database R2 Config:', {
        hasCfg: !!dbCfg,
        hasAccessKey: !!dbCfg?.accessKeyId,
        hasSecret: !!dbCfg?.secretAccessKey,
        hasBucket: !!dbCfg?.bucket,
        hasEndpoint: !!dbCfg?.endpoint,
        hasPublicBase: !!dbCfg?.publicBase,
      });

      const r2AccessKey = dbCfg?.accessKeyId || process.env.R2_ACCESS_KEY_ID;
      const r2Secret = dbCfg?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
      const r2Bucket = dbCfg?.bucket || process.env.R2_BUCKET;
      const r2Endpoint = dbCfg?.endpoint || process.env.R2_ENDPOINT;
      const r2PublicBase = dbCfg?.publicBase || process.env.R2_PUBLIC_BASE;
      const iconMaxKB = dbCfg?.iconMaxKB ?? 128;
      const iconMaxSize = dbCfg?.iconMaxSize ?? 128;

      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 5000);
      const iconRes = await fetch(icon, { signal: ctrl.signal });
      clearTimeout(tId);
      if (iconRes.ok) {
        const contentType = iconRes.headers.get('content-type') || '';
        const ab = await iconRes.arrayBuffer();
        let buf = Buffer.from(ab);
        // Skip compression in Edge Runtime as sharp is not available
        let ext = 'png';
        if (contentType.includes('svg')) ext = 'svg';
        else if (contentType.includes('x-icon') || contentType.includes('vnd.microsoft.icon') || icon.toLowerCase().endsWith('.ico')) ext = 'ico';
        else if (contentType.includes('jpeg') || icon.toLowerCase().endsWith('.jpg') || icon.toLowerCase().endsWith('.jpeg')) ext = 'jpg';
        else if (contentType.includes('webp') || icon.toLowerCase().endsWith('.webp')) ext = 'webp';
        const base = new URL(url);
        const hash = crypto.createHash('sha256').update(icon).digest('hex').slice(0, 10);
        const fileName = `${base.hostname.replace(/[:/]/g, '_')}_${hash}.${ext}`;

        console.log('R2 Config Check:', {
          hasAccessKey: !!r2AccessKey,
          hasSecret: !!r2Secret,
          hasBucket: !!r2Bucket,
          hasEndpoint: !!r2Endpoint,
          hasPublicBase: !!r2PublicBase,
        });

        if (r2AccessKey && r2Secret && r2Bucket && r2Endpoint && r2PublicBase) {
          try {
            console.log('Attempting R2 Upload...');
            
            const s3 = new S3Client({
              region: 'auto',
              endpoint: r2Endpoint,
              credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2Secret },
            });
            const key = `site-icons/${fileName}`;
            await s3.send(new PutObjectCommand({
              Bucket: r2Bucket,
              Key: key,
              Body: buf,
              ContentType: contentType || 'application/octet-stream',
              CacheControl: 'public, max-age=31536000, immutable',
            }));
            localIcon = `${r2PublicBase.replace(/\/+$/,'')}/${key}`;
            console.log('R2 Upload Success:', localIcon);
          } catch (r2Err: any) {
            console.error('R2 Upload Failed:', r2Err);
            r2Error = r2Err?.message || String(r2Err);
          }
        } else {
          console.log('R2 not configured or incomplete, skipping upload');
          r2Error = 'R2 not configured or incomplete';
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
    // Return empty success to allow manual entry without blocking
    return NextResponse.json({ success: false, message: 'Failed to fetch metadata' });
  }
}
