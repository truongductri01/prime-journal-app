import React, { useState, useEffect, useRef } from "react";
import { localGetQuests, localSaveQuest, generateUUID } from "@/lib/localDb";

export function TacticalConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [activeMajors, setActiveMajors] = useState<any[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState("");
  const [instantiated, setInstantiated] = useState(false);
  
  const consoleRef = useRef<HTMLDivElement>(null);

  // Monitor keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setResponse(null);
        setInstantiated(false);
        setInputVal("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch active Major Quests when the console opens
  useEffect(() => {
    if (isOpen) {
      localGetQuests().then((quests) => {
        const majors = quests.filter((q) => q.status === "active" && !q.majorQuestId);
        setActiveMajors(majors);
        if (majors.length > 0) {
          setSelectedMajorId(majors[0].id);
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    setLoading(true);
    setResponse(null);
    setInstantiated(false);

    try {
      let payload: any = {};
      let command = "";

      if (inputVal.startsWith("/breakdown-quest ")) {
        command = "breakdown-quest";
        payload = {
          command,
          text: inputVal.replace("/breakdown-quest ", "").trim(),
        };
      } else if (inputVal.startsWith("/verify-trade ")) {
        command = "verify-trade";
        const rawText = inputVal.replace("/verify-trade ", "").trim();
        // Parse simple format: "TSLA Buy PMCC Call" or similar
        const parts = rawText.split(" ");
        const ticker = parts[0] || "UNKNOWN";
        const strategy = parts.slice(1).join(" ") || "Option Strategy";
        
        payload = {
          command,
          text: rawText,
          details: { ticker, strategy },
        };
      } else {
        // Default text-query co-pilot
        command = "breakdown-quest";
        payload = {
          command,
          text: inputVal.trim(),
        };
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tactical-co-pilot", payload }),
      });

      const data = await res.json();
      setResponse({ command, data });
    } catch (err) {
      console.error(err);
      setResponse({ error: "Failed to communicate with Bifrost AI." });
    } finally {
      setLoading(false);
    }
  };

  const handleInstantiate = async () => {
    if (!selectedMajorId || !response?.data?.quests) return;

    try {
      for (const q of response.data.quests) {
        const minorQuest = {
          id: generateUUID(),
          majorQuestId: selectedMajorId,
          title: q.title,
          description: q.description,
          req1Star: q.req1Star,
          req2Star: q.req2Star,
          req3Star: q.req3Star,
          status: "active",
        };
        await localSaveQuest(minorQuest);
      }
      setInstantiated(true);
      // Trigger a window event so current page updates its quest state
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="clover-modal-overlay" style={{ zIndex: 3000 }}>
      <div 
        ref={consoleRef}
        className="card" 
        style={{
          width: "90%",
          maxWidth: "650px",
          maxHeight: "80vh",
          overflowY: "auto",
          border: "2.5px solid var(--azure-blue)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}
      >
        <div className="flex-between" style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--azure-blue)" }}>[SYSTEM CONSOLE]</span> Tactical Co-Pilot
          </h3>
          <button className="btn btn-secondary" onClick={() => setIsOpen(false)} style={{ padding: "0.25rem 0.5rem" }}>
            ESC
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className="input-text"
              placeholder="Enter command: /breakdown-quest [title]  or  /verify-trade [ticker] [strategy]"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoFocus
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Parsing..." : "Execute"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
            <span>Quick templates (Click to insert):</span>
            <span 
              onClick={() => setInputVal("/breakdown-quest Implement distributed message broker")}
              style={{ cursor: "pointer", textDecoration: "underline", color: "var(--azure-blue)" }}
            >
              /breakdown-quest
            </span>
            <span 
              onClick={() => setInputVal("/verify-trade TSLA Buy $200 LEAPS Call - Stop Loss at 180")}
              style={{ cursor: "pointer", textDecoration: "underline", color: "var(--azure-blue)" }}
            >
              /verify-trade
            </span>
          </div>
        </form>

        {loading && (
          <div className="solo-leveling-banner" style={{ textAlign: "center" }}>
            &gt;&gt; CONNECTING TO THE BIFROST AI AGENT GATEWAY...
          </div>
        )}

        {response && (
          <div style={{ marginTop: "1rem" }}>
            {response.error ? (
              <div style={{ color: "red", fontWeight: 600 }}>{response.error}</div>
            ) : (
              <div>
                {response.command === "breakdown-quest" && (
                  <div>
                    <h4 style={{ marginBottom: "0.5rem", color: "var(--azure-blue)" }}>
                      System Suggested Minor Quests:
                    </h4>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                      {response.data.quests?.map((q: any, i: number) => (
                        <div key={i} style={{ padding: "0.75rem", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                          <strong>{i + 1}. {q.title}</strong>
                          <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: "0.25rem 0" }}>{q.description}</p>
                          <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.15rem", borderTop: "1px dashed var(--border-color)", paddingTop: "0.25rem" }}>
                            <span>⭐ 1★: {q.req1Star}</span>
                            <span>⭐⭐ 2★: {q.req2Star}</span>
                            <span>⭐⭐⭐ 3★: {q.req3Star}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {activeMajors.length > 0 ? (
                      <div style={{ backgroundColor: "var(--canvas-bg)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                          Instantiate into Major Quest:
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <select 
                            className="input-text" 
                            style={{ padding: "0.5rem", fontSize: "0.9rem" }}
                            value={selectedMajorId}
                            onChange={(e) => setSelectedMajorId(e.target.value)}
                          >
                            {activeMajors.map((m) => (
                              <option key={m.id} value={m.id}>{m.title}</option>
                            ))}
                          </select>
                          <button 
                            className="btn btn-gold" 
                            onClick={handleInstantiate} 
                            disabled={instantiated}
                            style={{ flexShrink: 0 }}
                          >
                            {instantiated ? "Instantiated ✔" : "Instantiate"}
                          </button>
                        </div>
                        {instantiated && (
                          <div style={{ color: "green", fontSize: "0.85rem", marginTop: "0.5rem", fontWeight: 600 }}>
                            Quests successfully saved offline! They will sync in the background.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.9rem", color: "red", fontWeight: 600 }}>
                        Create an active Major Quest first to instantiate these Minor Quests.
                      </div>
                    )}
                  </div>
                )}

                {response.command === "verify-trade" && (
                  <div style={{
                    border: `1.5px solid ${response.data.compliant ? 'green' : 'var(--grimoire-gold)'}`,
                    backgroundColor: response.data.compliant ? 'rgba(0, 128, 0, 0.03)' : 'rgba(234, 179, 8, 0.03)',
                    padding: "1rem",
                    borderRadius: "8px"
                  }}>
                    <div className="flex-between" style={{ marginBottom: "0.5rem" }}>
                      <strong>Trade Compliance Status:</strong>
                      <span className="badge" style={{
                        backgroundColor: response.data.compliant ? 'rgba(0, 128, 0, 0.15)' : 'rgba(234, 179, 8, 0.25)',
                        color: response.data.compliant ? 'green' : '#a16207'
                      }}>
                        {response.data.compliant ? "COMPLIANT" : "VIOLATION DETECTED"}
                      </span>
                    </div>
                    
                    <p style={{ margin: "0.5rem 0", fontWeight: 500 }}>
                      {response.data.reason}
                    </p>

                    {response.data.warnings && response.data.warnings.length > 0 && (
                      <div style={{ marginTop: "0.75rem", borderTop: "1px dashed var(--border-color)", paddingTop: "0.5rem" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "red" }}>Warnings / Rules Triggered:</span>
                        <ul style={{ paddingLeft: "1.2rem", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                          {response.data.warnings.map((w: string, i: number) => (
                            <li key={i} style={{ color: "var(--ink-secondary)" }}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
