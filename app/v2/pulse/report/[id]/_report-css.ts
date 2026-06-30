/**
 * Scoped stylesheet for the v2 Pulse report — "Pook" olive/gold/cream medical CI.
 * Everything is namespaced under `.rpt` so it can't leak into the app's clinical-warm
 * Tailwind layer. Ported from 05_Reports/Wearable-Reports/Pook-Whoop-Report-v2.html
 * (tokens, hero, SVG gauges, sticky TOC, font-size control via [data-fs], print rules)
 * plus report-specific blocks (TOC, stat rows, insight list, BCA/CGM/food cards).
 */
export const REPORT_CSS = `
.rpt{
  --olive:#3D5826; --olive-light:#5A7A3A; --olive-pale:#E8EDE0;
  --gold:#F4C842; --gold-deep:#C99D2F; --gold-pale:#FBF3D6;
  --cream:#F7F4EE; --cream-dark:#EDE8DE;
  --ink:#1F1E1B; --ink-60:#56544E; --ink-40:#8B8880; --ink-20:#C7C3B8;
  --green:#5A7A3A; --green-bg:#E8EDE0;
  --amber:#D89A1E; --amber-bg:#FAF0D6;
  --red:#C2533F; --red-bg:#F6E2DC;
  --blue:#3E6E8E; --blue-bg:#DCE8EF;
  --white:#FFFFFF;
  --shadow:0 1px 3px rgba(31,30,27,.06),0 8px 24px -12px rgba(31,30,27,.12);
  --shadow-lg:0 2px 8px rgba(31,30,27,.08),0 24px 48px -20px rgba(31,30,27,.18);
  --radius:20px; --radius-sm:14px;
  font-family:'Sarabun',sans-serif; background:var(--cream); color:var(--ink);
  line-height:1.65; -webkit-font-smoothing:antialiased; min-height:100vh;
  display:block; overflow-x:hidden;
}
.rpt *{box-sizing:border-box}
.rpt h1,.rpt h2,.rpt h3,.rpt h4{font-family:'Kanit',sans-serif;font-weight:600;letter-spacing:-.01em;margin:0}
.rpt .rpt-wrap{max-width:1120px;margin:0 auto;padding:0 24px}

/* font-size scaling via [data-fs] on #rpt-doc */
#rpt-doc{transition:zoom .15s}
#rpt-doc[data-fs="sm"]{zoom:.88}
#rpt-doc[data-fs="md"]{zoom:1}
#rpt-doc[data-fs="lg"]{zoom:1.15}
#rpt-doc[data-fs="xl"]{zoom:1.3}

/* progress bar */
#rpt-prog{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--olive-light));z-index:200;width:0;transition:width .1s}

/* font-size control */
#rpt-fsctl{position:fixed;top:14px;right:14px;z-index:210;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border:1px solid var(--cream-dark);border-radius:100px;padding:5px 8px;box-shadow:0 4px 16px -6px rgba(31,30,27,.25)}
#rpt-fsctl button{width:30px;height:30px;border:none;border-radius:50%;background:var(--cream);color:var(--olive);font-family:'Kanit';font-weight:700;cursor:pointer;transition:background .2s,transform .15s;display:flex;align-items:center;justify-content:center;line-height:1}
#rpt-fsctl button:hover{background:var(--olive-pale);transform:scale(1.08)}
#rpt-fsctl button:active{transform:scale(.94)}
#rpt-fsctl button.b1{font-size:11px}
#rpt-fsctl button.b2{font-size:14px}
#rpt-fsctl button.b3{font-size:17px}
#rpt-fsctl button.b4{font-size:20px}
#rpt-fsctl button.on{background:var(--olive);color:var(--gold)}
#rpt-fsctl .lbl{font-family:'Kanit';font-size:10px;color:var(--ink-40);font-weight:500;padding-right:2px;letter-spacing:.02em}
@media(max-width:520px){#rpt-fsctl .lbl{display:none}#rpt-fsctl{top:10px;right:10px;padding:4px 6px}}

/* print button */
#rpt-printbtn{position:fixed;top:14px;right:210px;z-index:210;display:inline-flex;align-items:center;gap:7px;background:var(--olive);color:var(--gold);border:none;border-radius:100px;padding:9px 16px;font-family:'Kanit';font-weight:600;font-size:13px;cursor:pointer;box-shadow:0 4px 16px -6px rgba(61,88,38,.5);transition:transform .15s,box-shadow .2s}
#rpt-printbtn:hover{transform:translateY(-1px);box-shadow:0 8px 20px -8px rgba(61,88,38,.6);background:#46612C}
#rpt-printbtn:active{transform:scale(.97)}
@media(max-width:760px){#rpt-printbtn{right:auto;left:10px;top:auto;bottom:16px;padding:11px 18px}}

/* HERO */
.rpt-hero{position:relative;background:linear-gradient(155deg,#2E441C 0%,var(--olive) 55%,#46612C 100%);color:var(--cream);padding:56px 0 130px;overflow:hidden}
.rpt-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 10%,rgba(244,200,66,.18),transparent 45%),radial-gradient(circle at 10% 90%,rgba(90,122,58,.4),transparent 50%);pointer-events:none}
.rpt-hero-grid{position:absolute;inset:0;opacity:.05;background-image:linear-gradient(var(--cream) 1px,transparent 1px),linear-gradient(90deg,var(--cream) 1px,transparent 1px);background-size:48px 48px}
.rpt-hero-inner{position:relative;z-index:2}
.rpt-back{display:inline-block;color:rgba(247,244,238,.78);font-family:'Kanit';font-size:13px;font-weight:500;text-decoration:none;margin-bottom:18px;transition:color .2s}
.rpt-back:hover{color:var(--gold)}
.rpt-kicker{display:inline-flex;align-items:center;gap:8px;font-family:'Kanit';font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);background:rgba(244,200,66,.1);border:1px solid rgba(244,200,66,.25);padding:7px 14px;border-radius:100px;margin-bottom:20px}
.rpt-kicker .dot{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 0 rgba(244,200,66,.5);animation:rpt-pulse 2.5s infinite}
@keyframes rpt-pulse{0%{box-shadow:0 0 0 0 rgba(244,200,66,.5)}70%{box-shadow:0 0 0 10px rgba(244,200,66,0)}100%{box-shadow:0 0 0 0 rgba(244,200,66,0)}}
.rpt-hero h1{font-size:clamp(32px,5vw,56px);font-weight:700;line-height:1.05;margin-bottom:10px}
.rpt-hero h1 .accent{background:linear-gradient(120deg,var(--gold),#FFE08A);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.rpt-hero-sub{font-size:16px;color:rgba(247,244,238,.82);max-width:600px;margin-bottom:26px}
.rpt-hero-meta{display:flex;flex-wrap:wrap;gap:10px}
.rpt .chip{display:inline-flex;align-items:center;gap:7px;background:rgba(247,244,238,.08);border:1px solid rgba(247,244,238,.16);backdrop-filter:blur(8px);padding:9px 15px;border-radius:100px;font-size:13px;font-family:'Kanit';font-weight:400}
.rpt .chip b{font-weight:600;color:var(--gold)}

/* score strip */
.rpt-scorestrip{margin-top:-92px;position:relative;z-index:5}
.rpt-score-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.rpt-score-card{background:var(--white);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-lg);border:1px solid var(--cream-dark);position:relative;overflow:hidden;transition:transform .3s}
.rpt-score-card:hover{transform:translateY(-4px)}
.rpt-gauge{position:relative;width:96px;height:96px;margin:0 auto 12px}
.rpt-gauge svg{position:relative;z-index:2;display:block}
.rpt-gauge .gv{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1}
.rpt-gauge .gv .n{font-family:'Kanit';font-weight:700;font-size:24px;line-height:1;color:var(--ink)}
.rpt-gauge .gv .n .pct{font-size:13px}
.rpt-gauge .gv .u{font-size:9px;color:var(--ink-40);font-family:'Kanit';margin-top:2px;max-width:80px;text-align:center;line-height:1.1}
.rpt-score-lbl{text-align:center;font-family:'Kanit';font-weight:600;font-size:14px;margin-bottom:3px}
.rpt-score-desc{text-align:center;font-size:11px;color:var(--ink-40);line-height:1.4;min-height:15px}
.rpt-tag{position:absolute;top:14px;right:14px;font-size:9px;font-family:'Kanit';font-weight:600;letter-spacing:.06em;padding:3px 8px;border-radius:100px}
.rpt-tag.good{background:var(--green-bg);color:var(--green)}
.rpt-tag.ok{background:var(--amber-bg);color:var(--amber)}
.rpt-tag.watch{background:var(--red-bg);color:var(--red)}

/* TOC index */
.rpt-toc{position:sticky;top:0;z-index:100;background:rgba(247,244,238,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--cream-dark);margin-top:40px}
.rpt-toc-inner{display:flex;align-items:center;gap:14px;padding:12px 0;overflow-x:auto;scrollbar-width:thin}
.rpt-toc-label{flex-shrink:0;font-family:'Kanit';font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-deep)}
.rpt-toc-links{display:flex;gap:8px;flex-wrap:nowrap}
.rpt-toc-link{flex-shrink:0;font-family:'Kanit';font-weight:500;font-size:12.5px;color:var(--ink-60);background:var(--white);border:1px solid var(--cream-dark);padding:6px 13px;border-radius:100px;text-decoration:none;white-space:nowrap;transition:all .2s;cursor:pointer}
.rpt-toc-link:hover{background:var(--olive);color:var(--gold);border-color:var(--olive)}
@media(max-width:760px){.rpt-toc-inner{flex-direction:column;align-items:flex-start;gap:8px}.rpt-toc-links{overflow-x:auto;max-width:100%}}

/* sections */
.rpt-section{padding:48px 0}
.rpt-sec-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:26px}
.rpt-sec-num{flex-shrink:0;width:44px;height:44px;border-radius:13px;background:var(--olive);color:var(--gold);display:flex;align-items:center;justify-content:center;font-family:'Kanit';font-weight:700;font-size:18px;box-shadow:0 6px 16px -6px rgba(61,88,38,.5)}
.rpt-sec-head .t{font-size:clamp(21px,3vw,28px);font-weight:600;line-height:1.15;font-family:'Kanit'}
.rpt-sec-head .s{font-size:14px;color:var(--ink-60);margin-top:3px}
.rpt-eyebrow{font-family:'Kanit';font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep);margin-bottom:6px}

/* cards */
.rpt-card{background:var(--white);border:1px solid var(--cream-dark);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.rpt-card-pad{padding:24px}
.rpt-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.rpt-card-title{font-family:'Kanit';font-weight:600;font-size:17px;display:flex;align-items:center;gap:10px}
.rpt-card-title .ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.rpt-metric-now{text-align:right}
.rpt-metric-now .v{font-family:'Kanit';font-weight:700;font-size:22px;line-height:1}
.rpt-metric-now .l{font-size:11px;color:var(--ink-40);font-family:'Kanit'}
.rpt-grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:880px){.rpt-grid2{grid-template-columns:1fr}}

/* stat row */
.rpt-statrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:12px}
.rpt-stat{background:var(--cream);border-radius:var(--radius-sm);padding:14px 12px;text-align:center}
.rpt-stat .v{font-family:'Kanit';font-weight:700;font-size:22px;line-height:1.1}
.rpt-stat .v .u{font-size:11px;font-weight:500;margin-left:2px}
.rpt-stat .l{font-size:11px;color:var(--ink-60);margin-top:4px;line-height:1.2}
.rpt-stat .sub{font-size:10px;color:var(--ink-40);margin-top:2px;font-family:'Kanit'}

/* chart card (used by _Charts) */
.rpt-chart-card{background:var(--white);border:1px solid var(--cream-dark);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px}
.rpt-chart-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.rpt-chart-head .ttl{font-family:'Kanit';font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;min-width:0}
.rpt-chart-head .ttl .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.rpt-chart-head .avg{font-family:'Kanit';font-weight:700;font-size:13px;flex-shrink:0}
.rpt-chart-box{position:relative;height:230px;width:100%}
.rpt-chart-box.tall{height:280px}
.rpt-chart-loading{margin:28px 24px;border:1px solid var(--cream-dark);background:var(--white);border-radius:var(--radius);padding:48px;text-align:center;font-family:'Kanit';font-size:13px;color:var(--ink-60);display:flex;flex-direction:column;align-items:center;gap:10px}
.rpt-spinner{width:24px;height:24px;border:3px solid var(--cream-dark);border-top-color:var(--olive);border-radius:50%;animation:rpt-spin .8s linear infinite}
@keyframes rpt-spin{to{transform:rotate(360deg)}}

/* insight + findings */
.rpt-insight-list{display:flex;flex-direction:column;gap:12px}
.rpt-insight-item{display:flex;gap:12px;background:var(--blue-bg);border-radius:12px;padding:14px 16px;font-size:13.5px;color:var(--ink-60);line-height:1.6}
.rpt-insight-item .ii{flex-shrink:0;font-size:18px}
.rpt-insight{display:flex;gap:12px;border-radius:12px;padding:13px 16px;margin-top:14px;font-size:13px;color:var(--ink-60);line-height:1.6;background:var(--olive-pale)}
.rpt-insight .ii{flex-shrink:0;font-size:17px}
.rpt-insight.g{background:var(--green-bg)}
.rpt-insight.a{background:var(--amber-bg)}
.rpt-insight.r{background:var(--red-bg)}

/* delta chips (BCA) */
.rpt-deltas{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:18px}
.rpt-delta{background:var(--cream);border-radius:var(--radius-sm);padding:14px 16px;border-left:4px solid var(--ink-20)}
.rpt-delta.good{border-left-color:var(--green)}
.rpt-delta.bad{border-left-color:var(--red)}
.rpt-delta .dl{font-size:11px;color:var(--ink-40);font-family:'Kanit'}
.rpt-delta .dv{font-family:'Kanit';font-weight:700;font-size:20px;margin-top:2px}
.rpt-delta .dd{font-size:12px;font-family:'Kanit';font-weight:600;margin-top:2px}
.rpt-delta.good .dd{color:var(--green)}
.rpt-delta.bad .dd{color:var(--red)}

/* TIR bar (CGM) */
.rpt-tir{display:flex;height:30px;border-radius:8px;overflow:hidden;margin:6px 0 4px;font-family:'Kanit';font-size:11px;font-weight:600;color:#fff}
.rpt-tir .seg{display:flex;align-items:center;justify-content:center;min-width:0}
.rpt-tir-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--ink-60);margin-top:8px}
.rpt-tir-legend .li{display:flex;align-items:center;gap:5px}
.rpt-tir-legend .sw{width:10px;height:10px;border-radius:2px}

/* recent meals list (food) */
.rpt-meals{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.rpt-meal{display:flex;align-items:center;gap:12px;background:var(--cream);border-radius:12px;padding:11px 14px}
.rpt-meal .mt{flex-shrink:0;font-size:10px;font-family:'Kanit';font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--gold-deep);width:64px}
.rpt-meal .mf{flex:1;font-size:13px;color:var(--ink);min-width:0}
.rpt-meal .mk{flex-shrink:0;font-family:'Kanit';font-weight:600;font-size:12px;color:var(--ink-60)}
.rpt-meal .mh{flex-shrink:0;font-size:11px;font-family:'Kanit';font-weight:600;padding:2px 8px;border-radius:100px}

/* lab table */
.rpt-labcat{margin-top:18px}
.rpt-labcat-title{font-family:'Kanit';font-weight:600;font-size:14px;margin-bottom:8px;color:var(--ink)}
.rpt-table-wrap{overflow-x:auto}
.rpt-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}
.rpt-table th{padding:11px 14px;font-family:'Kanit';font-weight:600;font-size:11px;color:var(--ink-60);background:var(--cream);border-bottom:1px solid var(--cream-dark);white-space:nowrap}
.rpt-table th.num,.rpt-table td.num{text-align:right;font-family:'Kanit';font-variant-numeric:tabular-nums}
.rpt-table td{padding:11px 14px;border-bottom:1px solid var(--cream-dark);font-size:13px}
.rpt-table tbody tr:last-child td{border-bottom:none}
.rpt-table td.name{font-weight:600;color:var(--ink)}
.rpt-table td.ref{font-size:10px;color:var(--ink-40);white-space:nowrap}
.rpt-table td .arrow{font-size:10px}

/* empty + disclaimer + footer */
.rpt-empty{background:var(--white);border:1px dashed var(--ink-20);border-radius:var(--radius);padding:48px 24px;text-align:center}
.rpt-empty-ic{font-size:34px;margin-bottom:10px}
.rpt-empty .t{font-family:'Kanit';font-size:15px;color:var(--ink);font-weight:600}
.rpt-empty .s{font-size:13px;color:var(--ink-40);margin-top:6px}
.rpt-empty-btn{display:inline-block;margin-top:16px;background:var(--olive);color:var(--gold);font-family:'Kanit';font-weight:600;font-size:13px;padding:10px 18px;border-radius:100px;text-decoration:none}
.rpt-disclaimer{background:var(--white);border:1px dashed var(--ink-20);border-radius:var(--radius);padding:22px 26px;font-size:12.5px;color:var(--ink-60);line-height:1.7}
.rpt-disclaimer b{color:var(--ink);font-family:'Kanit'}
.rpt-footer{background:var(--olive);color:rgba(247,244,238,.7);padding:38px 0;margin-top:44px;text-align:center}
.rpt-footer .fb{font-family:'Kanit';font-weight:600;font-size:18px;color:var(--cream);margin-bottom:6px}
.rpt-footer .ftline{font-size:13px}
.rpt-footer .ft-tag{font-style:italic;font-family:'Lora';color:var(--gold);font-size:15px;margin-top:6px}
.rpt-footer .meta{font-size:11.5px;margin-top:16px;color:rgba(247,244,238,.45)}

@media(max-width:880px){.rpt-score-cards{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.rpt-score-cards{grid-template-columns:1fr}.rpt .rpt-wrap{padding:0 18px}}

/* PRINT / PDF */
@media print{
  @page{size:A4;margin:12mm}
  .rpt{background:#fff !important}
  .rpt *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  #rpt-doc{zoom:1 !important}
  .no-print,#rpt-fsctl,#rpt-prog,#rpt-printbtn,.rpt-toc,.rpt-back{display:none !important}
  .rpt .rpt-wrap{max-width:none !important;padding:0 !important}
  .rpt-section{padding:14px 0 !important}
  .rpt-hero{padding:26px 0 40px !important}
  .rpt-hero h1{font-size:30px !important}
  .rpt-scorestrip{margin-top:-26px !important}
  .rpt-score-card,.rpt-card,.rpt-chart-card,.rpt-delta,.rpt-meal,.rpt-disclaimer,.rpt-stat,.rpt-insight-item,.rpt-chart-box{break-inside:avoid;page-break-inside:avoid}
  .rpt-sec-head{break-after:avoid;page-break-after:avoid}
  .rpt-chart-box{height:240px !important}
  .rpt-card,.rpt-score-card,.rpt-chart-card{box-shadow:none !important}
}
`;
