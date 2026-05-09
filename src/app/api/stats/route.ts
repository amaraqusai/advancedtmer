import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  if (!groupId) return NextResponse.json({ error: 'GroupId required' }, { status: 400 });

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            sessions: true
          }
        }
      }
    });

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    const now = new Date();
    const yesterday = subDays(now, 1);
    
    // Find last Sunday
    let lastSunday = now;
    while (lastSunday.getDay() !== 0) {
      lastSunday = subDays(lastSunday, 1);
    }
    // If today is Sunday, we might want "last week Sunday" (7 days ago)
    if (isSameDay(lastSunday, now)) {
      lastSunday = subDays(lastSunday, 7);
    }

    const stats = group.members.map(member => {
      const yesterdaySeconds = member.sessions
        .filter(s => isSameDay(new Date(s.createdAt), yesterday))
        .reduce((acc, s) => acc + s.duration, 0);

      const lastSundaySeconds = member.sessions
        .filter(s => isSameDay(new Date(s.createdAt), lastSunday))
        .reduce((acc, s) => acc + s.duration, 0);

      const todaySeconds = member.sessions
        .filter(s => isSameDay(new Date(s.createdAt), now))
        .reduce((acc, s) => acc + s.duration, 0);

      return {
        id: member.id,
        name: member.name,
        todaySeconds,
        yesterdaySeconds,
        lastSundaySeconds,
        totalSeconds: member.totalStudySeconds
      };
    });

    return NextResponse.json({
      groupName: group.name,
      stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
