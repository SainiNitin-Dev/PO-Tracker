import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  apiError,
  HttpError,
  numberValue,
  readJson,
  textValue,
  uuid,
} from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const body = await readJson(request);
    if (body.action === "create") {
      const { error } = await supabase
        .from("muscles")
        .insert({ name: textValue(body.name, "Muscle name", { max: 80 }) });
      if (error) throw error;
    } else if (body.action === "replace") {
      if (
        !Array.isArray(body.primary) ||
        !Array.isArray(body.secondary) ||
        body.primary.length + body.secondary.length > 250
      )
        throw new HttpError(400, "Select up to 250 muscles.");
      const primary = body.primary.map((id) =>
        uuid(id, "muscle").toLowerCase(),
      );
      const secondary = body.secondary.map((id) =>
        uuid(id, "muscle").toLowerCase(),
      );
      if (
        new Set([...primary, ...secondary]).size !==
        primary.length + secondary.length
      )
        throw new HttpError(400, "Each muscle can have only one role.");
      const { error } = await supabase.rpc("replace_exercise_muscles", {
        p_exercise_id: uuid(body.exerciseId, "exercise"),
        p_primary: primary,
        p_secondary: secondary,
      });
      if (error) throw error;
    } else if (body.action === "map") {
      const contribution = numberValue(body.contribution, "Contribution", {
        min: 0.5,
        max: 1,
      });
      if (![0.5, 1].includes(contribution))
        throw new HttpError(400, "Choose primary or supporting muscle.");
      const exerciseId = uuid(body.exerciseId, "exercise");
      const { data, error: exerciseError } = await supabase
        .from("exercises")
        .select("id")
        .eq("id", exerciseId)
        .is("archived_at", null)
        .single();
      if (exerciseError || !data)
        throw new HttpError(400, "Choose an active exercise.");
      const { error } = await supabase.from("exercise_muscles").upsert(
        {
          exercise_id: exerciseId,
          muscle_id: uuid(body.muscleId, "muscle"),
          contribution,
        },
        { onConflict: "exercise_id,muscle_id" },
      );
      if (error) throw error;
    } else throw new HttpError(400, "Choose a valid action.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const body = await readJson(request);
    if (body.exerciseId !== undefined) {
      const { error } = await supabase
        .from("exercise_muscles")
        .delete()
        .eq("exercise_id", uuid(body.exerciseId))
        .eq("muscle_id", uuid(body.muscleId));
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("delete_unused_muscle", {
        muscle: uuid(body.id, "muscle"),
      });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
