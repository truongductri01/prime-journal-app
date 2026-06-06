"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface CelebrationOverlayProps {
  isOpen: boolean;
  type: "task" | "minor" | "major";
  title: string;
  description?: string;
  xpGained: number;
  level?: number;
  rank?: string;
  isPromoted?: boolean;
  promotionMessage?: string;
  stepsRecorded?: string[];
  onClose: (reflection?: string) => void;
}

export function CelebrationOverlay({
  isOpen,
  type,
  title,
  description = "",
  xpGained,
  level,
  rank,
  isPromoted = false,
  promotionMessage = "",
  stepsRecorded = [],
  onClose,
}: CelebrationOverlayProps) {
  const [reflection, setReflection] = useState("");
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
    } else {
      setRendered(false);
    }
  }, [isOpen]);

  if (!rendered || !isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center px-4 bg-primary/30 backdrop-blur-md transition-all duration-500 animate-fade-in"
      id="celebration-overlay"
    >
      {type === "task" && (
        /* ==================== DAILY TASK COMPLETE CELEBRATION ==================== */
        <div className="relative max-w-md w-full bg-surface-container-low rounded-xl tactile-card parchment-texture p-8 flex flex-col items-center text-center overflow-hidden glow-pulse animate-fade-in">
          {/* Sage Vertical Accent Line */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-tertiary-container"></div>
          {/* Warm Glow Backgrounds */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-secondary-container/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-tertiary-container/10 rounded-full blur-3xl"></div>

          {/* Icon */}
          <div className="relative z-10 w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center inset-shadow mb-4">
            <span className="material-symbols-outlined text-secondary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
          </div>

          <h2 className="font-headline-md text-headline-md text-primary mb-2 relative z-10">Focus Maintained</h2>
          <p className="font-body-md text-on-surface-variant max-w-[320px] mb-4 relative z-10">
            "{title}" has been successfully logged in the ledger. Clarity is its own reward.
          </p>

          {/* Solo Leveling / Black Clover Themed Message Banner */}
          <div className="relative z-10 w-full bg-[#f1eee5] border-l-4 border-secondary p-3 text-left rounded-r-lg mb-6">
            <p className="text-[11px] font-label-md uppercase tracking-wider text-secondary mb-1">System Notification</p>
            <p className="font-serif italic text-sm text-primary">
              "Do not look back. Keep moving forward."
            </p>
          </div>

          {/* XP Reward Chip */}
          <div className="relative z-10 flex items-center gap-2 bg-secondary-container/30 px-6 py-2 rounded-full border border-secondary/20 mb-6">
            <span className="material-symbols-outlined text-secondary text-lg">auto_stories</span>
            <span className="font-label-md text-label-md text-on-secondary-container">+{xpGained} XP GAINED</span>
          </div>

          {/* Completed Stamp Graphic */}
          <div className="stamp-fade-in absolute right-6 top-6">
            <div className="border-4 border-secondary/20 rounded-full px-4 py-1 flex items-center justify-center transform -rotate-12">
              <span className="font-label-md text-label-md text-secondary/30 font-bold uppercase tracking-widest">COMPLETED</span>
            </div>
          </div>

          {/* Action Button */}
          <button 
            className="relative z-10 w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
            onClick={() => onClose()}
          >
            Continue the Journey
          </button>

          {/* Botanical Sprout Illustration */}
          <div className="mt-6 opacity-20 pointer-events-none w-full flex justify-center">
            <img 
              className="h-16 object-contain" 
              alt="Sprouting seed illustration"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCv8zygIZGCr5aBTjzhM3sjggM18RMm2jNDxAiuQf_yGRVTa6Csm8qS9cqk1HWKZyM6t4xWRymGDHvgzZWzkSYE3So0jsVlWEMlcv4XWkpKvn4iCJk5RUw5HQ-OPmex036x7RXAo8nlFB1v6SZAfEcUtuEDGqjvOJ2fpAg8V970NLcDRDFJdB2jlyS38lNJBkIR2cMCvLJz6x28aLOTEKsd1RMqyJhh_VcLoYHYi7xJ_pDJ7a8JB6xYCaH5vr1ZaUfPse9kbOzQ1Pg"
            />
          </div>
        </div>
      )}

      {type === "minor" && (
        /* ==================== MINOR QUEST COMPLETE CELEBRATION ==================== */
        <div className="relative z-10 w-full max-w-2xl bg-gradient-to-b from-[#111] to-[#050505] border border-secondary/30 rounded-xl p-10 shadow-[0_0_100px_rgba(212,175,55,0.15)] animate-in zoom-in-95 fade-in duration-700 cursor-default" onClick={(e) => e.stopPropagation()}>
          {/* Subtle Texture Overlay */}
          <div className="absolute inset-0 parchment-texture opacity-30 pointer-events-none"></div>

          {/* Completed Stamp */}
          <div className="absolute top-6 right-6 stamp-fade-in pointer-events-none opacity-30">
            <div className="w-28 h-28 rounded-full border-4 border-secondary flex items-center justify-center rotate-12">
              <span className="font-display-lg text-secondary uppercase tracking-widest text-[20px]">Completed</span>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-6 items-center text-center">
            <header className="flex flex-col items-center">
              <div className="w-16 h-1 bg-secondary-container rounded-full mb-3"></div>
              <p className="font-label-md text-label-md text-secondary uppercase tracking-widest">Minor Quest Accomplished</p>
              <h1 className="font-display-lg-mobile text-primary mt-1">{title}</h1>
            </header>

            {/* Rewards Card */}
            <div className="flex items-center justify-center gap-4 bg-surface-container rounded-xl p-4 border border-outline-variant/20 w-full max-w-sm">
              <span className="material-symbols-outlined text-secondary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                workspace_premium
              </span>
              <div className="flex flex-col items-start">
                <span className="font-display-lg text-headline-sm text-primary">+{xpGained} XP</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Level {level} {rank} Progress</span>
              </div>
            </div>

            {/* Solo Leveling banner if active */}
            <div className="w-full max-w-md bg-[#fdf9f0] border-l-4 border-secondary p-3 text-left rounded-r-lg">
              <p className="text-[11px] font-label-md uppercase tracking-wider text-secondary mb-1">Codex Entry</p>
              <p className="font-serif italic text-sm text-primary">
                {description || "The path ahead is clear. Let every step leave a mark in the archives."}
              </p>
            </div>

            {/* Steps ledger */}
            {stepsRecorded.length > 0 && (
              <section className="w-full max-w-md text-left bg-surface/50 p-4 rounded-lg border-l-4 border-secondary/30">
                <h2 className="font-label-md text-label-md text-primary mb-2 uppercase tracking-tighter">Steps Logged:</h2>
                <ul className="flex flex-col gap-2">
                  {stepsRecorded.map((step, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface-variant">{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Reflection Textarea */}
            <section className="w-full max-w-md">
              <div className="flex flex-col gap-3 items-center italic">
                <span className="material-symbols-outlined text-outline-variant text-2xl">self_improvement</span>
                <blockquote className="font-headline-sm text-headline-sm text-primary">
                  "What was the most important lesson in this chapter?"
                </blockquote>
                <div className="w-full relative">
                  <textarea 
                    className="w-full bg-transparent border-t-0 border-x-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 font-body-lg text-body-lg text-primary placeholder:text-outline/50 py-2 resize-none text-center"
                    placeholder="Briefly reflect on your execution..."
                    rows={1}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <footer className="flex flex-col md:flex-row gap-4 w-full justify-center">
              <button 
                className="px-8 py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:opacity-90 transition-all shadow-sm"
                onClick={() => onClose(reflection)}
              >
                Seal this Chapter
              </button>
            </footer>
          </div>
        </div>
      )}

      {type === "major" && (
        /* ==================== MAJOR QUEST COMPLETE CELEBRATION ==================== */
        <div className="relative z-10 w-full max-w-lg bg-[#0A0E17] border border-white/10 rounded-lg p-8 shadow-[0_0_50px_rgba(30,58,138,0.3)] animate-in zoom-in-95 fade-in duration-500 cursor-default flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>
          {/* Subtle Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-secondary-fixed/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
          <div className="absolute inset-0 parchment-texture opacity-30 pointer-events-none"></div>

          {/* Ornate Wax Seal Centerpiece */}
          <div className="relative mb-6">
            <div className="seal-animation relative z-10 w-32 h-32 md:w-40 md:h-40">
              <div className="absolute inset-0 bg-primary rounded-full shadow-2xl flex items-center justify-center border-4 border-secondary-fixed">
                <div className="absolute inset-2 rounded-full border border-secondary/30 opacity-50"></div>
                <span className="material-symbols-outlined text-secondary-container text-6xl md:text-7xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
            </div>
          </div>

          <p className="font-label-md text-label-md text-secondary uppercase tracking-[0.2em] font-bold">Legendary Milestone Achieved</p>
          <h1 className="font-display-lg text-primary gold-shimmer leading-tight mb-2">The Oak Has Grown</h1>
          <div className="h-1 w-24 bg-secondary rounded-full mb-6"></div>

          {/* Details Card */}
          <div className="w-full bg-[#fdf9f0] border border-outline-variant/30 rounded-xl p-6 text-left relative overflow-hidden mb-6">
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-tertiary"></div>
            <h3 className="font-headline-sm text-primary mb-2">{title}</h3>
            
            {/* Limit Break / Black Clover Promoted Text */}
            <div className="bg-primary-container/20 border-l-4 border-secondary p-3 rounded-r-lg mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                {isPromoted ? "🍀 Limit Break Promotion" : "Archival Entry"}
              </p>
              <p className="font-serif italic text-sm text-primary">
                {promotionMessage || "You have successfully closed this major quest. Your discipline and execution are recorded in the Ledger."}
              </p>
            </div>
            
            {description && (
              <p className="font-body-md text-on-surface-variant italic leading-relaxed">
                "{description}"
              </p>
            )}
          </div>

          {/* XP Reward Sphere */}
          <div className="flex flex-col items-center justify-center p-4 bg-white/60 rounded-xl border border-secondary/20 w-full max-w-sm mb-6">
            <span className="font-label-md text-label-md text-secondary font-bold mb-1">XP REWARD</span>
            <div className="text-4xl font-display-lg text-primary">+{xpGained} XP</div>
            <span className="font-label-sm text-label-sm text-on-surface-variant tracking-widest uppercase">LEGEND</span>
          </div>

          <button 
            className="w-full max-w-sm py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-md hover:opacity-90 transition-all"
            onClick={() => onClose()}
          >
            Record in Archives
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
