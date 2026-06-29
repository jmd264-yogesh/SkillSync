"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SERVICE_LINES, CLIENT_TIER_LABELS, SOLUTION_TYPES } from "@/lib/constants";
import { markDealLost, updatePipelineContext } from "@/server/actions/pipeline";
import {
  AlertTriangle, Calendar, Clock, Star, Layers, Building2,
  XCircle, CheckCircle2, AlertCircle, ChevronRight,
} from "lucide-react";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";

// ─── Badge helpers ────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const cfg =
    confidence >= 80 ? { color: "text-green-700 bg-green-50 border-green-200", label: `${confidence}% confidence` }
    : confidence >= 40 ? { color: "text-amber-700 bg-amber-50 border-amber-200", label: `${confidence}% confidence` }
    : { color: "text-red-700 bg-red-50 border-red-200", label: `${confidence}% confidence` };
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cfg.color)}>
      {cfg.label}
    </Badge>
  );
}

function ClientTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const cfg: Record<string, string> = {
    GOLD:   "text-yellow-700 bg-yellow-50 border-yellow-300",
    SILVER: "text-slate-600 bg-slate-50 border-slate-300",
    BRONZE: "text-orange-700 bg-orange-50 border-orange-200",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cfg[tier] ?? "")}>
      <Star className="h-2.5 w-2.5 mr-0.5" />
      {CLIENT_TIER_LABELS[tier] ?? tier}
    </Badge>
  );
}

function SolutionBadge({ solution, priority }: { solution: string | null; priority: number }) {
  if (!solution) return null;
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 bg-blue-50 border-blue-200">
      <Layers className="h-2.5 w-2.5 mr-0.5" />
      #{priority !== 99 ? priority : "?"} {solution}
    </Badge>
  );
}

function HiringAlertBadge({ monthsUntilStart }: { monthsUntilStart: number | null }) {
  if (monthsUntilStart === null || monthsUntilStart >= 6) return null;
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-700 bg-red-50 border-red-200">
      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
      Hire now ({monthsUntilStart.toFixed(1)}mo)
    </Badge>
  );
}

// ─── Deal Lost Dialog ─────────────────────────────────────────

