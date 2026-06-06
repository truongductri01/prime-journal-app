import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface CompletionGuardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, note: string) => void;
  req1Star?: string;
  req2Star?: string;
  req3Star?: string;
  taskTitle: string;
}

export function CompletionGuard({
  isOpen,
  onClose,
  onSubmit,
  req1Star = "Minimum acceptable execution. Box checked, standard routine completed without tracking written metrics.",
  req2Star = "Flawless mechanical discipline. Execution performed with zero slacking off, confirming pre-existing system rules before taking action.",
  req3Star = "Exceptional execution + Manual lesson securely documented inside your physical notebook or iPad Codex.",
  taskTitle,
}: CompletionGuardProps) {
  const [rating, setRating] = useState<number>(1);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 3 && !note.trim()) {
      setError("A manual lesson or system friction point must be documented for 3★ (The Codex Exception).");
      return;
    }
    setError("");
    onSubmit(rating, rating === 3 ? note.trim() : "");
    setNote("");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] bg-surface-container-low p-8 rounded-xl border border-primary text-left raised-card parchment-texture shadow-2xl relative overflow-y-auto max-h-[90vh] cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-headline-sm text-primary mb-2 border-b border-outline-variant/30 pb-4">
          Completion Guard: {taskTitle}
        </h3>

        <p className="font-body-md text-on-surface-variant mb-6">
          Verify your execution quality to lock in your Experience Points (XP).
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>

            {/* 1 Star Option */}
            <label
              style={{
                display: "flex",
                gap: "0.75rem",
                padding: "0.75rem",
                border: rating === 1 ? "1.5px solid var(--azure-blue)" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                backgroundColor: rating === 1 ? "rgba(14, 165, 233, 0.05)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="rating"
                value={1}
                checked={rating === 1}
                onChange={() => { setRating(1); setError(""); }}
                style={{ marginTop: "0.25rem" }}
              />
              <div>
                <strong>⭐ 1★ (Mechanic Execution)</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", marginTop: "0.25rem" }}>
                  {req1Star}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--azure-blue)", fontWeight: 600, marginTop: "0.25rem" }}>
                  +10 XP yield
                </div>
              </div>
            </label>

            {/* 2 Star Option */}
            <label
              style={{
                display: "flex",
                gap: "0.75rem",
                padding: "0.75rem",
                border: rating === 2 ? "1.5px solid var(--azure-blue)" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                backgroundColor: rating === 2 ? "rgba(14, 165, 233, 0.05)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="rating"
                value={2}
                checked={rating === 2}
                onChange={() => { setRating(2); setError(""); }}
                style={{ marginTop: "0.25rem" }}
              />
              <div>
                <strong>⭐⭐ 2★ (System Mastery)</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", marginTop: "0.25rem" }}>
                  {req2Star}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--azure-blue)", fontWeight: 600, marginTop: "0.25rem" }}>
                  +25 XP yield
                </div>
              </div>
            </label>

            {/* 3 Star Option */}
            <label
              style={{
                display: "flex",
                gap: "0.75rem",
                padding: "0.75rem",
                border: rating === 3 ? "1.5px solid var(--grimoire-gold)" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                backgroundColor: rating === 3 ? "rgba(234, 179, 8, 0.05)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="rating"
                value={3}
                checked={rating === 3}
                onChange={() => { setRating(3); setError(""); }}
                style={{ marginTop: "0.25rem" }}
              />
              <div>
                <strong>⭐⭐⭐ 3★ (The Codex Exception)</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", marginTop: "0.25rem" }}>
                  {req3Star}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--grimoire-gold)", fontWeight: 600, marginTop: "0.25rem" }}>
                  +50 XP + Bonus XP (Loot Box roll: 5-15 XP)
                </div>
              </div>
            </label>
          </div>

          {rating === 3 && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                Codex Narrative Notes <span style={{ color: "red" }}>*</span>
              </label>
              <textarea
                className="input-text"
                rows={3}
                placeholder="Log lesson learned or systemic friction encountered..."
                value={note}
                onChange={(e) => { setNote(e.target.value); setError(""); }}
                required
                style={{ resize: "vertical" }}
              />
            </div>
          )}

          {error && (
            <div style={{ color: "red", fontSize: "0.85rem", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${rating === 3 ? 'btn-gold' : 'btn-primary'}`}
            >
              Commit Clear
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
