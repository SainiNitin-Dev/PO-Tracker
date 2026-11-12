import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export async function POST(request: Request) { try { const { supabase } = await requireAdmin(); const { name, weightIncrementKg } = await request.json(); const { error } = await supabase.from("gyms").insert({ name, weight_increment_kg: Number(weightIncrementKg) }); if (error) throw error; return NextResponse.json({ ok: true }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 400 }); } }
