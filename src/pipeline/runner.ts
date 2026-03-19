import type { EmitFn, PipelineState, RequestInput } from "./types";
import { parseRequest }       from "./steps/01_parseRequest";
import { fetchCandidates }    from "./steps/02_fetchCandidates";
import { filterRegion }       from "./steps/03_filterRegion";
import { filterRestrictions } from "./steps/04_filterRestrictions";
import { filterCapacity }     from "./steps/05_filterCapacity";
import { applyThreshold }     from "./steps/06_applyThreshold";
import { applyCategoryRules } from "./steps/07_applyCategoryRules";
import { applyGeographyRules }from "./steps/08_applyGeographyRules";
import { validateRequest }    from "./steps/09_validateRequest";
import { rankSuppliers }      from "./steps/10_rankSuppliers";
import { checkEscalations }   from "./steps/11_checkEscalations";
import { buildRecommendation }from "./steps/12_buildRecommendation";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runPipeline(
  request: RequestInput,
  emit: EmitFn,
  stepDelayMs = Number(process.env.PIPELINE_STEP_DELAY_MS ?? 800),
): Promise<PipelineState> {
  const state: PipelineState = {
    request,
    candidates:       [],
    active:           [],
    eliminated:       [],
    flagged:          [],
    threshold:        null,
    policiesApplied:  [],
    validationIssues: [],
    shortlist:        [],
    escalations:      [],
    recommendation:   null,
  };

  const stageSummary = async (stage: string, step: number, prevEliminated: number) => {
    await emit({
      type: "STAGE_SUMMARY",
      data: {
        stage,
        step,
        activeCount:         state.active.length,
        eliminatedThisStep:  state.eliminated.length - prevEliminated,
        totalEliminated:     state.eliminated.length,
      },
    });
  };

  try {
    await parseRequest(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await fetchCandidates(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    let prevElim = 0;
    await filterRegion(state, emit);
    await stageSummary("Region Filter", 3, prevElim);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    prevElim = state.eliminated.length;
    await filterRestrictions(state, emit);
    await stageSummary("Restriction Filter", 4, prevElim);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    prevElim = state.eliminated.length;
    await filterCapacity(state, emit);
    await stageSummary("Capacity Filter", 5, prevElim);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await applyThreshold(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await applyCategoryRules(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await applyGeographyRules(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await validateRequest(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await rankSuppliers(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await checkEscalations(state, emit);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    await buildRecommendation(state, emit);
  } catch (err) {
    await emit({
      type: "ERROR",
      data: { message: err instanceof Error ? err.message : String(err) },
    });
  }

  return state;
}
