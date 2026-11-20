import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { sanitizeQuizData } from '@/lib/sanitize-template';

// PATCH - Update a quiz: metadata and/or the board itself
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      timeLimit,
      theme,
      isPublic,
      quizData,
      expectedUpdatedAt,
    } = body;

    // RLS decides who may write at all (owner or collaborator); this read
    // finds out which of the two the caller is.
    const { data: current, error: currentError } = await supabase
      .from('quizzes')
      .select('user_id, is_public, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const isOwner = current.user_id === user.id;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      const trimmed = String(title).trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Tittel kan ikke være tom' },
          { status: 400 }
        );
      }
      updateData.title = trimmed.slice(0, 200);
    }
    if (description !== undefined) {
      updateData.description = String(description).slice(0, 1000);
    }
    if (timeLimit !== undefined) {
      updateData.time_limit =
        timeLimit === null ? null : Math.max(5, Math.round(Number(timeLimit) || 0));
    }
    if (theme !== undefined) {
      const allowed = ['classic', 'modern', 'christmas'];
      updateData.theme = allowed.includes(theme) ? theme : 'classic';
    }
    if (isPublic !== undefined && Boolean(isPublic) !== current.is_public) {
      // Publishing someone else's quiz is the owner's call. The client sends
      // the flag with every save, so an unchanged value is simply left out.
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Bare eieren kan gjøre quizen offentlig eller privat' },
          { status: 403 }
        );
      }
      updateData.is_public = Boolean(isPublic);
    }
    if (quizData !== undefined) {
      // Never trust the client with the template shape: see lib/sanitize-template.
      updateData.quiz_data = sanitizeQuizData(quizData);
    }

    // No `.eq('user_id', ...)` here: a collaborator may also save the board,
    // and RLS (owner OR collaborator) is what actually decides who can write
    // this row. Matches 0 rows for anyone else, which the PGRST116 branch
    // below turns into a 404 rather than a silent no-op.
    //
    // With expectedUpdatedAt, the write only lands on the version the client
    // loaded. Without it, a stale tab — the projector PC from last time —
    // replaced everything saved elsewhere since, with no one the wiser.
    let query = supabase.from('quizzes').update(updateData).eq('id', id);
    if (typeof expectedUpdatedAt === 'string' && expectedUpdatedAt) {
      query = query.eq('updated_at', expectedUpdatedAt);
    }
    const { data, error } = await query.select().single();

    if (error) {
      if (error.code === 'PGRST116') {
        if (typeof expectedUpdatedAt === 'string' && expectedUpdatedAt) {
          return NextResponse.json(
            { error: 'Quizen er endret et annet sted', updatedAt: current.updated_at },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: 'Quiz not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ quiz: data });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to update quiz' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return NextResponse.json(
      { error: 'Failed to delete quiz' },
      { status: 500 }
    );
  }
}
