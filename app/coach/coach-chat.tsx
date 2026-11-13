"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  initialMessages,
  initialNotes,
  configured,
}: {
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
    if (busy || !configured) return;
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
  const clearChat = async () => {
    setBusy(true);
    setError("");
    try {
      await coachRequest("DELETE", { action: "conversation" });
      setMessages([]);
      setPending(null);
      setClearConfirm(false);
      setStatus(
        "Conversation cleared. Your saved notes and workouts are unchanged.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your conversation could not be cleared.",
      );
    } finally {
      setBusy(false);
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
              Ask about a movement, a tough session, or what your recent logs
              show. Your coach will tell you when it needs more information.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {starters.map((starter) => (
                <button
                  type="button"
                  key={starter}
                  className="secondary-action text-sm"
                  disabled={!configured || busy}
                  onClick={() => {
                    setText(starter);
                    composer.current?.focus();
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
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
        {error && (
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
          disabled={!configured || busy || Boolean(pending)}
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
            disabled={busy || !configured || !text.trim() || Boolean(pending)}
          >
            {busy ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>
      {messages.length > 0 && (
        <div className="mt-6">
          {clearConfirm ? (
            <div className="status-message">
              <p>
                Delete your conversation history? Your saved notes and workouts
                will stay.
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  className="secondary-action text-[var(--danger)]"
                  disabled={busy}
                  onClick={() => void clearChat()}
                >
                  Delete Conversation
                </button>
                <button
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => setClearConfirm(false)}
                >
                  Keep It
                </button>
              </div>
            </div>
          ) : (
            <button
              className="muted text-sm underline"
              disabled={busy}
              onClick={() => setClearConfirm(true)}
            >
              Clear Conversation
            </button>
          )}
        </div>
      )}
    </main>
  );
}
