type Message = { role: "system" | "user" | "assistant"; content: string };
export async function completeCoachMessage(messages: Message[]) {
  const baseUrl = process.env.CHAT_API_BASE_URL;
  const key = process.env.CHAT_API_KEY;
  const model = process.env.CHAT_MODEL;
  if (!baseUrl || !key || !model) return null;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0.2, messages, response_format: { type: "json_object" } }) });
  if (!response.ok) throw new Error("Coach provider request failed");
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;
  if (!content) return undefined;
  try { const parsed = JSON.parse(content); return typeof parsed.answer === "string" ? parsed.answer : undefined; } catch { return undefined; }
}
