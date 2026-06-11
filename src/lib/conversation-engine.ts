export type AnswerType = "chips" | "text" | "chips+text";

export type Question = {
  id: string;
  text: string;
  subtext?: string;
  answerType: AnswerType;
  options?: string[];
  placeholder?: string;
  required: boolean;
};

export type OutputType = {
  id: string;
  label: string;
  description: string;
  team: "marketing" | "creative" | "video";
  questions: Question[];
};

export const OUTPUT_TYPES: OutputType[] = [
  {
    id: "hook_copy",
    label: "Hook & Copy",
    description: "Hooks, captions, CTA, hashtags",
    team: "marketing",
    questions: [
      {
        id: "promo",
        text: "Apa yang nak dipromosikan?",
        subtext: "Ceritakan secara ringkas",
        answerType: "chips+text",
        options: ["Program baru", "Promo / Offer", "Event", "Pendaftaran dibuka"],
        placeholder: "Contoh: Diskaun 20% untuk pendaftaran tutor sempena Raya",
        required: true,
      },
      {
        id: "platform",
        text: "Platform mana untuk content ni?",
        answerType: "chips",
        options: ["Instagram", "Facebook", "TikTok", "Semua platform"],
        required: true,
      },
      {
        id: "format",
        text: "Format content?",
        answerType: "chips",
        options: ["Feed Post", "Reel", "Story", "Carousel"],
        required: true,
      },
      {
        id: "objective",
        text: "Objective utama content ni?",
        answerType: "chips",
        options: ["Drive pendaftaran", "Awareness", "Tingkat engagement", "Clicks ke website"],
        required: true,
      },
      {
        id: "urgency",
        text: "Ada urgency atau tarikh tamat?",
        answerType: "chips+text",
        options: ["Ya, ada tarikh", "Tidak, open-ended"],
        placeholder: "Contoh: Tamat 31 Mei 2026",
        required: false,
      },
      {
        id: "extra",
        text: "Ada info tambahan untuk AI tahu?",
        subtext: "Optional — boleh skip",
        answerType: "text",
        placeholder: "Contoh: Fokus pada ibu bapa, jangan sebut harga dalam copy",
        required: false,
      },
    ],
  },
  {
    id: "poster",
    label: "Poster",
    description: "Visual poster prompt untuk designer atau AI image",
    team: "creative",
    questions: [
      {
        id: "promo",
        text: "Apa yang nak dipamerkan dalam poster?",
        answerType: "chips+text",
        options: ["Promo Raya", "Program baru", "Event", "Motivational / Brand"],
        placeholder: "Contoh: Pendaftaran tutor diskaun 20%, tamat 31 Mei",
        required: true,
      },
      {
        id: "size",
        text: "Saiz poster?",
        answerType: "chips",
        options: ["1:1 (Feed)", "9:16 (Story/Reel)", "16:9 (YouTube/Banner)", "A4 (Print)"],
        required: true,
      },
      {
        id: "style",
        text: "Style visual poster?",
        answerType: "chips",
        options: ["Clean & minimal", "Bold & energetic", "Warm & family", "Professional & formal"],
        required: true,
      },
      {
        id: "elements",
        text: "Elemen wajib ada dalam poster?",
        answerType: "chips",
        options: ["Tarikh / Deadline", "Harga / Diskaun", "CTA Button", "Logo sahaja"],
        required: false,
      },
      {
        id: "extra",
        text: "Info tambahan untuk designer?",
        answerType: "text",
        placeholder: "Contoh: Gunakan warna biru gelap, ada bulan sabit untuk Raya feel",
        required: false,
      },
    ],
  },
  {
    id: "storyboard",
    label: "Storyboard",
    description: "Scene-by-scene visual breakdown untuk video",
    team: "creative",
    questions: [
      {
        id: "story",
        text: "Cerita apa yang nak disampaikan?",
        answerType: "chips+text",
        options: ["Testimoni student", "Problem & solution", "Before & after", "Brand story"],
        placeholder: "Contoh: Student SPM yang struggle math, lepas guna SifuTutor dapat A",
        required: true,
      },
      {
        id: "scenes",
        text: "Berapa scene?",
        answerType: "chips",
        options: ["3 scenes (pendek)", "5 scenes (standard)", "7 scenes (detail)"],
        required: true,
      },
      {
        id: "platform",
        text: "Platform target?",
        answerType: "chips",
        options: ["Instagram Reel", "TikTok", "YouTube Shorts", "Facebook Video"],
        required: true,
      },
      {
        id: "tone_visual",
        text: "Tone visual?",
        answerType: "chips",
        options: ["Energetic & fast-paced", "Warm & emotional", "Professional & clean", "Fun & youthful"],
        required: true,
      },
    ],
  },
  {
    id: "video_script",
    label: "Video Script",
    description: "Script + shooting plan untuk video production",
    team: "video",
    questions: [
      {
        id: "objective",
        text: "Objective video?",
        answerType: "chips",
        options: ["Drive pendaftaran", "Brand awareness", "Testimoni / Social proof", "Explainer / Tutorial"],
        required: true,
      },
      {
        id: "duration",
        text: "Berapa lama video?",
        answerType: "chips",
        options: ["15 saat", "30 saat", "60 saat", "90 saat"],
        required: true,
      },
      {
        id: "presenter",
        text: "Siapa yang berucap?",
        answerType: "chips",
        options: ["Presenter on-camera", "Voiceover sahaja", "Text on screen", "Kombinasi"],
        required: true,
      },
      {
        id: "cta",
        text: "CTA akhir video?",
        answerType: "chips+text",
        options: ["Daftar sekarang", "Hubungi kami", "Link in bio", "Subscribe"],
        placeholder: "Atau taip CTA spesifik",
        required: true,
      },
      {
        id: "extra",
        text: "Ada arahan khas untuk scriptwriter?",
        answerType: "text",
        placeholder: "Contoh: Guna Bahasa Melayu formal, ada humor ringan",
        required: false,
      },
    ],
  },
];

export function getOutputType(id: string): OutputType | undefined {
  return OUTPUT_TYPES.find((o) => o.id === id);
}

export function buildBriefPrompt(
  outputType: OutputType,
  answers: Record<string, string>
): string {
  const lines = [`Output type: ${outputType.label}`];
  for (const q of outputType.questions) {
    const answer = answers[q.id];
    if (answer && answer !== "—") lines.push(`${q.text}: ${answer}`);
  }
  return lines.join("\n");
}