interface DealLostDialogProps {
  request: PipelineRequestWithContext;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function DealLostDialog({ request, onClose, onConfirm }: DealLostDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm(request.id);
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            Mark Deal as Lost
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-700">
            You are marking <span className="font-semibold">{request.client ?? "this deal"}</span> as lost.
            This action will:
          </p>
          <ul className="space-y-1.5 pl-4">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-600">Archive this pipeline request</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-600">Release all reserved allocations back to the bench pool</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-600">Update resource availability for future matching</span>
            </li>
          </ul>
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            This will update the deal status to LOST. Allocation records are soft-deleted and can be reviewed in the Allocation Board.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Processing…" : "Confirm Deal Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Context Edit Sheet ───────────────────────────────────────

interface ContextEditDialogProps {
  request: PipelineRequestWithContext;
  onClose: () => void;
  onSaved: () => void;
}

function ContextEditDialog({ request, onClose, onSaved }: ContextEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [clientTier, setClientTier] = useState(request.clientTier ?? "");
  const [isNewClient, setIsNewClient] = useState(request.isNewClient);
  const [months, setMonths] = useState(String(request.clientRelationshipMonths ?? ""));
  const [serviceLine, setServiceLine] = useState(request.serviceLine ?? "");

  function handleSave() {
    startTransition(async () => {
      try {
        await updatePipelineContext({
          pipelineRequestId: request.id,
          clientTier: (clientTier as "GOLD" | "SILVER" | "BRONZE") || undefined,
          isNewClient,
          clientRelationshipMonths: months ? parseInt(months) : undefined,
          serviceLine: serviceLine || undefined,
        });
        toast.success("Pipeline context updated");
        onSaved();
        onClose();
      } catch {
        toast.error("Failed to update context");
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Pipeline Context</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm font-medium text-slate-700">
            {request.client ?? "Unnamed deal"}
          </p>
          <Separator />

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Client Tier</Label>
            <Select value={clientTier} onValueChange={(v) => setClientTier(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOLD">Gold</SelectItem>
                <SelectItem value="SILVER">Silver</SelectItem>
                <SelectItem value="BRONZE">Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Client Status</Label>
            <div className="flex gap-3">
              {[{ label: "New Client", value: true }, { label: "Existing Client", value: false }].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setIsNewClient(opt.value)}
                  className={cn(
                    "flex-1 text-sm py-2 rounded-md border transition-colors",
                    isNewClient === opt.value
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Client Relationship (months)</Label>
            <Input
              type="number"
              min={0}
              max={600}
              placeholder="e.g. 24"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Service Line (Stage 2)</Label>
            <Select value={serviceLine} onValueChange={(v) => setServiceLine(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select service line" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_LINES.map((sl) => (
                  <SelectItem key={sl} value={sl}>{sl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save Context"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pipeline Row Card ────────────────────────────────────────

interface PipelineRowProps {
  request: PipelineRequestWithContext;
  onEdit: (r: PipelineRequestWithContext) => void;
  onLost: (r: PipelineRequestWithContext) => void;
}

function PipelineRow({ request: r, onEdit, onLost }: PipelineRowProps) {
  const isStage1 = !r.sowSigned && (!r.dealStage || ["LEAD", "PROPOSAL"].includes(r.dealStage.toUpperCase()));
  const isStage2 = !r.sowSigned && r.dealStage && ["SOW_PENDING"].includes(r.dealStage.toUpperCase());

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {r.client ?? "Unnamed Deal"}
              </span>
              {r.isNewClient && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-700 bg-purple-50 border-purple-200">
                  <Building2 className="h-2.5 w-2.5 mr-0.5" />
                  New Client
                </Badge>
              )}
              {isStage1 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 bg-slate-50">
                  Stage 1 — Inception
                </Badge>
              )}
              {isStage2 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-700 bg-blue-50 border-blue-200">
                  Stage 2 — Make It Real
                </Badge>
              )}
              {r.sowSigned && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 bg-green-50 border-green-200">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  SOW Signed
                </Badge>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <ConfidenceBadge confidence={r.confidence} />
              <ClientTierBadge tier={r.clientTier} />
              <SolutionBadge solution={r.solution} priority={r.solutionPriority} />
              <HiringAlertBadge monthsUntilStart={r.monthsUntilStart} />
              {r.serviceLine && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-teal-700 bg-teal-50 border-teal-200">
                  {r.serviceLine}
                </Badge>
              )}
              {r.clientRelationshipMonths && r.clientRelationshipMonths > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 bg-slate-50">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {r.clientRelationshipMonths}mo relationship
                </Badge>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {r.dealStage && <span>{r.dealStage}</span>}
              {r.likelyStart && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Start: {new Date(r.likelyStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {r.numberOfWeeks && <span>{r.numberOfWeeks}w engagement</span>}
              {r.resourcesRequested && <span>{r.resourcesRequested}</span>}
              {r.confidence < 100 && r.resourceRecommended && (
                <span>~{Math.round(r.resourceRecommended * r.confidence / 100 * 10) / 10} FTE at {r.confidence}%</span>
              )}
            </div>

            {r.hiringLeadTimeAlert && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Start date is within 6 months. Recommend initiating hiring immediately to meet timeline.
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(r)}>
              Edit Context
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => onLost(r)}
            >
              Mark Lost
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Client Component ────────────────────────────────────

interface PipelineInceptionClientProps {
  requests: PipelineRequestWithContext[];
}

export function PipelineInceptionClient({ requests: initialRequests }: PipelineInceptionClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [editTarget, setEditTarget] = useState<PipelineRequestWithContext | null>(null);
  const [lostTarget, setLostTarget] = useState<PipelineRequestWithContext | null>(null);
  const [, startTransition] = useTransition();

  const stage1 = useMemo(
    () => requests.filter((r) => !r.sowSigned && (!r.dealStage || ["LEAD", "PROPOSAL", ""].includes((r.dealStage ?? "").toUpperCase()))),
    [requests],
  );
  const stage2 = useMemo(
    () => requests.filter((r) => !r.sowSigned && r.dealStage && ["SOW_PENDING"].includes(r.dealStage.toUpperCase())),
    [requests],
  );
  const confirmed = useMemo(
    () => requests.filter((r) => r.sowSigned || (r.dealStage && ["SOW_SIGNED", "ACTIVE", "RAMP_DOWN"].includes((r.dealStage ?? "").toUpperCase()))),
    [requests],
  );

  const hiringAlerts = requests.filter((r) => r.hiringLeadTimeAlert).length;

  async function handleDealLost(id: string) {
    try {
      const result = await markDealLost({ pipelineRequestId: id });
      if (result.success) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        toast.success(
          result.releasedCount > 0
            ? `Deal marked as lost. ${result.releasedCount} allocation(s) released.`
            : "Deal marked as lost.",
        );
      }
    } catch {
      toast.error("Failed to mark deal as lost");
    }
  }

  function handleSaved() {
    // Reload is handled via revalidatePath — optimistic update not needed here
    startTransition(() => { /* server revalidation propagates */ });
  }

  const SummaryCard = ({ label, count, color }: { label: string; count: number; color: string }) => (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 pb-3 px-4">
        <p className={cn("text-2xl font-bold", color)}>{count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Stage 1 — Inception" count={stage1.length} color="text-slate-700" />
        <SummaryCard label="Stage 2 — Make It Real" count={stage2.length} color="text-blue-700" />
        <SummaryCard label="Confirmed (SOW Signed)" count={confirmed.length} color="text-green-700" />
        <SummaryCard label="Hiring Alerts (< 6mo)" count={hiringAlerts} color={hiringAlerts > 0 ? "text-red-700" : "text-slate-400"} />
      </div>

      {hiringAlerts > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{hiringAlerts} deal{hiringAlerts !== 1 ? "s" : ""} require immediate hiring action</p>
            <p className="text-xs text-red-600 mt-0.5">
              Start dates are within 6 months with no confirmed internal resources. Engage Talent Acquisition now.
            </p>
          </div>
        </div>
      )}

      {/* Stage tabs */}
      <Tabs defaultValue="stage1">
        <TabsList className="h-9">
          <TabsTrigger value="stage1" className="text-sm">
            Stage 1 — Opportunity Inception
            {stage1.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-700">
                {stage1.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stage2" className="text-sm">
            Stage 2 — Make It Real
            {stage2.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700">
                {stage2.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="text-sm">
            Confirmed
            {confirmed.length > 0 && (
              <span className="ml-2 rounded-full bg-green-100 px-1.5 text-[10px] font-bold text-green-700">
                {confirmed.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stage1" className="mt-4">
          <div className="space-y-2 mb-3">
            <p className="text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3 inline" />
              Early stage deals. ~20% confidence. Record client context to improve resource forecasting.
            </p>
          </div>
          {stage1.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No Stage 1 opportunities in the pipeline.
            </div>
          ) : (
            <div className="space-y-2">
              {stage1
                .sort((a, b) => (a.solutionPriority ?? 99) - (b.solutionPriority ?? 99))
                .map((r) => (
                  <PipelineRow key={r.id} request={r} onEdit={setEditTarget} onLost={setLostTarget} />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stage2" className="mt-4">
          <div className="space-y-2 mb-3">
            <p className="text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3 inline" />
              SOW in progress. ~40% confidence. Add service lines and begin resource reservation.
            </p>
          </div>
          {stage2.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No Stage 2 opportunities in the pipeline.
            </div>
          ) : (
            <div className="space-y-2">
              {stage2
                .sort((a, b) => (a.solutionPriority ?? 99) - (b.solutionPriority ?? 99))
                .map((r) => (
                  <PipelineRow key={r.id} request={r} onEdit={setEditTarget} onLost={setLostTarget} />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="confirmed" className="mt-4">
          <div className="space-y-2 mb-3">
            <p className="text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3 inline" />
              SOW signed or actively running. 80–100% confidence. Resources should be fully allocated.
            </p>
          </div>
          {confirmed.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No confirmed opportunities.
            </div>
          ) : (
            <div className="space-y-2">
              {confirmed
                .sort((a, b) => (a.solutionPriority ?? 99) - (b.solutionPriority ?? 99))
                .map((r) => (
                  <PipelineRow key={r.id} request={r} onEdit={setEditTarget} onLost={setLostTarget} />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editTarget && (
        <ContextEditDialog
          request={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {lostTarget && (
        <DealLostDialog
          request={lostTarget}
          onClose={() => setLostTarget(null)}
          onConfirm={handleDealLost}
        />
      )}
    </div>
  );
}
