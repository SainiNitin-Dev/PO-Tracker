import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, HttpError, readJson, textValue } from "@/lib/http";

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const body = await readJson(request);
    const email = textValue(body.email, "Email", { max: 254 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Enter a valid email address.");
    const displayName = textValue(body.displayName, "Name", { max: 80 });
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo: `${new URL(request.url).origin}/set-password`,
    });
    if (error) {
      if (
        error.code === "email_exists" ||
        error.message.toLowerCase().includes("already")
      )
        throw new HttpError(
          409,
          "This person already has an account. They can log in or use Forgot password.",
        );
      if (error.status === 429 || error.code === "over_email_send_rate_limit")
        throw new HttpError(
          429,
          "The email limit has been reached. Wait a few minutes before sending another invitation.",
        );
      throw new HttpError(
        502,
        "The invitation could not be sent. Check the project’s email settings, then try again.",
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
