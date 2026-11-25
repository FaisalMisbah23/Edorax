import Link from "next/link";
import { Dot } from "@/components/brand/dot";
import { Wordmark } from "@/components/brand/wordmark";
import { FEATURE_PAGES, featurePath, type FeaturePageContent } from "./feature-pages";
import s from "./feature-page.module.css";

// One layout for every feature landing page (/features/<slug>): a headline with two lines of
// plain copy, three points, one main button with a reassurance line, a framed recording of the
// real product, three steps, the parts of the feature, questions, and a closing button.
// The proof number and the quote are drawn only when the page has real ones.
// Static markup, no client code: the recording loads only its poster until someone presses play.

function Tick() {
  return (
    <svg className={s.tick} width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#2434E0" />
      <path d="M4.5 8.3 L7 10.6 L11.5 5.6" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function Demo({ page }: { page: FeaturePageContent }) {
  const { demo, proof } = page;
  return (
    <figure className={s.demo}>
      {/* data-nosnippet: sample learners and answers in the recording, never the text Google quotes for the page. */}
      <div className={s.window} data-nosnippet="">
        <div className={s.windowBar}>
          <span className={s.windowDots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={s.address}>{demo.address}</span>
        </div>
        <video className={s.video} controls playsInline muted preload="none" poster={`/video/${demo.video}.webp`} width={1280} height={720} aria-label={demo.label}>
          <source src={`/video/${demo.video}.mp4`} type="video/mp4" />
        </video>
      </div>
      <figcaption className={s.caption}>{demo.caption}</figcaption>
      {proof.quote ? (
        <blockquote className={s.quote}>
          <p>{proof.quote.text}</p>
          <footer>{proof.quote.who}</footer>
        </blockquote>
      ) : null}
    </figure>
  );
}

export function FeaturePage({ page }: { page: FeaturePageContent }) {
  const others = FEATURE_PAGES.filter((other) => other.slug !== page.slug);
  return (
    <div className={s.root}>
      <header className={s.header}>
        <div className={s.headerWrap}>
          <Link href="/" aria-label="Edorax home" className={s.logo}>
            <Wordmark tone="light" height={30} />
          </Link>
          <nav aria-label="Main" className={s.nav}>
            <Link href="/catalog" className={s.navLink}>Courses</Link>
            <Link href="/labs" className={`${s.navLink} ${s.hideSm}`}>Labs</Link>
            <Link href="/#pricing" className={`${s.navLink} ${s.hideSm}`}>Pricing</Link>
            <Link href="/login" className={s.navLink}>Sign in</Link>
            <Link href={page.cta.href} className={`${s.btnSmall} ${s.hideSm}`}>{page.cta.label}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={s.hero}>
          <div className={page.demo.video ? s.heroWrap : `${s.heroWrap} ${s.heroSolo}`}>
            <div className={s.copy}>
              <div className={s.eyebrow}>{page.eyebrow}</div>
              <h1 className={s.h1}>
                {page.headline} <span className={s.mark}>{page.headlineMark}</span>
              </h1>
              {page.lead.map((line) => (
                <p key={line} className={s.lead}>{line}</p>
              ))}
              <ul className={s.points}>
                {page.points.map((point) => (
                  <li key={point}>
                    <Tick />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className={s.cta}>
                <Link href={page.cta.href} className={s.btn}>{page.cta.label}</Link>
                <p className={s.note}>{page.cta.note}</p>
              </div>
            </div>
            {/* No frame at all until a real recording exists. */}
            {page.demo.video ? <Demo page={page} /> : null}
          </div>
          {page.proof.number ? (
            <div className={s.proof}>
              <strong>{page.proof.number.value}</strong>
              <span>{page.proof.number.label}</span>
            </div>
          ) : null}
        </section>

        <section className={`${s.section} ${s.white}`} aria-labelledby="how-it-works">
          <div className={s.wrap}>
            <div className={s.eyebrow}>How it works</div>
            <h2 id="how-it-works" className={s.h2}>Three steps.</h2>
            <ol className={s.steps}>
              {page.steps.map((step, i) => (
                <li key={step.title} className={s.step}>
                  <span className={s.stepNumber} aria-hidden="true">{i + 1}</span>
                  <h3 className={s.h3}>{step.title}</h3>
                  <p className={s.body}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.section} aria-labelledby="parts">
          <div className={s.wrap}>
            <div className={s.eyebrow}>In the product now</div>
            <h2 id="parts" className={s.h2}>{page.parts.title}</h2>
            <ul className={s.parts}>
              {page.parts.items.map((part) => (
                <li key={part.title} className={s.part}>
                  <h3 className={s.h3}>{part.title}</h3>
                  <p className={s.body}>{part.body}</p>
                  {part.links ? (
                    <ul className={s.partLinks}>
                      {part.links.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href}>{link.label}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${s.section} ${s.white}`} aria-labelledby="questions">
          <div className={`${s.wrap} ${s.narrow}`}>
            <h2 id="questions" className={s.h2}>Good to know</h2>
            <div className={s.faq}>
              {page.questions.map(([q, a], i) => (
                <details key={q} className={s.faqItem} open={i === 0}>
                  <summary className={s.faqQ}>{q}</summary>
                  <p className={s.faqA}>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={s.final}>
          <div className={s.finalWrap}>
            <div>
              <h2 className={s.finalTitle}>{page.closing.title}</h2>
              <p className={s.finalLine}>{page.closing.line}</p>
              <div className={s.finalCta}>
                <Link href={page.cta.href} className={s.btnYellow}>{page.cta.label}</Link>
                <p className={s.finalNote}>{page.cta.note}</p>
              </div>
            </div>
            <span className={s.finalDot} aria-hidden="true">
              <Dot mood="cheer" size={160} />
            </span>
          </div>
        </section>

        <section className={s.section} aria-labelledby="more">
          <div className={s.wrap}>
            <h2 id="more" className={s.h2Small}>More of Edorax</h2>
            <ul className={s.more}>
              {others.map((other) => (
                <li key={other.slug}>
                  <Link href={featurePath(other.slug)} className={s.moreCard}>
                    <strong>{other.name}</strong>
                    <span>{other.teaser}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/catalog" className={s.moreCard}>
                  <strong>All courses</strong>
                  <span>Courses you read, hear and prove, one course at a time.</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerWrap}>
          <Link href="/" aria-label="Edorax home">
            <Wordmark tone="dark" height={26} />
          </Link>
          <nav aria-label="Footer" className={s.footerNav}>
            {FEATURE_PAGES.map((item) => (
              <Link key={item.slug} href={featurePath(item.slug)}>{item.name}</Link>
            ))}
            <Link href="/catalog">Courses</Link>
            <Link href="/labs">Labs</Link>
            <Link href="/learn">All areas</Link>
            <Link href="/#pricing">Pricing</Link>
            <span>edorax.com</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// The small row on the home page that links to every feature page.
export function ExploreFeatures() {
  return (
    <section id="features" className={`${s.section} ${s.root}`} aria-labelledby="explore-features">
      <div className={`${s.wrap} ${s.exploreWrap}`}>
        <h2 id="explore-features" className={s.h2Small}>Explore features</h2>
        <ul className={s.more}>
          {FEATURE_PAGES.map((page) => (
            <li key={page.slug}>
              <Link href={featurePath(page.slug)} className={s.moreCard}>
                <strong>{page.name}</strong>
                <span>{page.teaser}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
