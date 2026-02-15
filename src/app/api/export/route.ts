import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Link, Category } from '@/types';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Fetch all links and categories
    const linksResult = await sql<Link>`SELECT * FROM links ORDER BY sort_order ASC, created_at DESC`;
    const categoriesResult = await sql<Category>`SELECT * FROM categories ORDER BY sort_order ASC, created_at DESC`;
    
    const links = linksResult.rows;
    const categories = categoriesResult.rows;

    if (format === 'json') {
        const data = {
            categories,
            links,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        return new NextResponse(JSON.stringify(data, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="bookmarks_export.json"`
            }
        });
    } else if (format === 'html') {
        // Build Netscape Bookmark HTML
        let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

        // Map categories to children
        const categoryMap = new Map<number | null, Category[]>();
        categories.forEach(cat => {
            const pid = cat.parent_id || null; // Treat 0 or null as root
            if (!categoryMap.has(pid)) {
                categoryMap.set(pid, []);
            }
            categoryMap.get(pid)?.push(cat);
        });

        const linkMap = new Map<number, Link[]>();
        links.forEach(link => {
            if (!linkMap.has(link.category_id)) {
                linkMap.set(link.category_id, []);
            }
            linkMap.get(link.category_id)?.push(link);
        });

        // Recursive function to build tree
        function buildTree(parentId: number | null, level: number) {
            let output = '';
            const indent = '    '.repeat(level);
            
            // Links in this category (if not root)
            if (parentId) {
                const catLinks = linkMap.get(parentId) || [];
                catLinks.forEach(link => {
                    output += `${indent}<DT><A HREF="${link.url}" ${link.icon ? `ICON="${link.icon}"` : ''}>${link.title}</A>\n`;
                });
            }

            // Subcategories
            const subCats = categoryMap.get(parentId) || [];
            subCats.forEach(cat => {
                output += `${indent}<DT><H3>${cat.name}</H3>\n`;
                output += `${indent}<DL><p>\n`;
                output += buildTree(cat.id, level + 1);
                output += `${indent}</DL><p>\n`;
            });

            return output;
        }

        // Start from root (null or 0 parent_id)
        // Note: My category implementation might use null for root.
        // Let's assume root categories have parent_id = null.
        // Also handle links that might be in a root category (if any, though UI enforces category)
        
        html += buildTree(null, 1);
        
        // Also check for categories with parent_id=0 if that was used
        if (categoryMap.has(0)) {
             // Treat 0 as null/root
             // Re-run buildTree logic for these if needed, but usually we normalize DB to null.
             // Assuming null for now based on schema.
        }

        html += '</DL><p>';

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html',
                'Content-Disposition': `attachment; filename="bookmarks_export.html"`
            }
        });
    }

    return NextResponse.json({ success: false, message: 'Invalid format' }, { status: 400 });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, message: 'Export failed' }, { status: 500 });
  }
}