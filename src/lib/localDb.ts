import { openDB } from "idb";

// Default user ID for preserving identity isolation in Cosmos DB (/userId partition key)
export const DEFAULT_USER_ID = "cartographer-one";

// Setup database name and stores
const DB_NAME = "prime-journal-db";
const DB_VERSION = 1;

export interface SyncItem {
  id: string;
  action: "create" | "update" | "delete";
  store: "seasons" | "quests" | "tasks" | "characterProfile";
  data: any;
  timestamp: number;
}

// Open the IndexedDB instance
export async function getLocalDb() {
  if (typeof window === "undefined") return null; // Server-side rendering guard

  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("seasons")) {
        db.createObjectStore("seasons", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("quests")) {
        db.createObjectStore("quests", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("tasks")) {
        db.createObjectStore("tasks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("characterProfile")) {
        db.createObjectStore("characterProfile", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id" });
      }
    },
  });
}

// Generate deterministic UUIDv7 or high-resolution timestamp-based UUID
export function generateUUID(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "v7-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 9);
}

// Helper to push items into the sync queue
async function queueSyncAction(
  action: "create" | "update" | "delete",
  store: "seasons" | "quests" | "tasks" | "characterProfile",
  data: any
) {
  const db = await getLocalDb();
  if (!db) return;

  const syncId = generateUUID();
  const syncItem: SyncItem = {
    id: syncId,
    action,
    store,
    data,
    timestamp: Date.now(),
  };

  await db.put("syncQueue", syncItem);

  // Trigger non-blocking background sync
  triggerBackgroundSync().catch(console.error);
}

// Background sync loop
export async function triggerBackgroundSync() {
  if (typeof window === "undefined" || !navigator.onLine) {
    console.log("Offline: Background sync suspended.");
    return;
  }

  const db = await getLocalDb();
  if (!db) return;

  const tx = db.transaction("syncQueue", "readonly");
  const queue = await tx.objectStore("syncQueue").getAll();
  await tx.done;

  if (queue.length === 0) return;

  // Sort queue by timestamp to ensure operations apply in correct sequence
  const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`Syncing ${sortedQueue.length} queued mutations to Cosmos DB...`);

  for (const item of sortedQueue) {
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });

      if (response.ok) {
        // Remove successfully synced action from queue
        const deleteTx = db.transaction("syncQueue", "readwrite");
        await deleteTx.objectStore("syncQueue").delete(item.id);
        await deleteTx.done;
      } else {
        const errText = await response.text();
        console.error(`Sync item ${item.id} failed: ${errText}`);
        break; // Stop syncing remaining to maintain ordering on server error
      }
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error);
      break; // Stop syncing if network error occurs
    }
  }
}

// --- SEASONS CRUD ---
export async function localGetSeasons() {
  const db = await getLocalDb();
  if (!db) return [];
  return db.getAll("seasons");
}

export async function localSaveSeason(season: any) {
  const db = await getLocalDb();
  if (!db) return;
  const data = { ...season, userId: season.userId || DEFAULT_USER_ID };
  await db.put("seasons", data);
  await queueSyncAction("create", "seasons", data);
}

// --- QUESTS CRUD ---
export async function localGetQuests() {
  const db = await getLocalDb();
  if (!db) return [];
  return db.getAll("quests");
}

export async function localSaveQuest(quest: any) {
  const db = await getLocalDb();
  if (!db) return;
  const data = { ...quest, userId: quest.userId || DEFAULT_USER_ID };
  await db.put("quests", data);
  await queueSyncAction("create", "quests", data);
}

// --- TASKS CRUD ---
export async function localGetTasks() {
  const db = await getLocalDb();
  if (!db) return [];
  return db.getAll("tasks");
}

export async function localSaveTask(task: any) {
  const db = await getLocalDb();
  if (!db) return;
  const data = { ...task, userId: task.userId || DEFAULT_USER_ID };
  await db.put("tasks", data);
  await queueSyncAction("create", "tasks", data);
}

export async function localDeleteTask(taskId: string) {
  const db = await getLocalDb();
  if (!db) return;
  const task = await db.get("tasks", taskId);
  if (!task) return;
  await db.delete("tasks", taskId);
  await queueSyncAction("delete", "tasks", { id: taskId, userId: task.userId || DEFAULT_USER_ID });
}

// --- CHARACTER PROFILE CRUD ---
export async function localGetProfile() {
  const db = await getLocalDb();
  if (!db) return null;
  const profiles = await db.getAll("characterProfile");
  if (profiles.length === 0) {
    // Return default character profile if not initialized
    const defaultProfile = {
      id: "character-profile-id",
      userId: DEFAULT_USER_ID,
      experiencePoints: 0,
      level: 1,
      rank: "Apprentice III",
      disciplineMatrixIndex: 100,
      timeBudgetMinutes: 480, // Default 8 hours
    };
    await db.put("characterProfile", defaultProfile);
    return defaultProfile;
  }
  return profiles[0];
}

export async function localSaveProfile(profile: any) {
  const db = await getLocalDb();
  if (!db) return;
  const data = { ...profile, userId: profile.userId || DEFAULT_USER_ID };
  await db.put("characterProfile", data);
  await queueSyncAction("create", "characterProfile", data);
}
