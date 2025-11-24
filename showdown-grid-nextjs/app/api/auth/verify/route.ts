import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { 
          authenticated: false,
          error: authError.message,
          details: 'Failed to get user from Supabase'
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { 
          authenticated: false,
          message: 'No user session found. Try signing in anonymously first.'
        },
        { status: 401 }
      );
    }

    // Get session information
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        isAnonymous: user.is_anonymous,
        createdAt: user.created_at,
      },
      session: session ? {
        expiresAt: session.expires_at,
        expiresIn: session.expires_in,
      } : null,
      message: 'Authentication successful'
    });
  } catch (error: any) {
    console.error('[Auth Verify] Error:', error);
    return NextResponse.json(
      { 
        authenticated: false,
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

