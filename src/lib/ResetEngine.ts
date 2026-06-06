import { localGetTasks, localSaveTask, localGetProfile, localSaveProfile } from "./localDb";

// Helper to get the week string for tracking (e.g. "2026-W23")
export function getCurrentWeekString(date: Date = new Date()): string {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tempDate.getUTCFullYear()}-W${weekNo}`;
}

// Get the date of the most recent Sunday at 11:59:59 PM
export function getMostRecentSundayResetTime(now: Date = new Date()): Date {
  const reset = new Date(now);
  const day = reset.getDay(); // 0 is Sunday, 1 is Monday, etc.
  
  // Calculate days to subtract to get to last Sunday
  // If today is Sunday, we check if it is before or after 11:59:59 PM
  const diff = day === 0 ? 0 : day;
  reset.setDate(reset.getDate() - diff);
  reset.setHours(23, 59, 59, 999);
  
  // If the calculated Sunday reset is in the future relative to 'now', subtract 7 days
  if (reset.getTime() > now.getTime()) {
    reset.setDate(reset.getDate() - 7);
  }
  
  return reset;
}

// Check and execute the Sunday Clean Slate wipe
export async function checkSundayCleanSlate() {
  const profile = await localGetProfile();
  if (!profile) return null;

  const now = new Date();
  const lastReset = profile.lastResetTimestamp ? new Date(profile.lastResetTimestamp) : new Date(0);
  const targetSundayReset = getMostRecentSundayResetTime(now);

  // If the last reset was before the most recent Sunday 11:59:59 PM, we run the Clean Slate Wipe!
  if (lastReset.getTime() < targetSundayReset.getTime()) {
    console.log("Sunday Clean Slate activated. Purging active Daily Focus tasks...");

    const tasks = await localGetTasks();
    let updatedAny = false;

    for (const task of tasks) {
      // If task is in focus and is not completed
      if (task.executionDate && task.status === "open") {
        if (task.minorQuestId) {
          // Quest Task: pull out of active focus list (remove executionDate)
          task.executionDate = null;
        } else {
          // Non-Quest Task: deposit back into general user backlog (remove executionDate)
          task.executionDate = null;
        }
        await localSaveTask(task);
        updatedAny = true;
      }
    }

    // Update profile tracking
    profile.lastResetTimestamp = now.getTime();
    profile.lastRitualWeek = ""; // Reset ritual completion for the new week
    await localSaveProfile(profile);

    console.log("Sunday Clean Slate wipe complete. Updated tasks:", updatedAny);
  }

  return profile;
}

// Check if the Re-Budgeting Ritual lockout is active
// Lockout is active if:
// 1. It is Monday (or any day after the Sunday reset, but typically Monday)
// 2. The profile.lastRitualWeek does not match the current week string.
export async function isRitualLockoutActive(): Promise<boolean> {
  const profile = await localGetProfile();
  if (!profile) return false;

  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
  
  // We lock out starting Monday morning until they lock their slate
  // If currentDay is Monday (1) or later in the week, and they haven't completed the ritual for this week:
  const currentWeek = getCurrentWeekString(now);
  
  // Lockout applies starting Monday (day 1) through the rest of the week if not completed
  const isMondayOrLater = currentDay >= 1; 
  const ritualNotDone = profile.lastRitualWeek !== currentWeek;

  return isMondayOrLater && ritualNotDone;
}

// Complete the Re-Budgeting Ritual and release the dashboard
export async function lockWeeklySlate(committedTaskIds: string[]) {
  const profile = await localGetProfile();
  if (!profile) return;

  const now = new Date();
  const todayDateString = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // Set the execution date of all committed tasks to today/Monday to mount them on Daily Focus
  const tasks = await localGetTasks();
  for (const task of tasks) {
    if (committedTaskIds.includes(task.id)) {
      task.executionDate = todayDateString;
      await localSaveTask(task);
    }
  }

  // Save completion to profile
  profile.lastRitualWeek = getCurrentWeekString(now);
  await localSaveProfile(profile);
  console.log("Weekly slate locked. Ritual complete.");
}

// Prioritization algorithm for Re-Budgeting
// Prioritize due dates, quest items, and impact weighting
export function sortBacklogTasks(tasks: any[]) {
  return tasks
    .filter(t => t.status === "open" && !t.executionDate)
    .sort((a, b) => {
      // 1. Pin priority (quest tasks vs non-quest)
      const aQuestVal = a.minorQuestId ? 2 : 1;
      const bQuestVal = b.minorQuestId ? 2 : 1;
      if (aQuestVal !== bQuestVal) {
        return bQuestVal - aQuestVal; // Quest tasks first
      }

      // 2. Estimate minutes (shorter first as a tie-breaker for quick wins)
      return (a.estimateMinutes || 0) - (b.estimateMinutes || 0);
    });
}
