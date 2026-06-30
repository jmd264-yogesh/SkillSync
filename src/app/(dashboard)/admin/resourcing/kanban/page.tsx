"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Clock, DollarSign, User, RefreshCw, Search } from "lucide-react";
import { getProjectResourcingStatuses, saveProjectResourcingStatus, getKanbanProjects, getResourceNamesForRole, getCandidatesForKanbanRole, type KanbanCandidate, type KanbanResourceName } from "@/server/actions/kanban-resourcing";

// The 8 requested statuses
const STATUSES = [
  "Opportunity Inception",
  "Make It Real",
  "Build The Proposition",
  "Scoping Approval",
  "Propose & Negotiate",
  "SoW Pending Signature",
  "Deal Won",
  "Deal Lost"
] as const;

type StatusType = typeof STATUSES[number];

interface Allocation {
  role: string;
  count: number;
}

interface Project {
  id: string;
  code: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  weeks: number;
  status: StatusType;
  // Detail view fields
  client: string;
  description: string;
  budget: string;
  owner: string;
  confidence: string;
  allocations: Allocation[];
}

// Helper: get YYYY-MM-DD string for a date offset by `days` from today
function offsetDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

const STATUS_JUSTIFICATIONS: Record<"Approved" | "Rejected", readonly { id: string; label: string }[]> = {
  Approved: [
    { id: "skill", label: "Skill Match" },
    { id: "competency", label: "Competency Level" },
    { id: "availability", label: "Immediate Availability" },
    { id: "experience", label: "Relevant Experience" },
    { id: "coeAlignment", label: "CoE Alignment" }
  ],
  Rejected: [
    { id: "availability", label: "Allocation Conflict" },
    { id: "competency", label: "Competency Gap" },
    { id: "billability", label: "Billability / Cost Limit" },
    { id: "evidence", label: "No Evidenced Portfolio" }
  ]
};


