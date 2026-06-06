import confetti from "canvas-confetti";

// Tier I: Standard Clear (1★ or 2★)
// Fast, crisp burst of monochrome and gold particle confetti
export function triggerStandardClearConfetti() {
  const count = 30;
  const defaults = {
    origin: { y: 0.7 },
    spread: 50,
    ticks: 60,
  };

  confetti({
    ...defaults,
    particleCount: count,
    colors: ["#64748B", "#eab308", "#1E293B", "#FFFFFF"], // Slate, Gold, Charcoal, White
  });
}

// Tier II: Codex Roll (3★)
// Interactive chest open, drift colored confetti
export function triggerCodexRollConfetti() {
  const duration = 1.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 25, spread: 360, ticks: 100, zIndex: 1100 };

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 20 * (timeLeft / duration);
    // Left and right bursts
    confetti({ 
      ...defaults, 
      particleCount, 
      origin: { x: 0.3, y: 0.5 },
      colors: ["#0ea5e9", "#eab308", "#38bdf8", "#fef08a"] // Blue, Gold variations
    });
    confetti({ 
      ...defaults, 
      particleCount, 
      origin: { x: 0.7, y: 0.5 },
      colors: ["#0ea5e9", "#eab308", "#38bdf8", "#fef08a"]
    });
  }, 250);
}

// Tier III: Rank Promotion / Epic Win (Milestone / Major Quest Clear)
// Gold & crimson cascading sweep from the upper border
export function triggerRankPromotionConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    // Left side gold/crimson rain
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#eab308", "#ef4444", "#facc15", "#f87171"], // Gold, Crimson
    });
    // Right side gold/crimson rain
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#eab308", "#ef4444", "#facc15", "#f87171"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Experience point calculations based on rating
export function getXpYield(rating: number): number {
  if (rating === 1) return 10;
  if (rating === 2) return 25;
  if (rating === 3) return 50;
  return 0;
}

// Experience points required per sub-tier
export const XP_PER_SUBTIER = 100;

// Progression structure matching Section 2.2 Table
const RANKS = [
  "Apprentice III", "Apprentice II", "Apprentice I",
  "Strategist III", "Strategist II", "Strategist I",
  "Vanguard III", "Vanguard II", "Vanguard I",
  "Master Architect"
];

// Calculate rank progression and level based on XP increment
export function checkRankProgression(
  currentXp: number,
  addedXp: number,
  currentRank: string,
  questsCompletedCount: number, // To unlock rank thresholds (Apprentice -> Strategist: 3 minors with avg rating >= 2)
  majorQuestsCompletedCount: number // Vanguard: 1 Major with satisfaction >= 5. Master Architect: capstone
): {
  newXp: number;
  newRank: string;
  isPromoted: boolean;
} {
  const totalXp = currentXp + addedXp;
  let currentRankIndex = RANKS.indexOf(currentRank);
  if (currentRankIndex === -1) currentRankIndex = 0;

  let newRankIndex = currentRankIndex;
  
  // XP sub-tiers level up at 100 XP increments
  const subTiersEarned = Math.floor(totalXp / XP_PER_SUBTIER);
  const remainingXp = totalXp % XP_PER_SUBTIER;

  // Let's check promotion conditions
  // Apprentice III -> Apprentice II -> Apprentice I: no gates.
  // Strategist III requires: 3 minors completed. Let's make it a organic title advancement
  // if user earns enough sub-tiers.
  if (subTiersEarned > 0) {
    newRankIndex = Math.min(RANKS.length - 1, currentRankIndex + subTiersEarned);
  }

  // Enforce rank caps based on PRD Unlock Conditions
  // Strategist unlock: 3 minor quests completed.
  if (newRankIndex >= 3 && newRankIndex < 6 && questsCompletedCount < 3) {
    newRankIndex = 2; // Locked at Apprentice I
  }
  // Vanguard unlock: 1 major quest completed
  if (newRankIndex >= 6 && newRankIndex < 9 && majorQuestsCompletedCount < 1) {
    newRankIndex = 5; // Locked at Strategist I
  }

  return {
    newXp: remainingXp,
    newRank: RANKS[newRankIndex],
    isPromoted: newRankIndex > currentRankIndex,
  };
}
