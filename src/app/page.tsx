"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  localGetSeasons,
  localSaveSeason,
  localGetQuests,
  localGetTasks,
  localSaveTask,
  generateUUID,
  DEFAULT_USER_ID,
  localGetProfile,
  localSaveProfile
} from "@/lib/cosmos";
import { CompletionGuard } from "@/components/CompletionGuard";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { createPortal } from "react-dom";
import {
  triggerStandardClearConfetti,
  triggerCodexRollConfetti,
  triggerRankPromotionConfetti,
  getXpYield,
  checkRankProgression
} from "@/lib/celebration";

export default function Home() {
  const [activeSeason, setActiveSeason] = useState<any>(null);
  const [activeMajors, setActiveMajors] = useState<any[]>([]);
  const [todayFocusPreview, setTodayFocusPreview] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quick Capture & Form states
  const [quickCaptureText, setQuickCaptureText] = useState("");
  const [newSeasonTitle, setNewSeasonTitle] = useState("");
  const [newSeasonDuration, setNewSeasonDuration] = useState("12"); // default 12 weeks

  // Completion modal states
  const [activeTaskToComplete, setActiveTaskToComplete] = useState<any>(null);
  const [celebrationInfo, setCelebrationInfo] = useState<any>(null);

  // Task detail modal state
  const [viewingTask, setViewingTask] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Minor quests across active majors
  const [upcomingMinors, setUpcomingMinors] = useState<any[]>([]);

  const loadData = async () => {
    try {
      // Load season
      const seasons = await localGetSeasons();
      const active = seasons.find((s) => s.status === "active");
      setActiveSeason(active);

      // Load profile
      const prof = await localGetProfile();
      setProfile(prof);

      if (active) {
        // Load quests & tasks
        const allQuests = await localGetQuests();
        const allTasks = await localGetTasks();

        // Major Quests are those with no parent majorQuestId and belong to this season
        const majors = allQuests.filter(
          (q) => !q.majorQuestId && q.seasonId === active.id && q.status === "active"
        );

        // Fetch progress details for each Major Quest
        const majorsWithProgress = majors.map((major) => {
          // Find minor quests under this major quest
          const minors = allQuests.filter((q) => q.majorQuestId === major.id);
          const minorIds = minors.map((m) => m.id);

          // Tasks are linked to minors
          const questTasks = allTasks.filter(
            (t) => t.minorQuestId && (minorIds.includes(t.minorQuestId) || t.minorQuestId === major.id)
          );

          const totalTasks = questTasks.length;
          const completedTasks = questTasks.filter((t) => t.status === "completed");
          const completedCount = completedTasks.length;

          // Suppress quality rendering parameters until >= 3 tasks are completed within the branch
          const showQuality = completedCount >= 3;

          // Calculate average star rating for completed tasks in this branch
          let avgRating = 0;
          if (showQuality) {
            const ratings = completedTasks.map((t) => t.rating || 1);
            const sum = ratings.reduce((a, b) => a + b, 0);
            avgRating = sum / ratings.length;
          }

          // Pull minor quest titles for preview
          const minorPreviews = minors.slice(0, 2).map((m) => ({
            id: m.id,
            title: m.title,
            completed: allTasks.filter(t => t.minorQuestId === m.id && t.status === "completed").length,
            total: allTasks.filter(t => t.minorQuestId === m.id).length
          }));

          return {
            ...major,
            totalTasks,
            completedCount,
            progressPercent: totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0,
            showQuality,
            avgRating: avgRating.toFixed(1),
            minorPreviews
          };
        });

        setActiveMajors(majorsWithProgress.slice(0, 3)); // Display up to 3 active Major Quests

        // Get today's focus preview (all queued items for today)
        const todayStr = new Date().toISOString().split("T")[0];
        const focusTasks = allTasks.filter(
          (t) => t.executionDate === todayStr
        );

        // Sort: open first, then pinned
        const sortedFocus = focusTasks.sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === "open" ? -1 : 1;
          }
          const aPin = a.isPinned ? 1 : 0;
          const bPin = b.isPinned ? 1 : 0;
          return bPin - aPin;
        });

        setTodayFocusPreview(sortedFocus);

        // Map upcoming milestones (minor quests not complete)
        const activeMinorQuests = allQuests.filter(
          (q) => q.majorQuestId && q.seasonId === active.id && q.status === "active"
        );
        const incompleteMinors = activeMinorQuests.filter((minor) => {
          const mTasks = allTasks.filter((t) => t.minorQuestId === minor.id);
          return mTasks.length > 0 && mTasks.some((t) => t.status === "open");
        });
        setUpcomingMinors(incompleteMinors.slice(0, 4));
      }
    } catch (err) {
      console.error("Error loading home dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadData();

    window.addEventListener("local-db-update", loadData);
    return () => window.removeEventListener("local-db-update", loadData);
  }, []);

  // Quick Capture submission
  const handleQuickCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCaptureText.trim()) return;

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const newTask = {
        id: generateUUID(),
        userId: DEFAULT_USER_ID,
        title: quickCaptureText.trim(),
        status: "open",
        estimateMinutes: 30, // Default 30 mins
        executionDate: todayStr, // Add to Today's Focus automatically
        isPinned: false,
        snoozeCount: 0,
        source: "backlog",
      };

      await localSaveTask(newTask);
      setQuickCaptureText("");
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error("Quick capture failed:", err);
    }
  };

  // Create Season submission
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonTitle.trim()) return;

    try {
      const start = new Date();
      const end = new Date();
      const weeks = parseInt(newSeasonDuration) || 12;
      end.setDate(start.getDate() + weeks * 7);

      const newSeason = {
        id: generateUUID(),
        userId: DEFAULT_USER_ID,
        title: newSeasonTitle.trim(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        status: "active",
      };

      await localSaveSeason(newSeason);
      setNewSeasonTitle("");
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error("Season creation failed:", err);
    }
  };

  // Check off focus task directly on the dashboard
  const handleTaskCompleteCheck = (task: any) => {
    if (task.minorQuestId) {
      setActiveTaskToComplete(task);
    } else {
      completeNonQuestTask(task);
    }
  };

  const completeNonQuestTask = async (task: any) => {
    try {
      const updated = {
        ...task,
        status: "completed",
        completedAt: new Date().toISOString(),
        rating: 1,
      };
      await localSaveTask(updated);

      // Award XP
      const xpGained = 10;
      const { newXp, newRank, isPromoted } = checkRankProgression(
        profile.experiencePoints,
        xpGained,
        profile.rank,
        0,
        0
      );

      const updatedProfile = {
        ...profile,
        experiencePoints: newXp,
        level: isPromoted ? profile.level + 1 : profile.level,
        rank: newRank,
      };
      await localSaveProfile(updatedProfile);

      // Set Daily Task celebration modal info
      setCelebrationInfo({
        isOpen: true,
        type: "task",
        title: task.title,
        xpGained,
        isPromoted,
        promotionMessage: isPromoted ? `Level up achieved! You are now Level ${profile.level + 1} ${newRank}.` : ""
      });

      triggerStandardClearConfetti();
      if (isPromoted) {
        setTimeout(() => triggerRankPromotionConfetti(), 1000);
      }

      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommitQuestTask = async (rating: number, note: string) => {
    if (!activeTaskToComplete || !profile) return;
    const task = activeTaskToComplete;
    setActiveTaskToComplete(null);

    try {
      const basePoints = getXpYield(rating);
      let bonusPoints = 0;

      if (rating === 3) {
        bonusPoints = Math.floor(Math.random() * 11) + 5; // 5 to 15
      }

      const totalXp = basePoints + bonusPoints;

      const updatedTask = {
        ...task,
        status: "completed",
        rating,
        completedAt: new Date().toISOString(),
      };
      await localSaveTask(updatedTask);

      if (rating === 3 && note) {
        const logRecord = {
          id: `completion-log:${task.id}`,
          userId: DEFAULT_USER_ID,
          notes: note,
          taskId: task.id,
          bonusXp: bonusPoints,
          createdAt: new Date().toISOString(),
          type: "task-completion-log"
        };
        await localSaveTask(logRecord);
      }

      const { newXp, newRank, isPromoted } = checkRankProgression(
        profile.experiencePoints,
        totalXp,
        profile.rank,
        1,
        0
      );

      const updatedProfile = {
        ...profile,
        experiencePoints: newXp,
        level: isPromoted ? profile.level + 1 : profile.level,
        rank: newRank,
      };
      await localSaveProfile(updatedProfile);

      // Trigger Celebration overlay
      setCelebrationInfo({
        isOpen: true,
        type: rating === 3 ? "minor" : "task",
        title: task.title,
        description: rating === 3 ? `[ALERT: EXTRAORDINARY FEAT] Sung Jin-Woo has logged a Codex Exception: "${note}"` : "",
        xpGained: totalXp,
        level: isPromoted ? profile.level + 1 : profile.level,
        rank: newRank,
        isPromoted,
        promotionMessage: isPromoted ? `🍀 LIMIT BREAK! You surpassed your limits to reach Level ${profile.level + 1} [${newRank}].` : "",
        stepsRecorded: rating === 3 ? ["Completed " + task.title, "Logged Codex Insight"] : []
      });

      if (rating === 3) {
        triggerCodexRollConfetti();
      } else {
        triggerStandardClearConfetti();
      }

      if (isPromoted) {
        setTimeout(() => triggerRankPromotionConfetti(), 1200);
      }

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

  // Calculate remaining days for the season
  let remainingDays = 0;
  let seasonProgressPercent = 0;
  if (activeSeason) {
    const end = new Date(activeSeason.endDate).getTime();
    const start = new Date(activeSeason.startDate).getTime();
    const now = Date.now();
    remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    const totalDuration = end - start;
    const elapsed = now - start;
    seasonProgressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)) : 0;
  }

  const todayDateString = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="flex flex-col gap-stack-lg">

      {/* 1. Active Season Header Banner (Watercolor style) */}
      {!activeSeason ? (
        <section className="bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-8 text-center raised-card">
          <h2 className="text-primary font-headline-md">No Active Season Boundary</h2>
          <p className="text-on-surface-variant font-body-md mt-2 mb-6">
            Initialize your life-game roadmap by establishing a new focal Season boundary.
          </p>
          <form onSubmit={handleCreateSeason} className="max-w-md mx-auto flex flex-col gap-4">
            <input
              type="text"
              className="w-full bg-surface-container-lowest border-b-2 border-outline-variant p-3 font-body-md focus:border-primary focus:ring-0"
              placeholder="Season Title (e.g. Q3 Software Masterclass)"
              value={newSeasonTitle}
              onChange={(e) => setNewSeasonTitle(e.target.value)}
              required
            />
            <select
              className="w-full bg-surface-container-lowest border-b-2 border-outline-variant p-3 font-body-md"
              value={newSeasonDuration}
              onChange={(e) => setNewSeasonDuration(e.target.value)}
            >
              <option value="4">4 Weeks (Sprint Cycle)</option>
              <option value="8">8 Weeks (Medium Term)</option>
              <option value="12">12 Weeks (Standard Quarter)</option>
            </select>
            <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md hover:bg-primary-container transition-colors">
              Establish Season Boundary
            </button>
          </form>
        </section>
      ) : (
        <section className="animate-in fade-in duration-700">
          <div className="relative rounded-xl overflow-hidden h-48 md:h-60 mb-stack-md raised-card">
            {/* Watercolor Ancient Oak Forest Banner */}
            <img
              className="w-full h-full object-cover"
              alt="Watercolor Oak Forest at Sunrise"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9flNlPHyzaMkGohgaXwmv0mRjB3RiHVsUcvlsug60pGI_DVmDY9IpGvBUAwQJj3Ugu1w6gkTY--SDEBAq4V6e1T2qrnJdV57uuCPGSCdjegBlEv1DQ5f1PogzgH82dndd95hWH6LIvpu_Fxi3O0GDo9Vrx_YdWw__7LfJoZyy9FmBww8q-CfhYhTREJx-BFK66yRKj_1YstmXSsnTY0wJt8gAXk_pdlF1pqIBpWxSnfj3ekz6yh8jDwCgW11P18LmyhSGgwdcYJB3"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6">
              <div className="flex justify-between items-end">
                <div>
                  <span className="!text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-label-sm uppercase tracking-widest mb-1 block">Current Chapter</span>
                  <h1 className="!text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] font-display-lg-mobile md:text-display-lg leading-tight">{activeSeason.title}</h1>
                </div>
                <span className="!text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-mono text-label-sm hide-mobile">
                  {remainingDays > 0 ? `${remainingDays} days remaining` : "Season timeline concluded"}
                </span>
              </div>

              {/* Overall Progress bar inside hero */}
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-secondary-container h-full transition-all duration-700" style={{ width: `${seasonProgressPercent}%` }}></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeSeason && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">

          {/* 2. Left Column: Major Quests (8 Columns) */}
          <div className="lg:col-span-8 flex flex-col gap-stack-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                Primary Major Quests
              </h3>
              <Link href="/season" className="text-secondary font-label-md hover:underline flex items-center gap-1">
                View Ledger Map <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            {activeMajors.length === 0 ? (
              <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-8 text-center raised-card">
                <p className="text-on-surface-variant font-body-md mb-4">No active Major Quests established for this season cycle.</p>
                <Link href="/season" className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md inline-block hover:bg-primary-container transition-colors">
                  Instantiate Major Quest
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeMajors.map((major) => {
                  const isFinancial = major.category === "Financial Mechanics";
                  return (
                    <div
                      key={major.id}
                      className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-6 raised-card relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
                    >
                      {/* Left Accent line based on category */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isFinancial ? 'bg-secondary-fixed' : 'bg-tertiary-fixed-dim'}`}></div>

                      <div className="flex justify-between items-start mb-3 pl-2">
                        <div>
                          <span className={`font-label-sm text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 inline-block ${isFinancial ? 'bg-secondary-fixed/30 text-secondary' : 'bg-tertiary-fixed/30 text-tertiary'
                            }`}>
                            {major.category}
                          </span>
                          <h4 className="font-headline-sm text-primary group-hover:text-secondary transition-colors">
                            <Link href={`/season/${activeSeason.id}/major/${major.id}`}>
                              {major.title}
                            </Link>
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="font-label-md text-label-md text-primary font-bold">
                            {Math.round(major.progressPercent)}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-3 w-full bg-surface-container-highest rounded-full inset-shadow overflow-hidden mb-4 pl-2">
                        <div
                          className="h-full bg-tertiary-container transition-all duration-1000 ease-out"
                          style={{ width: `${major.progressPercent}%` }}
                        ></div>
                      </div>

                      {/* Associated sub-quests/minors preview */}
                      {major.minorPreviews && major.minorPreviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-outline-variant/10 pl-2">
                          {major.minorPreviews.map((m: any) => (
                            <Link
                              key={m.id}
                              href={`/season/${activeSeason.id}/minor/${m.id}`}
                              className="bg-surface p-3 rounded-lg border border-outline-variant/10 flex items-center justify-between hover:bg-surface-container-high transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className={`material-symbols-outlined text-[18px] ${m.completed === m.total && m.total > 0 ? 'text-tertiary' : 'text-outline'}`} style={{ fontVariationSettings: m.completed === m.total && m.total > 0 ? "'FILL' 1" : "" }}>
                                  {m.completed === m.total && m.total > 0 ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <span className="text-sm font-label-md text-primary truncate max-w-[160px]">{m.title}</span>
                              </div>
                              <span className="text-[11px] font-mono text-on-surface-variant font-semibold">
                                {m.completed}/{m.total}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs italic text-on-surface-variant pl-2">
                          No minor quests linked. Tap quest title to partition the objective.
                        </div>
                      )}

                      {/* Quality parameters badge */}
                      {major.showQuality && (
                        <div className="flex justify-end mt-3 pr-2">
                          <span className="text-xs font-label-md text-secondary font-semibold bg-secondary-fixed/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            ★ {major.avgRating} Quality Average
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Right Column: Today's Focus (4 Columns) */}
          <div className="lg:col-span-4 flex flex-col gap-stack-md">
            <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>track_changes</span>
              Today's Focus
            </h3>

            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 raised-card flex flex-col gap-4 min-h-[400px]">
              <p className="font-label-sm text-on-surface-variant border-b border-outline-variant/10 pb-2 italic">
                {todayDateString} - A day for steady roots
              </p>

              {todayFocusPreview.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                  <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">self_improvement</span>
                  <p className="text-on-surface-variant font-body-md italic text-sm">
                    No tasks committed to today's focus slate. Populate your slate to begin.
                  </p>
                  <Link href="/focus" className="text-secondary text-xs font-label-md hover:underline mt-2">
                    Manage focus slate &rarr;
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {todayFocusPreview.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 hover:bg-surface-container-low transition-colors rounded-lg group"
                    >
                      <input
                        className="w-5 h-5 rounded-full border-secondary text-secondary focus:ring-secondary cursor-pointer"
                        type="checkbox"
                        checked={task.status === "completed"}
                        onChange={() => handleTaskCompleteCheck(task)}
                      />
                      <span
                        className={`text-body-md font-body-md text-on-surface hover:text-primary cursor-pointer leading-tight flex-1 ${task.status === "completed" ? "line-through opacity-60 text-on-surface-variant" : ""}`}
                        onClick={() => setViewingTask(task)}
                      >
                        {task.isPinned && <span className="text-secondary mr-1">📌</span>}
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.minorQuestId && (
                          <span className="bg-tertiary-container text-on-tertiary-container text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Quest</span>
                        )}
                        {task.status === "completed" && task.minorQuestId && task.rating > 0 && (
                          <span className="text-secondary text-xs flex tracking-tighter opacity-80" title={`${task.rating} Star Rating`}>
                            {Array.from({ length: task.rating }).map((_, i) => "★").join("")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Intention capture inside the focus bento box */}
              <form onSubmit={handleQuickCaptureSubmit} className="mt-auto pt-4 border-t border-dashed border-outline-variant/40">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="w-full bg-surface-container-low border-0 border-b border-outline-variant p-2 font-body-md focus:ring-0 focus:border-primary transition-all text-xs"
                    placeholder="+ Quick Intention capture..."
                    value={quickCaptureText}
                    onChange={(e) => setQuickCaptureText(e.target.value)}
                  />
                  <button type="submit" className="text-secondary font-label-md text-xs hover:underline flex items-center">
                    Add
                  </button>
                </div>
              </form>
            </div>

            {/* Subtle growth insight card */}
            <div className="bg-tertiary-container text-on-tertiary-container rounded-xl p-6 flex items-start gap-4">
              <span className="material-symbols-outlined text-tertiary-fixed mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                lightbulb
              </span>
              <div>
                <h5 className="font-label-md text-label-md font-bold mb-1">Growth Insight</h5>
                <p className="font-body-md text-[13px] leading-snug">
                  "The strongest oaks take the longest to grow. Focus on consistency over intensity today."
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 4. Upcoming Milestones Section (Horizontal peek) */}
      {activeSeason && (
        <section className="mt-6 border-t border-outline-variant/20 pt-8">
          <h3 className="font-headline-sm text-primary mb-stack-md flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
            Upcoming Milestones
          </h3>

          {upcomingMinors.length === 0 ? (
            <div className="bg-surface-container-low border border-outline-variant/10 p-6 rounded-lg text-center opacity-60">
              <p className="text-xs font-label-md text-on-surface-variant uppercase tracking-wider">All Minor Chapters Locked or Cleared</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {upcomingMinors.map((minor) => (
                <Link
                  key={minor.id}
                  href={`/season/${activeSeason.id}/minor/${minor.id}`}
                  className="p-4 bg-surface-container-high rounded-lg flex flex-col items-center text-center gap-2 border border-outline-variant/10 hover:border-primary/30 transition-all hover:-translate-y-1"
                >
                  <span className="material-symbols-outlined text-primary text-3xl">history_edu</span>
                  <span className="font-label-sm text-label-sm text-primary truncate max-w-full font-bold">{minor.title}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Completion Guard Modal (3-line inline guard for quest tasks) */}
      <CompletionGuard
        isOpen={!!activeTaskToComplete}
        onClose={() => setActiveTaskToComplete(null)}
        onSubmit={handleCommitQuestTask}
        taskTitle={activeTaskToComplete?.title || ""}
      />

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
          stepsRecorded={celebrationInfo.stepsRecorded}
          onClose={() => setCelebrationInfo(null)}
        />
      )}

      {/* Task Details Modal */}
      {viewingTask && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity cursor-pointer"
          onClick={() => setViewingTask(null)}
        >
          <div
            className="w-full max-w-[500px] bg-surface-container-low p-8 rounded-xl border border-outline-variant/30 text-left raised-card parchment-texture animate-in fade-in zoom-in-95 duration-200 shadow-2xl cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-6">
              <h3 className="font-headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">track_changes</span>
                Task Details
              </h3>
              <button className="text-on-surface-variant hover:text-primary" onClick={() => setViewingTask(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <span className="font-label-sm text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">Objective</span>
                <p className="font-body-lg text-primary leading-snug flex items-center gap-3">
                  {viewingTask.title}
                  {viewingTask.minorQuestId && (
                    <span className="bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shadow-sm">Quest</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/20">
                  <span className="font-label-sm text-on-surface-variant uppercase tracking-wider block mb-1 font-bold">Status</span>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-slate uppercase tracking-wider text-[10px]">{viewingTask.status}</span>
                    {viewingTask.status === "completed" && viewingTask.minorQuestId && viewingTask.rating > 0 && (
                      <span className="text-secondary text-sm flex tracking-tighter" title={`${viewingTask.rating} Star Rating`}>
                        {Array.from({ length: viewingTask.rating }).map((_, i) => "★").join("")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/20">
                  <span className="font-label-sm text-on-surface-variant uppercase tracking-wider block mb-1 font-bold">Estimated Effort</span>
                  <span className="font-mono text-sm text-primary font-bold">{viewingTask.estimateMinutes} mins</span>
                </div>
              </div>
              {viewingTask.notes && (
                <div>
                  <span className="font-label-sm text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">Codex Notes</span>
                  <p className="font-body-md text-on-surface-variant p-4 bg-surface-container-highest rounded-lg italic border border-outline-variant/10 shadow-inner">
                    {viewingTask.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex justify-end">
              <button
                className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-label-md hover:bg-primary-container transition-colors active:scale-95 shadow-md flex items-center gap-2"
                onClick={() => setViewingTask(null)}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
