import { NextResponse } from "next/server";
import { getCosmosContainer, isCosmosConfigured } from "@/lib/cosmos";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, store, data } = body;
    const userId = data.userId || "cartographer-one";

    // If Cosmos DB is not configured, fall back gracefully to offline mode.
    if (!isCosmosConfigured()) {
      return NextResponse.json({
        success: true,
        offline: true,
        message: "Cosmos DB is not configured. Running in offline-only state.",
      });
    }

    const container = await getCosmosContainer();

    // Cosmos DB documents must have an 'id' and the partition key (userId).
    // We add a 'type' field to distinguish between different schemas in the same 'app' container.
    const document = {
      ...data,
      id: `${store}:${data.id}`, // Unique ID in the container
      documentType: store,       // Store discriminator
      realId: data.id,           // Original UUID
      userId: userId,            // Partition Key
    };

    if (action === "create" || action === "update") {
      await container.items.upsert(document);
    } else if (action === "delete") {
      const docId = `${store}:${data.id}`;
      try {
        await container.item(docId, userId).delete();
      } catch (err: any) {
        // If not found (404), it's already deleted.
        if (err.code !== 404) {
          throw err;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cosmos DB Sync API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
