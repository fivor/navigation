import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const metadataHandlers = {
  fetchMetadata: async (request: Request) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

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
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        (isIp && (
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31)
        ));

      if (isPrivate) {
         return NextResponse.json({ success: false, message: 'Invalid target' }, { status: 400 });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NavigationBot/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return NextResponse.json({ success: false, message: `Failed to fetch: ${res.status}` }, { status: 400 });
      }

      const html = await res.text();

      // Extract metadata
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
            let href = hrefMatch[1];
            // Handle relative URLs
            try {
               href = new URL(href, url).toString();
            } catch {}

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
        let ogImgUrl = ogImage;
        try {
           ogImgUrl = new URL(ogImage, url).toString();
        } catch {}
        icons.push({ href: ogImgUrl, sizeScore: 300, priority: 0 });
      }

      icons.sort((a, b) => b.sizeScore - a.sizeScore || b.priority - a.priority);

      return NextResponse.json({
        success: true,
        data: {
          title: title || ogTitle,
          description,
          icon: icons.length > 0 ? icons[0].href : ''
        }
      });
    } catch (error) {
      console.error('Fetch metadata error:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to fetch metadata' 
      }, { status: 500 });
    }
  }
};
