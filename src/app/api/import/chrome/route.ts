import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import * as cheerio from 'cheerio';

export const runtime = 'experimental-edge';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.id as number;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const defaultCategoryId = formData.get('categoryId') ? parseInt(formData.get('categoryId') as string) : null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'File is required' }, { status: 400 });
    }

    const text = await file.text();
    const $ = cheerio.load(text);

    let importedCount = 0;
    let duplicateCount = 0;
    const categoriesSet = new Set<string>();

    // Helper to process DL list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function processList(element: any, parentId: number | null) {
      // Direct links in this level (DT > A)
      const links = $(element).children('dt').children('a');
      for (const link of links) {
        const $link = $(link);
        const title = $link.text();
        const url = $link.attr('href');
        const icon = $link.attr('icon');
        
        if (title && url) {
          try {
            // Use default category if no parent, or if items are at root level
            const categoryId = parentId || defaultCategoryId;
            
            if (categoryId) {
              await sql`
                INSERT INTO links (title, url, description, icon, category_id, user_id, sort_order)
                VALUES (${title}, ${url}, null, ${icon || null}, ${categoryId}, ${userId}, 0)
                ON CONFLICT (url, user_id) DO NOTHING
              `;
              importedCount++;
            }
          } catch {
            duplicateCount++;
          }
        }
      }

      // Sub-folders (DT > H3 + DL)
      const folders = $(element).children('dt').has('h3');
      for (const folder of folders) {
        const $folder = $(folder);
        const name = $folder.children('h3').text();
        const $subDl = $folder.children('dl');

        if (name) {
          categoriesSet.add(name);
          
          const catResult = await sql`
            INSERT INTO categories (name, parent_id, user_id, sort_order)
            VALUES (${name}, ${parentId}, ${userId}, 0)
            RETURNING id
          `;
          const newCatId = catResult.rows[0].id as number;

          if ($subDl.length > 0) {
            await processList($subDl, newCatId);
          }
        }
      }
    }

    const $root = $('dl').first();
    if ($root.length > 0) {
        await processList($root, defaultCategoryId);
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      duplicates: duplicateCount,
      categories: Array.from(categoriesSet)
    });

  } catch (error) {
    console.error('Import Chrome error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to import bookmarks' },
      { status: 500 }
    );
  }
}
