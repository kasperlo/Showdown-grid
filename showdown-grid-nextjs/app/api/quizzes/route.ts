import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET - List all quizzes for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[API /quizzes GET] Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message 
    });

    if (authError || !user) {
      console.error('[API /quizzes GET] Unauthorized:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('quizzes')
      .select('id, title, description, is_public, time_limit, theme, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ quizzes: data || [] });
  } catch (error) {
    console.error('Error loading quizzes:', error);
    return NextResponse.json(
      { error: 'Failed to load quizzes' },
      { status: 500 }
    );
  }
}

// POST - Create a new quiz
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[API /quizzes POST] Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message 
    });

    if (authError || !user) {
      console.error('[API /quizzes POST] Unauthorized:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, quizData, setAsActive } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Default quiz data structure
    const defaultQuizData = quizData || {
      categories: [],
      teams: [
        { id: '1', name: 'Team 1', score: 0, players: ['Player 1'] },
        { id: '2', name: 'Team 2', score: 0, players: ['Player 1'] },
        { id: '3', name: 'Team 3', score: 0, players: ['Player 1'] },
      ],
      adjustmentLog: [],
    };

    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        title,
        description: description || 'En Jeopardy-stil quiz',
        quiz_data: defaultQuizData,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If setAsActive is true, update users table
    if (setAsActive) {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          user_id: user.id,
          active_quiz_id: data.id,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.error('Failed to set quiz as active:', upsertError);
      }
    }

    return NextResponse.json({ quiz: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz' },
      { status: 500 }
    );
  }
}
