# Feature landing pages: patterns worth taking

Date: 2026-11-25. Read with the free page fetch tool (one paid scrape, on Educative, returned the same text).
Structure and ideas only. No text, images, logos, layout or brand was copied from any of these pages.

## Pages studied

| Page | Kind | What it does well |
| --- | --- | --- |
| KodeKloud Playgrounds (`kodekloud.com/playgrounds`) | Hands-on labs | A grid that shows everything you can launch |
| KodeKloud AI Tutor (`kodekloud.com/ai-tutor`) | AI feature | Three numbered steps, and a "this is not a chatbot, not a course" comparison |
| Educative Mock Interviews (`educative.io/mock-interview`) | Interview practice | One proof number right under the hero, then the product in the order a user meets it: setup, interview, feedback |
| Final Round AI (`finalroundai.com/ai-mock-interview`) | Interview practice | The questions section answers "what is free, what is paid" directly |
| Aced, formerly Exponent (`aced.io/practice`) | Interview practice | The page works as a product: you can start from the first screen |
| iximiuz Labs (`labs.iximiuz.com`) | Hands-on labs | Every feature block has the same shape: headline, one line, three points, one step, a button, one quote. Numbers are real usage numbers |
| Instruqt (`instruqt.com`) | Lab platform for teams | A self-serve button next to a "talk to us" button, with a short reassurance line under the later buttons |
| Maven for instructors (`maven.com/teach`) | Cohort courses | Speaks only to the instructor, with instructor proof |
| Disco (`disco.co`) | Cohort platform | Tabs let one page cover several features |

## Patterns we take

| # | Pattern | Seen on | Where it is in our layout |
| --- | --- | --- | --- |
| 1 | A short headline, 5 to 9 words, that names the outcome | Educative, iximiuz, Final Round | `headline` |
| 2 | Two lines of plain copy, then exactly three short points | iximiuz | `lead`, `points` |
| 3 | One main button, with one reassurance line right under it | Instruqt, Educative's free entry cards | `cta`, `cta.note` |
| 4 | A real recording of the product beside the hero, in a window frame | The page the owner saw; missing on KodeKloud and Final Round, and those heroes are weaker for it | `demo` |
| 5 | One proof number directly under the hero | Educative | `proof.number` (hidden until real) |
| 6 | One quote pinned to the demo, not a wall of quotes | iximiuz | `proof.quote` (hidden until real) |
| 7 | Exactly three numbered steps | KodeKloud AI Tutor, Final Round, Aced, Instruqt | `steps` |
| 8 | Show the product in the order a user meets it | Educative | `parts` |
| 9 | No pricing table on the feature page: a "what is free, what is paid" answer in the questions | Final Round, Educative | `questions` |
| 10 | The closing button repeats the hero button | Maven, iximiuz | closing band |
| 11 | One page per feature, each for one reader | Maven, KodeKloud | `/features/<slug>` |
| 12 | Links to the other feature pages at the end | KodeKloud, Disco | "More of Edorax" row |

## Patterns we leave

- Sale banners stacked above the hero (KodeKloud, iximiuz). One page showed a broken discount string.
- A hero with no picture of the product (KodeKloud AI Tutor, Final Round).
- A ten-item list of "no this, no that" ticks (KodeKloud AI Tutor). Three points are enough.
- The same quotes repeated down the page, or two different ratings on one page (Disco, Instruqt, Maven).
- Numbers that cannot be checked. We show a number only when it comes from our own data.

## Rules for our pages

- Every claim is something the product does today. Read the code before writing the copy.
- The demo is filmed from the real product. If there is no real recording yet, the frame says so.
- The proof number and the quote stay hidden until the owner supplies real ones.
- If a feature needs the learner's own AI key, the page says so in the points and in the questions.
- Each page has its own title, a description of 120 to 160 characters, a sitemap entry, and `data-nosnippet` on the demo.

## Not found

The page with "Try a mock interview" and "2 Free, no credit card needed" was not found in the fetched text of the interview pages. Educative's page has the "31,000 mock interviews conducted" line, so the rest is most likely drawn by JavaScript on that page.
