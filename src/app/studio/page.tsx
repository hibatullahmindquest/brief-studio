import Link from "next/link";
import { requireUser } from "@/lib/session";
import { StudioWizard } from "@/components/studio/StudioWizard";
import { GenerationHistory } from "@/components/studio/GenerationHistory";

export default async function StudioPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7b8698] hover:text-[#00262a]"
      >
        ← Dashboard
      </Link>
      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="editorial-kicker">Studio</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">
          Apa yang nak dibuat hari ni?
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Pilih brand dan output — AI akan tanya soalan yang betul untuk hasilkan brief yang tepat.
        </p>
      </section>
      <StudioWizard />
      <GenerationHistory />
    </div>
  );
}
