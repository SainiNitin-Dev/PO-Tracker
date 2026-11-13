"use client";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";
import { requestJson } from "@/lib/client-request";
import { preparePhoto } from "@/lib/photo-upload";
type Photo = {
  id: string;
  storage_path: string;
  taken_at: string;
  pose: string | null;
  conditions: string | null;
  url: string | null;
};
type Review = {
  id: string;
  older_photo_id: string | null;
  newer_photo_id: string | null;
  review_text: string;
  confidence: string;
  created_at: string;
};
type PendingPhoto = {
  storagePath: string;
  takenAt: string;
  pose: string;
  conditions: string;
};
export default function PhotoUploader({
  userId,
  photos,
  reviews,
  configured,
}: {
  userId: string;
  photos: Photo[];
  reviews: Review[];
  configured: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState("");
  const [refreshing, transition] = useTransition();
  const busy = Boolean(working) || refreshing;
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [review, setReview] = useState<{
    review: string;
    confidence: string;
  } | null>(null);
  const [filter, setFilter] = useState("");
  const key = `progressive:photo:${userId}`;
  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const value = JSON.parse(saved) as PendingPhoto;
        if (value.storagePath?.startsWith(`${userId}/`)) setPending(value);
      }
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, [key, userId]);
  const clearPending = () => {
    setPending(null);
    try {
      localStorage.removeItem(key);
    } catch {
      /* The current page still clears its draft. */
    }
  };
  const saveDetails = async (details: PendingPhoto) => {
    await requestJson("/api/photos", details);
    clearPending();
    setMessage({ text: "Photo saved to your private collection." });
    transition(() => router.refresh());
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setWorking("Preparing photo…");
    setMessage(null);
    try {
      if (pending) {
        await saveDetails(pending);
        return;
      }
      const file = data.get("photo");
      if (!(file instanceof File)) throw new Error("Choose a photo first.");
      const prepared = await preparePhoto(file);
      const details = {
        storagePath: `${userId}/${crypto.randomUUID()}.jpg`,
        takenAt: String(data.get("takenAt")),
        pose: String(data.get("pose")),
        conditions: String(data.get("conditions") ?? ""),
      };
      setWorking("Uploading photo…");
      const { error } = await client()
        .storage.from("progress-photos")
        .upload(details.storagePath, prepared, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (error)
        throw new Error(
          "Your photo could not be uploaded. Check your connection and try again.",
        );
      setPending(details);
      try {
        localStorage.setItem(key, JSON.stringify(details));
      } catch {
        /* Keep the pending upload in memory when storage is blocked. */
      }
      setWorking("Saving photo details…");
      await saveDetails(details);
      form.reset();
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "The photo was not saved. Please try again.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const discard = async () => {
    if (!pending) return;
    setWorking("Checking upload…");
    setMessage(null);
    try {
      const supabase = client();
      const { data, error } = await supabase
        .from("progress_photos")
        .select("id")
        .eq("storage_path", pending.storagePath)
        .eq("user_id", userId)
        .maybeSingle();
      if (error)
        throw new Error(
          "We couldn’t confirm the upload status. Reconnect and retry.",
        );
      if (!data) {
        const { error: removeError } = await supabase.storage
          .from("progress-photos")
          .remove([pending.storagePath]);
        if (removeError)
          throw new Error(
            "The unfinished upload could not be removed. Please retry.",
          );
      }
      clearPending();
      setMessage({
        text: data
          ? "This photo was already saved. Your collection is refreshed."
          : "Unfinished upload removed.",
      });
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Please try again.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const compare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setWorking("Comparing your photos…");
    setMessage(null);
    setReview(null);
    try {
      setReview(
        await requestJson("/api/photo-reviews", {
          olderPhotoId: data.get("older"),
          newerPhotoId: data.get("newer"),
        }),
      );
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text:
          e instanceof Error
            ? e.message
            : "This review could not be completed.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const remove = async (id: string) => {
    setWorking("Removing photo…");
    setMessage(null);
    try {
      await requestJson("/api/photos", { id }, "DELETE");
      setMessage({ text: "Photo and its associated reviews removed." });
      setReview(null);
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text:
          e instanceof Error ? e.message : "The photo could not be removed.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const update = async (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setWorking("Updating photo…");
    setMessage(null);
    try {
      await requestJson(
        "/api/photos",
        { id, ...Object.fromEntries(data) },
        "PATCH",
      );
      setMessage({ text: "Photo details updated." });
      transition(() => router.refresh());
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Details could not be saved.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const today = new Date().toISOString().slice(0, 10);
  const visible = photos.filter((p) => !filter || p.pose === filter);
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">A quieter kind of progress</p>
        <h1>Progress photos</h1>
        <p>
          Keep a private visual record. Use a similar pose, distance, lighting,
          and time of day for useful comparisons.
        </p>
        <Link href="/progress" className="quiet-action -ml-4 mt-2">
          ← Progress overview
        </Link>
      </header>
      {message && (
        <p
          className="status-message mb-5"
          data-tone={message.error ? "error" : "success"}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      {busy && (
        <p className="muted mb-4 flex items-center gap-2 text-sm" role="status">
          <span className="spinner" />
          {working || "Refreshing collection…"}
        </p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-2">
        <section className="surface">
          <h2 className="text-lg font-semibold">Add a photo</h2>
          {pending ? (
            <div className="mt-4 space-y-4">
              <p className="status-message">
                A photo has uploaded but its details still need saving. Retry to
                finish without uploading it twice.
              </p>
              <form onSubmit={upload}>
                <button disabled={busy} className="primary-action">
                  Save uploaded photo
                </button>
              </form>
              <button
                className="quiet-action"
                disabled={busy}
                onClick={() =>
                  setConfirmation({
                    title: "Discard this unfinished upload?",
                    description:
                      "We’ll check whether it was saved first. Only an unfinished upload will be removed.",
                    label: "Discard upload",
                    onConfirm: () => void discard(),
                  })
                }
              >
                Discard unfinished upload
              </button>
            </div>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={upload}>
              <label className="field">
                Photo
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  disabled={busy}
                />
                <small>
                  JPG, PNG or WebP, up to 8 MB. Photos are resized on your
                  device to use less storage.
                </small>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  Date taken
                  <input
                    name="takenAt"
                    type="date"
                    defaultValue={today}
                    min="2000-01-01"
                    max={today}
                    required
                  />
                </label>
                <label className="field">
                  Pose
                  <select name="pose">
                    <option value="front">Front</option>
                    <option value="side">Side</option>
                    <option value="back">Back</option>
                  </select>
                </label>
              </div>
              <label className="field">
                Conditions (optional)
                <textarea
                  name="conditions"
                  maxLength={500}
                  rows={2}
                  placeholder="e.g. Morning, natural light, same distance"
                />
              </label>
              <button disabled={busy} className="primary-action">
                Save private photo
              </button>
            </form>
          )}
        </section>
        <section className="surface">
          <h2 className="text-lg font-semibold">Compare photos</h2>
          <p className="muted mt-2 text-sm">
            Choose the same pose on two different dates. Monthly comparisons are
            usually more useful than daily ones.
          </p>
          {!configured && (
            <p className="status-message mt-4">
              Photo reviews aren’t connected yet. You can still save, view, and
              manage your photos.
            </p>
          )}
          <form className="mt-4 space-y-4" onSubmit={compare}>
            <label className="field">
              Earlier photo
              <select name="older" required defaultValue="">
                <option value="">Choose earlier photo</option>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.taken_at} · {p.pose ?? "Pose not set"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Later photo
              <select name="newer" required defaultValue="">
                <option value="">Choose later photo</option>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.taken_at} · {p.pose ?? "Pose not set"}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted text-xs leading-relaxed">
              Comparing sends these two photos to the configured AI provider for
              a visual review. Reviews cannot measure body fat, muscle mass, or
              health. Up to 4 review requests per month; failed attempts count
              too.
            </p>
            <button
              disabled={busy || !configured || photos.length < 2}
              className="secondary-action"
            >
              Compare selected photos
            </button>
            {photos.length < 2 && (
              <p className="muted text-sm">
                Add at least two photos to compare.
              </p>
            )}
          </form>
          {review && (
            <div className="status-message mt-4" role="status">
              <span className="badge capitalize">
                {review.confidence} confidence
              </span>
              <p className="mt-3 whitespace-pre-wrap">{review.review}</p>
            </div>
          )}
        </section>
      </div>
      <section className="mt-8">
        <div className="section-heading">
          <h2>Your collection</h2>
          <label className="field">
            <span className="sr-only">Filter by pose</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All poses</option>
              <option value="front">Front</option>
              <option value="side">Side</option>
              <option value="back">Back</option>
            </select>
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <article className="surface !p-3" key={p.id}>
              <PrivateImage key={p.url} photo={p} />
              <div className="px-1 py-3">
                <h3 className="font-semibold capitalize">
                  {p.pose ?? "Progress"} · {p.taken_at}
                </h3>
                {p.conditions && (
                  <p className="muted mt-2 whitespace-pre-wrap text-sm">
                    {p.conditions}
                  </p>
                )}
                <details className="mt-3">
                  <summary className="text-sm">Edit photo details</summary>
                  <form
                    onSubmit={(event) => void update(event, p.id)}
                    className="mt-2 space-y-3"
                  >
                    <label className="field">
                      Date taken
                      <input
                        name="takenAt"
                        type="date"
                        defaultValue={p.taken_at}
                        required
                        min="2000-01-01"
                        max={today}
                      />
                    </label>
                    <label className="field">
                      Pose
                      <select name="pose" defaultValue={p.pose ?? "front"}>
                        <option value="front">Front</option>
                        <option value="side">Side</option>
                        <option value="back">Back</option>
                      </select>
                    </label>
                    <label className="field">
                      Conditions
                      <textarea
                        name="conditions"
                        maxLength={500}
                        defaultValue={p.conditions ?? ""}
                      />
                    </label>
                    <button className="secondary-action" disabled={busy}>
                      Save details
                    </button>
                  </form>
                </details>
                <button
                  className="danger-action mt-3"
                  disabled={busy}
                  onClick={() =>
                    setConfirmation({
                      title: "Delete this photo?",
                      description:
                        "This permanently removes the photo and any reviews that use it. Your workouts and other photos stay intact.",
                      label: "Delete photo",
                      onConfirm: () => void remove(p.id),
                    })
                  }
                >
                  Delete photo
                </button>
              </div>
            </article>
          ))}
        </div>
        {!visible.length && (
          <p className="empty-state">
            {photos.length
              ? "No photos match this pose."
              : "Your collection is empty. Add your first photo whenever you feel ready."}
          </p>
        )}
      </section>
      {reviews.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Saved reviews</h2>
          <div className="mt-4 space-y-3">
            {reviews.map((r) => (
              <details className="surface" key={r.id}>
                <summary>
                  {photos.find((p) => p.id === r.older_photo_id)?.taken_at ??
                    "Earlier photo"}{" "}
                  →{" "}
                  {photos.find((p) => p.id === r.newer_photo_id)?.taken_at ??
                    "Later photo"}
                  <span className="muted ml-2 text-xs font-normal">
                    {r.confidence} confidence
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                  {r.review_text}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}
      <p className="muted mt-6 text-xs">
        Showing your latest 200 photos and 30 reviews. Only you can access your
        collection. Private image links expire; refresh this page if needed.
      </p>
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
function PrivateImage({ photo }: { photo: Photo }) {
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  return photo.url && !failed ? (
    <a
      href={photo.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open full ${photo.pose ?? "progress"} photo from ${photo.taken_at}`}
    >
      <Image
        unoptimized
        src={photo.url}
        width={640}
        height={800}
        alt={`${photo.pose ?? "Progress"} pose from ${photo.taken_at}`}
        className="aspect-[4/5] w-full rounded-lg bg-[#eceee3] object-contain"
        onError={() => setFailed(true)}
      />
    </a>
  ) : (
    <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-lg bg-[#eceee3] p-4 text-center text-sm">
      <p className="muted">This photo link could not be opened.</p>
      <button className="secondary-action" onClick={() => router.refresh()}>
        Refresh photo
      </button>
    </div>
  );
}
