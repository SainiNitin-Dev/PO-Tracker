import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/user";
import {
  apiError,
  HttpError,
  readJson,
  numberValue,
  textValue,
  uuid,
} from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const { data, error } = await supabase.rpc("add_training_day", {
      p_program_id: uuid(body.programId, "Plan"),
      p_name: textValue(body.name, "Day name", { max: 80 }),
      p_weekday: numberValue(body.weekday, "Weekday", {
        min: 0,
        max: 6,
        integer: true,
      }),
    });
    if (error) throw error;
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const id = uuid(body.id, "Day");
    if (body.direction !== undefined) {
      const direction = numberValue(body.direction, "Direction", {
        min: -1,
        max: 1,
        integer: true,
      });
      if (!direction) throw new HttpError(400, "Choose up or down.");
      const { error } = await supabase.rpc("move_training_item", {
        p_kind: "day",
        p_id: id,
        p_direction: direction,
      });
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("program_days")
        .update({
          name: textValue(body.name, "Day name", { max: 80 }),
          weekday: numberValue(body.weekday, "Weekday", {
            min: 0,
            max: 6,
            integer: true,
          }),
        })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new HttpError(404, "This training day is no longer available.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const body = await readJson(request);
    const { data, error } = await supabase
      .from("program_days")
      .delete()
      .eq("id", uuid(body.id, "Day"))
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new HttpError(404, "This training day is no longer available.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
