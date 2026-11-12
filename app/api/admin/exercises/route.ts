import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export async function POST(request: Request) { try { const { supabase } = await requireAdmin(); const { name, trackingType } = await request.json(); const { error } = await supabase.from("exercises").insert({ name, tracking_type: trackingType }); if (error) throw error; return NextResponse.json({ ok: true }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 400 }); } }
