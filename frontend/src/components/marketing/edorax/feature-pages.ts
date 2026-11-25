// The feature landing pages at /features/<slug>, one entry per page. FeaturePage in
// feature-page.tsx draws every entry the same way, so a new page is a new entry here (plus a
// recording in public/video). The patterns behind the layout are in docs/marketing/feature-page-patterns.md.
//
// Rules for the copy: every claim is something the product does today; no invented numbers,
// logos or quotes (leave `proof` empty until real ones exist); no trainer names.

export type FeatureLink = { label: string; href: string };

export type FeaturePageContent = {
  slug: string;
  /** Short name used in links to the page. */
  name: string;
  /** One line under the name in the "Explore features" row. */
  teaser: string;
  /** The tab title, and a description of 120 to 160 characters. */
  seo: { title: string; description: string };
  eyebrow: string;
  /** The headline is `headline` followed by `headlineMark`, which gets the yellow underline. */
  headline: string;
  headlineMark: string;
  lead: [string, string];
  points: [string, string, string];
  /** The one main button, and the short reassurance line under it. */
  cta: FeatureLink & { note: string };
  demo: {
    /** File name in public/video without the extension (needs .mp4 and .webp). Leave out to show a marked placeholder. */
    video?: string;
    /** The address shown in the window frame. */
    address: string;
    caption: string;
    /** Read by screen readers in place of the recording. */
    label: string;
  };
  /** Real numbers and quotes only. Both stay hidden while they are missing. */
  proof: {
    number?: { value: string; label: string };
    quote?: { text: string; who: string };
  };
  steps: [FeatureStep, FeatureStep, FeatureStep];
  parts: { title: string; items: { title: string; body: string; links?: FeatureLink[] }[] };
  questions: [string, string][];
  closing: { title: string; line: string };
};

type FeatureStep = { title: string; body: string };

