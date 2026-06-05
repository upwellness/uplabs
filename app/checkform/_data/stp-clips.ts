/**
 * STP · Success Clips Database (mirror of /STP/clips.json · active only)
 *
 * Source of truth: `/Users/ckawin/Documents/Claude/Projects/UP Wellness/STP/clips.json`
 * Sync workflow: when STP DB updated, manually mirror active clips here.
 * (Phase 2: load via API once 10-15+ clips active.)
 *
 * Used by:
 *   - /api/checkform/recommend-clips  → Gemini matcher prompt
 *   - AIAnalysisModal                 → render ClipRecommendations
 */

export interface StpClip {
  id: string;
  youtube_id: string;
  url: string;
  title: string;
  duration_min: number | null;
  speaker: {
    name: string;
    nickname: string | null;
    age_range: string | null;
    previous_career: string | null;
    achievement_level: string;
    archetypes: string[];
  };
  content: {
    summary: string;
    topics: string[];
    themes: string[];
    pain_addressed: string[];
    objections_addressed: string[];
    evidence_types_shown: string[];
  };
  signals: {
    mood_tone: string[];
    appeal_style: string[];
    complexity_level: string;
    demographic_signals: string[];
  };
  trust_score: number; // 0-5 · 5=signature · 0=draft (filtered out)
}

