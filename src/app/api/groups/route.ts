import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Create a group
export async function POST(request: NextRequest) {
  try {
    const { name, userId, action, inviteCode } = await request.json();

    if (action === 'create') {
      if (!name || !userId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
      
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const group = await prisma.group.create({
        data: {
          name,
          inviteCode: code,
          members: {
            connect: { id: userId }
          }
        }
      });
      return NextResponse.json(group);
    }

    if (action === 'join') {
      if (!inviteCode || !userId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
      
      const group = await prisma.group.findUnique({
        where: { inviteCode }
      });

      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

      await prisma.user.update({
        where: { id: userId },
        data: { groupId: group.id }
      });

      return NextResponse.json(group);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get group data (for leaderboard)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  if (!groupId) return NextResponse.json({ error: 'GroupId required' }, { status: 400 });

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          orderBy: { totalStudySeconds: 'desc' }
        }
      }
    });

    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    return NextResponse.json(group);
  } catch (error) {
    console.error('Group fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
