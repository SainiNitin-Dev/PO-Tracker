import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (
    code === "P0001" &&
    error &&
    typeof error === "object" &&
    "message" in error
  )
    return NextResponse.json({ error: String(error.message) }, { status: 400 });
  const messages: Record<string, string> = {
    "23505":
      "This already exists. Choose a different name or edit the existing item.",
    "23503": "This item is still in use. Refresh the page and try again.",
    "23514":
      "One of the values is outside the allowed range. Check the form and try again.",
    "42501": "You don’t have permission to make this change.",
    PGRST116:
      "This item is no longer available. Refresh the page and try again.",
    P0002: "This item is no longer available. Refresh the page and try again.",
    "22023": "Some form values are invalid. Check your entries and try again.",
    PGRST202:
      "The database needs the latest update. Ask your administrator to apply the new migrations.",
    "42703":
      "The database needs the latest update. Ask your administrator to apply the new migrations.",
    "42P01":
      "The database needs the latest update. Ask your administrator to apply the new migrations.",
  };
  const statuses: Record<string, number> = {
    "23505": 409,
    "23503": 409,
    "23514": 400,
    "42501": 403,
    "22023": 400,
    P0002: 404,
    PGRST116: 404,
    PGRST202: 503,
    "42703": 503,
    "42P01": 503,
  };
  return NextResponse.json(
    {
      error:
        messages[code] ?? "We couldn’t save this change. Please try again.",
    },
    { status: statuses[code] ?? 500 },
  );
}

export async function readJson(
  request: Request,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Please submit this form from the app.");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send this request as JSON.");
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(
      400,
      "This form could not be read. Refresh the page and try again.",
    );
  }
}

export function uuid(value: unknown, label = "Item") {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, `Choose a valid ${label.toLowerCase()}.`);
  return value;
}

export function textValue(
  value: unknown,
  label: string,
  { min = 1, max = 120 }: { min?: number; max?: number } = {},
) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new HttpError(400, `${label} must contain ${min}–${max} characters.`);
  return value.trim();
}

export function numberValue(
  value: unknown,
  label: string,
  {
    min = 0,
    max = 10000,
    integer = false,
  }: { min?: number; max?: number; integer?: boolean } = {},
) {
  if (
    (typeof value === "string" && value.trim() === "") ||
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value !== "number" && typeof value !== "string")
  )
    throw new HttpError(400, `Enter ${label.toLowerCase()}.`);
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max ||
    (integer && !Number.isInteger(parsed))
  )
    throw new HttpError(
      400,
      `${label} must be ${integer ? "a whole number " : ""}between ${min} and ${max}.`,
    );
  return parsed;
}

export function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T))
    throw new HttpError(400, `Choose a valid ${label.toLowerCase()}.`);
  return value as T;
}

export function archiveSelection(body: Record<string, unknown>) {
  if (body.all === true && body.id === undefined)
    return { itemId: null, allItems: true };
  if (body.all !== undefined && body.all !== false)
    throw new HttpError(
      400,
      "Choose one item or explicitly confirm clearing all items.",
    );
  return { itemId: uuid(body.id), allItems: false };
}
