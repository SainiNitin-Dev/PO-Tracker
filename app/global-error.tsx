"use client";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f5f2eb",
          color: "#292d28",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, margin: "12vh auto", padding: 24 }}>
          <p style={{ color: "#4c5c3e", letterSpacing: 2, fontSize: 12 }}>
            PROGRESSIVE
          </p>
          <h1 style={{ fontSize: 32 }}>We couldn’t open your account.</h1>
          <p style={{ lineHeight: 1.6, color: "#686a60" }}>
            Check your connection and try again. If this keeps happening, log in
            again or ask your gym administrator for help.
          </p>
          <button
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 8,
              background: "#4c5c3e",
              color: "white",
              padding: "14px 20px",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a href="/login" style={{ marginLeft: 20, color: "#4c5c3e" }}>
            Go to log in
          </a>
        </main>
      </body>
    </html>
  );
}
