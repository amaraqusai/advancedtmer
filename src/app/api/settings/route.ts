import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/settings?userId=...
 * Returns all user preferences (mirrors Python's load_* methods)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subject: true,
        colorTheme: true,
        uiTheme: true,
        eyeCareOn: true,
        eyeCareTimerOnly: true,
        autoBreakOn: true,
        autoBreakFreqMins: true,
        autoBreakDurMins: true,
        currentGoalSecs: true,
        goalsReached: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings
 * Updates any subset of user preferences.
 * Mirrors Python's save_color, save_theme, save_subject, save_autobreak, save_eye_care, set_goal.
 *
 * Body: { userId, subject?, colorTheme?, uiTheme?, eyeCareOn?, eyeCareTimerOnly?,
 *          autoBreakOn?, autoBreakFreqMins?, autoBreakDurMins?, currentGoalSecs? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...settings } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Whitelist allowed fields to avoid arbitrary updates
    const ALLOWED_FIELDS = new Set([
      'subject',
      'colorTheme',
      'uiTheme',
      'eyeCareOn',
      'eyeCareTimerOnly',
      'autoBreakOn',
      'autoBreakFreqMins',
      'autoBreakDurMins',
      'currentGoalSecs',
    ]);

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (ALLOWED_FIELDS.has(key)) {
        data[key] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        subject: true,
        colorTheme: true,
        uiTheme: true,
        eyeCareOn: true,
        eyeCareTimerOnly: true,
        autoBreakOn: true,
        autoBreakFreqMins: true,
        autoBreakDurMins: true,
        currentGoalSecs: true,
        goalsReached: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
