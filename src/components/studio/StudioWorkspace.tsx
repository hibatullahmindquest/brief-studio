"use client";

import { useEffect, useRef, useState } from "react";
import type { StudioResponse, RecipeRef } from "@/lib/router";
import type { RunArtifacts } from "@/lib/artifact-store";
import { Stepper, type StepKey } from "./Stepper";
import { BriefBar, type BriefFields } from "./BriefBar";
import { StepDescribe } from "./StepDescribe";
import { StepUnderstand } from "./StepUnderstand";
import { StepGenerating } from "./StepGenerating";
import { ResultView } from "./ResultView";

type Lens = "marketing" | "social";

// Phase G — the client orchestrator island. Owns the 4-step state machine
// (Describe → Understand → Generate → Result), the runId, the intake response, and the fetched
// artifacts. Text-first flow: the recipe job produces copy; the image is rendered on demand from
// the Result screen, so there is no separate Visual step.

const LABELS: Record<StepKey, string> = {
  describe: "Describe",
  understand: "Understand",
  generating: "Generate",
  result: "Result",
};

export type StudioState = {
  step: StepKey;
  runId: string | null;
  intake: StudioResponse | null;
  /** resolved task type — may change from intake when the user answers a task_type gap */
  taskType: string | null;
  artifacts: RunArtifacts | null;
  /** spec values surfaced into the brief bar as the flow advances */
  brief: BriefFields;
};

const initialState: StudioState = { step: "describe", runId: null, intake: null, taskType: null, artifacts: null, brief: {} };

export function StudioWorkspace({ lensOptions, defaultLens }: { lensOptions: Lens[]; defaultLens: Lens }) {
  const [state, setState] = useState<StudioState>(initialState);

  // intake landed → store response, seed the brief bar, advance to Understand.
  const handleIntake = (resp: StudioResponse) =>
    setState((s) => ({
      ...s,
      intake: resp,
      runId: resp.runId,
      taskType: resp.taskType || null,
      brief: { ...s.brief, task: resp.taskType || undefined, format: resp.recipe?.outputFormat || undefined },
      step: "understand",
    }));

  // gaps cleared in Understand → seed brief, then generate (text). Image comes later, on demand.
  const handleUnderstood = (c: { recipe: RecipeRef | null; taskType: string; brief: Record<string, string> }) =>
    setState((s) => ({
      ...s,
      taskType: c.taskType,
      brief: {
        ...s.brief,
        task: c.taskType || undefined,
        format: c.recipe?.outputFormat || s.brief.format,
        objective: c.brief.objective || s.brief.objective,
        angle: c.brief.key_message || c.brief.angle || s.brief.angle,
      },
      step: "generating",
    }));

  // recipe (text) job finished → store artifacts, show the Result.
  const handleDone = (a: RunArtifacts) => setState((s) => ({ ...s, artifacts: a, step: "result" }));

  const goTo = (step: StepKey) => setState((s) => ({ ...s, step }));

  // chaining pre-fill — a "Take it further" click stashed the source output in sessionStorage.
  // Read it once on mount (post-hydration to avoid an SSR mismatch), clear it, seed the front door.
  const [seed, setSeed] = useState("");
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("studio:seed");
      if (!raw) return;
      sessionStorage.removeItem("studio:seed");
      const s = JSON.parse(raw) as { text?: string; type?: string };
      if (!s.text) return;
      const PREFIX: Record<string, string> = {
        poster: "Make a poster from this:", caption: "Write captions from this:", marketing_plan: "Make a marketing plan from this:",
      };
      const lead = s.type && PREFIX[s.type] ? `${PREFIX[s.type]}\n\n` : "";
      // one-shot read of a browser-only API after hydration — setState here is the intended pattern
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeed(lead + s.text);
    } catch { /* private mode / bad json — ignore */ }
  }, []);

  const reset = () => { setSeed(""); setState(initialState); };

  // move focus + scroll to the active step on transition (skip the very first render) so
  // keyboard/screen-reader users land on the new content.
  const stepRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    stepRef.current?.focus();
    stepRef.current?.scrollIntoView({ block: "nearest" });
  }, [state.step]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
      {/* breadcrumb */}
      <div className="flex items-center justify-between">
        <p className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Studio <span className="opacity-50">›</span> {LABELS[state.step]}
        </p>
        {state.step !== "describe" && (
          <button type="button" onClick={reset} className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
            ↺ Start over
          </button>
        )}
      </div>

      <Stepper active={state.step} />
      <BriefBar fields={state.brief} />

      {/* active step */}
      <div key={state.step} ref={stepRef} tabIndex={-1} className="studio-fade outline-none">
        {state.step === "describe" ? (
          <StepDescribe lensOptions={lensOptions} defaultLens={defaultLens} onIntake={handleIntake} seed={seed} />
        ) : state.step === "understand" && state.intake && state.runId ? (
          <StepUnderstand
            runId={state.runId}
            intake={state.intake}
            onBack={() => goTo("describe")}
            onCleared={handleUnderstood}
          />
        ) : state.step === "generating" && state.runId ? (
          <StepGenerating
            runId={state.runId}
            onDone={handleDone}
            onBack={() => goTo("understand")}
          />
        ) : state.step === "result" && state.runId && state.artifacts ? (
          <ResultView runId={state.runId} initial={state.artifacts} />
        ) : null}
      </div>
    </div>
  );
}
