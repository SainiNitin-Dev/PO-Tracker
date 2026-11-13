import { NextResponse } from "next/server";
import { requireAccountApi } from "@/lib/auth";
import { apiError, readJson, textValue } from "@/lib/http";
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireAccountApi();
    const body = await readJson(request);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: textValue(body.displayName, "Your name", { max: 120 }),
      })
      .eq("id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
