import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Load user's quiz
export async function GET(request: NextRequest) {
  try {
    // For now, we'll use a simple user_id from session or default to 'demo'
    // In production, this would come from your auth system
    const userId = 'demo-user'; // TODO: Get from auth session

    const { data, error } = await supabase
      .from('user_quizzes')
      .select('quiz_data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return NextResponse.json({ message: 'No quiz found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data: data.quiz_data });
  } catch (error) {
    console.error('Error loading quiz:', error);
    return NextResponse.json(
      { error: 'Failed to load quiz' },
      { status: 500 }
    );
  }
}

// POST - Save user's quiz
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: quizData } = body;

    if (!quizData) {
      return NextResponse.json(
        { error: 'Quiz data is required' },
        { status: 400 }
      );
    }

    // For now, we'll use a simple user_id from session or default to 'demo'
    const userId = 'demo-user'; // TODO: Get from auth session

    const { error } = await supabase
      .from('user_quizzes')
      .upsert({
        user_id: userId,
        quiz_data: quizData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      throw error;
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
