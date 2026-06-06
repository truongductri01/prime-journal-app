"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  localGetQuests,
  localSaveQuest,
  localGetTasks,
  localSaveTask,
  localGetProfile,
  localSaveProfile,
  generateUUID,
  DEFAULT_USER_ID
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

export default function MinorQuestDetail() {
  const params = useParams();
  const router = useRouter();
  const minorId = params.minorId as string;
  const seasonId = params.seasonId as string;

  const [minorQuest, setMinorQuest] = useState<any>(null);
  const [parentMajor, setParentMajor] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Calibration Form State
  const [editingCalibration, setEditingCalibration] = useState(false);
  const [req1, setReq1] = useState("");
  const [req2, setReq2] = useState("");
  const [req3, setReq3] = useState("");

  // Add Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState(30);
  const [mountToFocus, setMountToFocus] = useState(true);

  // Completion Guard State
  const [activeTaskToComplete, setActiveTaskToComplete] = useState<any>(null);

  // Celebration overlay state
  const [celebrationInfo, setCelebrationInfo] = useState<any>(null);

  // Single-line reflection input
  const [quickReflection, setQuickReflection] = useState("");

  // Edit Task State
  const [editingTask, setEditingTask] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const loadData = async () => {
    try {
      const quests = await localGetQuests();
      const minor = quests.find((q) => q.id === minorId && q.majorQuestId);
      setMinorQuest(minor);

      if (minor) {
        // Find parent major quest
        const major = quests.find((q) => q.id === minor.majorQuestId);
        setParentMajor(major);

        // Load tasks for this minor quest
        const allTasks = await localGetTasks();
        const questTasks = allTasks.filter((t) => t.minorQuestId === minorId);
        setTasks(questTasks);

        setReq1(minor.req1Star || "");
        setReq2(minor.req2Star || "");
        setReq3(minor.req3Star || "");
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
    setMounted(true);
    loadData();
    window.addEventListener("local-db-update", loadData);
    return () => window.removeEventListener("local-db-update", loadData);
  }, [minorId]);

  // Handle task submission
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const newTask = {
        id: generateUUID(),
        userId: DEFAULT_USER_ID,
        minorQuestId: minorId,
        title: newTaskTitle.trim(),
        status: "open",
        estimateMinutes: Number(newTaskMinutes) || 30,
        executionDate: mountToFocus ? todayStr : null,
        isPinned: false,
        snoozeCount: 0,
        source: "quest",
      };

      await localSaveTask(newTask);
      setNewTaskTitle("");
      setNewTaskMinutes(30);

      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Star economy calibration update (CR-10)
  const handleSaveCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minorQuest) return;

    try {
      const updated = {
        ...minorQuest,
        req1Star: req1.trim(),
        req2Star: req2.trim(),
        req3Star: req3.trim(),
      };
      await localSaveQuest(updated);
      setEditingCalibration(false);
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Handle task edit submission
  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      await localSaveTask(editingTask);
      setEditingTask(null);
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Complete task flow (CR-11)
  const handleTaskCheck = (task: any) => {
    setActiveTaskToComplete(task);
  };

  const handleCommitTaskClear = async (rating: number, note: string) => {
    if (!activeTaskToComplete || !profile || !minorQuest) return;

    const task = activeTaskToComplete;
    setActiveTaskToComplete(null);

    try {
      const basePoints = getXpYield(rating);
      let bonusPoints = 0;

      // 3★ triggers Loot Box Roll: Bonus XP = RandomInteger(5, 15)
      if (rating === 3) {
        bonusPoints = Math.floor(Math.random() * 11) + 5; // 5 to 15
      }

      const totalXpGained = basePoints + bonusPoints;

      const updatedTask = {
        ...task,
        status: "completed",
        rating: rating,
        completedAt: new Date().toISOString(),
      };
      await localSaveTask(updatedTask);

      // Save Codex completion narrative logs if 3★
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
        totalXpGained,
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

      // Display Celebration Overlay
      let descriptionStr = "";
      if (rating === 3) {
        descriptionStr = `[ALERT: EXTRAORDINARY FEAT] Sung Jin-Woo has logged a Codex Exception: "${note}"`;
      } else {
        descriptionStr = `[NOTIFICATION] Clear confirmed. "Do not look back. Keep moving forward."`;
      }

      setCelebrationInfo({
        isOpen: true,
        type: rating === 3 ? "minor" : "task",
        title: task.title,
        description: descriptionStr,
        xpGained: totalXpGained,
        level: isPromoted ? profile.level + 1 : profile.level,
        rank: newRank,
        isPromoted,
        promotionMessage: isPromoted ? `🍀 LIMIT BREAK! surpased limits to reach Level ${profile.level + 1} [${newRank}].` : "",
        stepsRecorded: rating === 3 ? [task.title + " completed", "Codex Exception registered"] : []
      });

      if (rating === 3) {
        triggerCodexRollConfetti();
      } else {
        triggerStandardClearConfetti();
      }

      if (isPromoted) {
        setTimeout(() => triggerRankPromotionConfetti(), 1500);
      }

      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveReflection = async () => {
    if (!quickReflection.trim() || !minorQuest) return;
    try {
      const updated = {
        ...minorQuest,
        reflection: quickReflection.trim()
      };
      await localSaveQuest(updated);
      setQuickReflection("");
      alert("Reflection saved to the Quest ledger.");
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

  if (!minorQuest) {
    return (
      <div className="card text-center p-8 border border-outline-variant/20 rounded-xl raised-card max-w-md mx-auto mt-12">
        <h3 className="font-headline-sm text-primary">Minor Quest Not Found</h3>
        <Link href="/season" className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md inline-block mt-4">
          Back to Season
        </Link>
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isCalibrationEmpty = !minorQuest.req1Star || !minorQuest.req2Star || !minorQuest.req3Star;

  return (
    <div className="max-w-[1120px] mx-auto pb-24">
      {/* Back to Parent link */}
      <nav className="flex items-center gap-2 mb-stack-md text-on-surface-variant opacity-70">
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        <Link href={`/season/${seasonId}/major/${minorQuest.majorQuestId}`} className="font-label-sm text-label-sm cursor-pointer hover:text-primary">
          Back to {parentMajor?.title || "Major Quest"}
        </Link>
      </nav>

      {/* Hero Header Section */}
      <section className="mb-stack-lg animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Minor Quest
              </span>
              <span className="text-on-surface-variant font-label-sm text-xs">Linked Season Map</span>
            </div>
            <h2 className="font-display-lg-mobile md:font-display-lg text-primary tracking-tight">
              {minorQuest.title}
            </h2>
          </div>
        </div>
      </section>

      {/* Grid Layout (Bento structure from template 220) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop mt-6">

        {/* Left Column: Primary Details (8 Columns) */}
        <div className="lg:col-span-8 space-y-stack-md">

          {/* Goal & Definition Card */}
          <article className="bg-surface-container-low journal-card rounded-xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary"></div>

            <div className="flex items-center gap-2 mb-4 text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <h3 className="font-headline-sm text-headline-sm">SMART Objective</h3>
            </div>

            <p className="text-body-lg text-on-surface-variant mb-6 italic border-l-2 border-outline-variant/30 pl-4 py-1 font-serif">
              "{minorQuest.description}"
            </p>

            <hr className="border-outline-variant/20 mb-6" />

            <div className="flex justify-between items-center mb-4">
              <h4 className="font-label-md text-label-md text-primary font-bold uppercase tracking-wider text-xs">
                STAR Calibration Rules
              </h4>
              {!editingCalibration && (
                <button
                  className="text-secondary text-xs font-semibold hover:underline"
                  onClick={() => setEditingCalibration(true)}
                >
                  Edit Calibration Rules
                </button>
              )}
            </div>

            {/* Mount explicit calibration warning if empty (CR-10) */}
            {isCalibrationEmpty && !editingCalibration && (
              <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-xs font-bold">
                ⚠️ Star economy calibration rules are empty. Please configure verification criteria.
              </div>
            )}

            {editingCalibration ? (
              <form onSubmit={handleSaveCalibration} className="space-y-4 bg-surface-container-high/20 p-4 rounded-lg border border-outline-variant/20">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">⭐ 1★ Target (Routine checkoff):</label>
                  <input
                    type="text"
                    className="w-full bg-surface border border-outline-variant/40 rounded-lg p-2 text-sm"
                    value={req1}
                    onChange={(e) => setReq1(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">⭐⭐ 2★ Target (Disciplined Execution):</label>
                  <input
                    type="text"
                    className="w-full bg-surface border border-outline-variant/40 rounded-lg p-2 text-sm"
                    value={req2}
                    onChange={(e) => setReq2(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">⭐⭐⭐ 3★ Target (Codex Reflection log):</label>
                  <input
                    type="text"
                    className="w-full bg-surface border border-outline-variant/40 rounded-lg p-2 text-sm"
                    value={req3}
                    onChange={(e) => setReq3(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => setEditingCalibration(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary text-xs">Save Calibration</button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Effort 1 */}
                <div className="p-4 rounded-lg bg-surface-container border border-outline-variant/10">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">1★ Basic</span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{minorQuest.req1Star || "No rule configured"}</p>
                </div>
                {/* Effort 2 */}
                <div className="p-4 rounded-lg bg-surface-container-high border border-outline-variant/30">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="font-label-sm text-label-sm text-primary font-bold">2★ Detailed</span>
                  </div>
                  <p className="text-xs text-primary leading-relaxed">{minorQuest.req2Star || "No rule configured"}</p>
                </div>
                {/* Effort 3 */}
                <div className="p-4 rounded-lg bg-surface-container-highest border border-outline-variant/50">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">3★ Epic</span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{minorQuest.req3Star || "No rule configured"}</p>
                </div>
              </div>
            )}
          </article>

          {/* Task List Card */}
          <article className="bg-surface-container-low journal-card rounded-xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined">format_list_bulleted</span>
                <h3 className="font-headline-sm text-headline-sm">Progress Tracking</h3>
              </div>
              <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                {completedCount} / {totalCount} Tasks
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-surface-container-high rounded-full inset-shadow mb-8 overflow-hidden">
              <div className="h-full bg-tertiary-container rounded-full relative transition-all duration-700" style={{ width: `${progressPercent}%` }}></div>
            </div>

            {/* Tasks checklist */}
            <div className="space-y-2">
              {tasks.map((task) => {
                const isCompleted = task.status === "completed";
                return (
                  <div
                    key={task.id}
                    className={`raised-card bg-surface-container-lowest p-3 rounded-lg flex items-center justify-between border-l-4 border-outline-variant/20 hover:border-primary/20 transition-all cursor-pointer ${isCompleted ? 'opacity-60 bg-surface-container-low' : ''
                      }`}
                    onClick={() => setEditingTask(task)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        disabled={isCompleted}
                        onChange={() => handleTaskCheck(task)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded text-secondary focus:ring-secondary cursor-pointer"
                      />
                      <span
                        className={`text-body-md text-primary leading-tight font-medium hover:text-secondary ${isCompleted ? 'line-through text-on-surface-variant' : ''}`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <span className="text-[10px] bg-secondary-container/40 text-secondary px-2 py-0.5 rounded-full font-bold">
                          {task.rating}★ Rating
                        </span>
                      )}
                      <span className="text-xs font-mono text-on-surface-variant">
                        {task.estimateMinutes}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Add Task Form */}
            <form onSubmit={handleAddTask} className="mt-6 pt-6 border-t border-outline-variant/10 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-bold text-on-surface-variant block mb-1">New Sub-task Title:</label>
                <input
                  type="text"
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg p-2 text-sm"
                  placeholder="e.g. Audit legacy endpoints..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  required
                />
              </div>
              <div className="w-24">
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Est Mins:</label>
                <input
                  type="number"
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg p-2 text-sm"
                  value={newTaskMinutes}
                  onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
                  min={5}
                  required
                />
              </div>
              <div className="flex items-center gap-1.5 h-10 select-none pb-2">
                <input
                  type="checkbox"
                  id="mount-focus-today"
                  checked={mountToFocus}
                  onChange={(e) => setMountToFocus(e.target.checked)}
                  className="rounded text-secondary focus:ring-secondary"
                />
                <label htmlFor="mount-focus-today" className="text-xs font-bold text-on-surface-variant cursor-pointer">Mount today</label>
              </div>
              <button type="submit" className="bg-primary text-on-primary px-4 h-9 rounded-lg text-xs font-bold hover:bg-primary-container">
                Add Task
              </button>
            </form>

          </article>
        </div>

        {/* Right Column: Metadata & Context (4 Columns) */}
        <div className="lg:col-span-4 space-y-stack-md">
          {/* Quest Context Image */}
          <div className="rounded-xl overflow-hidden journal-card aspect-square relative group">
            <img
              alt="Journaling workspace desk"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBtxw0dT7vr19EyANO7yOMfhG7bjWT4DgZXIglq1bsnUyKvrTL6D5n-fze_UxwTWm0HCjM0PqK8ur7rwU-3GfWImmom3qmXzaF8qbkNYXjhUxtVYGRCpvLo0FFfXvqwzfjaUqEWWoDV4qNagq2rXUGHOgGaHc4FOSB_H8euBfR0ZzgKGQjzkJ6FSpaQ5WIaQnPz3ZY2uLTj5aqA6GOOlT_yoSRy0tSyoN6hImscejvdp5Wo_0DFI95TrbCSSYMwM8xV4TbVUUDsw9K_"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-primary/80 to-transparent">
              <p className="text-on-primary font-label-sm text-xs font-semibold">Active Focus Session: 45m</p>
            </div>
          </div>

          {/* Attributes/Metadata Card */}
          <article className="bg-surface-container-high journal-card rounded-xl p-6">
            <h4 className="font-label-md text-label-md text-primary mb-4 uppercase tracking-wider font-bold text-xs">Quest Metadata</h4>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-label-sm">Linked Season</span>
                <span className="text-tertiary underline decoration-dotted font-bold">{parentMajor?.title || "Active Season"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-label-sm">Difficulty Rating</span>
                <div className="flex gap-0.5">
                  <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
                  <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
                  <span className="material-symbols-outlined text-outline-variant text-[16px]">history_edu</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-label-sm">XP Reward Base</span>
                <span className="text-primary font-extrabold">+150 Growth XP</span>
              </div>
            </div>
          </article>

          {/* Reflection Prompt Card */}
          <article className="bg-surface-bright journal-card rounded-xl p-6 border-dashed border-2 border-outline-variant/40">
            <h4 className="font-headline-sm text-headline-sm text-secondary mb-2 italic">Reflect</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              {minorQuest.reflection ? "Latest ledger note:" : "What is the primary operational risk of this sub-pathway?"}
            </p>
            {minorQuest.reflection ? (
              <p className="p-3 bg-surface-container-low rounded italic text-sm text-primary font-serif">
                "{minorQuest.reflection}"
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full bg-surface-container border-0 border-b border-outline-variant p-2 font-body-md focus:ring-0 focus:border-primary transition-all resize-none text-xs"
                  placeholder="Record reflection note..."
                  value={quickReflection}
                  onChange={(e) => setQuickReflection(e.target.value)}
                  rows={3}
                />
                <button
                  className="bg-primary text-on-primary py-1.5 px-3 rounded text-xs font-bold hover:bg-primary-container self-end"
                  onClick={handleSaveReflection}
                >
                  Save Note
                </button>
              </div>
            )}
          </article>
        </div>

      </div>

      {/* Completion Guard Modal */}
      <CompletionGuard
        isOpen={!!activeTaskToComplete}
        onClose={() => setActiveTaskToComplete(null)}
        onSubmit={handleCommitTaskClear}
        req1Star={minorQuest.req1Star}
        req2Star={minorQuest.req2Star}
        req3Star={minorQuest.req3Star}
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

      {/* Rotated Completed Stamp overlay */}
      {progressPercent === 100 && (
        <div className="absolute top-24 right-4 pointer-events-none select-none z-10 stamp-fade-in opacity-25">
          <div className="border-4 border-secondary rounded-full p-4 flex items-center justify-center rotate-12">
            <span className="font-headline-sm text-secondary uppercase tracking-widest text-[24px] font-extrabold">CLEARED</span>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity cursor-pointer"
          onClick={() => setEditingTask(null)}
        >
          <div
            className="w-full max-w-[500px] bg-surface-container-low p-8 rounded-xl border border-outline-variant/30 text-left raised-card parchment-texture animate-in fade-in zoom-in-95 duration-200 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-6">
              <h3 className="font-headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">edit_square</span>
                Edit Task
              </h3>
              <button className="text-on-surface-variant hover:text-primary" onClick={() => setEditingTask(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {editingTask.status === "completed" && (
              <div className="bg-surface-container-high/40 p-4 rounded-lg border border-outline-variant/20 space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <span className="font-label-sm text-on-surface-variant uppercase tracking-wider font-bold text-xs">Status:</span>
                  <span className="badge badge-slate uppercase tracking-wider text-[10px]">{editingTask.status}</span>
                </div>
                {editingTask.rating > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="font-label-sm text-on-surface-variant uppercase tracking-wider font-bold text-xs">Rating Awarded:</span>
                    <span className="text-secondary text-lg flex tracking-tighter" title={`${editingTask.rating} Star Rating`}>
                      {Array.from({ length: editingTask.rating }).map((_, i) => "★").join("")}
                    </span>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSaveEditTask} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Task Objective</label>
                <input
                  type="text"
                  className="w-full bg-surface border border-outline-variant/40 rounded-lg p-3 text-sm"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Estimated Minutes</label>
                <input
                  type="number"
                  className="w-full bg-surface border border-outline-variant/40 rounded-lg p-3 text-sm"
                  value={editingTask.estimateMinutes}
                  onChange={(e) => setEditingTask({ ...editingTask, estimateMinutes: Number(e.target.value) })}
                  min={5}
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-pin"
                  checked={editingTask.isPinned || false}
                  onChange={(e) => setEditingTask({ ...editingTask, isPinned: e.target.checked })}
                  className="rounded text-secondary focus:ring-secondary w-5 h-5 cursor-pointer"
                />
                <label htmlFor="edit-pin" className="text-sm font-bold text-on-surface-variant cursor-pointer">Pin to Top (Priority)</label>
              </div>

              <div className="mt-8 pt-6 border-t border-outline-variant/20 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-label-md hover:bg-primary-container transition-colors active:scale-95 shadow-md flex items-center gap-2"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
