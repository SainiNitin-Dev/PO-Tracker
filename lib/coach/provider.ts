type Message = { role: "system" | "user" | "assistant"; content: string };
type ProviderMessage = Message | { role: "tool"; tool_call_id: string; content: string } | { role: "assistant"; content: string | null; tool_calls: unknown[] };
export async function completeCoachMessage(messages: Message[], databaseFacts: unknown) {
  const baseUrl = process.env.CHAT_API_BASE_URL;
  const key = process.env.CHAT_API_KEY;
  const model = process.env.CHAT_MODEL;
  if (!baseUrl || !key || !model) return null;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  const tool = { type: "function", function: { name: "get_training_snapshot", description: "Fetch the user's private, current training facts. Must be called before every answer.", parameters: { type: "object", properties: {}, additionalProperties: false } } };
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model, temperature: 0.2, messages, tools: [tool], tool_choice: "required" }) });
  if (!response.ok) throw new Error("Coach provider request failed");
  const data = await response.json(); const first = data.choices?.[0]?.message;
  const calls = first?.tool_calls ?? [];
  if (!calls.length) throw new Error("Coach did not retrieve training facts");
  const toolMessages = calls.map((call: { id: string }) => ({ role: "tool" as const, tool_call_id: call.id, content: JSON.stringify(databaseFacts) }));
  const finalResponse = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model, temperature: 0.2, messages: [...messages, { role: "assistant", content: first.content ?? null, tool_calls: calls }, ...toolMessages] satisfies ProviderMessage[], response_format: { type: "json_object" } }) });
  if (!finalResponse.ok) throw new Error("Coach provider response failed");
  const finalData = await finalResponse.json();
  const content = finalData.choices?.[0]?.message?.content as string | undefined;
  if (!content) return undefined;
  try { const parsed = JSON.parse(content); return typeof parsed.answer === "string" ? parsed.answer : undefined; } catch { return undefined; }
}
