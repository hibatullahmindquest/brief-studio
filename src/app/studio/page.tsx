import { requireUser } from "@/lib/session";
import { StudioWizard } from "@/components/studio/StudioWizard";

export default async function StudioPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Studio</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">
          Apa yang nak dibuat hari ni?
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Pilih brand dan output — AI akan tanya soalan yang betul untuk hasilkan brief yang tepat.
        </p>
      </section>
      <StudioWizard />
    </div>
  );
}
