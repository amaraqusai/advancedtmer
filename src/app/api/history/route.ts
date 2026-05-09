import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/history?userId=...&limit=50&offset=0
 * Returns paginated study sessions for the user, newest first.
 * Mirrors Python's History tab showing: Start | End | Duration | Break | Subject
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit  = Math.min(parseInt(searchParams.get('limit')  || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const [sessions, total] = await Promise.all([
      prisma.studySession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          duration: true,
          breakSecs: true,
          subject: true,
          goalReached: true,
        },
      }),
      prisma.studySession.count({ where: { userId } }),
    ]);

    return NextResponse.json({ sessions, total, limit, offset });
  } catch (error) {
    console.error('History GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
