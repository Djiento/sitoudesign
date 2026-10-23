
import "server-only";

import { createClient } from "@supabase/supabase-js";

export class SupabaseStorageConfigurationError extends Error {
  constructor(missingVariables: string[]) {
    super(
      `Configuration Supabase Storage manquante : ${missingVariables.join(", ")}.`,
    );
    this.name = "SupabaseStorageConfigurationError";
  }
}

export function getSupabaseStorage() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingVariables = [
    ...(!supabaseUrl
      ? ["SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)"]
      : []),
    ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
  ];

  if (!supabaseUrl || !serviceRoleKey) {
    throw new SupabaseStorageConfigurationError(missingVariables);
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "sitou-media",
    url: supabaseUrl,
  };
}
