"use client";

import React, { useState, useEffect } from "react";
import { 
  localGetTasks, 
  localSaveTask, 
  localDeleteTask,
  localGetProfile, 
  localSaveProfile,
  generateUUID, 
  DEFAULT_USER_ID,
  localGetQuests
} from "@/lib/cosmos";
import { CompletionGuard } from "@/components/CompletionGuard";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { 
  triggerStandardClearConfetti, 
  triggerCodexRollConfetti,
  triggerRankPromotionConfetti,
  getXpYield,
  checkRankProgression
} from "@/lib/celebration";

export default function DailyFocus() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [minorQuests, setMinorQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Standalone task capture
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMins, setNewTaskMins] = useState(30);

  // Completion Guard State
  const [activeTaskToComplete, setActiveTaskToComplete] = useState<any>(null);
  
  // Weekly Analyst State
  const [weeklyInsights, setWeeklyInsights] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Celebration overlay state
  const [celebrationInfo, setCelebrationInfo] = useState<any>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const loadData = async () => {
    try {
      const allTasks = await localGetTasks();
      setTasks(allTasks);

      const prof = await localGetProfile();
      setProfile(prof);

      const quests = await localGetQuests();
      setMinorQuests(quests.filter(q => q.majorQuestId));

      const storedInsights = localStorage.getItem("cartographer-weekly-insights");
      if (storedInsights) {
        setWeeklyInsights(JSON.parse(storedInsights));
      }
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
  }, []);

  // Filter Focus Tasks: status === 'open' and executionDate === todayStr (CR-12)
  const focusTasks = tasks.filter(
    (t) => t.status === "open" && t.executionDate === todayStr
  );

  // Separate "From Quests" and "Non-Quest Tasks" (CR-12)
  const questTasks = focusTasks.filter((t) => t.minorQuestId);
  const nonQuestTasks = focusTasks.filter((t) => !t.minorQuestId);

  // Force pinned tasks to float directly at the topmost positions (CR-13)
  const sortPinned = (a: any, b: any) => {
    const aPin = a.isPinned ? 1 : 0;
    const bPin = b.isPinned ? 1 : 0;
    return bPin - aPin;
  };

  const sortedQuestTasks = questTasks.sort(sortPinned);
  const sortedNonQuestTasks = nonQuestTasks.sort(sortPinned);

  // Backlog tasks (open, no execution date set)
  const backlogTasks = tasks.filter((t) => t.status === "open" && !t.executionDate);

  // Total estimate minutes for budget check (CR-14)
  const totalMins = focusTasks.reduce((sum, t) => sum + (t.estimateMinutes || 0), 0);
  const timeBudget = profile?.timeBudgetMinutes || 480;
  const isOverBudget = totalMins > timeBudget * 1.1;

  // Add Non-Quest Task
  const handleAddNonQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (focusTasks.length >= 7) {
      alert("System Limit: Daily Focus active slate capacity is capped at 7 items. Please snooze or clear existing tasks to proceed.");
      return;
    }

    try {
      const newTask = {
        id: generateUUID(),
        userId: DEFAULT_USER_ID,
        title: newTaskTitle.trim(),
        status: "open",
        estimateMinutes: Number(newTaskMins) || 30,
        executionDate: todayStr,
        isPinned: false,
        snoozeCount: 0,
        source: "backlog",
      };

      await localSaveTask(newTask);
      setNewTaskTitle("");
      setNewTaskMins(30);

      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Snooze modifier (CR-15)
  const handleSnooze = async (task: any) => {
    try {
      const nextDate = new Date(todayStr);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      const updated = {
        ...task,
        executionDate: nextDateStr,
        snoozeCount: (task.snoozeCount || 0) + 1,
      };

      await localSaveTask(updated);
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Pinned status (CR-13 helper)
  const handleTogglePin = async (task: any) => {
    try {
      const updated = { ...task, isPinned: !task.isPinned };
      await localSaveTask(updated);
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Move backlog task to today's focus
  const handleMoveToFocus = async (task: any) => {
    if (focusTasks.length >= 7) {
      alert("Focus slate is capped at 7 active items.");
      return;
    }
    try {
      const updated = { ...task, executionDate: todayStr };
      await localSaveTask(updated);
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Handle task check action
  const handleTaskCompleteCheck = async (task: any) => {
    if (task.minorQuestId) {
      setActiveTaskToComplete(task);
    } else {
      // Non-quest tasks complete instantly
      try {
        const updated = {
          ...task,
          status: "completed",
          completedAt: new Date().toISOString(),
          rating: 1,
        };
        await localSaveTask(updated);

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

        // Display Celebration Overlay
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

      // Save completion log if 3★
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

      setCelebrationInfo({
        isOpen: true,
        type: rating === 3 ? "minor" : "task",
        title: task.title,
        description: rating === 3 ? `[ALERT: EXTRAORDINARY FEAT] Sung Jin-Woo has logged a Codex Exception: "${note}"` : "",
        xpGained: totalXp,
        level: isPromoted ? profile.level + 1 : profile.level,
        rank: newRank,
        isPromoted,
        promotionMessage: isPromoted ? `🍀 LIMIT BREAK! You reached Level ${profile.level + 1} [${newRank}].` : "",
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

  // Grand Cartographer System Analyst Audit Refresh (Sunday analyst)
  const handleSundayAnalystAudit = async () => {
    setAnalyzing(true);
    try {
      const allTasks = await localGetTasks();
      
      const logDocs = allTasks.filter(
        (t) => t.id && t.id.startsWith("completion-log:") && t.notes
      );

      const logsPayload = logDocs.map((doc) => ({
        taskId: doc.taskId,
        notes: doc.notes,
        createdAt: doc.createdAt,
      }));

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sunday-analyst",
          payload: { logs: logsPayload },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setWeeklyInsights(data);
        localStorage.setItem("cartographer-weekly-insights", JSON.stringify(data));

        const updatedProfile = {
          ...profile,
          disciplineMatrixIndex: data.disciplineMatrixIndex,
        };
        await localSaveProfile(updatedProfile);
        window.dispatchEvent(new Event("local-db-update"));
      } else {
        alert("Failed to compile weekly insights: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error compiling Weekly Cartographer audit.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined text-secondary animate-spin text-4xl">sync</span>
      </div>
    );
  }

  const getMinorQuestTitle = (minorQuestId: string) => {
    const q = minorQuests.find((mq) => mq.id === minorQuestId);
    return q ? q.title : "Linked Quest";
  };

  return (
    <div className="max-w-[720px] mx-auto pb-24">
      
      {/* Header Section */}
      <section className="mb-stack-lg text-center md:text-left border-b border-outline-variant/15 pb-6">
        <span className="text-label-md font-label-md text-secondary uppercase tracking-widest mb-2 block font-bold">Today's Focus</span>
        <h1 className="font-display-lg-mobile md:font-display-lg text-primary mb-3">Operational Slate</h1>
        <p className="font-body-lg text-on-surface-variant italic leading-relaxed">
          “The forest grows one leaf at a time.” Focus on these small movements today.
        </p>
      </section>

      {/* Amber alert warning bar (CR-14) */}
      {isOverBudget && (
        <div className="mb-6 p-4 bg-error-container/20 border border-error-container text-error rounded-xl text-xs font-bold flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] mt-0.5">warning</span>
          <div>
            <strong>Operational Overload Alert:</strong> Your committed focus minutes ({totalMins}m) exceed 110% of your daily budget capacity ({timeBudget}m). Use "Snooze" on lower priority tasks to maintain sustainable pacing.
          </div>
        </div>
      )}

      {/* Focus Tasks Grid */}
      <div className="space-y-4">
        
        {/* Section A: From Quests */}
        {sortedQuestTasks.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-label-sm text-secondary font-bold uppercase tracking-wider text-xs pb-1.5 border-b border-outline-variant/10">
              Quest Intentions
            </h3>
            {sortedQuestTasks.map((task) => (
              <article 
                key={task.id} 
                className="quest-card bg-surface-container-low p-5 rounded-xl border border-outline-variant/20 flex items-start gap-4 group"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <input 
                    type="checkbox"
                    checked={task.status === "completed"}
                    onChange={() => handleTaskCompleteCheck(task)}
                    className="w-5 h-5 rounded-full border-secondary text-secondary focus:ring-secondary cursor-pointer"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-1 gap-4">
                    <h3 className="font-headline-sm text-[16px] text-primary transition-all">
                      {task.title}
                    </h3>
                    <span className="text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed-variant px-2.5 py-0.5 rounded-full flex-shrink-0">
                      {getMinorQuestTitle(task.minorQuestId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-on-surface-variant">
                    <button 
                      onClick={() => handleTogglePin(task)} 
                      className={`flex items-center gap-1 hover:text-primary ${task.isPinned ? 'text-secondary font-bold' : ''}`}
                    >
                      <span className="material-symbols-outlined text-sm">push_pin</span>
                      {task.isPinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button 
                      onClick={() => handleSnooze(task)} 
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-sm">snooze</span>
                      Snooze (+1d)
                    </button>
                    <span className="font-mono text-outline ml-auto">{task.estimateMinutes}m</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Section B: Non-Quest Tasks */}
        <div className="space-y-3 mt-6">
          <h3 className="font-label-sm text-on-surface-variant font-bold uppercase tracking-wider text-xs pb-1.5 border-b border-outline-variant/10">
            Daily Routines & Standalone Items
          </h3>
          
          {sortedNonQuestTasks.length === 0 && sortedQuestTasks.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-outline-variant/30 rounded-xl flex flex-col items-center justify-center text-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
              <span className="material-symbols-outlined text-4xl mb-2">add_circle</span>
              <p className="font-label-md text-label-md text-primary">No active focus tasks</p>
              <p className="text-[11px] text-on-surface-variant">Don't overfill the vessel; 4-5 items is plenty.</p>
            </div>
          ) : (
            sortedNonQuestTasks.map((task) => (
              <article 
                key={task.id} 
                className="quest-card bg-surface-container-low p-5 rounded-xl border border-outline-variant/20 flex items-start gap-4 group"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <input 
                    type="checkbox"
                    checked={task.status === "completed"}
                    onChange={() => handleTaskCompleteCheck(task)}
                    className="w-5 h-5 rounded-full border-secondary text-secondary focus:ring-secondary cursor-pointer"
                  />
                </div>
                <div className="flex-grow">
                  <h3 className="font-headline-sm text-[16px] text-primary transition-all">
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-on-surface-variant">
                    <button 
                      onClick={() => handleTogglePin(task)} 
                      className={`flex items-center gap-1 hover:text-primary ${task.isPinned ? 'text-secondary font-bold' : ''}`}
                    >
                      <span className="material-symbols-outlined text-sm">push_pin</span>
                      {task.isPinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button 
                      onClick={() => handleSnooze(task)} 
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-sm">snooze</span>
                      Snooze (+1d)
                    </button>
                    <span className="font-mono text-outline ml-auto">{task.estimateMinutes}m</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Quick-Capture Input for Standalone Routines */}
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-5 mt-6 raised-card text-left">
          <h4 className="font-label-md text-xs font-bold uppercase tracking-wider text-primary mb-3">Quick-Capture Non-Quest Intention</h4>
          <form onSubmit={handleAddNonQuest} className="flex gap-3 items-end">
            <div className="flex-[2] min-w-[200px]">
              <input 
                type="text" 
                className="w-full bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm py-2 px-1" 
                placeholder="e.g. Replenish groceries / Clean workspace desk..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required 
              />
            </div>
            <div className="w-[80px]">
              <input 
                type="number" 
                className="w-full bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm py-2 px-1 text-center" 
                placeholder="Mins"
                value={newTaskMins}
                onChange={(e) => setNewTaskMins(Number(e.target.value))}
                min={5}
                required 
              />
            </div>
            <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-container">
              Instantiate
            </button>
          </form>
        </div>

        {/* Section C: Backlog & General Inventory (Drag ritual helpers) */}
        {backlogTasks.length > 0 && (
          <div className="space-y-3 mt-6 border-t border-outline-variant/15 pt-6 text-left">
            <h3 className="font-label-sm text-secondary font-bold uppercase tracking-wider text-xs">
              Backlog Inventory
            </h3>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {backlogTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/10 flex justify-between items-center text-sm font-medium"
                >
                  <span className="text-primary truncate max-w-[320px]">{task.title}</span>
                  <button 
                    onClick={() => handleMoveToFocus(task)}
                    className="text-secondary text-xs hover:underline"
                  >
                    + Add to Slate
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 4. Grand Cartographer Analyst insights panel */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-6 mt-8 text-left raised-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-outline-variant/10 mb-4">
          <h3 className="font-headline-sm text-primary flex items-center gap-1.5 text-lg">
            <span>🍀</span> Grand Cartographer Analyst Audit
          </h3>
          <button 
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-container disabled:opacity-50"
            onClick={handleSundayAnalystAudit}
            disabled={analyzing}
          >
            {analyzing ? "Compiling Audit..." : "Request System Assessment"}
          </button>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
          Refreshes at weekly reset. The analyst evaluates your Codex Exception logs to calculate psychological slippage and system execution density parameters.
        </p>

        {weeklyInsights ? (
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center bg-white/40 p-3 rounded-lg border border-outline-variant/15 font-semibold text-sm">
              <span>Weekly Discipline Index:</span>
              <span className="text-secondary font-bold">{weeklyInsights.disciplineMatrixIndex}% Density</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong className="text-xs text-red font-bold uppercase tracking-wider block mb-1">Slippage Behaviors:</strong>
                <ul className="list-disc pl-4 text-xs text-on-surface-variant space-y-1">
                  {weeklyInsights.slippagePatterns?.map((p: string, i: number) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="text-xs text-green font-bold uppercase tracking-wider block mb-1">Success Factors:</strong>
                <ul className="list-disc pl-4 text-xs text-on-surface-variant space-y-1">
                  {weeklyInsights.successFactors?.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 bg-[#fdf9f0] border border-outline-variant/25 rounded-lg">
              <strong className="text-xs text-primary font-bold uppercase tracking-wider block mb-1">Recommendations:</strong>
              <ol className="list-decimal pl-4 text-xs text-on-surface-variant space-y-1">
                {weeklyInsights.recommendations?.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="text-center p-6 text-xs text-on-surface-variant italic border border-dashed border-outline-variant/10 rounded-lg">
            No assessment compiled. Complete 3★ Codex tasks, then click "Request System Assessment" to run the weekly analyst routine.
          </div>
        )}
      </div>

      {/* Decorative botanical leaf graphic */}
      <div className="mt-12 flex flex-col items-center opacity-30 grayscale hover:grayscale-0 transition-all duration-700 pointer-events-none select-none">
        <img 
          className="w-16 h-16 object-contain mb-2" 
          alt="Watercolor Oak Leaf Illustration"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqhe7wKc_WpwmiWIMapGlBdhd9-QvKNntF51fM2pfv7iakHZdmBlYORY5dzCatRuZXOwwsaIs8_OY8FGLvIiqxT24KUtupxYeVp63htPuUrE41kktFom7oPvxLcuxWaWCg3YcnAzDUN2vOEVoUVRWnVJt5WmEHJplWDzdA5zR_roKy6_zABv-yeKkwdT72cQfecKUlxyyA8K-qDudCbtQh_Dtx6E_d-OmM3AMNKgpw9Ol0Zfw-YCYHWOFddfpJijZOltSPggaGWx9P"
        />
        <p className="text-[10px] font-bold tracking-widest text-secondary uppercase">A record of today, a legacy for tomorrow.</p>
      </div>

      {/* Completion Guard Modal */}
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

    </div>
  );
}
