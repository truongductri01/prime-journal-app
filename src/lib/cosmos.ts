import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.AZURE_COSMOSDB_ENDPOINT || "";
const key = process.env.AZURE_COSMOSDB_KEY || "";

let client: CosmosClient | null = null;

if (endpoint && key && !endpoint.includes("your-cosmos-db-endpoint")) {
  client = new CosmosClient({ endpoint, key });
}

export async function getCosmosContainer() {
  if (!client) {
    // If environment variables are missing or default placeholders, throw a descriptive error
    throw new Error("Azure Cosmos DB configuration is missing or invalid in .env.local. Please configure AZURE_COSMOSDB_ENDPOINT and AZURE_COSMOSDB_KEY.");
  }

  // Create database if not exists
  const { database } = await client.databases.createIfNotExists({
    id: "omni-log-db",
  });

  // Create container if not exists, hardcoding the logical partition key definition path directly to /userId
  const { container } = await database.containers.createIfNotExists({
    id: "app",
    partitionKey: { paths: ["/userId"] },
  });

  return container;
}

export function isCosmosConfigured(): boolean {
  return !!(endpoint && key && !endpoint.includes("your-cosmos-db-endpoint"));
}

export * from "./localDb";
