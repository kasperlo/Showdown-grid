import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET - Load a specific quiz (public or owned) without activating it
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: quizId } = await params;

    // Get the authenticated user (optional for public quizzes)
    const { data: { user } } = await supabase.auth.getUser();

    // Get the quiz - either public or owned by the user
    const query = supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId);

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }
      throw error;
    }

    // Check if user has access (either public or owns it)
    const isPublic = data.is_public === true;
    const isOwner = user && data.user_id === user.id;

    if (!isPublic && !isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return quiz data
    return NextResponse.json({
      data: {
        ...data.quiz_data,
        quizId: data.id,
        quizOwnerId: data.user_id,
        quizTitle: data.title,
        quizDescription: data.description,
        quizTimeLimit: data.time_limit,
        quizTheme: data.theme,
        quizIsPublic: data.is_public,
      }
    });
  } catch (error) {
    console.error('Error loading quiz:', error);
    return NextResponse.json(
      { error: 'Failed to load quiz' },
      { status: 500 }
    );
  }
}
