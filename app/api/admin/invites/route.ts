import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) { try { await requireAdmin(); const { email, displayName } = await request.json(); const admin = createAdminClient(); const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName }, redirectTo: `${new URL(request.url).origin}/login` }); if (error) throw error; return NextResponse.json({ ok: true }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 400 }); } }
