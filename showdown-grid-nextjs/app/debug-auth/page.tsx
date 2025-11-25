"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function DebugAuthPage() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<string[]>([]);
  const [apiTestResult, setApiTestResult] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();

        // Check current session
        console.log("[Debug] Checking current session...");
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("[Debug] Current session:", sessionData);

        if (!sessionData.session) {
          // Try to sign in anonymously
          console.log("[Debug] No session, signing in anonymously...");
          const { data, error: signInError } =
            await supabase.auth.signInAnonymously();

          if (signInError) {
            console.error("[Debug] Sign in error:", signInError);
            setError(signInError.message);
            return;
          }

          console.log("[Debug] Sign in successful:", data);

          // Wait for cookies
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify session
          const {
            data: { session: verifiedSession },
          } = await supabase.auth.getSession();
          console.log("[Debug] Verified session:", verifiedSession);

          setAuthStatus(data);
        } else {
          setAuthStatus(sessionData);
        }

        // Check user
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        console.log("[Debug] User data:", userData, "Error:", userError);

        // Check cookies
        if (typeof document !== "undefined") {
          const supabaseCookies = document.cookie
            .split(";")
            .filter((c) => c.trim().startsWith("sb-"))
            .map((c) => c.trim());
          console.log("[Debug] Supabase cookies:", supabaseCookies);
          setCookies(supabaseCookies);
        }

        // Test API call
        console.log("[Debug] Testing API call...");
        try {
          const response = await fetch("/api/quizzes");
          const data = await response.json();
          console.log("[Debug] API test result:", {
            status: response.status,
            data,
          });
          setApiTestResult({ status: response.status, data });
        } catch (apiError: any) {
          console.error("[Debug] API test error:", apiError);
          setApiTestResult({ error: apiError.message });
        }
      } catch (err: any) {
        console.error("[Debug] Auth check error:", err);
        setError(err.message);
      }
    };

    checkAuth();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Supabase Authentication Debug</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid gap-4">
        {/* Auth Status */}
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-3">Auth Status</h2>
          <pre className="text-xs overflow-auto bg-gray-50 p-4 rounded">
            {JSON.stringify(authStatus, null, 2)}
          </pre>
        </div>

        {/* Cookies */}
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-3">Supabase Cookies</h2>
          {cookies.length > 0 ? (
            <ul className="text-sm space-y-1">
              {cookies.map((cookie, i) => (
                <li
                  key={i}
                  className="font-mono text-xs break-all bg-gray-50 p-2 rounded"
                >
                  {cookie}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No Supabase cookies found</p>
          )}
        </div>

        {/* API Test */}
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            API Test Result
            {apiTestResult?.status === 200 && (
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                ✓ Success
              </span>
            )}
            {apiTestResult?.status === 401 && (
              <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                ✗ 401 Unauthorized
              </span>
            )}
          </h2>
          <pre className="text-xs overflow-auto bg-gray-50 p-4 rounded">
            {JSON.stringify(apiTestResult, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-bold mb-2">Expected Behavior:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside text-gray-700">
          <li>Auth Status should show a user and session</li>
          <li>You should see Supabase cookies (sb-*) listed</li>
          <li>API Test should return status 200 (not 401)</li>
          <li>Check browser console for detailed [Debug] logs</li>
        </ul>
      </div>
    </div>
  );
}
