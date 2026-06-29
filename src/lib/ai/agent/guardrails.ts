export interface AgentStep {
  round: number;
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolResultSummary: string;
  isBacktrack?: boolean;
}

export const GUARDRAIL_NOTE = `CRITICAL CONSTRAINTS - FOLLOW EXACTLY:
1. NUMBERS: You may ONLY state numbers returned by tool results. Never compute, estimate, or invent figures.
2. PROPOSALS ONLY: You propose staffing plans. You NEVER apply or commit changes - that requires human approval.
3. BOUNDED: If you cannot complete in the allotted rounds, return your best partial plan and state what is missing.
4. CITE SOURCES: Every numeric claim must reference the tool that returned it.`;

/**
 * Checks if any number in agent output is absent from all tool result summaries.
 * Heuristic guard - flags potential hallucinations for the caller to handle.
 */
export function assertNumbersFromTools(
  text: string,
  trace: AgentStep[],
): { clean: boolean; inventedNumbers: string[] } {
  const toolNumbers = new Set<string>();
  for (const step of trace) {
    const matches = step.toolResultSummary.match(/\d+\.?\d*/g) ?? [];
    for (const m of matches) toolNumbers.add(m);
  }

  const textNumbers = (text.match(/\b\d+\.?\d*\b/g) ?? []).filter(
    (n) => parseFloat(n) > 1,
  );
  const invented = textNumbers.filter((n) => !toolNumbers.has(n));

  return { clean: invented.length === 0, inventedNumbers: invented };
}
