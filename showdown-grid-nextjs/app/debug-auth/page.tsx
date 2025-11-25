'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function DebugAuthPage() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();

        // Check current session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Current session:', sessionData);

        if (!sessionData.session) {
          // Try to sign in anonymously
          console.log('No session, signing in anonymously...');
          const { data, error: signInError } = await supabase.auth.signInAnonymously();

          if (signInError) {
            console.error('Sign in error:', signInError);
            setError(signInError.message);
            return;
          }

          console.log('Sign in successful:', data);
          setAuthStatus(data);
        } else {
          setAuthStatus(sessionData);
        }

        // Check user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        console.log('User data:', userData, 'Error:', userError);

      } catch (err: any) {
        console.error('Auth check error:', err);
        setError(err.message);
      }
    };

    checkAuth();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold mb-2">Auth Status:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(authStatus, null, 2)}
        </pre>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-600">
          Check the browser console for detailed logs
        </p>
      </div>
    </div>
  );
}
