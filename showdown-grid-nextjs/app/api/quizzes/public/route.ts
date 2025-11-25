import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET - List all public quizzes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Note: This endpoint doesn't require authentication
    // because public quizzes should be visible to everyone
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('quizzes')
      .select('id, title, description, is_public, time_limit, theme, created_at, updated_at, user_id')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Add a flag to indicate if the current user owns each quiz
    const quizzesWithOwnership = (data || []).map(quiz => ({
      ...quiz,
      isOwnedByCurrentUser: user ? quiz.user_id === user.id : false,
    }));

    return NextResponse.json({ quizzes: quizzesWithOwnership });
  } catch (error) {
    console.error('Error loading public quizzes:', error);
    return NextResponse.json(
      { error: 'Failed to load public quizzes' },
      { status: 500 }
    );
  }
}
