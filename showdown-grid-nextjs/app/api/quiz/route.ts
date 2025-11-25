import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET - Load user's active quiz
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the active quiz for this user
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No active quiz found
        return NextResponse.json({ message: 'No active quiz found' }, { status: 404 });
      }
      throw error;
    }

    // Return quiz data along with metadata
    return NextResponse.json({
      data: {
        ...data.quiz_data,
        quizId: data.id,
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

// POST - Save user's active quiz
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { data: quizData } = body;

    if (!quizData) {
      return NextResponse.json(
        { error: 'Quiz data is required' },
        { status: 400 }
      );
    }

    // Extract metadata from quiz data
    const { quizTitle, quizDescription, quizTimeLimit, quizTheme, quizIsPublic, ...actualQuizData } = quizData;

    // First, check if user has an active quiz
    const { data: activeQuiz } = await supabase
      .from('quizzes')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (activeQuiz) {
      // Update existing active quiz
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: quizTitle || 'Min Quiz',
          description: quizDescription || 'En Jeopardy-stil quiz',
          time_limit: quizTimeLimit,
          theme: quizTheme || 'classic',
          is_public: quizIsPublic || false,
          quiz_data: actualQuizData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeQuiz.id);

      if (error) throw error;
    } else {
      // Create new quiz and set as active
      const { error } = await supabase
        .from('quizzes')
        .insert({
          user_id: user.id,
          title: quizTitle || 'Min Quiz',
          description: quizDescription || 'En Jeopardy-stil quiz',
          time_limit: quizTimeLimit,
          theme: quizTheme || 'classic',
          is_public: quizIsPublic || false,
          quiz_data: actualQuizData,
          is_active: true,
        });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving quiz:', error);
    return NextResponse.json(
      { error: 'Failed to save quiz' },
      { status: 500 }
    );
  }
}