export default function KanbanPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Default: today → today + 14 days (current + next week)
  const [filterStartDate, setFilterStartDate] = useState(() => offsetDateStr(0));
  const [filterEndDate, setFilterEndDate] = useState(() => offsetDateStr(14));
  const [isLoading, setIsLoading] = useState(true);

  // State to manage approved/rejected state per project and individual resource
  const [projectDecisions, setProjectDecisions] = useState<Record<string, Record<string, "Approved" | "Rejected">>>({});
  const [projectJustifications, setProjectJustifications] = useState<Record<string, Record<string, string[]>>>({});
  const [swappedResources, setSwappedResources] = useState<Record<string, Record<string, string>>>({});
  const [negotiatedProjects, setNegotiatedProjects] = useState<Record<string, boolean>>({});
  const [submittedProjects, setSubmittedProjects] = useState<Record<string, boolean>>({});
  
  const [tempDecisions, setTempDecisions] = useState<Record<string, "Approved" | "Rejected">>({});
  const [tempJustifications, setTempJustifications] = useState<Record<string, string[]>>({});
  const [tempSwaps, setTempSwaps] = useState<Record<string, string>>({});

  // State for swapping dialog
  const [swappingResource, setSwappingResource] = useState<{ resourceKey: string; role: string; currentName: string } | null>(null);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");

  // Filter for decision states: All, Pending, Approved, Swapped, Negotiating
  const [decisionFilter, setDecisionFilter] = useState<"All" | "Pending" | "Approved" | "Swapped" | "Negotiating">("All");

  // Empty by default — filled exclusively from DB on mount
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // Cache: resource names per project -> role (from DB)
  const [resourceNamesCache, setResourceNamesCache] = useState<Record<string, Record<string, KanbanResourceName[]>>>({});
  // Cache: swap candidates per project+role (from DB matching engine)
  const [swapCandidatesCache, setSwapCandidatesCache] = useState<KanbanCandidate[]>([]);
  const [swapCandidatesLoading, setSwapCandidatesLoading] = useState(false);

  // Fetch resourcing state from database on page load
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [data, fetchedProjects] = await Promise.all([
          getProjectResourcingStatuses(),
          getKanbanProjects()
        ]);

        // Always replace with DB data (even if empty — no mock fallback)
        setProjectsList(fetchedProjects as Project[]);

        const decisions: Record<string, Record<string, "Approved" | "Rejected">> = {};
        const justifications: Record<string, Record<string, string[]>> = {};
        const swaps: Record<string, Record<string, string>> = {};
        const negotiated: Record<string, boolean> = {};
        const submitted: Record<string, boolean> = {};

        data.forEach((status) => {
          submitted[status.projectId] = status.isSubmitted;
          negotiated[status.projectId] = status.isNegotiated;

          decisions[status.projectId] = {};
          justifications[status.projectId] = {};
          swaps[status.projectId] = {};

          status.resourceDecisions.forEach((d) => {
            decisions[status.projectId]![d.resourceKey] = d.decision as "Approved" | "Rejected";
            try {
              justifications[status.projectId]![d.resourceKey] = JSON.parse(d.justifications);
            } catch {
              justifications[status.projectId]![d.resourceKey] = [];
            }
          });

          status.resourceSwaps.forEach((s) => {
            swaps[status.projectId]![s.resourceKey] = s.swappedName;
          });
        });

        setProjectDecisions(decisions);
        setProjectJustifications(justifications);
        setSwappedResources(swaps);
        setNegotiatedProjects(negotiated);
        setSubmittedProjects(submitted);
      } catch (err) {
        console.error("Failed to load resourcing decisions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleOpenProject = async (project: Project) => {
    setSelectedProject(project);
    setTempDecisions(projectDecisions[project.id] || {});
    setTempJustifications(projectJustifications[project.id] || {});
    setTempSwaps(swappedResources[project.id] || {});

    // Fetch resource names from DB if not already cached
    if (!resourceNamesCache[project.id]) {
      try {
        const namesByRole: Record<string, KanbanResourceName[]> = {};
        await Promise.all(
          project.allocations.map(async (alloc) => {
            const names = await getResourceNamesForRole(project.id, alloc.role, alloc.count);
            namesByRole[alloc.role] = names;
          })
        );
        setResourceNamesCache((prev) => ({ ...prev, [project.id]: namesByRole }));
      } catch (err) {
        console.error("Failed to fetch resource names:", err);
      }
    }
  };

  const handleDecisionChange = (resourceKey: string, status: "Approved" | "Rejected") => {
    setTempDecisions((prev) => ({
      ...prev,
      [resourceKey]: status
    }));
  };

  const handleJustificationToggle = (resourceKey: string, justId: string) => {
    setTempJustifications((prev) => {
      const current = prev[resourceKey] || [];
      if (current.includes(justId)) {
        return {
          ...prev,
          [resourceKey]: current.filter((id) => id !== justId)
        };
      } else {
        return {
          ...prev,
          [resourceKey]: [...current, justId]
        };
      }
    });
  };

  const handleOpenSwap = async (resourceKey: string, role: string, currentName: string) => {
    setSwappingResource({ resourceKey, role, currentName });
    setSwapSearchQuery("");
    setSwapCandidatesCache([]);
    setSwapCandidatesLoading(true);

    // Fetch real candidates from DB matching engine
    try {
      if (selectedProject) {
        const candidates = await getCandidatesForKanbanRole(selectedProject.id, role);
        setSwapCandidatesCache(candidates);
      }
    } catch (err) {
      console.error("Failed to fetch swap candidates:", err);
    } finally {
      setSwapCandidatesLoading(false);
    }
  };

  const handleConfirmSwap = (newName: string) => {
    if (!swappingResource) return;
    setTempSwaps((prev) => ({
      ...prev,
      [swappingResource.resourceKey]: newName
    }));
    setSwappingResource(null);
  };

  const handleNegotiateProject = async () => {
    if (!selectedProject) return;

    // Optimistic UI updates
    setNegotiatedProjects((prev) => ({
      ...prev,
      [selectedProject.id]: true
    }));
    setSubmittedProjects((prev) => ({
      ...prev,
      [selectedProject.id]: true
    }));
    setSelectedProject(null);

    try {
      const decisionsInput: Record<string, { decision: "Approved" | "Rejected"; justifications: string[] }> = {};
      Object.entries(tempDecisions).forEach(([key, dec]) => {
        decisionsInput[key] = {
          decision: dec,
          justifications: tempJustifications[key] || []
        };
      });

      await saveProjectResourcingStatus({
        projectId: selectedProject.id,
        isSubmitted: true,
        isNegotiated: true,
        decisions: decisionsInput,
        swaps: tempSwaps
      });
    } catch (err) {
      console.error("Failed to save negotiation status:", err);
    }
  };

  const handleSubmitDecisions = async () => {
    if (!selectedProject) return;

    // Optimistic UI updates
    setProjectDecisions((prev) => ({
      ...prev,
      [selectedProject.id]: tempDecisions
    }));
    setProjectJustifications((prev) => ({
      ...prev,
      [selectedProject.id]: tempJustifications
    }));
    setSwappedResources((prev) => ({
      ...prev,
      [selectedProject.id]: tempSwaps
    }));
    setNegotiatedProjects((prev) => ({
      ...prev,
      [selectedProject.id]: false
    }));
    setSubmittedProjects((prev) => ({
      ...prev,
      [selectedProject.id]: true
    }));
    setSelectedProject(null);

    try {
      const decisionsInput: Record<string, { decision: "Approved" | "Rejected"; justifications: string[] }> = {};
      Object.entries(tempDecisions).forEach(([key, dec]) => {
        decisionsInput[key] = {
          decision: dec,
          justifications: tempJustifications[key] || []
        };
      });

      await saveProjectResourcingStatus({
        projectId: selectedProject.id,
        isSubmitted: true,
        isNegotiated: false,
        decisions: decisionsInput,
        swaps: tempSwaps
      });
    } catch (err) {
      console.error("Failed to save resourcing decisions:", err);
    }
  };

  // Filter projects by start date within selected range
  const dateFilteredProjects = projectsList.filter((proj) => {
    return proj.startDate >= filterStartDate && proj.startDate <= filterEndDate;
  });

  // Apply decision status filter
  const filteredProjects = dateFilteredProjects.filter((proj) => {
    const isSubmitted = submittedProjects[proj.id];
    const isNegotiated = negotiatedProjects[proj.id];
    const swaps = swappedResources[proj.id] || {};
    
    let currentStatus: "Pending" | "Approved" | "Swapped" | "Negotiating" = "Pending";
    if (isSubmitted) {
      if (isNegotiated) {
        currentStatus = "Negotiating";
      } else if (Object.keys(swaps).length > 0) {
        currentStatus = "Swapped";
      } else {
        currentStatus = "Approved";
      }
    }

    if (decisionFilter === "All") return true;
    return currentStatus === decisionFilter;
  });

  return (
    <div className="flex flex-col gap-6 min-w-0 w-full overflow-hidden">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <PageHeader
          title="Pipeline Kanban Board"
          description="Visual pipeline overview of opportunities commencing during the selected period."
        />
        
        <div className="flex flex-wrap items-center gap-4 self-start xl:self-auto shrink-0">
          {/* Decision Filter Badges */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80">
            {(["All", "Pending", "Approved", "Swapped", "Negotiating"] as const).map((filter) => {
              const isActive = decisionFilter === filter;
              let badgeStyle = "text-slate-600 hover:text-slate-900 bg-transparent";
              
              if (isActive) {
                if (filter === "All") badgeStyle = "bg-white text-slate-800 shadow-xs border border-slate-200/30";
                if (filter === "Pending") badgeStyle = "bg-slate-700 text-white shadow-xs";
                if (filter === "Approved") badgeStyle = "bg-emerald-600 text-white shadow-xs";
                if (filter === "Swapped") badgeStyle = "bg-blue-600 text-white shadow-xs";
                if (filter === "Negotiating") badgeStyle = "bg-amber-600 text-white shadow-xs";
              }

              return (
                <button
                  key={filter}
                  onClick={() => setDecisionFilter(filter)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer ${badgeStyle}`}
                >
                  {filter === "Negotiating" ? "Negotiate" : filter}
                </button>
              );
            })}
          </div>

          {/* Date Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Start:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-semibold cursor-pointer"
              />
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">End:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-semibold cursor-pointer"
              />
            </div>
            <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ml-1">
              {filteredProjects.length} Projects
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board Container */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-6 -mx-6 px-6">
          {STATUSES.map((s) => (
            <div key={s} className="flex-1 min-w-[280px] max-w-[320px] rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-6 bg-slate-200 rounded-full animate-pulse" />
              </div>
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse mt-1" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : projectsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <span className="text-4xl">📋</span>
          <p className="text-sm font-semibold">No pipeline requests found in the database.</p>
          <p className="text-xs">Add pipeline requests to see them appear on this board.</p>
        </div>
      ) : (
      <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-6 -mx-6 px-6">
        {STATUSES.map((status) => {
          const statusProjects = filteredProjects.filter((p) => p.status === status);

          // Customize headers/indicators per column category for richer aesthetics
          const isWon = status === "Deal Won";
          const isLost = status === "Deal Lost";
          
          let headerBadgeBg = "bg-slate-200 text-slate-800";
          let columnBorder = "border-slate-200/60";
          let columnBg = "bg-slate-50/50";
          
          if (isWon) {
            headerBadgeBg = "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20";
            columnBorder = "border-emerald-100";
            columnBg = "bg-emerald-50/20";
          } else if (isLost) {
            headerBadgeBg = "bg-rose-500/10 text-rose-700 border border-rose-500/20";
            columnBorder = "border-rose-100";
            columnBg = "bg-rose-50/20";
          } else if (status === "Opportunity Inception" || status === "Make It Real") {
            headerBadgeBg = "bg-indigo-500/10 text-indigo-700 border border-indigo-500/20";
          } else {
            headerBadgeBg = "bg-amber-50/50 text-amber-700 border border-amber-500/20";
          }

          return (
            <div
              key={status}
              className={`flex-1 min-w-[280px] max-w-[320px] rounded-xl border ${columnBorder} ${columnBg} p-4 flex flex-col gap-3 shadow-sm`}
            >
              {/* Column Header */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 text-sm tracking-tight leading-snug">
                  {status}
                </h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${headerBadgeBg} shrink-0`}>
                  {statusProjects.length}
                </span>
              </div>

              {/* Cards list */}
              <div className="flex-1 flex flex-col gap-2.5">
                {statusProjects.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400">
                    <p className="text-[11px] font-medium">No projects starting</p>
                  </div>
                ) : (
                  statusProjects.map((project) => {
                    const isSubmitted = submittedProjects[project.id];
                    const isNegotiated = negotiatedProjects[project.id];
                    const swaps = swappedResources[project.id] || {};
                    
                    let cardBgClass = "bg-white border-slate-200 hover:border-primary/50";
                    if (isSubmitted) {
                      const hasSwaps = Object.keys(swaps).length > 0;
                      if (isNegotiated || hasSwaps) {
                        cardBgClass = "bg-amber-50/90 border-amber-300/80 hover:border-amber-400/90 hover:bg-amber-100/50 shadow-xs";
                      } else {
                        cardBgClass = "bg-emerald-50/90 border-emerald-300/80 hover:border-emerald-400/90 hover:bg-emerald-100/50 shadow-xs";
                      }
                    }

                    return (
                      <Card
                        key={project.id}
                        onClick={() => handleOpenProject(project)}
                        className={`cursor-pointer border transition-all duration-300 hover:shadow-md group ${cardBgClass}`}
                      >
                        <CardContent className="p-3.5 flex flex-col gap-2">
                          {/* Project Code & Name */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-primary transition-colors">
                              {project.code}
                            </span>
                            <h4 className="font-semibold text-slate-800 text-[13px] leading-tight group-hover:text-primary transition-colors line-clamp-1 mt-0.5">
                              {project.name}
                            </h4>
                          </div>

                          {/* Project Info Summary */}
                          <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>Start: <strong className="text-slate-700">{project.startDate}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>Duration: <strong className="text-slate-700">{project.weeks} Weeks</strong></span>
                            </div>
                          </div>

                          {/* Allocations Indicator (Badge design, showing all roles and counts directly) */}
                          <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-slate-100/60">
                            {project.allocations.map((alloc) => (
                              <div
                                key={alloc.role}
                                className="inline-flex items-center gap-1 bg-slate-100/80 hover:bg-slate-200/80 transition-colors border border-slate-200/80 rounded-md px-1.5 py-0.5 text-[9px] text-slate-600 font-semibold max-w-[150px] truncate"
                                title={`${alloc.role}: ${alloc.count} allocated`}
                              >
                                <span className="truncate">{alloc.role}</span>
                                <span className="bg-primary text-white rounded-sm px-1 py-px text-[8px] font-extrabold">
                                  {alloc.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Details Dialog */}
      <Dialog open={selectedProject !== null} onOpenChange={(open) => !open && setSelectedProject(null)}>
        {selectedProject && (
          <DialogContent className="sm:max-w-[550px] p-6 gap-6 rounded-2xl bg-white border border-slate-200 max-h-[85vh] overflow-y-auto">
            <DialogHeader className="gap-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">
                  {selectedProject.code}
                </span>
                <Badge variant={selectedProject.status === "Deal Won" ? "default" : selectedProject.status === "Deal Lost" ? "destructive" : "outline"} className="text-[11px] font-semibold bg-primary/5 text-primary border border-primary/20">
                  {selectedProject.status}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-primary leading-snug mt-1">
                {selectedProject.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Resourcing & Pipeline Decisions
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5 text-sm text-slate-700">
              {/* Client & Description */}
              <div className="flex flex-col gap-1.5 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client Context</span>
                <span className="font-semibold text-slate-800 text-[13px]">{selectedProject.client}</span>
                <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{selectedProject.description}</p>
              </div>

              {/* Grid with basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 border border-slate-100 rounded-xl p-2.5 bg-white">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <DollarSign className="h-3 w-3 text-primary" /> Est. Budget
                  </span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5">{selectedProject.budget}</span>
                </div>
                <div className="flex flex-col gap-1 border border-slate-100 rounded-xl p-2.5 bg-white">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <User className="h-3 w-3 text-primary" /> Owner
                  </span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5">{selectedProject.owner}</span>
                </div>
                <div className="flex flex-col gap-1 border border-slate-100 rounded-xl p-2.5 bg-white">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Calendar className="h-3 w-3 text-primary" /> Start Date
                  </span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5">{selectedProject.startDate}</span>
                </div>
                <div className="flex flex-col gap-1 border border-slate-100 rounded-xl p-2.5 bg-white">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Clock className="h-3 w-3 text-primary" /> Duration
                  </span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5">{selectedProject.weeks} Weeks</span>
                </div>
              </div>

              {/* Resource Allocations with Names & Decision Options */}
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Configure Resources</span>
                <div className="flex flex-col gap-4">
                  {selectedProject.allocations.map((alloc) => (
                    <div key={alloc.role} className="flex flex-col gap-3 border border-slate-200/60 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-xs text-slate-700 tracking-wide">{alloc.role}</span>
                        <span className="bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {alloc.count} Needed
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        {Array.from({ length: alloc.count }).map((_, idx) => {
                          const resourceKey = `${alloc.role}-${idx}`;
                          const swappedName = tempSwaps[resourceKey];
                          const cachedNames = resourceNamesCache[selectedProject.id]?.[alloc.role];
                          const resolvedName = swappedName
                            || cachedNames?.[idx]?.name
                            || `${alloc.role} Resource ${idx + 1}`;
                          const currentStatus = tempDecisions[resourceKey];

                          return (
                            <div key={resourceKey} className="flex flex-col gap-3 bg-white border border-slate-200/70 p-3 rounded-lg">
                              <div className="flex items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-700 text-xs">{resolvedName}</span>
                                  {swappedName && (
                                    <span className="text-[8px] font-extrabold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                      Swapped
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                  {(["Approved", "Rejected"] as const).map((status) => {
                                    const isSelected = currentStatus === status;
                                    let btnClass = "";
                                    
                                    if (status === "Approved") {
                                      btnClass = isSelected 
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                                        : "border-emerald-200 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50";
                                    } else if (status === "Rejected") {
                                      btnClass = isSelected 
                                        ? "bg-rose-600 text-white border-rose-600 shadow-xs" 
                                        : "border-rose-200 text-rose-700 bg-rose-50/30 hover:bg-rose-50";
                                    }

                                    return (
                                      <button
                                        key={status}
                                        onClick={() => handleDecisionChange(resourceKey, status)}
                                        className={`text-[10px] px-2.5 py-1 border rounded-md font-bold transition-all duration-150 cursor-pointer ${btnClass}`}
                                      >
                                        {status === "Rejected" ? "Reject" : "Approve"}
                                      </button>
                                    );
                                  })}

                                  {/* Swap Button */}
                                  <button
                                    onClick={() => handleOpenSwap(resourceKey, alloc.role, resolvedName)}
                                    className="text-[10px] px-2.5 py-1 border border-blue-200 text-blue-700 bg-blue-50/30 hover:bg-blue-50 rounded-md font-bold transition-all duration-150 cursor-pointer flex items-center gap-1"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    Swap
                                  </button>
                                </div>
                              </div>

                              {/* Justification select */}
                              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Justification reasons:</span>
                                <div className="flex flex-wrap gap-1">
                                  {(STATUS_JUSTIFICATIONS[currentStatus || "Approved"]).map((just) => {
                                    const selectedJusts = tempJustifications[resourceKey] || [];
                                    const isJustSelected = selectedJusts.includes(just.id);
                                    
                                    const activeStyle = isJustSelected 
                                      ? "bg-slate-800 text-white border-slate-800" 
                                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100";
                                      
                                    return (
                                      <button
                                        key={just.id}
                                        onClick={() => handleJustificationToggle(resourceKey, just.id)}
                                        className={`text-[9px] px-2 py-0.5 border rounded-md font-semibold transition-all cursor-pointer ${activeStyle}`}
                                      >
                                        {just.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>



              {/* Submit / Negotiate Buttons */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  onClick={handleNegotiateProject}
                  className="px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50/50 hover:bg-amber-100/80 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Negotiate Project
                </button>
                <button
                  onClick={handleSubmitDecisions}
                  className="px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Submit Resourcing
                </button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Swap Resource Dialog */}
      <Dialog open={swappingResource !== null} onOpenChange={(open) => !open && setSwappingResource(null)}>
        {swappingResource && (
          <DialogContent className="sm:max-w-[420px] p-5 gap-4 rounded-2xl bg-white border border-slate-200 shadow-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader className="gap-1">
              <DialogTitle className="text-base font-bold text-primary">
                Swap Resource: {swappingResource.currentName}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Select a candidate for the {swappingResource.role} role.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3.5">
              {/* Search input with search icon wrapper */}
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee name..."
                  value={swapSearchQuery}
                  onChange={(e) => setSwapSearchQuery(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 w-full focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-medium"
                />
              </div>

              {/* Candidates list (Best fit to Worst fit) */}
              <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                {swapCandidatesLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <span className="text-xs font-medium animate-pulse">Loading candidates...</span>
                  </div>
                ) : swapCandidatesCache.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <span className="text-xs font-medium">No candidates found for this role.</span>
                  </div>
                ) : (
                  swapCandidatesCache
                    .map((candidate, originalIdx) => ({ ...candidate, rank: originalIdx + 1 }))
                    .filter((c) => c.name.toLowerCase().includes(swapSearchQuery.toLowerCase()))
                    .map((candidate) => {
                      const isRankBest = candidate.rank === 1;
                      const isRankGood = candidate.rank > 1 && candidate.rank <= 3;

                      let rankBadge = "bg-slate-100 text-slate-600 border border-slate-200/50";
                      if (isRankBest) rankBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200/80";
                      else if (isRankGood) rankBadge = "bg-blue-50 text-blue-700 border border-blue-200/80";

                      return (
                        <button
                          key={candidate.employeeId}
                          onClick={() => handleConfirmSwap(candidate.name)}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:border-primary/50 hover:bg-slate-50/50 transition-all text-left w-full cursor-pointer group"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">
                              {candidate.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {candidate.jobName || swappingResource?.role}
                            </span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${rankBadge}`}>
                            #{candidate.rank} ({candidate.fitScore}%)
                          </span>
                        </button>
                      );
                    })
                )}
              </div>

            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

