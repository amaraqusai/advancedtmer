import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userId, additionalSeconds } = await request.json();

    if (!userId) return NextResponse.json({ error: 'UserId required' }, { status: 400 });

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        totalStudySeconds: { increment: additionalSeconds },
        lastSync: new Date()
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
