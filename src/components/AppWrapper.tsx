"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localGetProfile, localGetTasks, localSaveProfile } from "@/lib/localDb";
import { checkSundayCleanSlate, isRitualLockoutActive, lockWeeklySlate, sortBacklogTasks } from "@/lib/ResetEngine";
import { TacticalConsole } from "./TacticalConsole";

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lockoutActive, setLockoutActive] = useState(false);
  const [backlogTasks, setBacklogTasks] = useState<any[]>([]);
  const [committedIds, setCommittedIds] = useState<string[]>([]);
  const [timeBudget, setTimeBudget] = useState(480); // Default minutes

  const pathname = usePathname();

  // Run clean slate checks and refresh state
  const refreshState = async () => {
    try {
      // 1. Run Sunday Clean Slate check if needed
      await checkSundayCleanSlate();

      // 2. Fetch current profile
      const prof = await localGetProfile();
      setProfile(prof);
      if (prof) {
        setTimeBudget(prof.timeBudgetMinutes || 480);
      }

      // 3. Check Monday Lockout state
      const isLocked = await isRitualLockoutActive();
      setLockoutActive(isLocked);

      if (isLocked) {
        // Fetch backlog tasks for Re-Budgeting Ritual
        const tasks = await localGetTasks();
        const sorted = sortBacklogTasks(tasks);
        setBacklogTasks(sorted);
        setCommittedIds([]);
      }
    } catch (err) {
      console.error("Error loading profile/reset engine:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshState();

    window.addEventListener("local-db-update", refreshState);
    return () => window.removeEventListener("local-db-update", refreshState);
  }, [pathname]);

  const toggleCommitTask = (taskId: string) => {
    setCommittedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleLockSlate = async () => {
    await lockWeeklySlate(committedIds);
    setLockoutActive(false);
    window.dispatchEvent(new Event("local-db-update"));
  };

  // Calculate weekly committed minutes
  const totalCommittedMinutes = backlogTasks
    .filter((t) => committedIds.includes(t.id))
    .reduce((sum, t) => sum + (t.estimateMinutes || 0), 0);

  const budgetPercent = (totalCommittedMinutes / timeBudget) * 100;
  const isOverBudget = totalCommittedMinutes > timeBudget * 1.1; // 110% threshold

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background parchment-texture">
        <div className="text-center p-8 bg-surface-container rounded-xl raised-card">
          <span className="material-symbols-outlined text-secondary text-5xl animate-spin mb-4 block">sync</span>
          <h3 className="font-headline-sm text-primary">&gt;&gt; CONNECTING THE CARTOGRAPHER LEDGER...</h3>
        </div>
      </div>
    );
  }

  // Monday lockout screen: Re-Budgeting Ritual Portal
  if (lockoutActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-gutter-mobile bg-background parchment-texture">
        <div className="max-w-xl w-full bg-surface-container-low rounded-xl p-8 border-2 border-secondary-container raised-card relative">
          {/* Sage vertical line */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-tertiary-container"></div>

          <div className="text-center mb-6">
            <span className="text-3xl">🍀</span>
            <h2 className="font-headline-md text-primary mt-2">The Re-Budgeting Ritual</h2>
            <p className="text-on-surface-variant font-body-md mt-2">
              Monday morning focus is slate-locked. Review backlog items and commit to your weekly operational budget.
            </p>
          </div>

          <div className="bg-surface-container p-4 rounded-lg border border-outline-variant/20 mb-6">
            <div className="flex justify-between font-label-md text-primary font-semibold mb-2">
              <span>Time Budget Allocation:</span>
              <span className={isOverBudget ? "text-error font-bold" : ""}>
                {totalCommittedMinutes} / {timeBudget} mins
              </span>
            </div>

            <div className="w-full h-2 bg-surface-container-highest rounded-full inset-track overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isOverBudget ? 'bg-error' : 'bg-secondary'}`}
                style={{ width: `${Math.min(100, budgetPercent)}%` }}
              />
            </div>

            {isOverBudget && (
              <div className="text-error font-label-sm font-semibold mt-2">
                ⚠️ Commitment exceeds 110% of weekly operational budget capacity!
              </div>
            )}
          </div>

          <h3 className="font-label-md text-primary mb-3">Backlog Item Slate:</h3>
          {backlogTasks.length === 0 ? (
            <p className="text-on-surface-variant font-body-md mb-6 italic">
              Your backlog has been cleared. Tap below to establish a clean week slate.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar mb-6">
              {backlogTasks.map((task) => {
                const isCommitted = committedIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    onClick={() => toggleCommitTask(task.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isCommitted ? 'border-secondary bg-secondary-container/20 font-bold' : 'border-outline-variant/20 hover:bg-surface-container'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isCommitted}
                        readOnly
                        className="w-4 h-4 rounded text-secondary focus:ring-secondary cursor-pointer"
                      />
                      <span className="text-body-md text-primary">{task.title}</span>
                      {task.minorQuestId && (
                        <span className="badge badge-blue text-[9px] px-1.5 py-0.5 rounded-full">Quest</span>
                      )}
                    </div>
                    <span className="font-mono text-label-sm text-on-surface-variant">{task.estimateMinutes}m</span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            className="w-full py-4 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-md hover:bg-primary-container transition-colors"
            onClick={handleLockSlate}
          >
            Lock Weekly Slate &amp; Open Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Calculate current level progress bar percentage
  const levelProgress = profile ? (profile.experiencePoints / 100) * 100 : 0;

  return (
    <div className="min-h-screen">
      {/* 1. Mobile Header (Stitch design) */}
      <header className="md:hidden flex justify-between items-center w-full px-gutter-mobile h-16 bg-surface border-b border-outline-variant/20 sticky top-0 z-50">
        <span className="font-headline-sm text-headline-sm text-primary">Quest Journey</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "k" }))}
            className="p-1 text-primary hover:text-secondary"
            title="Toggle Co-Pilot Console"
          >
            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
          </button>
          <span className="material-symbols-outlined text-primary">person</span>
        </div>
      </header>

      {/* 2. Desktop SideNavBar (Stitch design) */}
      <aside className="hidden md:flex flex-col p-4 gap-4 h-full w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant/10 z-40">
        <div className="mt-4 px-4 mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary leading-tight">Quest Journey</h2>
          <p className="font-label-sm text-on-surface-variant opacity-70">Season of the Oak</p>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            href="/"
            className={`flex items-center gap-stack-sm px-4 py-3 rounded-lg font-label-md transition-all active:scale-[0.98] ${pathname === "/"
                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
          >
            <span className="material-symbols-outlined">home</span>
            <span>Home</span>
          </Link>
          <Link
            href="/season"
            className={`flex items-center gap-stack-sm px-4 py-3 rounded-lg font-label-md transition-all active:scale-[0.98] ${pathname.startsWith("/season")
                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
          >
            <span className="material-symbols-outlined">auto_stories</span>
            <span>Seasons</span>
          </Link>
          <Link
            href="/focus"
            className={`flex items-center gap-stack-sm px-4 py-3 rounded-lg font-label-md transition-all active:scale-[0.98] ${pathname === "/focus"
                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
          >
            <span className="material-symbols-outlined">track_changes</span>
            <span>Daily Focus</span>
          </Link>
        </nav>

        {/* Global co-pilot trigger in Sidebar */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "k" }))}
          className="mt-2 mx-4 bg-primary text-on-primary py-3 rounded-lg font-label-md flex justify-center items-center gap-2 hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
          Bifrost Console
        </button>

        {/* Rowan Vance Profile Card */}
        {profile && (
          <div className="mt-auto p-3 flex items-center gap-3 bg-surface-container-highest rounded-xl border border-outline-variant/15">
            <img
              alt="User Profile"
              className="w-10 h-10 rounded-full border border-outline-variant"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJOF7s4-uGDxiBw1tU1A7mv_WGwIfXDInfawhCs11m1LlJ93sFSHVw-cklQ981f6qksF_CzwRhz6YczrHMU1EAQg2m6MJvHYYlzalmDj1BojKyYCq1suKB0wk6alC0xHny9yA-W6xATV7GNfiBG_6Biq9HR-WpQO6lTckY0G0MM7_l2HJ3LA89WG6kCUlkGIThhLtTEAsNu6PSCHsyoLWd9H-gJPciLp17T4k2p-NyTLT4ezA2wZ_0qvEMSQ0R_cWl2PTYdHg_VcYk"
            />
            <div className="overflow-hidden flex-1">
              <p className="font-label-md text-primary leading-none font-bold truncate">Rowan Vance</p>
              <p className="text-[10px] text-on-surface-variant truncate mt-0.5">Lv.{profile.level} {profile.rank}</p>

              {/* Level XP Bar inside Profile Card */}
              <div className="w-full bg-[#f1eee5] h-1.5 rounded-full mt-1 overflow-hidden inset-track">
                <div className="bg-secondary h-full rounded-full" style={{ width: `${levelProgress}%` }}></div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* 3. Mobile BottomNavBar (Stitch design) */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pb-safe h-16 bg-surface border-t border-outline-variant/20 shadow-[0_-4px_20px_rgba(68,42,34,0.05)] rounded-t-xl">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center ${pathname === "/" ? 'text-secondary font-bold' : 'text-on-surface-variant'
            }`}
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-sm text-label-sm">Home</span>
        </Link>
        <Link
          href="/season"
          className={`flex flex-col items-center justify-center ${pathname.startsWith("/season") ? 'text-secondary font-bold' : 'text-on-surface-variant'
            }`}
        >
          <span className="material-symbols-outlined">auto_stories</span>
          <span className="font-label-sm text-label-sm">Seasons</span>
        </Link>
        <Link
          href="/focus"
          className={`flex flex-col items-center justify-center ${pathname === "/focus" ? 'text-secondary font-bold' : 'text-on-surface-variant'
            }`}
        >
          <span className="material-symbols-outlined">track_changes</span>
          <span className="font-label-sm text-label-sm">Focus</span>
        </Link>
      </nav>

      {/* Main Content Area */}
      <main className="md:pl-64 pt-6 pb-24 md:pb-12 min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 journal-texture pointer-events-none"></div>
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 relative z-10">
          {children}
        </div>
      </main>

      {/* Global Cmd+K Console overlay */}
      <TacticalConsole />
    </div>
  );
}
