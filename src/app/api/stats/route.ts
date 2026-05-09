import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isSameDay, subDays } from 'date-fns';

/**
 * GET /api/stats?userId=... (personal stats)
 * GET /api/stats?groupId=... (group leaderboard stats)
 *
 * Returns rich stats mirroring Python's Statistics tab:
 * - total study / break time
 * - today / yesterday / last-Sunday seconds
 * - day-of-week accumulation (mirrors Python's W2..W8 cells)
 * - goals reached / streak
 * - average session time
 * - best weekday
 * - subject breakdown
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId  = searchParams.get('userId');
  const groupId = searchParams.get('groupId');

  try {
    const now       = new Date();
    const yesterday = subDays(now, 1);

    // Find last Sunday (mirrors Python's leaderboard logic)
    let lastSunday = subDays(now, 1);
    while (lastSunday.getDay() !== 0) lastSunday = subDays(lastSunday, 1);

    /** Build per-user stat object */
    async function buildUserStats(user: {
      id: string;
      name: string;
      totalStudySeconds: number;
      totalBreakSeconds: number;
      goalsReached: number;
      currentGoalSecs: number;
      mondaySecs: number;
      tuesdaySecs: number;
      wednesdaySecs: number;
      thursdaySecs: number;
      fridaySecs: number;
      saturdaySecs: number;
      sundaySecs: number;
      sessions: { duration: number; breakSecs: number; subject: string; startedAt: Date }[];
    }) {
      const todaySecs     = user.sessions.filter(s => isSameDay(new Date(s.startedAt), now)).reduce((a, s) => a + s.duration, 0);
      const yesterdaySecs = user.sessions.filter(s => isSameDay(new Date(s.startedAt), yesterday)).reduce((a, s) => a + s.duration, 0);
      const lastSundaySecs = user.sessions.filter(s => isSameDay(new Date(s.startedAt), lastSunday)).reduce((a, s) => a + s.duration, 0);

      // Average session duration
      const avgSecs = user.sessions.length
        ? Math.round(user.sessions.reduce((a, s) => a + s.duration, 0) / user.sessions.length)
        : 0;

      // Best weekday (mirrors Python's get_weekday)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayTotals = [
        user.sundaySecs,
        user.mondaySecs,
        user.tuesdaySecs,
        user.wednesdaySecs,
        user.thursdaySecs,
        user.fridaySecs,
        user.saturdaySecs,
      ];
      const bestDayIdx   = dayTotals.indexOf(Math.max(...dayTotals));
      const bestWeekday  = dayTotals[bestDayIdx] > 0 ? dayNames[bestDayIdx] : '';

      // Subject breakdown (mirrors Python's subject_list)
      const subjectMap: Record<string, number> = {};
      for (const s of user.sessions) {
        subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.duration;
      }

      // Unique study days (mirrors Python's Daily Discipline)
      const uniqueDays = new Set(user.sessions.map(s => new Date(s.startedAt).toISOString().split('T')[0])).size;

      return {
        id: user.id,
        name: user.name,
        totalStudySecs: user.totalStudySeconds,
        totalBreakSecs: user.totalBreakSeconds,
        goalsReached: user.goalsReached,
        currentGoalSecs: user.currentGoalSecs,
        todaySecs,
        yesterdaySecs,
        lastSundaySecs,
        avgSessionSecs: avgSecs,
        bestWeekday,
        uniqueStudyDays: uniqueDays,
        dayOfWeek: {
          monday:    user.mondaySecs,
          tuesday:   user.tuesdaySecs,
          wednesday: user.wednesdaySecs,
          thursday:  user.thursdaySecs,
          friday:    user.fridaySecs,
          saturday:  user.saturdaySecs,
          sunday:    user.sundaySecs,
        },
        subjectBreakdown: subjectMap,
      };
    }

    // ── Personal stats ──────────────────────────────────────────────
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { sessions: { orderBy: { startedAt: 'asc' } } },
      });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      return NextResponse.json(await buildUserStats(user));
    }

    // ── Group leaderboard stats ──────────────────────────────────────
    if (groupId) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: { sessions: { orderBy: { startedAt: 'asc' } } },
            orderBy: { totalStudySeconds: 'desc' },
          },
        },
      });
      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

      const stats = await Promise.all(group.members.map(buildUserStats));
      return NextResponse.json({ groupName: group.name, stats });
    }

    return NextResponse.json({ error: 'userId or groupId required' }, { status: 400 });

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
