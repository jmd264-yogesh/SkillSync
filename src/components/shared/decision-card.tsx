import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConfidenceLevel } from "@/lib/ai/confidence";

export type DecisionVariant = "YES" | "YES_WITH_CONDITIONS" | "NO" | "NEUTRAL";

interface ScoreBar {
  label: string;
  value: number;
  color?: string;
}

interface DecisionCardProps {
  headline: string;
  decisionVariant: DecisionVariant;
  action: string;
  evidence: string[];
  aiWhy?: string;
  confidence?: ConfidenceLevel;
  confidenceNote?: string;
  scoreBars?: ScoreBar[];
  children?: React.ReactNode;
  className?: string;
}

const DECISION_STYLES: Record<DecisionVariant, { bg: string; text: string; badge: string }> = {
  YES: { bg: "bg-green-50 border-green-200", text: "text-green-800", badge: "bg-green-100 text-green-800 border-green-300" },
  YES_WITH_CONDITIONS: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", badge: "bg-amber-100 text-amber-800 border-amber-300" },
  NO: { bg: "bg-red-50 border-red-200", text: "text-red-800", badge: "bg-red-100 text-red-800 border-red-300" },
  NEUTRAL: { bg: "bg-slate-50 border-slate-200", text: "text-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-300" },
};

const CONFIDENCE_BADGE: Record<ConfidenceLevel, { label: string; class: string }> = {
  HIGH: { label: "High Confidence", class: "bg-green-50 text-green-700 border-green-200" },
  MEDIUM: { label: "Medium Confidence", class: "bg-amber-50 text-amber-700 border-amber-200" },
  LOW: { label: "Low Confidence", class: "bg-red-50 text-red-700 border-red-200" },
};

export function DecisionCard({
  headline,
  decisionVariant,
  action,
  evidence,
  aiWhy,
  confidence,
  confidenceNote,
  scoreBars,
  children,
  className,
}: DecisionCardProps) {
  const styles = DECISION_STYLES[decisionVariant];

  return (
    <Card className={cn("border shadow-sm overflow-hidden", className)}>
      {/* Headline decision strip */}
      <div className={cn("px-5 py-3 border-b flex items-center justify-between gap-3", styles.bg)}>
        <p className={cn("text-sm font-semibold", styles.text)}>{headline}</p>
        <Badge variant="outline" className={cn("text-xs font-medium shrink-0", styles.badge)}>
          {decisionVariant.replace("_", " ")}
        </Badge>
      </div>

      <CardHeader className="px-5 py-3 pb-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recommended Action</p>
        <p className="text-sm font-medium text-slate-800 mt-0.5">{action}</p>
      </CardHeader>

      <CardContent className="px-5 py-4 space-y-4">
        {/* Score bars (Match card variant - skill + competency side by side) */}
        {scoreBars && scoreBars.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Match Scores</p>
            {scoreBars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">{bar.label}</span>
                  <span className="text-slate-700 font-semibold">{bar.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", bar.color ?? "bg-primary")}
                    style={{ width: `${Math.min(bar.value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Evidence */}
        {evidence.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Evidence</p>
            <ul className="space-y-1">
              {evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Why */}
        {aiWhy && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-violet-500" />
              AI Analysis
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">{aiWhy}</p>
          </div>
        )}

        {/* Confidence badge */}
        {confidence && (
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className={cn("text-xs", CONFIDENCE_BADGE[confidence].class)}>
              {CONFIDENCE_BADGE[confidence].label}
            </Badge>
            {confidenceNote && (
              <p className="text-xs text-muted-foreground">{confidenceNote}</p>
            )}
          </div>
        )}

        {/* Slot for custom content */}
        {children}
      </CardContent>
    </Card>
  );
}
