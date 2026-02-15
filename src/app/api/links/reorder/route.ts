import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export const runtime = 'experimental-edge';

// Handle PUT request for reordering links
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { linkIds } = await req.json();

    if (!Array.isArray(linkIds)) {
      return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
    }

    // Update sort_order for each link based on its index in the array
    // This is a naive approach; for large datasets, a single batch query is better.
    // Given the small number of links usually in a category, a loop or transaction is fine.
    
    // We will use a transaction-like approach or just parallel promises.
    // Since Vercel Postgres doesn't support easy transactions in raw SQL without a client,
    // we will execute updates sequentially or in parallel.
    
    // Construct a CASE statement for a single update query for efficiency
    // UPDATE links SET sort_order = CASE id WHEN 1 THEN 0 WHEN 2 THEN 1 ... END WHERE id IN (1, 2, ...)
    
    if (linkIds.length === 0) {
        return NextResponse.json({ success: true });
    }

    // Use Promise.all to execute updates in parallel
    // This avoids raw SQL construction issues and uses the safe sql template tag
    await Promise.all(
      linkIds.map((id, index) => {
        return sql`UPDATE links SET sort_order = ${index} WHERE id = ${id} AND user_id = ${session.id}`;
      })
    );

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/links');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
