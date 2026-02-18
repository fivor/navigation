import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestContext } from '@cloudflare/next-on-pages';

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

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return NextResponse.json({ success: false, message: 'Invalid URL' }, { status: 400 });
      }

      const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NavigationBot/1.0)',
          },
      });

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
        
        const regexRev = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProperty}["']`, 'i');
        const matchRev = html.match(regexRev);
        return matchRev ? matchRev[1] : '';
      };

      const description = getMetaTag('description') || getMetaTag('og:description') || '';
      const ogTitle = getMetaTag('og:title') || '';
      const ogImage = getMetaTag('og:image') || '';

      // Extract icons
      const icons: { href: string; sizeScore: number; priority: number }[] = [];
      const linkRegex = /<link[^>]+rel=["']([^"']*)["'][^>]*>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const rel = match[1].toLowerCase();
        
        if (rel.includes('icon')) {
          const hrefMatch = fullTag.match(/href=["']([^"']*)["']/i);
          const sizesMatch = fullTag.match(/sizes=["']([^"']*)["']/i);
          
          if (hrefMatch && hrefMatch[1]) {
             let href = hrefMatch[1];
             try {
                href = new URL(href, url).toString();
                
                const sizes = sizesMatch ? sizesMatch[1] : '';
                let sizeScore = 0;
                let priority = 1;
                
                const sMatch = sizes.match(/(\d+)/);
                if (sMatch) {
                  sizeScore = parseInt(sMatch[1]);
                  priority = 3;
                } else if (rel.includes('apple-touch-icon')) {
                  sizeScore = 180;
                  priority = 4;
                } else if (href.toLowerCase().endsWith('.svg')) {
                  sizeScore = 512;
                  priority = 2;
                } else if (href.toLowerCase().endsWith('.ico')) {
                  sizeScore = 32;
                  priority = 1;
                } else {
                  sizeScore = 48;
                  priority = 2;
                }
                
                icons.push({ href, sizeScore, priority });
             } catch (e) {
                 // ignore invalid urls
             }
          }
        }
      }

      // Default favicon
      try {
        const defaultIcon = new URL('/favicon.ico', url).toString();
        icons.push({ href: defaultIcon, sizeScore: 16, priority: 0 });
      } catch {}

      icons.sort((a, b) => b.priority - a.priority || b.sizeScore - a.sizeScore);

      let finalIcon = icons.length > 0 ? icons[0].href : '';
      if (!finalIcon && ogImage) {
         try {
            finalIcon = new URL(ogImage, url).toString();
         } catch {}
      }

      // Upload to R2 if found
      let r2Url = null;
      if (finalIcon) {
          try {
              const iconRes = await fetch(finalIcon);
              if (iconRes.ok) {
                  const blob = await iconRes.blob();
                  const buffer = await blob.arrayBuffer();
                  
                  // Generate unique filename
                   const randomName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${finalIcon.split('.').pop()?.split('?')[0] || 'png'}`;
                   const objectKey = `icons/${randomName}`;
                   
                   // Get R2 binding
                   const { env } = getRequestContext();
                   const R2 = (env as any).R2;
                   if (R2) {
                       await R2.put(objectKey, buffer, {
                           httpMetadata: {
                               contentType: iconRes.headers.get('content-type') || 'image/png',
                           }
                       });
                       
                       // Construct R2 URL (assuming public access or worker proxy)
                        // Use /api/icons/ route to serve R2 directly
                        r2Url = `/api/icons/${randomName}`;
                   } else {
                      console.warn('R2 binding not found');
                  }
              }
          } catch (e) {
              console.error('Failed to upload icon to R2', e);
          }
      }

      return NextResponse.json({
        success: true,
        data: {
          title: title || ogTitle,
          description: description,
          icon: finalIcon, // Original URL
          r2_icon: r2Url   // Uploaded R2 URL
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
