"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  localGetSeasons, 
  localGetQuests, 
  localSaveQuest, 
  localGetTasks,
  generateUUID, 
  DEFAULT_USER_ID 
} from "@/lib/cosmos";

export default function SeasonOverview() {
  const [activeSeason, setActiveSeason] = useState<any>(null);
  const [allQuests, setAllQuests] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [impactFilter, setImpactFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("active");

  // Create Major state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMajorTitle, setNewMajorTitle] = useState("");
  const [newMajorDesc, setNewMajorDesc] = useState("");
  const [newMajorCategory, setNewMajorCategory] = useState("Infrastructure Engineering");
  const [newMajorImpact, setNewMajorImpact] = useState("medium");
  const [newMajorEffort, setNewMajorEffort] = useState("Detailed"); // Basic | Detailed | Epic
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    try {
      const seasons = await localGetSeasons();
      const active = seasons.find((s) => s.status === "active");
      setActiveSeason(active);

      if (active) {
        const quests = await localGetQuests();
        setAllQuests(quests);

        const tasks = await localGetTasks();
        setAllTasks(tasks);
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

  const activeMajorsCount = allQuests.filter(
    (q) => !q.majorQuestId && q.seasonId === activeSeason?.id && q.status === "active"
  ).length;

  const handleOpenCreateModal = () => {
    if (activeMajorsCount >= 3) {
      setErrorMsg("Active Limit Exceeded: You cannot have more than 3 active Major Quests at any time. Please archive or complete an existing Major Quest first.");
    } else {
      setErrorMsg("");
    }
    setIsModalOpen(true);
  };

  const handleCreateMajorQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeMajorsCount >= 3) {
      setErrorMsg("Active Limit Exceeded: Please archive or complete an existing Major Quest first.");
      return;
    }

    try {
      const newMajor = {
        id: generateUUID(),
        seasonId: activeSeason.id,
        userId: DEFAULT_USER_ID,
        title: newMajorTitle.trim(),
        description: newMajorDesc.trim(),
        category: newMajorCategory,
        impact: newMajorImpact,
        effort: newMajorEffort,
        status: "active",
      };

      await localSaveQuest(newMajor);
      
      // Reset form
      setNewMajorTitle("");
      setNewMajorDesc("");
      setNewMajorEffort("Detailed");
      setIsModalOpen(false);
      
      window.dispatchEvent(new Event("local-db-update"));
    } catch (err) {
      console.error(err);
    }
  };

  // Archive or Pause action helper
  const handleUpdateStatus = async (questId: string, newStatus: string) => {
    const questToUpdate = allQuests.find((q) => q.id === questId);
    if (!questToUpdate) return;

    try {
      const updated = { ...questToUpdate, status: newStatus };
      await localSaveQuest(updated);
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

  if (!activeSeason) {
    return (
      <div className="card text-center p-8 border-2 border-dashed border-outline-variant rounded-xl raised-card">
        <h2 className="text-primary font-headline-md">No Active Season Established</h2>
        <p className="text-on-surface-variant font-body-md mt-2 mb-6">
          Navigate to the home dashboard to instantiate an operational Season boundary.
        </p>
        <Link href="/" className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md inline-block hover:bg-primary-container transition-colors">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  // Filter Major Quests based on selects (CR-5)
  const filteredMajors = allQuests.filter((q) => {
    const isMajor = !q.majorQuestId && q.seasonId === activeSeason.id;
    if (!isMajor) return false;

    const matchesCategory = categoryFilter === "All" || q.category === categoryFilter;
    const matchesImpact = impactFilter === "All" || q.impact === impactFilter;
    const matchesStatus = statusFilter === "All" || q.status === statusFilter;

    return matchesCategory && matchesImpact && matchesStatus;
  });

  // Calculate detailed progress stats for major quests
  const majorsWithStats = filteredMajors.map((major) => {
    const minors = allQuests.filter((q) => q.majorQuestId === major.id);
    const minorIds = minors.map((m) => m.id);
    
    // Tasks linked to minors or directly to major
    const questTasks = allTasks.filter(
      (t) => t.minorQuestId && (minorIds.includes(t.minorQuestId) || t.minorQuestId === major.id)
    );

    const totalCount = questTasks.length;
    const completedCount = questTasks.filter((t) => t.status === "completed").length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      ...major,
      totalCount,
      completedCount,
      progressPercent,
      minorsCount: minors.length,
      completedMinorsCount: minors.filter(m => {
        const mTasks = allTasks.filter(t => t.minorQuestId === m.id);
        return mTasks.length > 0 && mTasks.every(t => t.status === "completed");
      }).length
    };
  });

  // Split into Pivotal (Highest impact or first) and Auxiliary
  const pivotalQuest = majorsWithStats.find(m => m.status === "active") || majorsWithStats[0];
  const auxiliaryQuests = majorsWithStats.filter(m => m.id !== pivotalQuest?.id);

  // Overall Season Progress
  const activeSeasonTasks = allTasks.filter(t => {
    if (!t.minorQuestId) return false;
    const minor = allQuests.find(q => q.id === t.minorQuestId);
    return minor && minor.seasonId === activeSeason.id;
  });
  const seasonTotal = activeSeasonTasks.length;
  const seasonCompleted = activeSeasonTasks.filter(t => t.status === "completed").length;
  const overallSeasonProgress = seasonTotal > 0 ? Math.round((seasonCompleted / seasonTotal) * 100) : 0;

  // Calculate category averages
  const categories = [
    { name: "Financial Mechanics", count: allQuests.filter(q => !q.majorQuestId && q.category === "Financial Mechanics" && q.status === "completed").length, total: allQuests.filter(q => !q.majorQuestId && q.category === "Financial Mechanics").length },
    { name: "Infrastructure Engineering", count: allQuests.filter(q => !q.majorQuestId && q.category === "Infrastructure Engineering" && q.status === "completed").length, total: allQuests.filter(q => !q.majorQuestId && q.category === "Infrastructure Engineering").length },
    { name: "Relational Leadership", count: allQuests.filter(q => !q.majorQuestId && q.category === "Relational Leadership" && q.status === "completed").length, total: allQuests.filter(q => !q.majorQuestId && q.category === "Relational Leadership").length }
  ];

  return (
    <div className="flex flex-col gap-stack-lg">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-outline-variant/20">
        <div>
          <span className="font-label-md text-secondary tracking-widest uppercase font-bold">Season Ledger Matrix</span>
          <h2 className="font-display-lg-mobile md:font-display-lg text-primary mt-2">{activeSeason.title}</h2>
          <p className="font-body-lg text-on-surface-variant max-w-2xl mt-4">
            A time for deep rooting and upward growth. This season focuses on establishing structural habits and long-term vitality.
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end min-w-[200px]">
          <span className="font-label-sm text-on-surface-variant uppercase">Overall Season Progress</span>
          <div className="flex items-center gap-3 mt-1 w-full">
            <div className="w-full h-2 bg-surface-container-highest rounded-full inset-track overflow-hidden">
              <div className="bg-secondary h-full rounded-full transition-all duration-700" style={{ width: `${overallSeasonProgress}%` }}></div>
            </div>
            <span className="font-label-md text-primary font-bold">{overallSeasonProgress}%</span>
          </div>
          <button 
            className="bg-primary text-on-primary font-label-md px-5 py-2.5 rounded-lg hover:bg-primary-container transition-colors mt-4 w-full text-center" 
            onClick={handleOpenCreateModal}
          >
            + Create Major Quest
          </button>
        </div>
      </header>

      {/* Filter Options */}
      <section className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 raised-card flex flex-wrap gap-4 items-center">
        <span className="font-label-sm text-primary font-bold uppercase tracking-wider flex items-center gap-1.5 mr-2">
          <span className="material-symbols-outlined text-sm">filter_list</span>
          Filter Ledger:
        </span>
        
        <div className="flex flex-col gap-0.5 flex-1 min-w-[150px]">
          <select 
            className="w-full bg-surface border-0 border-b border-outline-variant focus:ring-0 focus:border-primary py-2 px-1 text-sm font-label-md"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Financial Mechanics">Financial Mechanics</option>
            <option value="Infrastructure Engineering">Infrastructure Engineering</option>
            <option value="Relational Leadership">Relational Leadership</option>
          </select>
        </div>

        <div className="flex flex-col gap-0.5 flex-1 min-w-[150px]">
          <select 
            className="w-full bg-surface border-0 border-b border-outline-variant focus:ring-0 focus:border-primary py-2 px-1 text-sm font-label-md"
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
          >
            <option value="All">All Impact Weightings</option>
            <option value="high">High Impact</option>
            <option value="medium">Medium Impact</option>
            <option value="low">Low Impact</option>
          </select>
        </div>

        <div className="flex flex-col gap-0.5 flex-1 min-w-[150px]">
          <select 
            className="w-full bg-surface border-0 border-b border-outline-variant focus:ring-0 focus:border-primary py-2 px-1 text-sm font-label-md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Lifecycles</option>
            <option value="active">Active Quests</option>
            <option value="completed">Completed Quests</option>
            <option value="archived">Archived Quests</option>
          </select>
        </div>
      </section>

      {/* Major Journey Map Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-md">
        
        {/* Pivotal Quest Card (Large 8-Column Banner) */}
        {pivotalQuest ? (
          <section className="md:col-span-8">
            <div className="quest-card main-quest-glow p-8 rounded-xl accent-line-gold relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-15">
                <span className="material-symbols-outlined text-[80px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full tracking-wider uppercase">
                    Pivotal Quest
                  </span>
                  <span className="text-on-surface-variant font-label-sm font-semibold">{pivotalQuest.category}</span>
                </div>
                <h3 className="font-headline-md text-primary mb-4 leading-tight">
                  <Link href={`/season/${activeSeason.id}/major/${pivotalQuest.id}`}>
                    {pivotalQuest.title}
                  </Link>
                </h3>
                <p className="font-body-md text-on-surface-variant mb-8 leading-relaxed max-w-xl">
                  {pivotalQuest.description}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between font-label-sm mb-2">
                    <span className="text-on-surface-variant">Progress toward completion</span>
                    <span className="text-primary font-bold">{pivotalQuest.progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 inset-track rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-tertiary-container to-secondary-container h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${pivotalQuest.progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex gap-4 flex-wrap text-sm font-label-md text-primary font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">account_tree</span>
                    {pivotalQuest.completedMinorsCount} / {pivotalQuest.minorsCount} Minor Quests Completed
                  </span>
                  <span className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">workspace_premium</span>
                    {pivotalQuest.impact.toUpperCase()} IMPACT
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="md:col-span-8 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant mb-2">auto_stories</span>
            <p className="font-headline-sm text-primary">No Active Major Quests Established</p>
            <p className="text-on-surface-variant text-sm mt-1 max-w-sm">Use the button above to define your next key milestone for this season.</p>
          </section>
        )}

        {/* Growth Categories (Right Column 4-Col) */}
        <aside className="md:col-span-4 flex flex-col gap-stack-md">
          <div className="quest-card p-6 rounded-xl h-full flex flex-col justify-between">
            <div>
              <h4 className="font-label-md text-primary mb-6 flex items-center gap-2 uppercase tracking-wider font-bold">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                Growth Categories
              </h4>
              <ul className="space-y-5">
                {categories.map((cat, idx) => {
                  const percent = cat.total > 0 ? Math.round((cat.count / cat.total) * 100) : 0;
                  return (
                    <li key={idx} className="space-y-2">
                      <div className="flex justify-between text-label-sm font-semibold">
                        <span className="text-on-surface-variant uppercase tracking-wider text-[11px] truncate max-w-[160px]">{cat.name}</span>
                        <span className="text-primary font-bold">{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 inset-track rounded-full overflow-hidden">
                        <div className="bg-tertiary h-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                      </div>
                      <div className="text-[10px] text-outline text-right font-mono">
                        {cat.count}/{cat.total} Quests Cleared
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="text-[11px] font-mono text-outline leading-tight border-t border-outline-variant/10 pt-4 mt-6">
              *Category matrix resets on seasonal boundaries.
            </div>
          </div>
        </aside>
      </div>

      {/* Auxiliary Quests Section */}
      <section className="mt-4">
        <h3 className="font-headline-sm text-primary mb-stack-md">Auxiliary Quests</h3>
        {auxiliaryQuests.length === 0 ? (
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 text-center opacity-60">
            <p className="text-sm font-label-md text-on-surface-variant italic">No secondary quests currently active.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
            {auxiliaryQuests.map((quest) => (
              <div 
                key={quest.id} 
                className="quest-card p-6 rounded-xl accent-line-sage relative overflow-hidden group hover:border-primary/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-label-sm text-[10px] uppercase text-secondary font-semibold">{quest.category}</span>
                    <span className="badge badge-slate text-[9px] uppercase tracking-tighter">{quest.status}</span>
                  </div>
                  <h4 className="font-headline-sm text-[18px] text-primary mb-3 leading-snug">
                    <Link href={`/season/${activeSeason.id}/major/${quest.id}`}>
                      {quest.title}
                    </Link>
                  </h4>
                  <p className="text-label-sm text-on-surface-variant mb-6 line-clamp-3 leading-relaxed">
                    {quest.description}
                  </p>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-outline-variant/10">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-on-surface-variant">Progress</span>
                    <span className="text-primary">{quest.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="bg-secondary h-full transition-all duration-700" style={{ width: `${quest.progressPercent}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Visual Explorer View Map Section (Static layout matching design) */}
      <section className="mt-8">
        <div className="bg-surface-container h-[300px] rounded-xl relative flex items-center justify-center overflow-hidden border border-outline-variant/10 shadow-inner">
          <img 
            alt="Journey map forest backdrop" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhI8cME-ZQR7VfzhvzXEHgySL03y3UqqCBzWYeRkiU4MXGR8Rjthu43vVk8rHRegILBHW0GyzNL6n-NJbPjYsIJoNfk_T8ov6PCfZusgAIcTe-KKv_AOnk94aYKLRysGo5PimQR_FsDlIRE_WDiUz0sctHMd4-2FupJBV7OUIKy6mEQrLFsSPUvPFlCY8_itiyLZW7AYxHNIQsybIftJFJY78V9WyCDX8j2GEmVjqoav-PBXpSAVpTENjZRIlIPJONqNjuYNjrbVyz"
          />
          <div className="relative text-center max-w-lg px-6 z-10">
            <h4 className="font-headline-md text-primary mb-2">The Path Ahead</h4>
            <p className="font-body-md text-on-surface-variant mb-6 text-sm">Your season map grows as you complete quests. Click milestones to reveal hidden lore and rewards.</p>
            <button className="bg-primary text-on-primary px-8 py-3 rounded-full font-label-md flex items-center gap-2 mx-auto hover:bg-primary-container transition-transform active:scale-95 shadow-md">
              <span className="material-symbols-outlined text-[18px]">map</span>
              Enter Exploratory View
            </button>
          </div>
          {/* Decorative nodes */}
          <div className="absolute top-1/4 left-1/4 w-2.5 h-2.5 bg-secondary rounded-full animate-pulse shadow-[0_0_10px_#fed488]"></div>
          <div className="absolute bottom-1/3 right-1/4 w-2.5 h-2.5 bg-on-tertiary-container rounded-full opacity-60"></div>
          <div className="absolute top-1/2 right-1/2 w-2.5 h-2.5 bg-on-tertiary-container rounded-full opacity-40"></div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M25,25 L50,50 L75,66" fill="none" stroke="#442a22" strokeDasharray="2,2" strokeWidth="0.2"></path>
          </svg>
        </div>
      </section>

      {/* Create Major Modal (Stitch Create / Edit Quest Page Form Design) */}
      {isModalOpen && (
        <div className="clover-modal-overlay z-[2100]">
          <div className="clover-modal w-full max-w-[680px] bg-surface-container-low p-8 rounded-xl border border-outline-variant/30 text-left raised-card parchment-texture overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-6">
              <h3 className="font-headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">history_edu</span>
                Draft New Major Quest
              </h3>
              <button className="text-on-surface-variant hover:text-primary" onClick={() => setIsModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {errorMsg ? (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg font-body-md">
                <p className="font-semibold">{errorMsg}</p>
                <div className="flex justify-end mt-4">
                  <button className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md" onClick={() => setIsModalOpen(false)}>Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateMajorQuest} className="space-y-6">
                
                {/* Title */}
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-2 font-bold uppercase tracking-wider">Quest Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface-container border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-xl font-headline-sm py-3 px-2 transition-all placeholder:text-outline-variant/50" 
                    placeholder="e.g. Launch the flag community project..."
                    value={newMajorTitle}
                    onChange={(e) => setNewMajorTitle(e.target.value)}
                    required 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category select */}
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-2 font-bold uppercase tracking-wider">Category Branch</label>
                    <select 
                      className="w-full bg-surface-container border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 font-body-md py-3 px-2 text-primary"
                      value={newMajorCategory}
                      onChange={(e) => setNewMajorCategory(e.target.value)}
                    >
                      <option value="Financial Mechanics">Financial Mechanics</option>
                      <option value="Infrastructure Engineering">Infrastructure Engineering</option>
                      <option value="Relational Leadership">Relational Leadership</option>
                    </select>
                  </div>

                  {/* Impact Weighting */}
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-2 font-bold uppercase tracking-wider">Impact Weighting</label>
                    <select 
                      className="w-full bg-surface-container border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 font-body-md py-3 px-2 text-primary"
                      value={newMajorImpact}
                      onChange={(e) => setNewMajorImpact(e.target.value)}
                    >
                      <option value="high">High Impact</option>
                      <option value="medium">Medium Impact</option>
                      <option value="low">Low Impact</option>
                    </select>
                  </div>
                </div>

                {/* SMART Description */}
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-2 font-bold uppercase tracking-wider">The SMART Objective</label>
                  <p className="text-xs text-on-surface-variant italic mb-2">Define your clear, measurable objective. What does the destination look like?</p>
                  <textarea 
                    className="w-full bg-surface-container border-2 border-dashed border-outline-variant rounded-lg p-4 font-body-lg text-body-lg resize-none placeholder:text-outline-variant/60"
                    placeholder="By the end of this season, I will have completed..."
                    value={newMajorDesc}
                    onChange={(e) => setNewMajorDesc(e.target.value)}
                    rows={4}
                    required 
                  />
                </div>

                {/* Level of Effort selection cards */}
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-3 font-bold uppercase tracking-wider">Level of Effort</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all group ${
                        newMajorEffort === "Basic" 
                          ? "border-secondary bg-secondary-container/20 font-bold" 
                          : "border-outline-variant/30 hover:border-secondary hover:bg-surface-container-high"
                      }`}
                      onClick={() => setNewMajorEffort("Basic")}
                    >
                      <span className="font-headline-sm text-on-surface-variant group-hover:text-primary mb-1">Basic</span>
                      <p className="text-[11px] text-on-surface-variant leading-snug">Short-term focus. Done in a single sitting or day. [100 XP]</p>
                    </button>
                    <button
                      type="button"
                      className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all group ${
                        newMajorEffort === "Detailed" 
                          ? "border-secondary bg-secondary-container/20 font-bold" 
                          : "border-outline-variant/30 hover:border-secondary hover:bg-surface-container-high"
                      }`}
                      onClick={() => setNewMajorEffort("Detailed")}
                    >
                      <span className="font-headline-sm text-primary mb-1">Detailed</span>
                      <p className="text-[11px] text-on-surface-variant leading-snug">Substantial work. Multiple milestones. [450 XP]</p>
                    </button>
                    <button
                      type="button"
                      className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all group ${
                        newMajorEffort === "Epic" 
                          ? "border-secondary bg-secondary-container/20 font-bold" 
                          : "border-outline-variant/30 hover:border-secondary hover:bg-surface-container-high"
                      }`}
                      onClick={() => setNewMajorEffort("Epic")}
                    >
                      <span className="font-headline-sm text-on-surface-variant group-hover:text-primary mb-1">Epic</span>
                      <p className="text-[11px] text-on-surface-variant leading-snug">A monumental feat. Spans weeks and defines your season. [1000 XP]</p>
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <footer className="flex flex-col md:flex-row gap-4 pt-6 border-t border-outline-variant/20">
                  <button 
                    type="submit" 
                    className="flex-1 bg-primary text-on-primary font-headline-sm py-3 rounded-lg hover:bg-primary-container transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    Seal Quest in Ledger
                  </button>
                  <button 
                    type="button" 
                    className="flex-1 border-2 border-secondary text-secondary font-headline-sm py-3 rounded-lg hover:bg-secondary-container/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel Draft
                  </button>
                </footer>

              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
