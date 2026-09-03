import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variable.");
}

const instrumentedFetch: typeof fetch = async (input, init) => {
  const startedAt = performance.now();
  const response = await fetch(input, init);
  const durationMs = Math.round(performance.now() - startedAt);

  if (durationMs >= 1000) {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    console.warn("[Supabase] slow request", {
      method: init?.method ?? "GET",
      path: new URL(requestUrl).pathname,
      status: response.status,
      durationMs,
      contentLength: response.headers.get("content-length"),
    });
  }

  return response;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: instrumentedFetch },
});
