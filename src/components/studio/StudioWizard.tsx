"use client";

import { useState, useEffect, useCallback } from "react";
import { OUTPUT_TYPES, getOutputType } from "@/lib/conversation-engine";
import { GuidedPosterFlow } from "./GuidedPosterFlow";
import { ChatConversation } from "./ChatConversation";
import { ChatBubble, Chip } from "./chat-ui";

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  tagline: string;
};

export type GeneratedOutput = {
  primaryPost: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  strategyNote: string;
  generatedAt: string;
};

// Conversational Studio: the whole entry is a chat. AI greets → pick brand
// (chips) → pick output (chips). Poster continues into the guided brief/spec
// flow; other output types run their Q&A as chat bubbles too.
export function StudioWizard() {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [outputTypeId, setOutputTypeId] = useState<string | null>(null);
  const [editRunId, setEditRunId] = useState<string | null>(null);
  // Poster flow phase, mirrored up so the shell can collapse on the result.
  const [posterPhase, setPosterPhase] = useState<"brief" | "spec" | "generate">("brief");

  const outputType = outputTypeId ? getOutputType(outputTypeId) : null;

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/brand");
        if (res.ok) setBrands((await res.json()) as BrandSummary[]);
      } catch { /* picker just stays empty */ }
    })();
  }, []);

  const resetAll = useCallback(() => { setBrand(null); setOutputTypeId(null); setEditRunId(null); setPosterPhase("brief"); }, []);
  const changeBrand = useCallback(() => { setBrand(null); setOutputTypeId(null); setEditRunId(null); setPosterPhase("brief"); }, []);
  const changeOutput = useCallback(() => { setOutputTypeId(null); setEditRunId(null); setPosterPhase("brief"); }, []);

  // "Edit" on a Draft in Semakan Lepas → jump into the guided poster flow with
  // that draft's spec loaded.
  useEffect(() => {
    function onEditDraft(e: Event) {
      const { featureRunId, brandSlug } = (e as CustomEvent<{ featureRunId: string; brandSlug: string }>).detail ?? {};
      if (!featureRunId || !brandSlug) return;
      void (async () => {
        try {
          const res = await fetch("/api/brand");
          const list = (await res.json()) as BrandSummary[];
          const b = list.find((x) => x.slug === brandSlug);
          if (!b) return;
          setBrands(list);
          setBrand(b);
          setOutputTypeId("poster");
          setEditRunId(featureRunId);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch { /* ignore */ }
      })();
    }
    window.addEventListener("studio:edit-draft", onEditDraft);
    return () => window.removeEventListener("studio:edit-draft", onEditDraft);
  }, []);

  const isPoster = outputTypeId === "poster";
  // Once the poster reaches the result, collapse the Q&A bubbles into a compact
  // breadcrumb and unwrap the card so VisualPanel/CopyResult don't nest in a card.
  const collapsed = brand !== null && isPoster && posterPhase === "generate";

  return (
    <div className="space-y-4">
      {/* Chat shell — full card while choosing/briefing, bare once we have a result */}
      <div className={collapsed ? "space-y-3" : "editorial-panel space-y-3 rounded-3xl p-5 sm:p-6"}>
        {collapsed ? (
          /* Compact breadcrumb header for the result view */
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#00262a]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brand!.primaryColor }} />
              {brand!.name}
            </span>
            <span className="text-[var(--line-2)]">/</span>
            <span className="font-semibold text-[#00262a]">{outputType?.label}</span>
            <button onClick={resetAll} className="ml-auto rounded-lg border border-[var(--line-2)] px-3 py-1.5 text-xs font-medium text-[#33414f] hover:bg-[var(--card-2)]">
              ↻ Mula semula
            </button>
          </div>
        ) : (
          <>
            {/* Brand */}
            <ChatBubble role="ai">
              Hai! Jom mula 👋 Nak buat untuk <b>brand</b> mana?
            </ChatBubble>
            {!brand ? (
              <ChatBubble role="ai" bare>
                <div className="flex flex-wrap gap-2">
                  {brands.length === 0 ? (
                    <span className="text-xs text-[#a6aebb]">Memuatkan brand…</span>
                  ) : (
                    brands.map((b) => (
                      <Chip key={b.id} onClick={() => setBrand(b)}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: b.primaryColor }} />
                          {b.name}
                        </span>
                      </Chip>
                    ))
                  )}
                </div>
              </ChatBubble>
            ) : (
              <ChatBubble role="user">{brand.name}</ChatBubble>
            )}

            {/* Output type */}
            {brand && (
              <>
                <ChatBubble role="ai">
                  Nak buat <b>output</b> apa?{" "}
                  <button onClick={changeBrand} className="text-[11px] underline opacity-70 hover:opacity-100">tukar brand</button>
                </ChatBubble>
                {!outputTypeId ? (
                  <ChatBubble role="ai" bare>
                    <div className="flex flex-wrap gap-2">
                      {OUTPUT_TYPES.map((ot) => (
                        <Chip key={ot.id} onClick={() => { setOutputTypeId(ot.id); setEditRunId(null); }}>{ot.label}</Chip>
                      ))}
                    </div>
                  </ChatBubble>
                ) : (
                  <ChatBubble role="user">{outputType?.label}</ChatBubble>
                )}
              </>
            )}
          </>
        )}

        {/* Poster → guided brief/spec inside the same chat (stays mounted across
            phases; the wrapper above un-cards itself once collapsed) */}
        {brand && isPoster && (
          <GuidedPosterFlow
            key={editRunId ?? "new"}
            brand={brand}
            initialRunId={editRunId}
            onExit={changeOutput}
            embedded
            onPhaseChange={setPosterPhase}
          />
        )}
      </div>

      {/* Non-poster → generic Q&A chat (+ result) below the shell */}
      {brand && outputType && !isPoster && (
        <ChatConversation brand={brand} outputType={outputType} onReset={resetAll} />
      )}
    </div>
  );
}
