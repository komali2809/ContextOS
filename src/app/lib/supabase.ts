
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  console.log("Supabase URL loaded:", Boolean(url));
  console.log("Supabase key loaded:", Boolean(key));

  if (!url || !key) {
    throw new Error("Supabase environment variables are not loading.");
  }

  return createBrowserClient(url, key);
}
