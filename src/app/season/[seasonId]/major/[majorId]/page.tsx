"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  localGetQuests, 
  localSaveQuest, 
  localGetTasks, 
  generateUUID, 
  DEFAULT_USER_ID,
  localGetProfile,
  localSaveProfile
} from "@/lib/cosmos";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { triggerRankPromotionConfetti } from "@/lib/celebration";

export default function MajorQuestDetail() {
  const params = useParams();
  const router = useRouter();
  const majorId = params.majorId as string;
  const seasonId = params.seasonId as string;

  const [majorQuest, setMajorQuest] = useState<any>(null);
  const [minorQuests, setMinorQuests] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Add Minor form state
  const [showAddMinor, setShowAddMinor] = useState(false);
  const [minorTitle, setMinorTitle] = useState("");
  const [minorDesc, setMinorDesc] = useState("");
  const [minorReq1, setMinorReq1] = useState("Minimum acceptable execution. Box checked, standard routine completed without tracking written metrics.");
  const [minorReq2, setMinorReq2] = useState("Flawless mechanical discipline. Execution performed with zero slacking off, confirming pre-existing system rules before taking action.");
  const [minorReq3, setMinorReq3] = useState("Exceptional execution + Manual lesson securely documented inside your physical notebook or iPad Codex.");

  // Finalize Major state
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState<number>(5);
  
  // Celebration overlay state
  const [celebrationInfo, setCelebrationInfo] = useState<any>(null);

  const loadData = async () => {
    try {
      const quests = await localGetQuests();
      const major = quests.find((q) => q.id === majorId && !q.majorQuestId);
      setMajorQuest(major);

      if (major) {
        // Find minor quests under this major quest
        const minors = quests.filter((q) => q.majorQuestId === majorId);
        
        // Find tasks linked to these minors
        const allTasks = await localGetTasks();
        const minorIds = minors.map(m => m.id);
        const questTasks = allTasks.filter(t => t.minorQuestId && minorIds.includes(t.minorQuestId));
        setTasks(questTasks);

        // Calculate completion percentage for each minor
        const minorsWithProgress = minors.map((minor) => {
          const mTasks = allTasks.filter((t) => t.minorQuestId === minor.id);
          const totalCount = mTasks.length;
          const completedCount = mTasks.filter((t) => t.status === "completed").length;
          const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          return {
            ...minor,
            completedCount,
            totalCount,
            progressPercent: percent,
          };
        });

        setMinorQuests(minorsWithProgress);
      }

      const prof = await localGetProfile();
      setProfile(prof);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener("local-db-update", loadData);
    return () => window.removeEventListener("local-db-update", loadData);
  }, [majorId]);

  // Handle inline Minor Quest addition (CR-8)
  const handleAddMinorQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minorTitle.trim()) return;

    try {
      const newMinor = {
        id: generateUUID(),
        majorQuestId: majorId,
        seasonId: seasonId,
        userId: DEFAULT_USER_ID,
        title: minorTitle.trim(),
        description: minorDesc.trim(),
        req1Star: minorReq1,
        req2Star: minorReq2,
        req3Star: minorReq3,
        status: "active",
      };

      await localSaveQuest(newMinor);

      // Reset
      setMinorTitle("");
      setMinorDesc("");
      setShowAddMinor(false);
      
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Major Quest finalization (CR-9)
  const handleFinalizeMajorQuest = async () => {
    if (!majorQuest || !profile) return;

    try {
      const updatedMajor = {
        ...majorQuest,
        status: "completed",
        satisfactionScore,
        completedAt: new Date().toISOString(),
      };

      await localSaveQuest(updatedMajor);

      // Award major XP
      let xpAward = 100;
      let newXp = profile.experiencePoints + xpAward;
      let newLevel = profile.level;
      let isLevelUp = false;

      if (newXp >= 100) {
        newLevel += Math.floor(newXp / 100);
        newXp = newXp % 100;
        isLevelUp = true;
      }

      // Check for rank promotions based on major completion
      let newRank = profile.rank;
      let isRankPromo = false;
      if (satisfactionScore >= 5) {
        if (profile.rank.startsWith("Apprentice")) {
          newRank = "Strategist III";
          isRankPromo = true;
        } else if (profile.rank.startsWith("Strategist")) {
          newRank = "Vanguard III";
          isRankPromo = true;
        }
      }

      const updatedProfile = {
        ...profile,
        experiencePoints: newXp,
        level: newLevel,
        rank: newRank,
      };

      await localSaveProfile(updatedProfile);

      // Trigger Celebration Overlay
      let promoMsg = "";
      if (isRankPromo) {
        promoMsg = `🍀 RANK PROMOTION ACHIEVED! Current Status: ${newRank}. "Right here, right now... surpass your limits. If you don't look past what you think you're capable of, you'll never achieve greatness." [Self-Trust Ledger Matrix: Maximum Density]`;
      } else {
        promoMsg = `[NOTIFICATION] Major Quest Cleared. "Do not look back. Keep moving forward." [XP +${xpAward}] [System Awareness Leveling Up]`;
      }

      setCelebrationInfo({
        isOpen: true,
        type: "major",
        title: majorQuest.title,
        description: majorQuest.description,
        xpGained: xpAward,
        level: newLevel,
        rank: newRank,
        isPromoted: isRankPromo,
        promotionMessage: promoMsg
      });

      triggerRankPromotionConfetti();
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined text-secondary animate-spin text-4xl">sync</span>
      </div>
    );
  }

  if (!majorQuest) {
    return (
      <div className="card text-center p-8 border border-outline-variant/20 rounded-xl raised-card max-w-md mx-auto mt-12">
        <h3 className="font-headline-sm text-primary">Major Quest Not Found</h3>
        <Link href="/season" className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md inline-block mt-4">
          Back to Season
        </Link>
      </div>
    );
  }

  const totalMinors = minorQuests.length;
  const completedMinors = minorQuests.filter((m) => m.progressPercent === 100).length;
  const overallProgress = totalMinors > 0 ? Math.round((completedMinors / totalMinors) * 100) : 0;
  const isFinancial = majorQuest.category === "Financial Mechanics";

  return (
    <div className="max-w-[800px] mx-auto flex flex-col gap-stack-lg relative">
      
      {/* Back link */}
      <nav className="flex items-center gap-2 text-on-surface-variant opacity-70">
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        <Link href="/season" className="font-label-sm text-label-sm cursor-pointer hover:text-primary">
          Back to Season Overview
        </Link>
      </nav>

      {/* Hero Header Section */}
      <div className="page-canvas p-6 md:p-8 rounded-2xl relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${isFinancial ? 'bg-secondary-fixed' : 'bg-secondary'}`}></div>
        
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2 text-secondary font-label-md tracking-widest font-bold uppercase">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            MAJOR QUEST
          </div>
          <h2 className="font-display-lg-mobile md:font-display-lg text-primary leading-tight">
            {majorQuest.title}
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center pt-4 border-t border-outline-variant/15">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-tighter text-[10px]">Current Status</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${majorQuest.status === 'completed' ? 'bg-tertiary' : 'bg-secondary animate-pulse'}`}></span>
              <span className="font-body-md text-primary font-bold">
                {majorQuest.status === "completed" ? "Successfully Cleared" : "Active: Strategic execution"}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 w-full md:w-48">
            <div className="flex justify-between items-end mb-1">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-tighter text-[10px]">Overall Progress</span>
              <span className="font-label-md text-secondary font-bold">{overallProgress}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container-highest rounded-full inset-track overflow-hidden">
              <div className="h-full bg-secondary rounded-full transition-all duration-700" style={{ width: `${overallProgress}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* SMART Goal Card */}
      <section className="flex flex-col gap-2">
        <h3 className="font-label-md text-on-surface-variant opacity-80 flex items-center gap-2 font-bold uppercase tracking-wider">
          <span className="material-symbols-outlined text-sm">target</span>
          THE SMART OBJECTIVE
        </h3>
        <div className="page-canvas p-6 rounded-xl border-l-4 border-secondary-container">
          <p className="font-body-lg text-primary italic leading-relaxed">
            "{majorQuest.description}"
          </p>
        </div>
      </section>

      {/* Minor Quests List (Path to Completion) */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-outline-variant/10">
          <h3 className="font-label-md text-on-surface-variant opacity-80 flex items-center gap-2 font-bold uppercase tracking-wider text-label-md">
            <span className="material-symbols-outlined text-sm">account_tree</span>
            Path to Completion
          </h3>
          <span className="font-label-sm text-secondary font-bold">
            {completedMinors} of {totalMinors} Minor Quests Cleared
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {minorQuests.map((minor) => {
            const isCompleted = minor.progressPercent === 100;
            return (
              <div 
                key={minor.id}
                className={`raised-card p-4 rounded-xl flex items-center justify-between border-l-4 transition-all ${
                  isCompleted 
                    ? 'bg-surface-container-low border-tertiary/40' 
                    : 'bg-surface-container-lowest border-secondary hover:translate-x-1 cursor-pointer'
                }`}
                onClick={() => router.push(`/season/${seasonId}/minor/${minor.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'bg-tertiary-fixed text-tertiary' : 'bg-secondary-container text-secondary'}`}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: isCompleted ? "'FILL' 1" : "" }}>
                      {isCompleted ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-headline-sm text-[16px] ${isCompleted ? 'text-on-surface-variant line-through opacity-70' : 'text-primary'}`}>
                      {minor.title}
                    </h4>
                    <p className="font-label-sm text-on-surface-variant/50 text-xs">
                      {isCompleted ? 'Completed milestone' : `Active • ${minor.progressPercent}% progress`}
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline-variant">
                  {isCompleted ? 'chevron_right' : 'arrow_forward'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Add Minor Quest Trigger & Form (CR-8) */}
        <div className="mt-2">
          {!showAddMinor ? (
            <button 
              className="text-secondary font-label-md flex items-center gap-1 hover:underline"
              onClick={() => setShowAddMinor(true)}
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Add Minor Quest Branch
            </button>
          ) : (
            <div className="page-canvas p-6 rounded-xl border border-outline-variant/30 mt-4 animate-fade-in text-left">
              <h4 className="font-headline-sm text-primary mb-4">Draft New Minor Quest</h4>
              <form onSubmit={handleAddMinorQuest} className="space-y-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-1.5 font-bold uppercase tracking-wider">Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 font-body-md py-2.5 px-2"
                    placeholder="e.g. Conduct user feedback research sessions..."
                    value={minorTitle}
                    onChange={(e) => setMinorTitle(e.target.value)}
                    required 
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-1.5 font-bold uppercase tracking-wider">SMART Objective Description</label>
                  <textarea 
                    className="w-full bg-surface border border-outline-variant/30 rounded-lg p-3 font-body-md"
                    placeholder="Describe specific tasks, timelines, and quantitative targets..."
                    value={minorDesc}
                    onChange={(e) => setMinorDesc(e.target.value)}
                    rows={2}
                    required 
                  />
                </div>

                {/* STAR Calibration Fields */}
                <div className="space-y-3 pt-3 border-t border-outline-variant/10">
                  <span className="font-label-sm text-primary font-bold uppercase tracking-widest block">STAR Economy Calibrations</span>
                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1 font-semibold">⭐ 1★ Mechanic Target (Routine Clear):</label>
                    <input 
                      type="text" 
                      className="w-full bg-surface border-0 border-b border-outline-variant/40 focus:ring-0 focus:border-primary py-1.5 px-2 text-sm"
                      value={minorReq1}
                      onChange={(e) => setMinorReq1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1 font-semibold">⭐⭐ 2★ System Target (Disciplined Execution):</label>
                    <input 
                      type="text" 
                      className="w-full bg-surface border-0 border-b border-outline-variant/40 focus:ring-0 focus:border-primary py-1.5 px-2 text-sm"
                      value={minorReq2}
                      onChange={(e) => setMinorReq2(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1 font-semibold">⭐⭐⭐ 3★ Codex Exception Target (Manual Reflection):</label>
                    <input 
                      type="text" 
                      className="w-full bg-surface border-0 border-b border-outline-variant/40 focus:ring-0 focus:border-primary py-1.5 px-2 text-sm"
                      value={minorReq3}
                      onChange={(e) => setMinorReq3(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowAddMinor(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary text-xs">Instantiate Minor Quest</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Reflection Ledger Section */}
      <section className="flex flex-col gap-2">
        <h3 className="font-label-md text-on-surface-variant opacity-80 flex items-center gap-2 uppercase tracking-wider font-bold">
          <span className="material-symbols-outlined text-sm">edit_note</span>
          Reflection Ledger
        </h3>
        <div className="page-canvas p-6 rounded-xl relative overflow-hidden">
          {/* Background watermark */}
          <div className="absolute -top-4 -right-4 opacity-10 pointer-events-none select-none">
            <span className="material-symbols-outlined text-8xl text-secondary">history_edu</span>
          </div>

          <div className="flex flex-col gap-6 relative z-10">
            <div className="border-b border-outline-variant/20 pb-4">
              <label className="font-label-sm text-secondary block mb-1.5 font-bold uppercase tracking-wider text-xs">Contextual Obstacles</label>
              <p className="font-body-md text-on-surface-variant leading-relaxed">
                Minor tasks under this ledger mapping require focus checkpoints to determine friction points. If bottlenecks arise, use the Bifrost Co-Pilot console overlay (Ctrl+K) to structure options trading rules or code refactoring branches.
              </p>
            </div>
            <div>
              <label className="font-label-sm text-secondary block mb-1.5 font-bold uppercase tracking-wider text-xs">Journal Entry: Mental State</label>
              <div className="p-4 bg-surface-container-high/40 rounded-lg italic text-on-surface-variant font-serif">
                "Feeling cautiously optimistic. Growth in the Season of the Oak is slow but steady. Building offline-first databases and local sync queues ensures persistent life-ledger continuity."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Context Image */}
      <div className="w-full h-56 rounded-2xl overflow-hidden raised-card relative">
        <img 
          alt="Desk blueprints illustration" 
          className="w-full h-full object-cover grayscale-[0.2] brightness-[0.9]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsHG_uqtB6qJmsww067kNNcw30FIxtVbz9svQD-LXOtjTaFNoD19BS6m19_K8bwzTkGx__DLuHjd0JPFvT1zo6D5QhUeyDLUYprFh06y1LUPNGBB3B3-xMNApLH-xDMX62eCPO3HhqhydM1kbVpY2Ix9Lj24m8hieQyTKQ5zN45fIZ-a_--1Fdb4VNatYBy_W88xKBwRZNdJHSlew3rttkEbpTQR0l6fzLeWgm49bXgdBNqvBGRlsKplQ4_aBIy8eS0ripsQ2OWjh4"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent"></div>
        <div className="absolute bottom-4 left-6">
          <p className="font-headline-sm text-white text-lg font-bold">Visualizing Success</p>
          <p className="font-label-sm text-white/80 text-xs">Active chapter mapping in progress</p>
        </div>
      </div>

      {/* Action buttons */}
      {majorQuest.status === "active" && (
        <div className="flex flex-col md:flex-row gap-4 mt-2">
          <button 
            className="flex-1 bg-primary text-on-primary py-4 rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.98] shadow-md font-bold uppercase tracking-wider"
            onClick={() => setShowFinalizeModal(true)}
          >
            <span className="material-symbols-outlined text-[20px]">verified</span>
            Finalize Major Quest
          </button>
        </div>
      )}

      {/* Satisfaction Modal Overlay */}
      {showFinalizeModal && (
        <div className="clover-modal-overlay z-[2100]">
          <div className="clover-modal max-w-md bg-surface p-6 rounded-xl border border-outline-variant/30 text-center raised-card">
            <h3 className="font-headline-sm text-primary mb-3">Rate Quest Satisfaction</h3>
            <p className="color-on-surface-variant font-body-md text-sm mb-6 leading-relaxed">
              Finalizing "{majorQuest.title}" requires mapping subjective lifecycle value. Rate your satisfaction on a scale from 1 (Low) to 7 (Exceptional System Mastery).
            </p>

            <div className="flex justify-center gap-2.5 mb-6">
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border transition-all"
                  style={{
                    borderColor: satisfactionScore === num ? "var(--color-secondary)" : "var(--color-outline-variant)",
                    backgroundColor: satisfactionScore === num ? "rgba(119, 90, 25, 0.15)" : "transparent",
                    color: satisfactionScore === num ? "var(--color-secondary)" : "var(--color-primary)"
                  }}
                  onClick={() => setSatisfactionScore(num)}
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <button className="btn btn-secondary text-xs" onClick={() => setShowFinalizeModal(false)}>Cancel</button>
              <button 
                className="btn btn-gold text-xs" 
                onClick={() => {
                  setShowFinalizeModal(false);
                  handleFinalizeMajorQuest();
                }}
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebration overlay */}
      {celebrationInfo && (
        <CelebrationOverlay
          isOpen={celebrationInfo.isOpen}
          type={celebrationInfo.type}
          title={celebrationInfo.title}
          description={celebrationInfo.description}
          xpGained={celebrationInfo.xpGained}
          level={celebrationInfo.level}
          rank={celebrationInfo.rank}
          isPromoted={celebrationInfo.isPromoted}
          promotionMessage={celebrationInfo.promotionMessage}
          onClose={() => {
            setCelebrationInfo(null);
            router.push("/season");
          }}
        />
      )}

      {/* Rotated Atmospheric Stamp (completed check watermark) */}
      {majorQuest.status === "completed" && (
        <div className="absolute top-20 right-6 opacity-20 pointer-events-none select-none z-10 stamp-fade-in">
          <div className="border-4 border-secondary rounded-full p-4 flex items-center justify-center rotate-12">
            <span className="font-headline-sm text-secondary uppercase tracking-widest text-[24px] font-extrabold">LEGACY</span>
          </div>
        </div>
      )}

    </div>
  );
}
