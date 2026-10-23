
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase";

export default function LoginPage() {
  const [supabase] = useState(() => createClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const callbackUrl = new URL(window.location.href);
    const queryParams = callbackUrl.searchParams;
    const fragmentParams = new URLSearchParams(callbackUrl.hash.slice(1));
    const callbackError =
      queryParams.get("error") ?? fragmentParams.get("error");

    if (!callbackError) return;

    const providerErrorCode =
      fragmentParams.get("error_code") ?? queryParams.get("error_code");
    queryParams.delete("error_description");
    callbackUrl.hash = "";
    window.history.replaceState(
      null,
      "",
      `${callbackUrl.pathname}${callbackUrl.search}`
    );

    const callbackMessages: Record<string, string> = {
      access_denied: "Google sign-in was canceled or denied.",
      callback_failed:
        "Google sign-in could not be completed. Check the app's server logs for the callback error.",
      configuration:
        "Google sign-in is not configured correctly. Check the app's Supabase environment variables.",
      missing_code:
        "Google sign-in returned without an authorization code. Check the Supabase and Google redirect URL settings.",
      provider_error:
        "Google sign-in failed during Supabase's code exchange. Verify the Google OAuth client credentials in Supabase and the authorized redirect URI in Google Cloud Console.",
    };

    setError(
      `${callbackMessages[callbackError] ?? "Google sign-in could not be completed. Please try again."}${
        providerErrorCode ? ` (${providerErrorCode})` : ""
      }`
    );
  }, []);

  // Redirect to chatbot when a valid session exists.
  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (active && data.session) {
        window.location.replace("/");
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        window.location.replace("/");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function socialLogin(provider: "google" | "github") {
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        window.location.replace("/");
        return;
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        window.location.replace("/");
        return;
      }
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold">ContextOS</h1>
        <p className="mt-2 text-slate-400">
          Sign in to continue to your AI assistant.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">
            {message}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void socialLogin("google")}
            className="w-full rounded-lg bg-white px-4 py-3 font-medium text-slate-900 disabled:opacity-50"
          >
            Continue with Google
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void socialLogin("github")}
            className="w-full rounded-lg border border-slate-700 px-4 py-3 font-medium disabled:opacity-50"
          >
            Continue with GitHub
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
          <div className="h-px flex-1 bg-slate-700" />
          or use email
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
          />

          <input
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {isSignup ? "Already have an account?" : "New to ContextOS?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError("");
              setMessage("");
            }}
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            {isSignup ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>
    </main>
  );
}
