"use client";

import Link from "next/link";
import { useId, useState, type KeyboardEvent } from "react";
import s from "./home-showcase.module.css";

// Two showcase sections for the home page. Every recording is filmed from the real product
// (public/video), and every number and claim here is one the product already makes elsewhere.
// A video loads only its small poster until someone presses play.

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

/** A product window: a title bar with three dots, then the recording. */
function ProductWindow({ title, file, label }: { title: string; file: string; label: string }) {
  return (
    <div className={s.window}>
      <div className={s.windowBar}>
        <span className={s.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={s.windowTitle}>{title}</span>
      </div>
      <video key={file} className={s.video} controls playsInline preload="none" poster={`/video/${file}.webp`} width={1920} height={1080} aria-label={label}>
        <source src={`/video/${file}.mp4`} type="video/mp4" />
      </video>
    </div>
  );
}

/** Visual labs, on a dark band: what they are, how many there are, and the real board in a window. */
export function HomeVisualLabs({ labCount, areas }: { labCount: number; areas: string[] }) {
  return (
    <section id="visual-labs" className={s.dark}>
      <div className={`${s.wrap} ${s.split}`}>
        <div className={s.text}>
          <p className={s.eyebrowLight}>Visual labs</p>
          <h2 className={s.h2Light}>Design the system. Then break it.</h2>
          <p className={s.leadLight}>
            Put the parts on a board, link them and press Run. The design is tested under normal traffic, the peak and each failure, and every check tells you
            what it measured.
          </p>
          <ul className={s.ticksLight}>
            {areas.map((area) => (
              <li key={area}>
                <Check />
                {area}
              </li>
            ))}
          </ul>
          <p className={s.stat}>
            <span className={s.statNum}>{labCount}</span>
            <span className={s.statLabel}>visual labs, all in your browser</span>
          </p>
          <div className={s.ctaRow}>
            <Link href="/labs/visual" className={s.btnYellow}>
              Try a visual lab
              <span aria-hidden="true">{"→"}</span>
            </Link>
            <span className={s.ctaNoteLight}>No account needed</span>
          </div>
        </div>
        <div className={s.media}>
          <ProductWindow
            title="Visual lab: design a short-link service"
            file="demo-visual-labs"
            label="Demo filmed on edorax.com: a visual lab going from 5 of 11 checks passing to 11 of 11"
          />
          {/* The end of the recording, as a card: the same result the lab shows when every check passes. */}
          <div className={s.resultCard} aria-hidden="true">
            <p className={s.resultLabel}>Test results</p>
            <p className={s.resultTitle}>Your design passes</p>
            <p className={s.resultBar}>
              <span />
            </p>
            <ul>
              <li>Shortening works</li>
              <li>Clicks are counted</li>
              <li>Serves the whole peak</li>
            </ul>
            <p className={s.resultScore}>11 of 11 checks pass</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type Feature = {
  id: string;
  tab: string;
  title: string;
  line: string;
  listTitle: string;
  items: string[];
  cta: { label: string; href: string };
  note: string;
  window: string;
  file: string;
  label: string;
};

const FEATURES: Feature[] = [
  {
    id: "shell",
    tab: "Shell labs",
    title: "A real Linux machine, on your own computer",
    line: "Press Start. The desktop app builds a fresh machine in Docker, you type real commands, and the checks tick themselves because they look at the machine itself.",
    listTitle: "46 free labs",
    items: ["19 Linux labs", "10 Kubernetes labs", "9 Ansible labs", "8 Docker labs"],
    cta: { label: "Get the desktop app", href: "/labs/shell#download" },
    note: "Windows, macOS (Apple silicon) and Linux",
    window: "Shell lab",
    file: "edorax-desktop-labs",
    label: "Demo filmed in the Edorax desktop app: starting a shell lab and passing its checks",
  },
  {
    id: "interview",
    tab: "AI interview practice",
    title: "Practise the interview before the real one",
    line: "An AI interviewer asks one question at a time and follows up on what you actually said. When you finish, you get written feedback and your next three steps.",
    listTitle: "What you get",
    items: [
      "Follow-up questions built from your own answers",
      "Written feedback that quotes you",
      "Saved as you go, so you can come back",
      "Runs on your own AI key",
    ],
    cta: { label: "See AI interview practice", href: "/features/ai-interview-practice" },
    note: "In five courses today",
    window: "AI interview",
    file: "feature-ai-interview",
    label: "Demo filmed on edorax.com: an AI interview with follow-up questions and written feedback",
  },
  {
    id: "listen",
    tab: "Courses you can hear",
    title: "Read the chapter, or listen to it",
    line: "Pick what you build, listen to the chapter at any speed, and answer checkpoints that tell you why you were right or wrong.",
    listTitle: "What you get",
    items: [
      "Narrated chapters, from 0.75x to 4x",
      "Small audio files for phones and slow connections",
      "Checkpoints inside every chapter",
      "10 USD a course, no subscription",
    ],
    cta: { label: "Browse courses", href: "/catalog" },
    note: "Free courses to start",
    window: "Course reader",
    file: "demo-courses",
    label: "Demo filmed in the Edorax reader: picking a product, listening to a chapter and answering a checkpoint",
  },
  {
    id: "instructors",
    tab: "For instructors",
    title: "Claude drafts every review. You approve.",
    line: "Every written answer your learners send in gets a first review: what works, what to fix, a suggested verdict and a score. Nothing reaches a learner until you send it.",
    listTitle: "What you get",
    items: [
      "A first review on every open answer",
      "Replies to learner questions, drafted from the chapter",
      "Every learner across all your courses",
      "An email nudge for the quiet ones",
    ],
    cta: { label: "See how it works", href: "/features/for-instructors" },
    note: "An admin approves each instructor",
    window: "Answers to check",
    file: "feature-instructors",
    label: "Demo filmed on edorax.com: an instructor approving AI review drafts",
  },
];

/** Four features behind tabs: what each one is, what you get, and the real thing in a window. */
export function HomeFeatureTabs() {
  const [active, setActive] = useState(0);
  const uid = useId();
  const feature = FEATURES[active];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + FEATURES.length) % FEATURES.length;
    setActive(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <section id="labs" className={s.light}>
      <div className={s.wrap}>
        <p className={s.eyebrow}>More than reading</p>
        <h2 className={s.h2}>Four ways to practise for real.</h2>
        <p className={s.lead}>Each one is filmed in the real product. Pick one to see it.</p>

        <div role="tablist" aria-label="Features" className={s.tabs} onKeyDown={onKeyDown}>
          {FEATURES.map((item, index) => (
            <button
              key={item.id}
              id={`${uid}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-controls={`${uid}-panel`}
              tabIndex={index === active ? 0 : -1}
              className={index === active ? s.tabOn : s.tab}
              onClick={() => setActive(index)}
            >
              {item.tab}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${active}`} className={`${s.split} ${s.panel}`}>
          <div key={feature.id} className={`${s.text} ${s.enter}`}>
            <h3 className={s.h3}>{feature.title}</h3>
            <p className={s.panelLine}>{feature.line}</p>
            <p className={s.listTitle}>{feature.listTitle}</p>
            <ul className={s.list}>
              {feature.items.map((item) => (
                <li key={item}>
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
            <div className={s.ctaRow}>
              <Link href={feature.cta.href} className={s.btnOutline}>
                {feature.cta.label}
                <span aria-hidden="true">{"→"}</span>
              </Link>
              <span className={s.ctaNote}>{feature.note}</span>
            </div>
          </div>
          <div className={s.media}>
            <ProductWindow title={feature.window} file={feature.file} label={feature.label} />
          </div>
        </div>
      </div>
    </section>
  );
}
