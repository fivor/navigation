import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';

export const runtime = 'edge';

/**
 * 解析 Chrome 导出的 HTML 书签文件
 * 采用原生正则解析，避免引入沉重的 cheerio 库
 */
function parseBookmarks(html: string) {
  const links: { title: string; url: string; icon: string | null; folder: string | null }[] = [];
  
  // 匹配书签文件夹和其中的链接
  // Chrome 格式通常是 <DT><H3>文件夹</H3><DL><p>...链接...</DL><p>
  // 简化的解析策略：匹配所有链接，并尝试找到其所属的最近文件夹
  
  const folderRegex = /<DT><H3[^>]*>(.*?)<\/H3>([\s\S]*?)(?=<DT><H3|<\/DL>|$)/gi;
  let folderMatch;
  
  // 先找文件夹
  while ((folderMatch = folderRegex.exec(html)) !== null) {
    const folderName = folderMatch[1];
    const folderContent = folderMatch[2];
    
    const linkRegex = /<A HREF="([^"]*)"[^>]*ICON="([^"]*)"[^>]*>(.*?)<\/A>/gi;
    const linkRegexNoIcon = /<A HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi;
    
    let linkMatch;
    // 匹配带图标的链接
    while ((linkMatch = linkRegex.exec(folderContent)) !== null) {
      links.push({
        url: linkMatch[1],
        icon: linkMatch[2],
        title: linkMatch[3],
        folder: folderName
      });
    }
    
    // 补充匹配不带图标的链接（如果没被上一个正则匹配到）
    while ((linkMatch = linkRegexNoIcon.exec(folderContent)) !== null) {
      if (!links.some(l => l.url === linkMatch![1])) {
        links.push({
          url: linkMatch[1],
          icon: null,
          title: linkMatch[2],
          folder: folderName
        });
      }
    }
  }
  
  // 匹配根目录下的链接（不在任何 H3 文件夹内的）
  const rootContent = html.replace(folderRegex, '');
  const rootLinkRegex = /<A HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi;
  let rootLinkMatch;
  while ((rootLinkMatch = rootLinkRegex.exec(rootContent)) !== null) {
    if (!links.some(l => l.url === rootLinkMatch![1])) {
      const iconMatch = rootLinkMatch[0].match(/ICON="([^"]*)"/i);
      links.push({
        url: rootLinkMatch[1],
        icon: iconMatch ? iconMatch[1] : null,
        title: rootLinkMatch[2],
        folder: null
      });
    }
  }
  
  return links;
}

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
    const bookmarks = parseBookmarks(text);

    let importedCount = 0;
    const categoriesMap = new Map<string, number>();

    for (const bookmark of bookmarks) {
      try {
        let categoryId = defaultCategoryId;
        
        // 如果书签有文件夹，尝试创建或获取该分类
        if (bookmark.folder) {
          if (categoriesMap.has(bookmark.folder)) {
            categoryId = categoriesMap.get(bookmark.folder)!;
          } else {
            const catResult = await sql`
              INSERT INTO categories (name, user_id, sort_order)
              VALUES (${bookmark.folder}, ${userId}, 0)
              ON CONFLICT (name, user_id) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `;
            categoryId = catResult.rows[0].id;
            categoriesMap.set(bookmark.folder, categoryId!);
          }
        }

        if (categoryId) {
          const result = await sql`
            INSERT INTO links (title, url, icon, category_id, user_id, sort_order)
            VALUES (${bookmark.title}, ${bookmark.url}, ${bookmark.icon}, ${categoryId}, ${userId}, 0)
            ON CONFLICT (url, user_id) DO NOTHING
          `;
          if (result.rowCount > 0) {
            importedCount++;
          }
        }
      } catch (err) {
        console.error('Failed to import bookmark:', bookmark.url, err);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      categories: Array.from(categoriesMap.keys())
    });

  } catch (error) {
    console.error('Import Chrome error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to import bookmarks' },
      { status: 500 }
    );
  }
}
