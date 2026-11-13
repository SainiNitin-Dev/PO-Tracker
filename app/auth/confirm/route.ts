import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (
    tokenHash &&
    (type === "invite" || type === "recovery" || type === "email")
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error)
      return NextResponse.redirect(new URL("/set-password", url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL("/set-password", url.origin));
  }
  return NextResponse.redirect(
    new URL("/set-password?error=expired", url.origin),
  );
}
