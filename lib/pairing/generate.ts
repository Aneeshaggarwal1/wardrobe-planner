import type { Item, Outfit, PairFeedback } from "../types";
import { hardFilter, pairKey, type FilterContext, type FilterReason } from "./filters";
import { templateReason } from "./reasons";
import { scorePair, type ScoreBreakdown, type TasteSignal } from "./score";

export interface Candidate {
  top_id: string;
  bottom_id: string;
  score: number;
  breakdown: ScoreBreakdown;
  reason: string;
}

export interface GenerateOptions {
  feedback: readonly PairFeedback[];
  /** Outfits already in the bank or queue; their pairs are not proposed again. */
  existing: readonly Outfit[];
  /** Maximum candidates to return (default 30, the size sent to the LLM re-rank). */
  limit?: number;
}

export interface GenerateResult {
  candidates: Candidate[];
  /** How many pairs each hard filter dropped; useful for tests and debugging. */
  dropped: Record<FilterReason, number>;
}

export function buildFilterContext(feedback: readonly PairFeedback[]): FilterContext {
  const rejectedPairs = new Set<string>();
  let allowMonochrome = false;
  for (const f of feedback) {
    if (f.decision === "reject") rejectedPairs.add(pairKey(f.top_id, f.bottom_id));
    if (f.decision === "approve" && f.features.top_color === f.features.bottom_color) {
      allowMonochrome = true;
    }
  }
  return { rejectedPairs, allowMonochrome };
}

export function buildTasteSignal(feedback: readonly PairFeedback[]): TasteSignal {
  return {
    approved: feedback.filter((f) => f.decision === "approve").map((f) => f.features),
    rejected: feedback.filter((f) => f.decision === "reject").map((f) => f.features),
  };
}

/**
 * Generate ranked top × bottom candidates. Pure: no I/O, so it runs on the
 * server for real wardrobes and in the browser for demo mode.
 * Ties break on ids so output is deterministic.
 */
export function generateCandidates(items: readonly Item[], options: GenerateOptions): GenerateResult {
  const tops = items.filter((i) => i.category === "top");
  const bottoms = items.filter((i) => i.category === "bottom");
  const ctx = buildFilterContext(options.feedback);
  const signal = buildTasteSignal(options.feedback);
  const taken = new Set(options.existing.map((o) => pairKey(o.top_id, o.bottom_id)));
  const dropped: Record<FilterReason, number> = {
    formality_gap: 0,
    double_pattern: 0,
    monochrome: 0,
    previously_rejected: 0,
  };

  const candidates: Candidate[] = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      if (taken.has(pairKey(top.id, bottom.id))) continue;
      const reason = hardFilter(top, bottom, ctx);
      if (reason) {
        dropped[reason] += 1;
        continue;
      }
      const breakdown = scorePair(top, bottom, signal);
      candidates.push({
        top_id: top.id,
        bottom_id: bottom.id,
        score: breakdown.total,
        breakdown,
        reason: templateReason(top, bottom),
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score || a.top_id.localeCompare(b.top_id) || a.bottom_id.localeCompare(b.bottom_id),
  );
  return { candidates: candidates.slice(0, options.limit ?? 30), dropped };
}
