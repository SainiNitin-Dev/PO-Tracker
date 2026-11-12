import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { name } = await request.json();
    await supabase.from("programs").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);
    const { data, error } = await supabase.from("programs").insert({ user_id: user.id, name, is_active: true }).select("id").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create program" }, { status: 400 }); }
}
