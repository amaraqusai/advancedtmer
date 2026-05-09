import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Mirror Python's day-of-week accumulation logic
const DAY_FIELDS = [
  'mondaySecs',
  'tuesdaySecs',
  'wednesdaySecs',
  'thursdaySecs',
  'fridaySecs',
  'saturdaySecs',
  'sundaySecs',
] as const;

type DayField = typeof DAY_FIELDS[number];

// Achievement recalculation – mirrors Python's DataManager.create_achievements()
async function recalcAchievements(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sessions: true,
      notes: { where: { deleted: false } },
    },
  });
  if (!user) return;

  const totalStudySecs   = user.totalStudySeconds;
  const goalsReached     = user.goalsReached;
  const subjects         = [...new Set(user.sessions.map(s => s.subject))];
  const longestSession   = user.sessions.length ? Math.max(...user.sessions.map(s => s.duration)) : 0;
  const subjectCounts    = user.sessions.reduce((acc, s) => {
    acc[s.subject] = (acc[s.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostStudiedCount = Object.values(subjectCounts).length ? Math.max(...Object.values(subjectCounts)) : 0;
  const totalBreakSecs   = user.totalBreakSeconds;
  const uniqueDays       = new Set(user.sessions.map(s => s.startedAt.toISOString().split('T')[0])).size;
  const notesCount       = user.notes.length;

  const updates: Record<string, number> = {
    'Time Titan':       totalStudySecs,
    'Goal Getter':      goalsReached,
    'Subject Explorer': subjects.length,
    'Focus Maestro':    longestSession,
    'Subject Savant':   mostStudiedCount,
    'Restful Respite':  totalBreakSecs,
    'Daily Discipline': uniqueDays,
    'Note Scribbler':   notesCount,
  };

  for (const [name, value] of Object.entries(updates)) {
    const achievement = await prisma.userAchievement.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (achievement) {
      await prisma.userAchievement.update({
        where: { userId_name: { userId, name } },
        data: {
          value,
          unlocked: value >= achievement.maxValue,
        },
      });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      studySecs,
      breakSecs = 0,
      subject = 'Other',
      startedAt,
      endedAt,
    } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'UserId required' }, { status: 400 });
    }
    if (!studySecs || studySecs <= 0) {
      return NextResponse.json({ error: 'studySecs must be > 0' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine if this session hits the daily goal
    const goalReached = studySecs >= user.currentGoalSecs;

    // Day-of-week accumulation (mirrors Python's set_weekday)
    const sessionDate = startedAt ? new Date(startedAt) : new Date();
    const dayIndex = sessionDate.getDay(); // 0=Sun, 1=Mon ... 6=Sat
    // Python uses Mon=0, reorder: Sun is index 6 in Python (our array is Sun=0 → map to index 6)
    const pythonDayMap = [6, 0, 1, 2, 3, 4, 5]; // JS Sunday→Python index 6, JS Monday→Python index 0
    const dayField = DAY_FIELDS[pythonDayMap[dayIndex]] as DayField;

    // Streak logic: if studied today, check if yesterday also studied (simple version)
    const today = sessionDate.toISOString().split('T')[0];

    const [updatedUser] = await prisma.$transaction([
      // Update user totals
      prisma.user.update({
        where: { id: userId },
        data: {
          totalStudySeconds: { increment: studySecs },
          totalBreakSeconds: { increment: breakSecs },
          lastSync: new Date(),
          goalsReached: goalReached ? { increment: 1 } : undefined,
          lastStudyDate: today,
          subject,
          [dayField]: { increment: studySecs },
        },
      }),
      // Create session record (mirrors Python's write_to_excel)
      prisma.studySession.create({
        data: {
          userId,
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          endedAt: endedAt ? new Date(endedAt) : new Date(),
          duration: studySecs,
          breakSecs,
          subject,
          goalReached,
        },
      }),
    ]);

    // Recalculate achievements in background
    recalcAchievements(userId).catch(console.error);

    return NextResponse.json({
      user: updatedUser,
      goalReached,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
