"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { TrainingFact } from "@/lib/coach/training-facts";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  evidence?: TrainingFact[];
};
type Note = { id: string; note: string; updated_at: string };
const starters = [
  "How is my training going?",
  "What should I focus on next?",
  "Help me understand my last workout",
];

async function coachRequest(method: string, body: Record<string, unknown>) {
  const response = await fetch("/api/coach", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error ?? "Your request could not be completed. Please try again.",
    );
  return data;
}

export default function CoachChat({
  chatId,
  chats,
  page,
  hasOlderChats,
  initialMessages,
  initialNotes,
  configured,
}: {
  chatId: string | null;
  chats: { id: string; title: string | null; created_at: string }[];
  page: number;
  hasOlderChats: boolean;
  initialMessages: ChatMessage[];
  initialNotes: Note[];
  configured: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const [error, setError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [chatAction, setChatAction] = useState<"create" | "delete" | null>(
    null,
  );
  const [navigating, startNavigation] = useTransition();
  const router = useRouter();
  const chatBusy = busy || noteBusy || Boolean(chatAction) || navigating;
  const chatUrl = (id: string, listPage = page) =>
    `/coach?chat=${id}&page=${listPage}`;
  const [status, setStatus] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const send = async (retry = false) => {
    if (chatBusy || !configured || !chatId || (pending && !retry)) return;
    const draft =
      retry && pending
        ? pending
        : { id: crypto.randomUUID(), text: text.trim() };
    if (!draft.text) return;
    setPending(draft);
    setText("");
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const data = await coachRequest("POST", {
        message: draft.text,
        requestId: draft.id,
        chatId,
      });
      const now = new Date().toISOString();
      setMessages((old) => [
        ...old,
        {
          id: `${draft.id}-user`,
          role: "user",
          content: draft.text,
          created_at: now,
        },
        {
          id: `${draft.id}-answer`,
          role: "assistant",
          content: data.answer,
          evidence: data.evidence,
          created_at: now,
        },
      ]);
      setPending(null);
      if (!messages.length) router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.name !== "TimeoutError"
          ? failure.message
          : "The reply took too long. Retry to check whether it was saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    setStatus("");
    try {
      const data = await coachRequest("POST", {
        action: "note",
        note: noteDraft,
        ...(editingNote ? { id: editingNote } : {}),
      });
      setNotes((old) => [
        data.note,
        ...old.filter((note) => note.id !== data.note.id),
      ]);
      setNoteDraft("");
      setEditingNote(null);
      setStatus("Note saved. Your coach will use it in future replies.");
    } catch (failure) {
      setNoteError(
        failure instanceof Error
          ? failure.message
          : "Your note could not be saved.",
      );
    } finally {
      setNoteBusy(false);
    }
  };
  const removeNote = async (id: string) => {
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      await coachRequest("DELETE", { action: "note", id });
      setNotes((old) => old.filter((note) => note.id !== id));
      if (editingNote === id) {
        setEditingNote(null);
        setNoteDraft("");
      }
      setStatus("Note removed.");
    } catch (failure) {
      setNoteError(
        failure instanceof Error
          ? failure.message
          : "Your note could not be removed.",
      );
    } finally {
      setNoteBusy(false);
    }
  };
  const changeChat = async (action: "create" | "delete") => {
    if (chatBusy || (action === "delete" && !chatId)) return;
    setChatAction(action);
    setError("");
    try {
      if (action === "create") {
        const { id } = await coachRequest("POST", { action: "new-chat" });
        startNavigation(() => {
          router.push(chatUrl(id, 1));
          router.refresh();
        });
      } else {
        await coachRequest("DELETE", { action: "conversation", id: chatId });
        startNavigation(() => {
          router.replace(chatUrl("new", 1));
          router.refresh();
        });
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your chat could not be updated.",
      );
    } finally {
      setChatAction(null);
    }
  };

  return (
    <main className="app-page coach-page">
      <header className="page-header">
        <p className="eyebrow">A little guidance</p>
        <h1>Your Coach</h1>
        <p>
          Talk through your training, with your own workout history at hand.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/history">View Your History →</Link>
          <Link href="/program">Edit Your Plan →</Link>
        </div>
      </header>
      <section className="surface mb-6 space-y-3" aria-label="Your chats">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your chats</h2>
          <button
            type="button"
            className="primary-action"
            disabled={chatBusy}
            onClick={() => void changeChat("create")}
          >
            {chatAction === "create" ? "Starting…" : "New chat"}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="field min-w-48 flex-1">
            Open a chat
            <select
              disabled={chatBusy || !chats.length}
              value={chats.some((chat) => chat.id === chatId) ? chatId! : ""}
              onChange={(event) => {
                const id = event.target.value;
                startNavigation(() => router.push(chatUrl(id)));
              }}
            >
              <option value="" disabled>
                {chats.length ? "Choose a saved chat" : "No saved chats yet"}
              </option>
              {chats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title || "Untitled chat"} ·{" "}
                  {new Date(chat.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Kolkata",
                  })}
                </option>
              ))}
            </select>
          </label>
          {chatId && (
            <button
              type="button"
              className="danger-action"
              disabled={chatBusy}
              onClick={() => setClearConfirm(true)}
            >
              Delete this chat
            </button>
          )}
        </div>
        {(page > 1 || hasOlderChats) && (
          <div className="flex flex-wrap gap-2">
            {page > 1 && (
              <button
                className="secondary-action"
                disabled={chatBusy}
                onClick={() =>
                  startNavigation(() =>
                    router.push(chatUrl(chatId ?? "new", page - 1)),
                  )
                }
              >
                Newer chats
              </button>
            )}
            {hasOlderChats && (
              <button
                className="secondary-action"
                disabled={chatBusy}
                onClick={() =>
                  startNavigation(() =>
                    router.push(chatUrl(chatId ?? "new", page + 1)),
                  )
                }
              >
                Older chats
              </button>
            )}
          </div>
        )}
        {clearConfirm && (
          <div
            className="status-message"
            role="group"
            aria-label="Confirm chat deletion"
          >
            <p>
              Permanently delete this chat and its messages? Saved goals and
              notes are kept separately.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="danger-action"
                disabled={chatBusy}
                onClick={() => void changeChat("delete")}
              >
                {chatAction === "delete" ? "Deleting…" : "Delete chat"}
              </button>
              <button
                className="secondary-action"
                disabled={chatBusy}
                onClick={() => setClearConfirm(false)}
              >
                Keep chat
              </button>
            </div>
          </div>
        )}
        {!pending && error && (
          <p className="status-message" data-tone="error" role="alert">
            {error}
          </p>
        )}
      </section>
      {!configured && (
        <p className="status-message" role="status">
          Your coach is waiting to be connected. An administrator needs to
          finish the AI settings. You can still save notes below.
        </p>
      )}
      <details className="surface p-5 mb-6">
        <summary className="cursor-pointer font-semibold">
          What Your Coach Knows{" "}
          <span className="muted font-normal">· Goals & Notes</span>
        </summary>
        <p className="muted text-sm mt-3">
          Your recent workouts, active plan, bodyweight entries and these notes.
          Add your goal, experience, preferences or anything you want
          remembered. The coach cannot change your plan for you.
        </p>
        <form onSubmit={saveNote} className="mt-4 space-y-3">
          <label className="field">
            {editingNote ? "Edit Your Note" : "Add a Note"}
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              required
              maxLength={1000}
              rows={3}
              placeholder="For example: I want to get stronger and can train three days a week."
            />
          </label>
          <div className="flex gap-2">
            <button
              className="primary-action"
              disabled={noteBusy || !noteDraft.trim()}
            >
              {noteBusy ? "Saving…" : "Save Note"}
            </button>
            {editingNote && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setEditingNote(null);
                  setNoteDraft("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {noteError && (
          <p role="alert" data-tone="error" className="status-message mt-3">
            {noteError}
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="border-t border-[var(--line)] pt-3">
              <p className="text-sm whitespace-pre-wrap break-words">
                {note.note}
              </p>
              <div className="flex gap-4 mt-1">
                <button
                  type="button"
                  className="text-sm underline"
                  disabled={noteBusy}
                  onClick={() => {
                    setEditingNote(note.id);
                    setNoteDraft(note.note);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-sm text-[var(--danger)] underline"
                  disabled={noteBusy}
                  onClick={() => void removeNote(note.id)}
                >
                  Remove Note
                </button>
              </div>
            </li>
          ))}
        </ul>
      </details>
      {status && (
        <p className="status-message mb-4" role="status">
          {status}
        </p>
      )}
      <section aria-label="Conversation" className="space-y-5" aria-busy={busy}>
        {messages.length ? (
          messages.map((message) => (
            <article
              key={message.id}
              className={`chat-message ${message.role === "user" ? "chat-message-user" : "chat-message-coach"}`}
            >
              <p className="eyebrow mb-2">
                {message.role === "user" ? "You" : "Coach"}
              </p>
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
              </p>
              {Boolean(message.evidence?.length) && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer muted">
                    Records Used
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {message.evidence?.map((fact) => (
                      <li key={fact.id}>
                        <p>{fact.text}</p>
                        <p className="muted text-xs">
                          {fact.source.startsWith("Workout ")
                            ? "Saved workout"
                            : fact.source}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h2>What Would You Like to Work On?</h2>
            <p>
              {chatId
                ? "Ask about a movement, a tough session, or what your recent logs show."
                : "Start a new chat or open one from your saved chats."}
            </p>
            {chatId && (
              <div className="flex flex-wrap gap-2 mt-4">
                {starters.map((starter) => (
                  <button
                    type="button"
                    key={starter}
                    className="secondary-action text-sm"
                    disabled={!configured || chatBusy || !chatId}
                    onClick={() => {
                      setText(starter);
                      composer.current?.focus();
                    }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {pending && (
          <article className="chat-message chat-message-user">
            <p className="eyebrow mb-2">
              You · {busy ? "Sending" : "Not Yet Saved"}
            </p>
            <p className="whitespace-pre-wrap break-words">{pending.text}</p>
          </article>
        )}
        {busy && (
          <p className="status-message" role="status">
            Reading your training records and preparing a reply…
          </p>
        )}
        {error && pending && (
          <div className="status-message" data-tone="error" role="alert">
            <p>{error}</p>
            {pending && (
              <div className="flex flex-wrap gap-3 mt-3">
                <button
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => void send(true)}
                >
                  Retry Message
                </button>
                <button
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => {
                    setText(pending.text);
                    setPending(null);
                    setError("");
                    composer.current?.focus();
                  }}
                >
                  Edit Message
                </button>
              </div>
            )}
          </div>
        )}
        <div ref={end} />
      </section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="coach-composer mt-6"
      >
        <label className="sr-only" htmlFor="coach-message">
          Message Your Coach
        </label>
        <textarea
          id="coach-message"
          ref={composer}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Ask about your training…"
          disabled={!configured || chatBusy || !chatId || Boolean(pending)}
          className="w-full"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3 mt-2">
          <span className="muted text-xs">
            20 requests per day · Advice never changes your plan
          </span>
          <button
            className="primary-action"
            disabled={
              chatBusy ||
              !chatId ||
              !configured ||
              !text.trim() ||
              Boolean(pending)
            }
          >
            {busy ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>
    </main>
  );
}
