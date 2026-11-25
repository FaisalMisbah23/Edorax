"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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

/**
 * A product window that plays a short silent loop by itself, like a GIF, while it is on screen.
 * The file loads only when the window first comes into view, and it pauses when scrolled away.
 * People who ask for less motion get the still poster with normal controls instead.
 */
function LoopWindow({ title, file, poster, label }: { title: string; file: string; poster: string; label: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.controls = true;
      return;
    }
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.35 },
    );
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  /** Full screen the loop itself. Esc, or the browser's own exit control, returns to the page. */
  function openFullScreen() {
    const el = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
    else el.webkitEnterFullscreen?.();
  }

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
      <div className={s.stage}>
        <video ref={video} className={s.video} muted loop playsInline preload="none" poster={`/video/${poster}.webp`} width={1280} height={720} aria-label={label}>
          <source src={`/video/${file}.mp4`} type="video/mp4" />
        </video>
        <button type="button" className={s.fullscreen} onClick={openFullScreen}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
          </svg>
          Full screen
        </button>
      </div>
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
          <LoopWindow
            title="Visual lab: design a short-link service"
            file="demo-visual-labs-loop"
            poster="demo-visual-labs"
            label="A short silent loop filmed on edorax.com: a visual lab going from 5 of 11 checks passing to 11 of 11"
          />
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
    id: "visual",
    tab: "Visual labs",
    title: "Build it, then press Run",
    line: "Put the parts on a board, link them and press Run. Each design is tested under normal traffic, the peak and each failure, and every check shows what it measured.",
    listTitle: "What you get",
    items: [
      "System design challenges, cloud and DevOps, and networking labs",
      "Break one part, then run it under load",
      "Every check shows what it measured and why it failed",
      "No account needed to try",
    ],
    cta: { label: "Try a visual lab", href: "/labs/visual" },
    note: "Runs in your browser",
    window: "Visual lab",
    file: "demo-visual-labs",
    label: "Demo filmed on edorax.com: a visual lab going from 5 of 11 checks passing to 11 of 11",
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
        <h2 className={s.h2}>Learn it your way.</h2>
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
