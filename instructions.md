# Engineering Instructions: Project "The Prime Journal" Implementation

## Step 1: Environment Validation
1. Read the environment variables from `.env.local`.
2. Validate that connection endpoints for Azure OpenAI (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY) and Azure Cosmos DB (AZURE_COSMOSDB_ENDPOINT, AZURE_COSMOSDB_KEY) are parsed correctly.

## Step 2: Database Initialization Script
1. Generate `src/lib/cosmos.ts` to coordinate client connectivity to Azure Cosmos DB.
2. Programmatically establish a database called `omni-log-db` and an internal container called `app`.
3. Hardcode the logical partition key definition path directly to `/userId` to preserve complete identity isolation profiles across multi-tenant execution bounds.

## Step 3: Offline-First IndexedDB Layout
1. Implement local browser client caching storage using `idb` inside `src/lib/localDb.ts`.
2. Build isolated local collection stores for: `seasons`, `quests`, `tasks`, and `characterProfile` matching the JSON objects from Section 7 of `prd.md`.
3. Implement immediate offline CRUD event hooks that synchronize back to Azure Cosmos DB via a local background sync mechanism.

## Step 4: UI Development (Light Theme & Gamified Mechanics)
1. Build out the global layout using the clean, radiant game-inspired "Paper & Ink" light theme colors defined in Section 5.1 of `prd.md` (Background: #FAFAFX, Text: #1E293B, Primary Blue: #0ea5e9, Gold Accents: #eab308). Ensure dark mode utilities are fully stripped or commented out.
2. Implement the 3-Line Inline Completion Guard in `src/components/CompletionGuard.tsx`. Wire up the validation rules so that selecting 3★ dynamically prompts for and requires a text log entry before the record can be committed.
3. Inject the tiered celebration patterns into the task resolution loop using `canvas-confetti`. Match the visual bursts and text templates (Solo Leveling blue notifications for standard clears; Black Clover modals for milestone promotions).
4. Implement the Absolute Sunday Clean Slate engine loop. Code an automated routine that executes at the week-start boundary to sweep uncompleted focus tasks away and force open the fullscreen Re-Budgeting Ritual Portal on Monday morning.

## Step 5: Dual Bifrost AI API Route Formulation
1. Construct the core Azure OpenAI endpoint handler inside `src/app/api/ai/route.ts` using the SDK clients.
2. Implement the branch logic parameter conditions:
   - `mode === "tactical-co-pilot"`: Binds system role strings to act as the Solo Leveling System Interface, converting long text parameters into structured SMART Minor Quests or executing options safety evaluations via Function Calling.
   - `mode === "sunday-analyst"`: Binds system instructions to act as the Grand Cartographer Analyst, compiling text histories to calculate systemic friction metrics and outputting the "Discipline Matrix Index".

## Step 6: Verification & Local Testing
1. Launch the local development pipeline using `npm run dev`.
2. Verify that all components render smoothly with spacious layouts (+1.5% hover scales) and that calculations function correctly even when the terminal network connection states are manually toggled to simulate offline usage.