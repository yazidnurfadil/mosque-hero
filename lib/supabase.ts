import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * You can generate the Database type for better DX by running
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/types/supabase.ts
 * and then replacing the `any` below with the generated type.
 */
type Database = any

let serverClient: SupabaseClient<Database> | undefined

/**
 * A singleton **server-side** Supabase client that uses the
 * SERVICE_ROLE key so we can read / write and upload files in API routes.
 */
export function getSupabaseServer(): SupabaseClient<Database> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables")
  }
  if (!serverClient) {
    serverClient = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  }
  return serverClient
}

/**
 * A **client-side** singleton that uses the public anon key.
 */
let browserClient: SupabaseClient<Database> | undefined
export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowser should only be called on the client")
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env")
  }
  if (!browserClient) {
    browserClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  }
  return browserClient
}
