import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Default achievements matching the Python app
const DEFAULT_ACHIEVEMENTS = [
  { name: 'Time Titan',       title: 'Clock in 5000 minutes of study, mastering the art of time management.', maxValue: 300000 }, // 5000 min in seconds
  { name: 'Goal Getter',      title: 'Reach 30 goals, proving dedication to progress.',                       maxValue: 30 },
  { name: 'Subject Explorer', title: 'Dive into 7 different subjects, broadening your knowledge horizons.',   maxValue: 7 },
  { name: 'Focus Maestro',    title: 'Master concentration in a 5-hour session, demonstrating exceptional focus.', maxValue: 18000 }, // 5h in seconds
  { name: 'Subject Savant',   title: 'Study one subject 30 times, becoming a savant in its intricacies.',    maxValue: 30 },
  { name: 'Restful Respite',  title: 'Accumulate 500 minutes of break time, rejuvenating your mind and body.', maxValue: 30000 }, // 500 min in seconds
  { name: 'Daily Discipline', title: 'Exhibit discipline through diligent study for 30 days.',                maxValue: 30 },
  { name: 'Note Scribbler',   title: 'Scribble down 10 notes, capturing key insights and ideas.',             maxValue: 10 },
];

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { name: trimmedName },
      include: { achievements: true }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: trimmedName,
          achievements: {
            create: DEFAULT_ACHIEVEMENTS.map(a => ({
              name: a.name,
              title: a.title,
              maxValue: a.maxValue,
              value: 0,
            }))
          }
        },
        include: { achievements: true }
      });
    } else if (user.achievements.length === 0) {
      // Seed achievements if missing (for existing users before migration)
      await prisma.userAchievement.createMany({
        data: DEFAULT_ACHIEVEMENTS.map(a => ({
          userId: user!.id,
          name: a.name,
          title: a.title,
          maxValue: a.maxValue,
          value: 0,
        })),
        skipDuplicates: true,
      });
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { achievements: true }
      }) as typeof user;
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
