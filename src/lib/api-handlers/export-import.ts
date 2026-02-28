import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Link, Category } from '@/types';

/**
 * 解析 CSV 内容
 * 支持格式：title,url,description,category
 */
function parseCSV(content: string): { title: string; url: string; description: string; category: string }[] {
  const lines = content.trim().split('\n');
  const results: { title: string; url: string; description: string; category: string }[] = [];
  
  // 跳过标题行（如果有）
  const startIndex = lines[0].toLowerCase().includes('title') || 
                     lines[0].toLowerCase().includes('url') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 处理引号包裹的字段
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    if (fields.length >= 2 && fields[0] && fields[1]) {
      results.push({
        title: fields[0].replace(/^"|"$/g, ''),
        url: fields[1].replace(/^"|"$/g, ''),
        description: (fields[2] || '').replace(/^"|"$/g, ''),
        category: (fields[3] || '').replace(/^"|"$/g, '')
      });
    }
  }
  
  return results;
}

export const exportImportHandlers = {
  export: async (request: Request) => {
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

          html += buildTree(null, 1);
          
          return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html',
                'Content-Disposition': `attachment; filename="bookmarks_export.html"`
            }
          });
      }
      return NextResponse.json({ success: false, message: 'Invalid format' }, { status: 400 });
    } catch (e) {
      return NextResponse.json({ success: false, message: 'Failed to export bookmarks' }, { status: 500 });
    }
  },

  importChrome: async (request: Request) => {
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
      
      const links: { title: string; url: string; icon: string | null; folder: string | null }[] = [];
      
      const folderRegex = /<DT><H3[^>]*>(.*?)<\/H3>([\s\S]*?)(?=<DT><H3|<\/DL>|$)/gi;
      let folderMatch;
      
      while ((folderMatch = folderRegex.exec(text)) !== null) {
        const folderName = folderMatch[1];
        const folderContent = folderMatch[2];
        
        const linkRegex = /<A HREF="([^"]*)"[^>]*ICON="([^"]*)"[^>]*>(.*?)<\/A>/gi;
        const linkRegexNoIcon = /<A HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi;
        
        let linkMatch;
        while ((linkMatch = linkRegex.exec(folderContent)) !== null) {
          links.push({
            url: linkMatch[1],
            icon: linkMatch[2],
            title: linkMatch[3],
            folder: folderName
          });
        }
        
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
      
      const rootContent = text.replace(folderRegex, '');
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

      let importedCount = 0;
      const categoriesMap = new Map<string, number>();

      for (const bookmark of links) {
        try {
          let categoryId = defaultCategoryId;
          
          if (bookmark.folder) {
            if (categoriesMap.has(bookmark.folder)) {
              categoryId = categoriesMap.get(bookmark.folder)!;
            } else {
              // Create or find category
              // Simple check if exists
              const catResult = await sql`SELECT id FROM categories WHERE name = ${bookmark.folder} AND user_id = ${userId}`;
              if (catResult.rows.length > 0) {
                 categoryId = catResult.rows[0].id as number;
                 categoriesMap.set(bookmark.folder, categoryId);
              } else {
                 const newCat = await sql`
                   INSERT INTO categories (name, user_id, sort_order)
                   VALUES (${bookmark.folder}, ${userId}, 0)
                   RETURNING id
                 `;
                 categoryId = newCat.rows[0].id as number;
                 categoriesMap.set(bookmark.folder, categoryId);
              }
            }
          }

          if (categoryId) {
            await sql`
              INSERT INTO links (title, url, icon, category_id, user_id, sort_order)
              VALUES (${bookmark.title}, ${bookmark.url}, ${bookmark.icon}, ${categoryId}, ${userId}, 0)
              ON CONFLICT (url, user_id) DO NOTHING
            `;
            importedCount++;
          }
        } catch (e) {
          // ignore error
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
  },

  importSafari: async (request: Request) => {
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

      return NextResponse.json({ success: false, message: 'Safari import temporarily disabled due to Edge Runtime compatibility' }, { status: 501 });

    } catch (error) {
      console.error('Import Safari error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to import bookmarks' },
        { status: 500 }
      );
    }
  },

  /**
   * 批量导入链接（支持 CSV 和 JSON 格式）
   */
  importBatch: async (request: Request) => {
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
        return NextResponse.json({ success: false, message: '请选择要导入的文件' }, { status: 400 });
      }

      const text = await file.text();
      const fileName = file.name.toLowerCase();
      let links: { title: string; url: string; description?: string; category?: string }[] = [];

      // 根据文件扩展名解析
      if (fileName.endsWith('.csv')) {
        links = parseCSV(text);
      } else if (fileName.endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data.links)) {
            links = data.links;
          } else if (Array.isArray(data)) {
            links = data;
          } else {
            return NextResponse.json({ success: false, message: 'JSON 格式不正确' }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ success: false, message: 'JSON 解析失败' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ success: false, message: '不支持的文件格式，请使用 CSV 或 JSON' }, { status: 400 });
      }

      if (links.length === 0) {
        return NextResponse.json({ success: false, message: '文件中没有找到有效的链接' }, { status: 400 });
      }

      let importedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      const categoriesMap = new Map<string, number>();

      for (const link of links) {
        try {
          // 验证必填字段
          if (!link.title || !link.url) {
            errorCount++;
            continue;
          }

          // 验证 URL 格式
          if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            errorCount++;
            continue;
          }

          let categoryId = defaultCategoryId;

          // 处理分类
          if (link.category) {
            if (categoriesMap.has(link.category)) {
              categoryId = categoriesMap.get(link.category)!;
            } else {
              const catResult = await sql`SELECT id FROM categories WHERE name = ${link.category} AND user_id = ${userId}`;
              if (catResult.rows.length > 0) {
                categoryId = catResult.rows[0].id as number;
                categoriesMap.set(link.category, categoryId);
              } else {
                const newCat = await sql`
                  INSERT INTO categories (name, user_id, sort_order)
                  VALUES (${link.category}, ${userId}, 0)
                  RETURNING id
                `;
                categoryId = newCat.rows[0].id as number;
                categoriesMap.set(link.category, categoryId);
              }
            }
          }

          if (categoryId) {
            const insertRes = await sql`
              INSERT INTO links (title, url, description, category_id, user_id, sort_order)
              VALUES (${link.title}, ${link.url}, ${link.description || null}, ${categoryId}, ${userId}, 0)
              ON CONFLICT (url, user_id) DO NOTHING
            `;
            if (insertRes.rowCount > 0) {
              importedCount++;
            } else {
              duplicateCount++;
            }
          } else {
            errorCount++;
          }
        } catch (e) {
          console.error('Import link error:', e);
          errorCount++;
        }
      }

      return NextResponse.json({
        success: true,
        imported: importedCount,
        duplicates: duplicateCount,
        errors: errorCount,
        total: links.length,
        categories: Array.from(categoriesMap.keys())
      });
    } catch (error) {
      console.error('Import batch error:', error);
      return NextResponse.json(
        { success: false, message: '批量导入失败' },
        { status: 500 }
      );
    }
  }
};
