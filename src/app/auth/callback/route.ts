
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set(
      "error",
      providerError === "access_denied" ? providerError : "provider_error"
    );

    const providerErrorCode = url.searchParams.get("error_code");
    if (providerErrorCode) {
      loginUrl.searchParams.set("error_code", providerErrorCode);
    }

    console.error(
      "OAuth callback returned an identity provider error:",
      providerError,
      providerErrorCode ?? "unknown error code"
    );

    return NextResponse.redirect(loginUrl);
  }

  // OAuth must return a code to exchange for a session.
  if (!code) {
    console.error("OAuth callback: authorization code is missing.");

    return NextResponse.redirect(
      new URL("/login?error=missing_code", url.origin)
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("OAuth callback: Supabase environment variables are missing.");

    return NextResponse.redirect(
      new URL("/login?error=configuration", url.origin)
    );
  }

  // Successful login should redirect to the chatbot homepage.
  const response = NextResponse.redirect(new URL("/", url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error(
      "ContextOS OAuth callback failed:",
      error?.message ?? "No session returned"
    );

    return NextResponse.redirect(
      new URL("/login?error=callback_failed", url.origin)
    );
  }

  console.log("ContextOS login successful. Redirecting to chatbot.");

  return response;
}
