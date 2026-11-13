import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";

export const getIdentity = cache(async () => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  if (profileError || !profile)
    throw new HttpError(
      503,
      "Your profile could not be loaded. Please try again.",
    );
  return { supabase, user, profile };
});

export async function requireAccount() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new HttpError(
      503,
      "Add the Supabase project URL and publishable key to finish setting up the app.",
    );
  const identity = await getIdentity();
  if (!identity) redirect("/login");
  return identity;
}

export async function requireAccountApi() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new HttpError(
      503,
      "Add the Supabase project URL and publishable key to finish setting up the app.",
    );
  const identity = await getIdentity();
  if (!identity)
    throw new HttpError(401, "Your session has expired. Please log in again.");
  return identity;
}

export async function requireAdmin() {
  const identity = await requireAccount();
  if (identity.profile.role !== "admin") redirect("/");
  return identity;
}

export async function requireAdminApi() {
  const identity = await requireAccountApi();
  if (identity.profile.role !== "admin")
    throw new HttpError(
      403,
      "Only an administrator can manage the gym catalog.",
    );
  return identity;
}
