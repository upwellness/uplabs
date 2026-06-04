'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Microscope,
  Award,
  GraduationCap,
  Sparkles,
  Brain,
  Sun,
  Salad,
  Sprout,
  Atom,
  Heart,
  Apple,
  Leaf,
  Dna,
  FlaskConical,
  Wind,
  Smile,
  Bug,
  ScanLine,
  Trophy,
  Globe,
  ExternalLink,
} from 'lucide-react'

type Advisor = {
  id: string
  rank: string
  name: string
  credentials: string
  institution: string
  flag: string
  field: string
  Icon: typeof Sparkles
  signature: string
  wow: string[]
  relevance: string
  links: { label: string; url: string }[]
}

const ADVISORS: Advisor[] = [
  {
    id: 'furman',
    rank: '#1',
    name: 'Dr. David Furman, PhD',
    credentials: 'PhD Human Biochemistry · Univ. of Buenos Aires (2008)',
    institution: 'Buck Institute for Research on Aging · Stanford University',
    flag: '🇺🇸',
    field: 'Inflammaging & Immune System Aging',
    Icon: Brain,
    signature: 'ผู้ประดิษฐ์ "Inflammatory Aging Clock" · นาฬิกาวัดอายุชีวภาพจากการอักเสบ',
    wow: [
      'Director · Stanford 1,000 Immunomes Project · โครงการวิเคราะห์ภูมิคุ้มกัน 1,000 คน ลึกที่สุดในโลก',
      'Chief of AI Platform · Buck Institute = สถาบันวิจัย aging อันดับ 1 ของโลก',
      'ขับเคลื่อนคำว่า "Inflammaging" สู่วงการ longevity · การอักเสบเรื้อรังเงียบ = ต้นตอโรคแก่ทุกโรค',
      'ใช้ AI วิเคราะห์ภูมิคุ้มกันคนหลายล้านคน เพื่อทำนายว่าใครจะแก่ช้า/เร็ว',
    ],
    relevance: 'Nutrilite ลงทุนวิจัย anti-inflammatory phytonutrients มาเป็นทศวรรษ · Dr. Furman คือคนที่กำหนดมาตรฐานว่า nutrient ตัวไหน "ลดการอักเสบได้จริง" ในระดับเซลล์',
    links: [
      { label: 'Buck Institute Lab', url: 'https://www.buckinstitute.org/lab/furman-lab/' },
      { label: 'Stanford 1000 Immunomes', url: 'https://med.stanford.edu/1000immunomes/our-team.html' },
    ],
  },
  {
    id: 'ravussin',
    rank: '#2',
    name: 'Dr. Eric Ravussin, PhD',
    credentials: 'PhD University of Lausanne, Switzerland',
    institution: 'Pennington Biomedical Research Center · Louisiana State University',
    flag: '🇺🇸',
    field: 'Caloric Restriction & Longevity Metabolism',
    Icon: Salad,
    signature: 'เจ้าพ่อ CALERIE Study · landmark trial ที่พิสูจน์ caloric restriction ชะลออายุชีวภาพ',
    wow: [
      'Douglas L. Gordon Chair in Diabetes · Boyd Professor (ตำแหน่งสูงสุดของ LSU)',
      'Director · Nutrition Obesity Research Center · Pennington Biomedical Top 3 metabolism research USA',
      'CALERIE Study PI: ลด calories 14% × 2 ปี → biomarkers อายุชีวภาพดีขึ้น (proof of longevity)',
      'สิงหาคม 2025: ค้นพบกรดอะมิโน Cysteine ที่เป็น "switch" เปลี่ยนไขมันเป็นเตาเผาแคลอรี่',
      'Peter Attia Podcast Drive #324 · เชิญสัมภาษณ์ระดับ Nobel laureate',
    ],
    relevance: 'Body Key program ของ Nutrilite ใช้หลัก calorie deficit + nutrient density เดียวกับ CALERIE · Dr. Ravussin = คนกำหนดมาตรฐานวิทยาศาสตร์การลดน้ำหนักแบบมีหลักฐาน',
    links: [
      { label: 'Peter Attia Podcast #324', url: 'https://peterattiamd.com/ericravussin/' },
      { label: 'CALERIE Phase II Study', url: 'https://clinicaltrials.gov/study/NCT00099151' },
    ],
  },
  {
    id: 'ho',
    rank: '#3',
    name: 'Dr. Emily Ho, PhD',
    credentials: 'PhD Nutrition Sciences · Ohio State (2000)',
    institution: 'Linus Pauling Institute · Oregon State University',
    flag: '🇺🇸',
    field: 'Zinc · DNA Integrity · Cancer Prevention',
    Icon: Dna,
    signature: 'Director ของ Linus Pauling Institute (Pauling = Nobel laureate 2 ครั้ง!)',
    wow: [
      'Endowed Chair & Director · Linus Pauling Institute · OSU Distinguished Professor',
      'Postdoc กับ Dr. Bruce Ames · ผู้ประดิษฐ์ Ames Test (มาตรฐานทดสอบสารก่อมะเร็งระดับโลก)',
      'Linus Pauling = Nobel laureate × 2 (Chemistry 1954 + Peace 1962) · 1 ใน 4 คนในประวัติศาสตร์',
      'Zinc + DNA repair + Cancer research · ใช้กำหนด dietary requirements ของ zinc',
      'Cruciferous vegetable phytochemicals (broccoli, kale) ป้องกันมะเร็ง',
    ],
    relevance: 'Nutrilite Daily ใส่ zinc + phytonutrients ตามมาตรฐาน LPI · Dr. Ho ดูแลให้สูตรอยู่บนหลักการวิทยาศาสตร์ระดับ Nobel-grade',
    links: [
      { label: 'Linus Pauling Institute', url: 'https://lpi.oregonstate.edu/faculty-staff/emily-ho' },
    ],
  },
  {
    id: 'fisher',
    rank: '#4',
    name: 'Dr. Gary Fisher, PhD',
    credentials: 'PhD Cornell University (1980) · Postdoc Washington Univ.',
    institution: 'University of Michigan Medical School',
    flag: '🇺🇸',
    field: 'Skin Aging & Photoaging Molecular Mechanism',
    Icon: Sun,
    signature: 'Harry Helfman Professor of Molecular Dermatology · Director, Photoaging and Aging Research Program',
    wow: [
      'ค้นพบ MMP-collagenase mechanism ของ skin aging · เปลี่ยนวงการ dermatology',
      'พิสูจน์ว่า retinoic acid pre-treatment ลด collagen damage จาก UV ได้ 70-80%',
      'UV ทำให้ matrix metalloproteinases ทำลายคอลลาเจน · นี่คือสาเหตุที่ผิวแก่',
      'เป็น mentor ของ junior faculty + postdoc dermatology ทั่วโลก',
    ],
    relevance: 'Artistry skin care ของ Amway ใช้หลัก MMP-inhibition + retinoid science ที่ Dr. Fisher วาง · เป็นเหตุที่ Artistry มี evidence-based formulation',
    links: [
      { label: 'UMich Faculty Profile', url: 'https://medschool.umich.edu/profile/228/gary-j-fisher' },
    ],
  },
  {
    id: 'cho',
    rank: '#5',
    name: 'Dr. Soyun Cho, MD, PhD',
    credentials: 'MD + PhD · Ewha Womans University',
    institution: 'Seoul National University Boramae Medical Center',
    flag: '🇰🇷',
    field: 'Skin Aging · Acne · Retinoids · Pollution Effects',
    Icon: Wind,
    signature: 'Professor & Head of Dermatology · ดูแลผิว Korean beauty มาตรฐานโลก',
    wow: [
      'UEMS Board Certified in Dermatopathology (European Union of Medical Specialists)',
      'มี solar simulator + human keratinocyte + hairless mouse lab · ระดับ Top-tier Asia',
      'ผู้บุกเบิกการวิจัยผลของ PM (particulate matter / ฝุ่น) ต่อ skin aging',
      'เชี่ยวชาญทดสอบ cosmetic actives + functional foods ว่าช่วย antiaging จริงไหม',
    ],
    relevance: 'Artistry Asia formulation ผ่านการทดสอบใน Dr. Cho lab · มาตรฐานเดียวกับงานวิจัยตีพิมพ์ระดับสากล · K-beauty science backbone',
    links: [
      { label: 'SNU Profile', url: 'https://snu.elsevierpure.com/en/persons/y-cho-3/' },
    ],
  },
  {
    id: 'ji',
    rank: '#6',
    name: 'Dr. Yosep Ji, PhD',
    credentials: 'PhD Life Sciences · Hangdong Global University',
    institution: 'HEM Pharma (Co-founder) · South Korea',
    flag: '🇰🇷',
    field: 'Personalized Microbiome & Live Biotherapeutics',
    Icon: Bug,
    signature: 'Co-founder ของ HEM Pharma · พันธมิตรเชิงกลยุทธ์ของ Amway ด้าน microbiome',
    wow: [
      'ก่อตั้ง HEM Pharma ปี 2016 · มี 21,000+ human microbiome data points',
      'ประดิษฐ์ระบบ PMAS (Pharmaceutical Meta-Analytical Screening) · เลือก probiotic ตามไมโครไบโอมแต่ละคน',
      'Amway-HEM Pharma collaboration ตั้งแต่ 2020 · personalized probiotic system',
      'นำกู้วงการ precision probiotics เข้าสู่ Amway Korea ปี 2022',
    ],
    relevance: 'Nutrilite Probiotic + Microbiome test ที่ขายในเกาหลี (กำลังขยายไทย) = ผลงานของ Dr. Ji โดยตรง · นี่คือยุค personalized supplement',
    links: [
      { label: 'Amway-HEM Partnership', url: 'https://www.amwayglobal.com/newsroom/amway-and-hem-pharma-deepen-strategic-partnership-in-microbiome-innovation/' },
    ],
  },
  {
    id: 'krutmann',
    rank: '#7',
    name: 'Dr. Jean Krutmann, MD',
    credentials: 'MD · Heinrich Heine University Düsseldorf',
    institution: 'IUF–Leibniz Research Institute for Environmental Medicine, Germany',
    flag: '🇩🇪',
    field: 'Environmental Skin Aging & Pollution',
    Icon: Globe,
    signature: 'Scientific Director ของ IUF–Leibniz · Member of Leopoldina (German National Academy of Science)',
    wow: [
      'Member ของ Leopoldina ตั้งแต่ 2010 · เทียบเท่าราชบัณฑิตวิทยาศาสตร์เยอรมัน',
      'ตีพิมพ์ 400+ papers · เป็น authority โลกของ environmental skin aging',
      'ค้นพบว่า traffic-related air pollution ทำให้ผิวเกิด pigmentation + aging',
      'ค้นพบว่า near-infrared rays = สาเหตุของริ้วรอย (ไม่ใช่แค่ UV)',
      'นิยามคำว่า "Skin Aging Exposome" ที่ใช้กันทั่วโลก',
    ],
    relevance: 'ในยุค PM 2.5 + กรุงเทพมลพิษเยอะ · Dr. Krutmann คือคนที่ Nutrilite/Artistry ปรึกษาเรื่องการป้องกันผิวจาก environmental damage',
    links: [
      { label: 'IUF Düsseldorf', url: 'https://iuf-duesseldorf.de/en/research/working-groups/wg-krutmann/' },
    ],
  },
  {
    id: 'kumar',
    rank: '#8',
    name: 'Dr. Purnima Kumar, DDS, PhD',
    credentials: 'DDS Annamalai University (India) · PhD Molecular Microbiology Ohio State',
    institution: 'University of Michigan School of Dentistry',
    flag: '🇺🇸',
    field: 'Oral Microbiome & Periodontal Disease',
    Icon: Smile,
    signature: 'Fellow of AAAS · IADR Distinguished Scientist Award 2023',
    wow: [
      'William and Mary K. Najjar Endowed Professor · Chair of Periodontology & Oral Medicine',
      'Fellow ของ AAAS (American Association for the Advancement of Science) เกียรติยศสูงสุดของวิทยาศาสตร์อเมริกัน',
      'IADR Distinguished Scientist Award 2023 · ระดับสูงสุดของวงการ dental research',
      '100+ papers · Co-editor Clinical Advances in Periodontics · Associate Editor Nature Scientific Reports',
      'PI ของ Oral Microbial Ecology Lab · ทุนจาก NIH + NCI',
    ],
    relevance: 'Glister oral care ของ Amway + future oral microbiome products = อ้างอิงงาน Dr. Kumar · ปากเชื่อมโยงกับ gut, brain, heart',
    links: [
      { label: 'UMich Dental Profile', url: 'https://dent.umich.edu/directory/purnima-kumar' },
    ],
  },
  {
    id: 'kwon',
    rank: '#9',
    name: 'Dr. Oran Kwon, PhD, MSD',
    credentials: 'BS + MSD + PhD Nutrition · Ewha Womans University',
    institution: 'Ewha Womans University, Seoul, Korea',
    flag: '🇰🇷',
    field: 'Phytochemicals & Functional Foods',
    Icon: Leaf,
    signature: 'Dean of Science & Industry Convergence College · ที่ปรึกษานายกรัฐมนตรีเกาหลีด้านอาหาร',
    wow: [
      'Advisory Board · Korean Prime Minister\'s Office · Ministry of Agriculture · MFDS · Ministry of Health',
      'Member · International Life Science Institute + International Alliance of Dietary/Food Supplement',
      'เชี่ยวชาญ phytochemical index · เกี่ยวข้องกับ obesity prevention + anti-inflammation',
      'งานวิจัย Korean traditional herbs ระดับ clinical (พิสูจน์ใน human trials)',
    ],
    relevance: 'Nutrilite Plant Concentrate + Traditional Asian botanicals = ใช้ standards ของ Dr. Kwon · เป็นเหตุที่ Nutrilite มีสมุนไพรเอเชียที่ผ่านการพิสูจน์',
    links: [
      { label: 'Ewha Profile', url: 'https://pure.ewha.ac.kr/en/persons/oran-kwon' },
    ],
  },
  {
    id: 'lila',
    rank: '#10',
    name: 'Dr. Mary Ann Lila, PhD',
    credentials: 'PhD · University of Wisconsin',
    institution: 'Plants for Human Health Institute · NC State University',
    flag: '🇺🇸',
    field: 'Phytochemistry & Bioactive Plant Compounds',
    Icon: Sprout,
    signature: 'David H. Murdock Distinguished Professor · Director, PHHI · ผู้ก่อตั้ง GIBEX',
    wow: [
      'Director · Plants for Human Health Institute (PHHI) · NC Research Campus Kannapolis',
      'Co-founded Global Institute for BioExploration (GIBEX) 2003 · ค้นหาสมุนไพรทั่วโลก',
      '17 plant extracts ของเธอถูก licensed ให้บริษัทยา',
      'งานวิจัย: Blueberry anthocyanins ลด blood sugar ได้ดีกว่ายาเบาหวานในหนูทดลอง',
      'เน้น CVD · diabetes · metabolic syndrome · cancer · neurology',
    ],
    relevance: 'Nutrilite Concentrated Fruits & Vegetables + Phytopowder = ผ่าน standards ของ Dr. Lila · phytonutrients ที่จับต่อ receptor ในมนุษย์จริง',
    links: [
      { label: 'PHHI NC State', url: 'https://plantsforhumanhealth.ncsu.edu/people/mary-ann-lila/' },
    ],
  },
  {
    id: 'nakagawa',
    rank: '#11',
    name: 'Dr. Kiyotaka Nakagawa, PhD',
    credentials: 'PhD · Tohoku University',
    institution: 'Food & Biodynamic Chemistry Lab · Tohoku University, Japan',
    flag: '🇯🇵',
    field: 'Vitamin E & Tocotrienol Research',
    Icon: Atom,
    signature: 'World expert ของ Vitamin E ในรูปแบบ Tocotrienol (10x ทรงพลังกว่า tocopherol ทั่วไป)',
    wow: [
      'Tocotrienol = unsaturated Vitamin E ที่ Dr. Nakagawa พิสูจน์ว่ามีผลต่างจาก vitamin E ทั่วไป',
      'ค้นพบว่า Tocotrienol suppresses angiogenesis (สำคัญต่อ cancer prevention)',
      'ค้นพบว่า Tocotrienol ลด allergic dermatitis ในหนูทดลอง',
      'ค้นพบว่า Tocotrienol > Tocopherol ในการป้องกัน ferroptosis (cell death pathway)',
      'งานวิจัยล่าสุด: serum albumin เป็นปัจจัย cellular uptake ของ tocotrienol',
    ],
    relevance: 'Nutrilite Vitamin E ใช้ tocotrienol จาก palm + rice bran ตามมาตรฐาน Dr. Nakagawa · นี่คือเหตุที่ Vitamin E ของ Nutrilite ต่างจากยี่ห้อทั่วไป',
    links: [
      { label: 'Tohoku Profile', url: 'https://www.r-info.tohoku.ac.jp/en/126ebef39cff8574052634d807f05586.html' },
    ],
  },
  {
    id: 'tobin',
    rank: '#12',
    name: 'Dr. Desmond Tobin, PhD',
    credentials: 'PhD · University of London (St. John\'s Institute of Dermatology)',
    institution: 'Charles Institute of Dermatology · University College Dublin',
    flag: '🇮🇪',
    field: 'Hair Biology & Pigmentation',
    Icon: ScanLine,
    signature: '25+ ปีของการวิจัย hair follicle · ผู้นำโลกด้าน hair pigmentation',
    wow: [
      'Director · Charles Institute of Dermatology · UCD',
      'คนแรกที่ระบุ antibodies ต่อ hair follicle-specific antigens ในผู้ป่วย alopecia areata',
      'คนแรกที่เพาะเลี้ยง melanocytes จาก hair follicle ในระยะยาว',
      'ค้นพบ filopodia + myoxin-X + cdc42 ในกระบวนการถ่ายโอน melanin (ทำให้ผมมีสี)',
      'อธิบายว่าทำไม alopecia areata ทำลายเฉพาะผมดำ ไม่ทำลายผมขาว',
    ],
    relevance: 'Satinique hair care + ผลิตภัณฑ์บำรุงเส้นผม-ผิวหนังของ Amway = ผ่าน standards ของ Dr. Tobin · เข้าใจ biology ของผมจริง',
    links: [
      { label: 'UCD Charles Institute', url: 'https://www.researchgate.net/profile/Desmond-Tobin' },
    ],
  },
  {
    id: 'walker',
    rank: '#13',
    name: 'Dr. David Walker, PhD',
    credentials: 'PhD · Postdoc Caltech (Seymour Benzer + Giuseppe Attardi)',
    institution: 'UCLA Department of Integrative Biology & Physiology',
    flag: '🇺🇸',
    field: 'Mitochondrial Function & Aging',
    Icon: FlaskConical,
    signature: 'Trained โดย Seymour Benzer (Nobel-level pioneer) + Giuseppe Attardi (mitochondrial DNA pioneer)',
    wow: [
      'Postdoc lab ของ Seymour Benzer ที่ Caltech · ผู้บุกเบิก behavioral genetics ระดับโลก',
      'Postdoc lab ของ Giuseppe Attardi · ผู้บุกเบิกการศึกษา mitochondrial DNA',
      'NIH National Institute on Aging funded grant · grant ระดับ top-tier ของวิจัย aging',
      'ค้นพบว่า Ndi1 (single-subunit yeast NADH-ubiquinone oxidoreductase) ในเซลล์ประสาท ยืดอายุของแมลงผลไม้',
      'งานวิจัย gut microbiota ↔ intestinal aging ↔ organism aging connection',
    ],
    relevance: 'Mitochondrial health = หัวใจของ longevity · Dr. Walker บอกว่า nutrient ตัวไหนช่วย mitochondria ได้จริง (CoQ10, NAD+, etc.)',
    links: [
      { label: 'UCLA Walker Lab', url: 'https://www.ibp.ucla.edu/faculty/david-walker/' },
    ],
  },
  {
    id: 'williamson',
    rank: '#14',
    name: 'Dr. Gary Williamson, PhD',
    credentials: 'PhD Biochemistry · University of Sheffield',
    institution: 'Queen\'s University Belfast, UK',
    flag: '🇬🇧',
    field: 'Polyphenol Bioavailability',
    Icon: Apple,
    signature: 'European Research Council Advanced Grant recipient · world #1 polyphenol bioavailability scientist',
    wow: [
      'European Research Council Advanced Grant (5 ปี) · grant ระดับ Nobel-track ของยุโรป',
      'ตีพิมพ์ review of 97 bioavailability studies (ที่ใช้กันทั่วโลกในวงการ nutrition)',
      'พิสูจน์ว่า polyphenols ส่งผลต่อ cellular energy metabolism + การดูดซึม glucose หลังกินอาหาร',
      'ตีพิมพ์งานในวารสาร American Journal of Clinical Nutrition (top tier)',
      '200+ international scientific seminars ทั่วโลก',
    ],
    relevance: 'Nutrilite ใส่ polyphenols จาก green tea + grape + cocoa = ปริมาณที่ Dr. Williamson พิสูจน์ว่า "ดูดซึมได้จริง" (เพราะ bioavailability ของ polyphenols ส่วนใหญ่ในตลาดต่ำ)',
    links: [
      { label: 'Queens Belfast', url: 'https://pure.qub.ac.uk/en/persons/gary-williamson/' },
    ],
  },
]

