import { NextResponse } from "next/server";
import OpenAI from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_API_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o";

let openai: OpenAI | null = null;

if (endpoint && apiKey && !endpoint.includes("your-openai-endpoint")) {
  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: `${endpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}`,
    defaultQuery: { "api-version": "2024-06-01" },
    defaultHeaders: { "api-key": apiKey },
  });
}

// Helper to check if OpenAI is configured
function isOpenAIConfigured() {
  return !!openai;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, payload } = body;

    if (!mode) {
      return NextResponse.json({ error: "Missing 'mode' parameter." }, { status: 400 });
    }

    if (mode === "tactical-co-pilot") {
      const { command, text, details } = payload || {};
      
      if (command === "breakdown-quest") {
        if (!isOpenAIConfigured()) {
          // Mock output for breakdown-quest
          return NextResponse.json({
            success: true,
            mocked: true,
            quests: [
              {
                title: `Establish Core Architecture of "${text}"`,
                description: "Map all structural components and database tables following clean design patterns.",
                req1Star: "Minimum database setup and basic file generation complete.",
                req2Star: "Data validation schemas and error boundaries fully documented and verified.",
                req3Star: "Architecture diagrams logged to iPad Codex, with immediate client-side test validations.",
              },
              {
                title: "Build Endpoint Interfaces & Offline Sync Mocking",
                description: "Create all REST routes and client-side database mock boundaries.",
                req1Star: "Basic network requests return successful mock responses.",
                req2Star: "All CRUD operations successfully handle network failure loops in browser storage.",
                req3Star: "Integration validation suite verifies local-offline queue and server syncing loops.",
              },
              {
                title: "UI Implementation & Visual Fine-Tuning",
                description: "Code responsive visual controls matching the Paper & Ink light theme.",
                req1Star: "Layout displays correctly on desktop and mobile viewports.",
                req2Star: "All hover scale offsets (+1.5%) and celebration animations run at 60fps.",
                req3Star: "Interactive transition tests run smoothly, and reduced-motion states fallback correctly.",
              }
            ]
          });
        }

        // Real OpenAI request using tools for structured breakdown
        const response = await openai!.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content: `You are the Solo Leveling System Interface. Convert the user's ambiguous quest objective into a structured list of 3-5 SMART Minor Quests. Each minor quest needs standard 1★, 2★, and 3★ validation rules matching the user's high-integrity engineering philosophy.`,
            },
            {
              role: "user",
              content: `Quest to breakdown: "${text}"`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_minor_quests",
                description: "Generates the SMART minor quests from the user's main objective",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    quests: {
                      type: "ARRAY",
                      description: "List of 3 to 5 minor quests",
                      items: {
                        type: "OBJECT",
                        properties: {
                          title: { type: "STRING", description: "Clear, actionable title of the minor quest" },
                          description: { type: "STRING", description: "SMART details mapping to this specific goal" },
                          req1Star: { type: "STRING", description: "1★ validation: Minimum mechanical execution" },
                          req2Star: { type: "STRING", description: "2★ validation: Flawless mechanical discipline" },
                          req3Star: { type: "STRING", description: "3★ validation: The Codex Exception (requires notes)" },
                        },
                        required: ["title", "description", "req1Star", "req2Star", "req3Star"],
                      },
                    },
                  },
                  required: ["quests"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_minor_quests" } },
        });

        const toolCalls = response.choices[0]?.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const args = JSON.parse((toolCalls[0] as any).function.arguments);
          return NextResponse.json({ success: true, quests: args.quests });
        }
        throw new Error("Failed to receive structured tool response from Azure OpenAI.");
      }

      if (command === "verify-trade") {
        if (!isOpenAIConfigured()) {
          // Mock output for verify-trade
          const { ticker, strategy } = details || {};
          const isFOMO = text?.toLowerCase().includes("fomo") || text?.toLowerCase().includes("hype");
          const hasStopLoss = text?.toLowerCase().includes("stop") || text?.toLowerCase().includes("sl");

          return NextResponse.json({
            success: true,
            mocked: true,
            compliant: !isFOMO && hasStopLoss,
            reason: isFOMO 
              ? "Rejected: Trade appears to be driven by emotional FOMO or hype vectors."
              : !hasStopLoss
              ? "Rejected: No explicit stop-loss limit was defined. Capital preservation guidelines violated."
              : `Approved: Option trade on ${ticker} (${strategy}) complies with core risk thresholds.`,
            warnings: [
              isFOMO ? "Rule Violation: Entry must be grounded in structural setups, not momentum hype." : null,
              !hasStopLoss ? "Rule Violation: Risk cap must have an ironclad exit bracket defined." : null,
              "Account Risk Notice: Verify total capital deployment is less than 2.0% of liquid assets."
            ].filter(Boolean),
          });
        }

        // Real OpenAI request for trade verification
        const response = await openai!.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content: `You are the Solo Leveling System Interface. You enforce strict risk management and rules check for option trading. Check the trade detail against the rules:
1. No FOMO entries (must have technical support/setup).
2. Max risk per trade must be <= 2% of liquid capital.
3. Must have an explicit stop-loss, profit-target, or exit bracket defined.
Analyze the trade details and return compliance state.`,
            },
            {
              role: "user",
              content: `Trade to verify: "${text}"\nDetails: ${JSON.stringify(details)}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "evaluate_trade",
                description: "Evaluates the options trade compliance",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    compliant: { type: "BOOLEAN", description: "True if all risk rules are met, false otherwise" },
                    reason: { type: "STRING", description: "Detailed summary explaining compliance decision" },
                    warnings: { type: "ARRAY", items: { type: "STRING" }, description: "Specific warning points or rule violations found" },
                  },
                  required: ["compliant", "reason", "warnings"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "evaluate_trade" } },
        });

        const toolCalls = response.choices[0]?.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const args = JSON.parse((toolCalls[0] as any).function.arguments);
          return NextResponse.json({ success: true, ...args });
        }
        throw new Error("Failed to receive structured tool response from Azure OpenAI.");
      }

      return NextResponse.json({ error: "Unknown tactical co-pilot command." }, { status: 400 });
    }

    if (mode === "sunday-analyst") {
      const { logs } = payload || {};
      
      if (!isOpenAIConfigured()) {
        // Mock output for sunday-analyst
        const notesCount = logs?.length || 0;
        let dmi = 75; // Default Discipline Matrix Index
        if (notesCount > 5) dmi = 92;
        else if (notesCount > 2) dmi = 83;
        else if (notesCount > 0) dmi = 64;
        else dmi = 35; // Severe lack of logs

        return NextResponse.json({
          success: true,
          mocked: true,
          disciplineMatrixIndex: dmi,
          slippagePatterns: notesCount === 0 
            ? ["Complete absence of Codex Exception recordings. System drift is high."] 
            : ["Cognitive overload from late-night coding sessions", "Slight exit execution slippage due to morning market volatility"],
          successFactors: notesCount > 0 
            ? ["Disciplined entry checks performed on all option setups", "Hearth Time consistently reserved and free of screens"]
            : ["Infrastructure workspace kept clean and compile-ready"],
          recommendations: [
            "Force hard stop on screen activity after 9:30 PM to preserve sleep cycle.",
            "Establish automated alert triggers on option contracts rather than manual monitoring.",
            "Log at least three 3★ Codex Exceptions next week to restore cognitive inventory accuracy.",
          ],
        });
      }

      // Real OpenAI request for Sunday Analyst
      const response = await openai!.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: "system",
            content: `You are the Grand Cartographer Analyst. Compile the user's text log histories from the prior week's task completion notes.
Calculate the systemic friction, diagnose psychological patterns of task slippage or trade compliance, and output:
1. Discipline Matrix Index (0 to 100) representing self-mastery.
2. Slippage Patterns (friction or avoidance behaviors).
3. Success Factors (what went well).
4. Recommendations (specific, concrete steps for next week).`,
          },
          {
            role: "user",
            content: `Weekly logs to analyze:\n${JSON.stringify(logs)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_weekly_insights",
              description: "Generates the Grand Cartographer insights",
              parameters: {
                type: "OBJECT",
                properties: {
                  disciplineMatrixIndex: { type: "INTEGER", description: "Discipline index between 0 and 100" },
                  slippagePatterns: { type: "ARRAY", items: { type: "STRING" }, description: "Identified patterns behind task delay or failure" },
                  successFactors: { type: "ARRAY", items: { type: "STRING" }, description: "Factors that supported successful, high-integrity outcomes" },
                  recommendations: { type: "ARRAY", items: { type: "STRING" }, description: "Specific steps to optimize focus and discipline next week" },
                },
                required: ["disciplineMatrixIndex", "slippagePatterns", "successFactors", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_weekly_insights" } },
      });

      const toolCalls = response.choices[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const args = JSON.parse((toolCalls[0] as any).function.arguments);
        return NextResponse.json({ success: true, ...args });
      }
      throw new Error("Failed to receive structured tool response from Azure OpenAI.");
    }

    return NextResponse.json({ error: "Invalid 'mode' specified." }, { status: 400 });
  } catch (error: any) {
    console.error("Azure OpenAI API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
