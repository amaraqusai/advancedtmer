import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/achievements?userId=...
 * Returns all achievements for a user with current progress.
 * Mirrors Python's create_achievements() / create_achievement() display logic.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        title: true,
        value: true,
        maxValue: true,
        unlocked: true,
      },
    });

    return NextResponse.json(achievements);
  } catch (error) {
    console.error('Achievements GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
