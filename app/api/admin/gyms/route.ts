import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
const message = (error: unknown) => error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "Unauthorized";
export async function POST(request: Request) { try { const { supabase } = await requireAdmin(); const { name, weightIncrementKg } = await request.json(); const { error } = await supabase.from("gyms").insert({ name, weight_increment_kg: Number(weightIncrementKg) }); if (error) throw error; return NextResponse.json({ ok: true }); } catch (e) { return NextResponse.json({ error: message(e) }, { status: 400 }); } }
