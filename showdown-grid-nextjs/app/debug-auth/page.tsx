"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface VerifyResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email?: string;
    isAnonymous: boolean;
    createdAt: string;
  };
  session?: {
    expiresAt: number;
    expiresIn: number;
  };
  error?: string;
  message?: string;
  details?: string;
}

export default function DebugAuthPage() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [verifyStatus, setVerifyStatus] = useState<VerifyResponse | null>(null);
  const [quizStatus, setQuizStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const testServerAuth = async () => {
    try {
      const response = await fetch("/api/auth/verify");
      const data = await response.json();
      setVerifyStatus(data);
      return data.authenticated;
    } catch (err: any) {
      console.error("Verify endpoint error:", err);
      setVerifyStatus({ authenticated: false, error: err.message });
      return false;
    }
  };

  const testQuizEndpoint = async () => {
    try {
      const response = await fetch("/api/quiz");
      const data = await response.json();
      setQuizStatus({
        status: response.status,
        statusText: response.statusText,
        data,
      });
    } catch (err: any) {
      console.error("Quiz endpoint error:", err);
      setQuizStatus({ error: err.message });
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const supabase = createClient();

        // Check current session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Current session:", sessionData);

        if (!sessionData.session) {
          // Try to sign in anonymously
          console.log("No session, signing in anonymously...");
          const { data, error: signInError } =
            await supabase.auth.signInAnonymously();

          if (signInError) {
            console.error("Sign in error:", signInError);
            setError(signInError.message);
            setLoading(false);
            return;
          }

          console.log("Sign in successful:", data);
          setAuthStatus(data);
        } else {
          setAuthStatus(sessionData);
        }

        // Check user
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        console.log("User data:", userData, "Error:", userError);

        // Wait a bit for cookies to be set
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Test server-side authentication
        await testServerAuth();

        // Test quiz endpoint
        await testQuizEndpoint();
      } catch (err: any) {
        console.error("Auth check error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const getCookieInfo = () => {
    if (typeof document === "undefined") return [];
    const cookies = document.cookie.split(";").map((c) => c.trim());
    return cookies.filter((c) => c.startsWith("sb-"));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Supabase Authentication Debug</h1>

      {loading && (
        <div className="bg-blue-50 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          <strong>Loading:</strong> Initializing authentication...
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Client-side Auth Status */}
      <div className="bg-white border rounded-lg shadow-sm p-6 mb-4">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <span className="text-2xl">🖥️</span>
          Client-side Auth Status
        </h2>
        <pre className="text-xs overflow-auto bg-gray-50 p-4 rounded">
          {JSON.stringify(authStatus, null, 2)}
        </pre>
      </div>

      {/* Server-side Verification */}
      <div className="bg-white border rounded-lg shadow-sm p-6 mb-4">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          Server-side Verification
          {verifyStatus?.authenticated && (
            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
              ✓ Authenticated
            </span>
          )}
          {verifyStatus && !verifyStatus.authenticated && (
            <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded ml-2">
              ✗ Not Authenticated
            </span>
          )}
        </h2>
        <pre className="text-xs overflow-auto bg-gray-50 p-4 rounded">
          {JSON.stringify(verifyStatus, null, 2)}
        </pre>
      </div>

      {/* Quiz Endpoint Test */}
      <div className="bg-white border rounded-lg shadow-sm p-6 mb-4">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          Quiz Endpoint Test
          {quizStatus?.status === 200 && (
            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
              ✓ Success
            </span>
          )}
          {quizStatus?.status === 404 && (
            <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">
              ⚠ No data (expected for new user)
            </span>
          )}
          {quizStatus?.status === 401 && (
            <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded ml-2">
              ✗ Unauthorized (problem!)
            </span>
          )}
        </h2>
        <pre className="text-xs overflow-auto bg-gray-50 p-4 rounded">
          {JSON.stringify(quizStatus, null, 2)}
        </pre>
      </div>

      {/* Cookie Information */}
      <div className="bg-white border rounded-lg shadow-sm p-6 mb-4">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <span className="text-2xl">🍪</span>
          Supabase Cookies
        </h2>
        <div className="bg-gray-50 p-4 rounded">
          {getCookieInfo().length > 0 ? (
            <ul className="text-sm space-y-1">
              {getCookieInfo().map((cookie, i) => (
                <li key={i} className="font-mono text-xs break-all">
                  {cookie}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No Supabase cookies found</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white border rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-3">Actions</h2>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Page
          </button>
          <button
            onClick={testServerAuth}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test Server Auth
          </button>
          <button
            onClick={testQuizEndpoint}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Test Quiz Endpoint
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-bold mb-2">Expected Behavior:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside text-gray-700">
          <li>Client-side Auth Status should show a user and session</li>
          <li>Server-side Verification should show "authenticated: true"</li>
          <li>
            Quiz Endpoint should return 404 (no data) or 200 (has data), NOT 401
          </li>
          <li>You should see Supabase cookies (sb-*) listed</li>
        </ul>
      </div>
    </div>
  );
}
