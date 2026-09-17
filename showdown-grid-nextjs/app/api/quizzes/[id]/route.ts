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
    const { title, description, timeLimit, theme, isPublic, quizData } = body;

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
    if (isPublic !== undefined) {
      updateData.is_public = Boolean(isPublic);
    }
    if (quizData !== undefined) {
      // Never trust the client with the template shape: see lib/sanitize-template.
      updateData.quiz_data = sanitizeQuizData(quizData);
    }

    const { data, error } = await supabase
      .from('quizzes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
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