export const STP_ACTIVE_CLIPS: StpClip[] = [
  {
    id: "PeeKui-Right-Tool",
    youtube_id: "HCHk1w6Agg4",
    url: "https://youtu.be/HCHk1w6Agg4",
    title: "เส้นทางสู่ความสำเร็จ เลือกเดินบนเครื่องมือที่ใช่",
    duration_min: 28,
    speaker: {
      name: "กฤษฎา กรประดิษฐ์ศิลป์",
      nickname: "พี่กุ่ย + ภรรยา อังคณา 'แอน'",
      age_range: "40-50",
      previous_career: "พนักงานธนาคาร + ธุรกิจครอบครัวขายส่งขนมไทย · จบบัญชี",
      achievement_level: "executive_diamond",
      archetypes: ["sage", "mentor", "everyman"],
    },
    content: {
      summary:
        "เพชรกุ่ย กฤษฎา (Executive Diamond) + ภรรยา 28 นาที · เปิดด้วยเรื่อง 'เด็กผู้หญิงกับแอปเปิ้ล 2 ลูก' · เล่า journey ครอบครัวขายส่งขนมไทย ตื่นตี 4 ทำขนมจนตี 2 · พนักงานธนาคาร 17:00 + ขนมจนตี 2 + นอน 5:00 · 2 ปีแบบนั้น · ใช้ Bill Gross 5 Factors (Idea/Team/Business Model/Funding/Timing) อธิบาย Amway · ปิดด้วยพ่อแม่ passport เล่มแรกไปญี่ปุ่น",
      topics: ["right tool selection", "Bill Gross 5 factors", "active vs passive income", "family transformation"],
      themes: ["choose the right tool", "timing > effort", "parents passport metaphor", "active income trap"],
      pain_addressed: [
        "Sunday blues",
        "active income trap",
        "ทำงานหนักกว่าพ่อแม่แต่ไม่สำเร็จเท่า",
        "ไม่มีเวลาให้ครอบครัว",
      ],
      objections_addressed: [
        "ขายของเพื่อนรอบข้างจะหาย",
        "Amway is just MLM",
        "ทำงานหนักอยู่แล้ว ไม่เหลือเวลา",
      ],
      evidence_types_shown: [
        "Bill Gross framework",
        "family transformation story",
        "passport story",
        "Executive Diamond proof",
      ],
    },
    signals: {
      mood_tone: ["warm", "structured", "emotional", "paternal"],
      appeal_style: ["framework_driven", "story_driven", "balanced"],
      complexity_level: "beginner",
      demographic_signals: [
        "family_business_owners",
        "small_business_inheritors",
        "accounting_professionals",
        "couples",
      ],
    },
    trust_score: 4,
  },
  {
    id: "BetterMaker-EP12-Mohnam-2024",
    youtube_id: "rwdvfBI_Gd0",
    url: "https://youtu.be/rwdvfBI_Gd0",
    title: "BetterMaker EP.12 — สำเร็จแบบหมอนั้ม ไม่ต้องเก่งแต่ต้องทำให้ครบ",
    duration_min: null,
    speaker: {
      name: "นพ.ชนันต์ คุณชยางกูร",
      nickname: "หมอนั้ม (พี่น้ำ)",
      age_range: "55-60",
      previous_career: "หมอตา ศิริราช 2534 · ใช้ทุนร้อยเอ็ด 3 ปี",
      achievement_level: "founders_diamond",
      archetypes: ["sage", "mentor", "everyman"],
    },
    content: {
      summary:
        "BetterMaker Podcast สัมภาษณ์ พี่น้ำ (นพ.ชนันต์ · หมอตา ศิริราช) · 28 ปี Amway · เริ่มปี 2539 จากเข็นรถที่ลานจอด · 5 ปีถึง Diamond · ปรัชญา 'ไม่ต้องเก่ง แต่ต้องทำให้ครบ' · Karaoke metaphor (งับคำตรงจังหวะ · ไม่ต้องร้องเพราะ) · 3F formula: Family / Freedom / Financial · เกษียณราชการอายุ 49",
      topics: [
        "doctor + Amway integration",
        "completeness over excellence",
        "freedom > finance",
        "imposter syndrome counter",
      ],
      themes: ["it's okay not to be the best", "consistency beats brilliance", "freedom is the true wealth"],
      pain_addressed: [
        "feeling not good enough",
        "imposter syndrome",
        "lack of natural talent",
        "career professional considering side biz",
      ],
      objections_addressed: ["im_not_good_enough", "i_dont_have_special_skills", "doctors_dont_do_amway"],
      evidence_types_shown: ["doctor credentials", "personal humble story", "ophthalmologist Siriraj"],
    },
    signals: {
      mood_tone: ["calm", "warm", "humble", "reassuring"],
      appeal_style: ["story_driven", "balanced"],
      complexity_level: "beginner",
      demographic_signals: ["medical_professionals", "high_credential_professionals", "introvert_friendly"],
    },
    trust_score: 5,
  },
  {
    id: "UpSpiration-Salaryman-Business",
    youtube_id: "GRdBHS1FTL8",
    url: "https://youtu.be/GRdBHS1FTL8",
    title: "The UpSpiration | อดีตคนทำงานประจำ สู่เจ้าของธุรกิจ",
    duration_min: 37,
    speaker: {
      name: "รัชชาตา สำราญ",
      nickname: "ชาย (Nat)",
      age_range: "45",
      previous_career: "Office worker 14 ปี · Siam Paragon → Black Canyon → IKEA/Mega Bangna · เงินเดือนสุดท้าย 75,000",
      achievement_level: "founders_executive_crown",
      archetypes: ["hero", "everyman", "mentor"],
    },
    content: {
      summary:
        "ชาย รัชชาตา (45) · ABAC BBA + MBA · 14 ปี corporate (Paragon → Black Canyon → IKEA · เงินเดือน 75k) · 9 ปี Amway · ภรรยา 'นัท' ลดน้ำหนัก 20 กก. ผ่าน 3 เดือน Body Key · เป็น 20%/Ruby ใน 1.5 เดือนแรกก่อนเข้าเซ็นเตอร์ · 9 ปีรวมรายได้ 29M Net Profit after Tax · 300k/เดือน · First Class 8 ทริป · ปิดด้วย Begin with End in Mind / Find Your Why / Focus on Success / Believe in Yourself",
      topics: ["salaryman to FECrown", "spouse-led entry via Body Key", "office worker pain", "first class as proof"],
      themes: [
        "white collar can win",
        "spouse partnership essential",
        "credentials don't matter — choices do",
      ],
      pain_addressed: [
        "stuck in corporate",
        "income ceiling at 75k",
        "no clear retirement path",
        "wife wants weight loss",
      ],
      objections_addressed: ["only_uneducated_do_amway", "i_have_good_job_already", "amway_is_for_unemployed"],
      evidence_types_shown: [
        "income statement 29M/9yr",
        "first class proof",
        "spouse weight loss before/after",
        "ABAC MBA credentials",
      ],
    },
    signals: {
      mood_tone: ["confident", "structured", "aspirational", "calm"],
      appeal_style: ["framework_driven", "balanced", "achievement_driven"],
      complexity_level: "intermediate",
      demographic_signals: [
        "white_collar_professionals",
        "corporate_employees",
        "ABAC_alumni",
        "couples",
        "income_seekers",
      ],
    },
    trust_score: 4,
  },
  {
    id: "Oranong-Phone-Wrong-Story",
    youtube_id: "QuRK7c3Gyqo",
    url: "https://youtu.be/QuRK7c3Gyqo",
    title: "อรอนงค์ ศิริรังคมานนท์ · สายโทรผิด สู่ Founder Crown",
    duration_min: null,
    speaker: {
      name: "อรอนงค์ ศิริรังคมานนท์",
      nickname: "ป้าอรอนงค์",
      age_range: "70-80",
      previous_career: "อดีต VP Betagro Group · นักธุรกิจอาวุโส",
      achievement_level: "founders_crown",
      archetypes: ["sage", "founder", "mentor", "matriarch"],
    },
    content: {
      summary:
        "BetterMaker สัมภาษณ์อรอนงค์ · 37 ปี journey · เริ่มจาก 'สายโทรผิด' (โทรหาคนที่ไม่รู้จัก) ในช่วงต้น · ประโยคที่ canonical: 'I will set up my own meeting' · 30-min decision · ปรับ mindset จากพนักงานเป็นเจ้าของ · เน้น ownership · ปัจจุบัน Founder Crown 2019 (Triple Diamond ปี 2008)",
      topics: ["wrong phone call origin story", "i_will_set_up_my_own_meeting", "30-minute decision", "ownership mindset"],
      themes: ["take ownership immediately", "decision speed = success speed", "transition employee to entrepreneur"],
      pain_addressed: [
        "fear of cold contact",
        "waiting for upline to do things",
        "lack of ownership",
        "indecision paralysis",
      ],
      objections_addressed: ["upline_should_do_it", "i_cant_call_strangers", "need_more_time_to_decide"],
      evidence_types_shown: ["Founder Crown tenure 37 yrs", "canonical phrase legacy", "former VP credentials"],
    },
    signals: {
      mood_tone: ["wise", "direct", "energetic", "warm"],
      appeal_style: ["story_driven", "ownership_focused"],
      complexity_level: "beginner",
      demographic_signals: ["mature_audience", "ex_corporate_executives", "decision_makers"],
    },
    trust_score: 5,
  },
  {
    id: "UpSpiration-WaveA-Healthy-Wealthy",
    youtube_id: "DRR8CsdCmJI",
    url: "https://youtu.be/DRR8CsdCmJI",
    title: "ป้าอรอนงค์ · Healthy AND Wealthy · Wave A 2024",
    duration_min: null,
    speaker: {
      name: "อรอนงค์ ศิริรังคมานนท์",
      nickname: "ป้าอรอนงค์",
      age_range: "77",
      previous_career: "อดีต VP Betagro Group",
      achievement_level: "founders_crown",
      archetypes: ["sage", "founder", "mentor", "matriarch"],
    },
    content: {
      summary:
        "อรอนงค์ Founder Crown 77 ปี · บรรยายบนเวที Wave A · เนื้อหา Healthy AND Wealthy (ไม่ใช่ OR) · อายุ 77 hike 7.8km · proof ว่า longevity + business success ไปด้วยกันได้ · UP Wellness brand-aligned ที่สุด: ใช้ Sage + Caregiver tone · ไม่มีหัวข้อ MLM ตรง · เน้นคุณภาพชีวิต",
      topics: ["healthy AND wealthy", "longevity + business", "77yo hiking proof", "lifestyle integration"],
      themes: ["wealth without health is empty", "long-game living", "evidence through your own body"],
      pain_addressed: [
        "fear of aging",
        "wealth at cost of health",
        "lost vitality",
        "longevity skepticism",
      ],
      objections_addressed: [
        "rich_people_unhealthy",
        "amway_is_not_for_elderly",
        "im_too_old_to_start",
        "supplements_are_useless",
      ],
      evidence_types_shown: ["77yo hike 7.8km", "Founder Crown tenure", "personal body as proof"],
    },
    signals: {
      mood_tone: ["serene", "wise", "inspiring", "elegant"],
      appeal_style: ["lifestyle_driven", "proof_through_self", "longevity_first"],
      complexity_level: "beginner",
      demographic_signals: [
        "longevity_seekers",
        "mature_audience_50_plus",
        "wellness_oriented",
        "UP_Wellness_brand_aligned",
      ],
    },
    trust_score: 5,
  },
];

/**
 * Return clips for the matcher prompt — facts only, no IDs.
 * Keeps the Gemini context tight.
 */
export function getActiveClipsForMatcher(): StpClip[] {
  return STP_ACTIVE_CLIPS.filter((c) => c.trust_score > 0);
}

export function findClipById(id: string): StpClip | undefined {
  return STP_ACTIVE_CLIPS.find((c) => c.id === id);
}
