import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/notes?userId=...
 * Returns all non-deleted notes for the user, newest first.
 * Mirrors Python's load_notes() / notes_manager.create_task()
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const notes = await prisma.note.findMany({
      where: { userId, deleted: false },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Notes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/notes
 * Creates a new note.
 * Mirrors Python's DataManager.create_new_note(title, text)
 *
 * Body: { userId, title, text }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, title, text } = await request.json();

    if (!userId || !title || text === undefined) {
      return NextResponse.json({ error: 'userId, title and text are required' }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: { userId, title, text },
    });

    // Recalculate Note Scribbler achievement
    const noteCount = await prisma.note.count({ where: { userId, deleted: false } });
    await prisma.userAchievement.updateMany({
      where: { userId, name: 'Note Scribbler' },
      data: {
        value: noteCount,
        unlocked: noteCount >= 10,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/notes
 * Updates a note's title/text, or soft-deletes it.
 * Mirrors Python's "Deleted: Yes" flag in the Excel sheet.
 *
 * Body: { noteId, title?, text?, deleted? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { noteId, title, text, deleted } = await request.json();

    if (!noteId) {
      return NextResponse.json({ error: 'noteId required' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (text !== undefined) data.text = text;
    if (deleted !== undefined) data.deleted = deleted;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const note = await prisma.note.update({
      where: { id: noteId },
      data,
    });

    // Recalculate Note Scribbler achievement after soft delete
    if (deleted !== undefined) {
      const noteCount = await prisma.note.count({ where: { userId: note.userId, deleted: false } });
      await prisma.userAchievement.updateMany({
        where: { userId: note.userId, name: 'Note Scribbler' },
        data: {
          value: noteCount,
          unlocked: noteCount >= 10,
        },
      });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Notes PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
