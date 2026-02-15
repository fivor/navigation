import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import plist from 'plist';

export const runtime = 'edge';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = plist.parse(text) as any;

    let importedCount = 0;
    let duplicateCount = 0;
    const categoriesSet = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processNode = async (node: any, parentId: number | null) => {
      if (node.WebBookmarkType === 'WebBookmarkTypeList') {
        // It's a folder
        const title = node.Title;
        const children = node.Children;

        let currentCategoryId = parentId;

        if (title && title !== 'BookmarksBar' && title !== 'BookmarksMenu' && title !== 'com.apple.ReadingList') {
           // Skip root folders if needed, or create them.
           categoriesSet.add(title);
           
           const catResult = await sql`
             INSERT INTO categories (name, parent_id, user_id, sort_order)
             VALUES (${title}, ${parentId}, ${userId}, 0)
             RETURNING id
           `;
           currentCategoryId = catResult.rows[0].id as number;
        } else if (!parentId && defaultCategoryId) {
           // If root and we have default category, use it
           currentCategoryId = defaultCategoryId;
        }

        if (children && Array.isArray(children)) {
          for (const child of children) {
            await processNode(child, currentCategoryId);
          }
        }
      } else if (node.WebBookmarkType === 'WebBookmarkTypeLeaf') {
        // It's a link
        const url = node.URLString;
        const title = node.URIDictionary?.title || 'Untitled';

        if (url && parentId) {
          try {
             await sql`
                INSERT INTO links (title, url, description, icon, category_id, user_id, sort_order)
                VALUES (${title}, ${url}, null, null, ${parentId}, ${userId}, 0)
                ON CONFLICT (url, user_id) DO NOTHING
              `;
              importedCount++;
          } catch {
            duplicateCount++;
          }
        }
      }
    }

    // Safari plist root usually has Children
    if (data.Children) {
      for (const child of data.Children) {
        await processNode(child, defaultCategoryId);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      duplicates: duplicateCount,
      categories: Array.from(categoriesSet)
    });

  } catch (error) {
    console.error('Import Safari error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to import bookmarks' },
      { status: 500 }
    );
  }
}