export const FEATURE_PAGES: FeaturePageContent[] = [
  {
    slug: "for-instructors",
    name: "For instructors",
    teaser: "Claude drafts a first review of every answer. You approve or send back.",
    seo: {
      title: "AI review drafts for cohort instructors",
      description: "Run a hands-on technical cohort on Edorax: Claude drafts a first review of every written answer, and you approve, edit or send back from one list.",
    },
    eyebrow: "For instructors",
    headline: "Claude drafts every review.",
    headlineMark: "You approve.",
    lead: [
      "Edorax is for the person who runs a hands-on technical cohort. Every written answer your learners send in gets a first review from Claude: what works, what to fix, a suggested verdict and a score.",
      "You read it, edit it if you want, and approve or send it back from one list. Nothing reaches a learner until you send it.",
    ],
    points: [
      "A first review on every open answer, with how sure Claude is",
      "Replies to learner questions, drafted from the chapter they are on",
      "Every learner across all your courses, with an email nudge for the quiet ones",
    ],
    cta: {
      label: "Create a free account",
      href: "/signup",
      note: "Then choose Request instructor access in your account menu. An admin approves each request.",
    },
    demo: {
      video: "feature-instructors",
      address: "edorax.com/review",
      caption: "Filmed in the real product, on a test run with sample learners. The reviews are real Claude drafts.",
      label: "Recording of the Edorax instructor workspace: the list of answers to check with Claude's draft reviews, the learner questions inbox and the learners list",
    },
    proof: {},
    steps: [
      { title: "Learners answer in the course", body: "Your open questions sit inside the chapters. Each one can carry a rubric and a reference answer." },
      { title: "Claude drafts a first review", body: "It reads the question, your rubric and the answer, then writes feedback with a suggested verdict, a score and how sure it is." },
      { title: "You approve or send back", body: "Work down one list. Send the drafts you agree with in one go. Low-confidence drafts always stay for you to read." },
    ],
    parts: {
      title: "What is in the workspace today",
      items: [
        { title: "Answers to check", body: "One card per answer: the question, the learner's answer, Claude's draft and your feedback box. Approve, Send back or Archive without leaving the list. Answers sent in again come first." },
        { title: "Send all drafted reviews", body: "One button sends the drafts as written, after it shows you how many will be approved and how many sent back. Low-confidence drafts are left out." },
        { title: "Learner questions", body: "Questions from every course in one inbox, as a list or a chat view. The AI button writes a reply from the chapter and the course outline. You edit it, then send." },
        { title: "Learners", body: "One row per learner across all your courses: progress, last active and the chapter they are on. Tabs for Waiting on you, Gone quiet, Not started, Active and Completed." },
        { title: "Nudges", body: "Email a reminder to one learner, or to everyone who has been quiet for 7 days or more. The button then rests for a day, so nobody gets two in a row." },
        { title: "Feedback", body: "Flag a learner question as a course problem or a platform problem. Flagged questions and lesson reports collect on one page you can copy as text." },
      ],
    },
    questions: [
      ["Do I need my own AI key?", "No. On edorax.com the review drafts and the reply drafts run on the platform's key. Each draft shows the model that wrote it and what it cost."],
      ["Does anything reach a learner without me?", "No. A draft is only a draft. Feedback is sent when you press Approve or Send back, or when you confirm Send all."],
      ["Which answers get a draft?", "Written answers to open questions that are waiting for review. Capstone projects have their own AI check, with a report you open from the same list."],
      ["Can I run more than one course?", "Yes. Every list opens on all your courses, with a course filter for when you want only one."],
      ["How do I get an instructor account?", "Create a free account, open your account menu and choose Request instructor access. An admin reviews each request."],
    ],
    closing: {
      title: "Spend your time on the answers that need you.",
      line: "Create an account, ask for instructor access and bring your first cohort.",
    },
  },
  {
    slug: "ai-interview-practice",
    name: "AI interview practice",
    teaser: "An AI interviewer that follows up on your answers, then written feedback.",
    seo: {
      title: "AI interview practice with written feedback",
      description: "Practise interviews with an AI interviewer that follows up on your own answers, then read written feedback and three next steps. Runs on your own AI key.",
    },
    eyebrow: "AI interview practice",
    headline: "Practise the interview",
    headlineMark: "before the real one.",
    lead: [
      "An AI interviewer asks one question at a time and follows up on what you actually said: why, how do you know, give me one example.",
      "When you finish, you get written feedback: your strengths, what to do better, things to watch in your own words, and your next three steps.",
    ],
    points: [
      "Follow-up questions built from your own answers",
      "Written feedback that quotes you, with three next steps",
      "Runs on your own AI key: OpenRouter, Google Gemini or Anthropic",
    ],
    cta: {
      label: "Open The Founder Interview",
      href: "/catalog/founder-interviews",
      note: "Eight AI interviews in this course. 10 USD, no subscription. You bring your own AI key.",
    },
    demo: {
      video: "feature-ai-interview",
      address: "edorax.com/courses/founder-interviews",
      caption: "Filmed in the real product: an interview from The Founder Interview, answered by a test learner on a test run.",
      label: "Recording of an AI interview on Edorax: the learner answers, the interviewer asks follow-up questions, and written feedback appears at the end",
    },
    proof: {},
    steps: [
      { title: "Add your AI key once", body: "In Settings, pick OpenRouter, Google Gemini or Anthropic and paste your key. It is tested, then stored encrypted. You pay the provider directly." },
      { title: "Answer the interviewer", body: "Type your answers, or dictate them in a browser that supports it. Each interview has a set number of answers, and you can finish early." },
      { title: "Read your feedback", body: "Strengths, what to do better, notes by topic and your next three steps. Then practise again." },
    ],
    parts: {
      title: "What is in it today",
      items: [
        { title: "Questions about your own work", body: "Some interviews ask you to paste your resume or describe a project first, so the questions are about what you really did." },
        { title: "Topics set by the course", body: "Ownership, impact, five whys, your resume, your best technical work, storytelling, a case study, and strengths and weaknesses." },
        { title: "Flags, with your words as proof", body: "Vague ownership, a number with no source, a story that is really a habit, jargon with no explanation. A flag only shows with a quote from your own answer." },
        { title: "Saved as you go", body: "Close the tab and the interview is still there when you come back. Finish it, read the feedback, and start a new round when you want one." },
        { title: "A person can follow up", body: "The mentor of the course can read your conversation and the feedback, so the practice does not end with the AI." },
        {
          title: "In five courses",
          body: "19 interviews today, spread across these courses.",
          links: [
            { label: "The Founder Interview", href: "/catalog/founder-interviews" },
            { label: "Your Career Brand", href: "/catalog/career-brand" },
            { label: "Win Paid Work", href: "/catalog/win-paid-work" },
            { label: "Learn and Build with AI", href: "/catalog/build-with-ai" },
            { label: "Product Sense for Engineers", href: "/catalog/product-sense" },
          ],
        },
      ],
    },
    questions: [
      ["Why do I need my own AI key?", "The interview runs on your key, so you pay the provider directly for a few cents of usage and Edorax adds nothing on top. Free models on OpenRouter work too."],
      ["Is my key safe?", "It is checked with the provider, then stored encrypted on the server. The page only ever shows its last four characters, and you can delete it at any time."],
      ["Do I get a score?", "No. You get written feedback, not a number. It says what was strong, what to fix and what to do next."],
      ["Does the interviewer speak?", "No. It is a text interview. You can dictate your answers in a browser that supports speech input, and the interviewer replies in writing."],
      ["What does it cost?", "Each course is 10 USD, with no subscription. The AI usage is billed by your provider, not by Edorax."],
    ],
    closing: {
      title: "Take one practice interview today.",
      line: "Pick a course, add your key and answer the first question.",
    },
  },
];

export function findFeaturePage(slug: string): FeaturePageContent | undefined {
  return FEATURE_PAGES.find((page) => page.slug === slug);
}

export function featurePath(slug: string): string {
  return `/features/${slug}`;
}
