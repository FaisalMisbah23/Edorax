import s from "./hero-floaters.module.css";

// Four small cards that float beside the hero headline on a wide screen. Each one is a
// real moment from the product (a shell step passing, a lab check, a hint, a narrated
// chapter), so the empty margins show what learning here looks like. They are decoration:
// hidden from screen readers, never in the way of a click, and not shown where there is
// no room for them (under 1280px wide).

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#12805C" />
      <path d="M4.5 8.3 L7 10.6 L11.5 5.6" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function HeroFloaters() {
  return (
    <div className={s.layer} aria-hidden="true">
      {/* Shell lab: the first step of the lab in the window below. */}
      <div className={`${s.slot} ${s.leftTop}`}>
        <div className={`${s.card} ${s.dark}`}>
          <p className={s.label}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 8 4 4-4 4M12 16h7" />
            </svg>
            Shell lab
          </p>
          <p className={s.mono}>
            <span className={s.prompt}>~ $</span> pwd
          </p>
          <p className={`${s.mono} ${s.dim}`}>/home/learner</p>
          <p className={s.pass}>
            <Tick />
            Step 1 of 3 done
          </p>
        </div>
      </div>

      {/* Visual lab: one check from the system design board. */}
      <div className={`${s.slot} ${s.leftBottom}`}>
        <div className={s.card}>
          <p className={s.label}>
            <span className={s.dotBlue} />
            Visual lab check
          </p>
          <p className={s.title}>Serves the load</p>
          <div className={s.needGot}>
            <span>
              <small>Need</small>
              10,000/s
            </span>
            <span>
              <small>Got</small>
              <b>12,400/s</b>
            </span>
          </div>
          <p className={s.pass}>
            <Tick />4 of 4 checks pass
          </p>
        </div>
      </div>

      {/* A hint, the way the labs give one when you are stuck. */}
      <div className={`${s.slot} ${s.rightTop}`}>
        <div className={`${s.card} ${s.hint}`}>
          <p className={s.label}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.1V16h6v-.4c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3Z" />
            </svg>
            Hint
          </p>
          <p className={s.body}>The reply needs a route back too. Check the server&apos;s routes.</p>
        </div>
      </div>

      {/* Listen: the narrated chapter from the Listen tab below. */}
      <div className={`${s.slot} ${s.rightBottom}`}>
        <div className={s.card}>
          <p className={s.label}>
            <span className={s.dotBlue} />
            Listen
          </p>
          <div className={s.player}>
            <span className={s.play}>
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
            <span className={s.playerText}>
              <span className={s.title}>Set the scene</span>
              <span className={s.track}>
                <span className={s.trackFill} />
              </span>
            </span>
            <span className={s.speed}>1.5x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