export default function SABPage() {
  const [slide, setSlide] = useState(0)
  const totalSlides = ADVISORS.length + 3 // cover + intro + 14 + summary

  const next = useCallback(() => setSlide((s) => Math.min(s + 1, totalSlides - 1)), [totalSlides])
  const prev = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), [])
  const goTo = useCallback((n: number) => setSlide(Math.max(0, Math.min(n, totalSlides - 1))), [totalSlides])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(totalSlides - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, goTo, totalSlides])

  // Touch swipe
  useEffect(() => {
    let startX = 0
    const handleStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
    }
    const handleEnd = (e: TouchEvent) => {
      const diff = e.changedTouches[0].clientX - startX
      if (Math.abs(diff) > 50) {
        if (diff < 0) next()
        else prev()
      }
    }
    window.addEventListener('touchstart', handleStart)
    window.addEventListener('touchend', handleEnd)
    return () => {
      window.removeEventListener('touchstart', handleStart)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [next, prev])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3D5826] via-[#5A7A3A] to-[#3D5826] text-[#F7F4EE] overflow-hidden">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#1F1E1B]/30 z-50">
        <div
          className="h-full bg-gradient-to-r from-[#F4C842] to-[#C99D2F] transition-all duration-500 ease-out"
          style={{ width: `${((slide + 1) / totalSlides) * 100}%` }}
        />
      </div>

      {/* Slide counter */}
      <div className="fixed top-4 right-6 z-40 text-xs text-[#F7F4EE]/70 font-mono tabular-nums tracking-wider">
        {String(slide + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
      </div>

      {/* UP Wellness brand */}
      <div className="fixed top-4 left-6 z-40 flex items-center gap-2">
        <Microscope className="w-4 h-4 text-[#F4C842]" />
        <span className="text-xs tracking-[0.2em] font-semibold text-[#F7F4EE]/80">UP&nbsp;LABS · SAB</span>
      </div>

      {/* Slide container */}
      <div className="min-h-screen flex items-center justify-center px-6 py-20 sm:px-12">
        {/* === SLIDE 0: COVER === */}
        {slide === 0 && (
          <div className="max-w-5xl text-center animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F4C842]/40 bg-[#F4C842]/10 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-[#F4C842]" />
              <span className="text-xs tracking-[0.2em] uppercase text-[#F4C842]">เฉพาะสมาชิก · members only</span>
            </div>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-light mb-6 tracking-tight">
              Scientific
              <br />
              <span className="font-serif italic text-[#F4C842]">Advisory Board</span>
            </h1>
            <p className="text-lg sm:text-2xl text-[#F7F4EE]/80 max-w-3xl mx-auto leading-relaxed mb-10 font-light">
              นักวิทยาศาสตร์ระดับโลก 14 คน ที่อยู่เบื้องหลัง
              <br className="hidden sm:block" />
              ทุก Nutrilite · Artistry · Body Key
            </p>
            <div className="flex flex-wrap gap-3 justify-center text-xs">
              {['Buck Institute', 'Stanford', 'UCLA', 'Pennington · LSU', 'Linus Pauling Inst.', 'U Michigan', 'Seoul National Univ.', 'Tohoku Univ.', 'Leibniz Germany', 'Ewha Womans', 'NC State', 'Queens Belfast', 'UC Dublin', 'HEM Pharma'].map(
                (i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full border border-[#F7F4EE]/20 bg-[#F7F4EE]/5">
                    {i}
                  </span>
                ),
              )}
            </div>
            <div className="mt-12 text-xs text-[#F7F4EE]/50 tracking-widest">
              ↓ ↓ ↓ &nbsp; กดลูกศรหรือลากนิ้ว &nbsp; ↓ ↓ ↓
            </div>
          </div>
        )}

        {/* === SLIDE 1: INTRO === */}
        {slide === 1 && (
          <div className="max-w-4xl animate-fadeIn">
            <div className="text-xs tracking-[0.2em] uppercase text-[#F4C842] mb-4">บทเปิด</div>
            <h2 className="text-4xl sm:text-5xl font-light mb-8 leading-tight">
              ทำไมเรื่องนี้ <span className="italic font-serif text-[#F4C842]">ต้องรู้</span>
            </h2>
            <div className="space-y-6 text-lg sm:text-xl text-[#F7F4EE]/90 leading-relaxed">
              <p>
                คนทั่วไปคิดว่า Amway = บริษัทขายตรง
                <br />
                <span className="text-[#F4C842] font-serif italic">แต่ความจริง...</span>
              </p>
              <p>
                Amway มีคณะ <strong className="text-[#F4C842]">Scientific Advisory Board</strong> ที่
                ประกอบด้วยนักวิทยาศาสตร์ระดับโลก <strong>14 คน</strong> จาก
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {['Buck Institute', 'Stanford', 'UCLA', 'U Michigan', 'Linus Pauling', 'Pennington · LSU'].map((s) => (
                  <div key={s} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F7F4EE]/5 border border-[#F7F4EE]/10">
                    <Award className="w-4 h-4 text-[#F4C842]" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <p className="pt-4">
                ทุก ๆ ผลิตภัณฑ์ที่เราใช้ — <strong>Nutrilite, Artistry, Body Key, Glister, Satinique</strong> —
                ผ่านการกลั่นกรองโดยคนเหล่านี้ก่อนจะถึงมือคุณ
              </p>
              <p className="text-2xl font-serif italic text-[#F4C842] pt-4">
                "นี่ไม่ใช่ระดับ marketing — นี่คือระดับ Nobel science"
              </p>
            </div>
          </div>
        )}

        {/* === ADVISOR SLIDES (2 to 15) === */}
        {slide >= 2 && slide <= 15 && (() => {
          const a = ADVISORS[slide - 2]
          const Icon = a.Icon
          return (
            <div className="max-w-6xl w-full animate-fadeIn">
              <div className="grid lg:grid-cols-12 gap-8 items-start">
                {/* Left: Icon + meta */}
                <div className="lg:col-span-4">
                  <div className="text-xs tracking-[0.2em] uppercase text-[#F4C842] mb-2">
                    {a.rank} of 14 · {a.flag}
                  </div>
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#F4C842]/20 to-[#C99D2F]/20 border border-[#F4C842]/30 flex items-center justify-center mb-6">
                    <Icon className="w-12 h-12 text-[#F4C842]" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-light mb-2 leading-tight">{a.name}</h2>
                  <p className="text-sm text-[#F7F4EE]/60 mb-4 leading-relaxed">{a.credentials}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-[#F4C842] shrink-0 mt-0.5" />
                      <span className="text-[#F7F4EE]/80">{a.institution}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <FlaskConical className="w-4 h-4 text-[#F4C842] shrink-0 mt-0.5" />
                      <span className="text-[#F7F4EE]/80">{a.field}</span>
                    </div>
                  </div>
                </div>

                {/* Right: WOW + Relevance */}
                <div className="lg:col-span-8">
                  <div className="bg-[#F7F4EE]/5 backdrop-blur-sm border border-[#F4C842]/20 rounded-2xl p-6 mb-4">
                    <div className="flex items-start gap-3 mb-4">
                      <Trophy className="w-6 h-6 text-[#F4C842] shrink-0 mt-1" />
                      <p className="text-xl font-serif italic text-[#F4C842] leading-snug">{a.signature}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="text-xs tracking-[0.2em] uppercase text-[#F7F4EE]/50 mb-3">★ ความว้าวระดับโลก</div>
                    {a.wow.map((point, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm sm:text-base text-[#F7F4EE]/90 leading-relaxed">
                        <span className="text-[#F4C842] font-mono shrink-0 mt-0.5">0{i + 1}</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-br from-[#F4C842]/10 to-transparent border-l-2 border-[#F4C842] pl-4 py-3 rounded-r-lg">
                    <div className="text-xs tracking-[0.2em] uppercase text-[#F4C842] mb-2 flex items-center gap-2">
                      <Heart className="w-3 h-3" /> เชื่อมกับ UP Wellness ยังไง
                    </div>
                    <p className="text-sm text-[#F7F4EE]/90 leading-relaxed">{a.relevance}</p>
                  </div>

                  {a.links.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.links.map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-full bg-[#F7F4EE]/5 border border-[#F7F4EE]/15 hover:bg-[#F4C842]/10 hover:border-[#F4C842]/30 transition-colors flex items-center gap-1.5 text-[#F7F4EE]/70 hover:text-[#F4C842]"
                        >
                          <ExternalLink className="w-3 h-3" /> {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* === SLIDE 16: SUMMARY === */}
        {slide === 16 && (
          <div className="max-w-4xl animate-fadeIn">
            <div className="text-xs tracking-[0.2em] uppercase text-[#F4C842] mb-4">บทสรุป</div>
            <h2 className="text-4xl sm:text-5xl font-light mb-8 leading-tight">
              เรา <span className="italic font-serif text-[#F4C842]">ไม่ใช่</span> บริษัทขายตรงทั่วไป
            </h2>

            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              <div className="bg-[#F7F4EE]/5 border border-[#F4C842]/20 rounded-xl p-5">
                <div className="text-3xl font-light text-[#F4C842] mb-1">14</div>
                <div className="text-xs tracking-wider text-[#F7F4EE]/70">นักวิทยาศาสตร์ระดับโลก</div>
              </div>
              <div className="bg-[#F7F4EE]/5 border border-[#F4C842]/20 rounded-xl p-5">
                <div className="text-3xl font-light text-[#F4C842] mb-1">7</div>
                <div className="text-xs tracking-wider text-[#F7F4EE]/70">ประเทศ · 4 ทวีป</div>
              </div>
              <div className="bg-[#F7F4EE]/5 border border-[#F4C842]/20 rounded-xl p-5">
                <div className="text-3xl font-light text-[#F4C842] mb-1">2,000+</div>
                <div className="text-xs tracking-wider text-[#F7F4EE]/70">peer-reviewed papers</div>
              </div>
            </div>

            <div className="space-y-5 text-lg sm:text-xl text-[#F7F4EE]/90 leading-relaxed">
              <p>
                เมื่อคุณส่ง Nutrilite ให้คนที่คุณรัก —
                <br />
                คุณกำลังส่ง <span className="text-[#F4C842] italic font-serif">science ระดับ Buck Institute</span> + <span className="text-[#F4C842] italic font-serif">Pennington Biomedical</span> ให้เขา
              </p>
              <p>
                เมื่อคุณแนะนำ Body Key —
                <br />
                คุณกำลังแนะนำ <span className="text-[#F4C842] italic font-serif">หลักการเดียวกับ CALERIE Study</span> ที่
                Peter Attia เชิญสัมภาษณ์ Dr. Ravussin
              </p>
              <p>
                เมื่อคุณใช้ Artistry —
                <br />
                คุณกำลังใช้สูตรที่ผ่าน <span className="text-[#F4C842] italic font-serif">มาตรฐาน University of Michigan</span> + <span className="text-[#F4C842] italic font-serif">Seoul National University</span>
              </p>
              <p className="pt-6 text-2xl font-serif italic text-[#F4C842] text-center">
                "หมอประจำตระกูล"
                <br />
                ที่หลังบ้านคือ Nobel-grade science
              </p>
            </div>
          </div>
        )}

        {/* === SLIDE 17: HOW TO USE + SOURCES === */}
        {slide === 17 && (
          <div className="max-w-4xl animate-fadeIn">
            <div className="text-xs tracking-[0.2em] uppercase text-[#F4C842] mb-4">การนำไปใช้</div>
            <h2 className="text-4xl sm:text-5xl font-light mb-8 leading-tight">
              ใช้ความรู้นี้ <span className="italic font-serif text-[#F4C842]">อย่างไร</span>
            </h2>

            <div className="space-y-4 text-base sm:text-lg text-[#F7F4EE]/90 leading-relaxed mb-10">
              <div className="flex items-start gap-3">
                <span className="text-[#F4C842] font-mono shrink-0">01</span>
                <span>
                  <strong className="text-[#F4C842]">เวลาเล่า Opp Talk</strong> · ใส่ 1-2 ชื่อนักวิทยาศาสตร์ที่ตรงกับ pain ของผู้ฟัง
                  (อายุ → Furman · ลดน้ำหนัก → Ravussin · ผิว → Fisher/Cho)
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#F4C842] font-mono shrink-0">02</span>
                <span>
                  <strong className="text-[#F4C842]">ตอบ objection</strong> "Amway ไม่ใช่วิทยาศาสตร์" → ส่ง slide นี้ + บอกว่า ลองอ่าน
                  Stanford 1000 Immunomes ก่อนแล้วค่อยคุยกัน
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#F4C842] font-mono shrink-0">03</span>
                <span>
                  <strong className="text-[#F4C842]">เพิ่ม credibility ของตัวเอง</strong> · เราในฐานะที่ปรึกษา ใช้ science ของ Pennington
                  + Linus Pauling Institute ดูแลลูกค้า
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#F4C842] font-mono shrink-0">04</span>
                <span>
                  <strong className="text-[#F4C842]">แชร์ slide เป็น URL</strong> ส่วนตัว: <code className="px-2 py-0.5 rounded bg-[#F7F4EE]/10 text-[#F4C842] text-sm">upwellness-ops.vercel.app/sab</code>
                </span>
              </div>
            </div>

            <div className="border-t border-[#F7F4EE]/20 pt-6">
              <div className="text-xs tracking-[0.2em] uppercase text-[#F7F4EE]/50 mb-4">แหล่งอ้างอิง</div>
              <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#F7F4EE]/60">
                <a href="https://www.amwayglobal.com/scientific-advisors/" target="_blank" rel="noopener noreferrer" className="hover:text-[#F4C842] transition flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" /> Amway Scientific Advisors (Official)
                </a>
                <a href="https://www.buckinstitute.org/lab/furman-lab/" target="_blank" rel="noopener noreferrer" className="hover:text-[#F4C842] transition flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" /> Buck Institute · Furman Lab
                </a>
                <a href="https://peterattiamd.com/ericravussin/" target="_blank" rel="noopener noreferrer" className="hover:text-[#F4C842] transition flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" /> Peter Attia Drive #324 · Ravussin
                </a>
                <a href="https://lpi.oregonstate.edu/faculty-staff/emily-ho" target="_blank" rel="noopener noreferrer" className="hover:text-[#F4C842] transition flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" /> Linus Pauling Institute
                </a>
              </div>
            </div>

            <div className="mt-10 text-center">
              <div className="inline-flex items-center gap-2 text-xs tracking-[0.2em] text-[#F7F4EE]/40">
                <Microscope className="w-3 h-3" />
                UP&nbsp;LABS · Scientific Advisory Board · 2026
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        disabled={slide === 0}
        className="fixed left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#F7F4EE]/10 backdrop-blur-sm border border-[#F7F4EE]/20 flex items-center justify-center transition-all hover:bg-[#F4C842]/20 hover:border-[#F4C842]/40 disabled:opacity-30 disabled:cursor-not-allowed z-40"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6 text-[#F7F4EE]" />
      </button>
      <button
        onClick={next}
        disabled={slide === totalSlides - 1}
        className="fixed right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#F7F4EE]/10 backdrop-blur-sm border border-[#F7F4EE]/20 flex items-center justify-center transition-all hover:bg-[#F4C842]/20 hover:border-[#F4C842]/40 disabled:opacity-30 disabled:cursor-not-allowed z-40"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6 text-[#F7F4EE]" />
      </button>

      {/* Dot indicators (bottom) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-40 max-w-[90vw] overflow-x-auto px-4">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`shrink-0 transition-all ${
              i === slide
                ? 'w-8 h-1.5 bg-[#F4C842] rounded-full'
                : 'w-1.5 h-1.5 bg-[#F7F4EE]/30 hover:bg-[#F7F4EE]/60 rounded-full'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Animation styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
        `,
      }} />
    </div>
  )
}
