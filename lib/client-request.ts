export async function requestJson<T = { ok: boolean }>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error(
      "We couldn’t confirm that this saved. Check your connection and refresh before trying again.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error ||
        (response.status === 401
          ? "Your session expired. Please log in again."
          : "That did not save. Please try again."),
    );
  if (data === null)
    throw new Error(
      "The server returned an unexpected response. Please try again.",
    );
  return data as T;
}
