// The feature landing pages at /features/<slug>, one entry per page. FeaturePage in
// feature-page.tsx draws every entry the same way, so a new page is a new entry here (plus a
// recording in public/video). The patterns behind the layout are in docs/marketing/feature-page-patterns.md.
//
// Rules for the copy: every claim is something the product does today; no invented numbers,
// logos or quotes (leave `proof` empty until real ones exist); no trainer names.

import { LAB_SLUGS } from "@/shared/lab/slugs";

export type FeatureLink ={ label: string; href: string };

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
    /** File name in public/video without the extension (needs .mp4 and .webp). Leave out and the page shows no frame. */
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
  {
    slug: "hands-on-labs",
    name: "Hands-on labs",
    teaser: "Build a system on a board, break it and watch every check pass or fail.",
    seo: {
      title: "Hands-on labs: visual, guided and shell",
      description: "Learn by doing on Edorax: visual system design labs in your browser, guided projects checked step by step, and 46 shell labs on real Linux machines.",
    },
    eyebrow: "Hands-on labs",
    headline: "Build it, break it,",
    headlineMark: "see what happens.",
    lead: [
      "Reading tells you how a system should behave. A lab lets you find out: put the parts on a board, pick what fails, and press Run.",
      "Every test case passes or fails in front of you, with the number it measured and the reason. Fix one thing and run again.",
    ],
    points: [
      `${LAB_SLUGS.length} visual labs that run in your browser, with no code and no account to try`,
      "Guided labs: a real project in small steps, with tests on every step",
      "46 shell labs on real Linux machines, in the free desktop app",
    ],
    cta: {
      label: "Open the labs",
      href: "/labs",
      note: "Visual labs open in your browser with no account. Make one when you want to keep your progress.",
    },
    demo: {
      video: "demo-visual-labs",
      address: "edorax.com/labs/visual/hld-visual-url-shortener",
      caption: "Filmed on edorax.com: a visual lab going from 5 of 11 checks passing to 11 of 11.",
      label: "Recording of a visual system design lab on Edorax: parts are added to a board, the tests run, and the checks go from 5 of 11 passing to 11 of 11",
    },
    proof: {},
    steps: [
      { title: "Build", body: "Add parts from the list, link them and set their size. Switch between plain names and real AWS names at any time." },
      { title: "Break", body: "Open a part and press Break it. That only arms the failure. Nothing changes until you run." },
      { title: "Run", body: "The design plays through every scenario: normal traffic, the peak, and each failure. Each test case shows what it measured and why." },
    ],
    parts: {
      title: "Three kinds of lab",
      items: [
        { title: "Visual labs", body: "Design a system on a board and run it. System design, cloud and DevOps, and networking labs are open today.", links: [{ label: "See the visual labs", href: "/labs" }] },
        { title: "Guided labs", body: "One real project, split into small labs. You write the code on your own computer or in a GitHub Codespace, tests check each lab, and a quiz follows it.", links: [{ label: "See the guided labs", href: "/labs/guided" }] },
        { title: "Shell labs", body: "A fresh Linux machine in Docker on your own computer. You type real commands, and the Check button looks at the machine itself.", links: [{ label: "See the shell labs", href: "/labs/shell" }] },
        { title: "Checks that explain", body: "A failed check says what it measured and what is still missing, so you know what to change before you run again." },
        { title: "Help when you are stuck", body: "Shell labs have hints and the visual labs can show a solution. You choose how much help you take." },
        { title: "Labs inside the courses", body: "Chapters embed the same labs next to the lesson that explains them, so you read, then try it." },
      ],
    },
    questions: [
      ["Do I need to install anything?", "Not for the visual labs: they run in your browser. Shell labs use the free Edorax desktop app, because they need a real Linux machine, and the app uses Docker to make one."],
      ["Do I need an account?", "You can open and run a visual lab without one. Sign in to keep your progress, and to use the shell labs in the desktop app."],
      ["What do the labs cost?", "The visual labs on the labs page and the shell labs are free. The guided labs are part of courses you enroll in."],
      ["Can I break things?", "Yes, that is the point. A visual lab resets when you want, and every shell lab starts from a clean machine."],
      ["Which computers does the desktop app run on?", "Windows, macOS on Apple silicon, and Linux. It is an early release."],
    ],
    closing: {
      title: "Start with one lab.",
      line: "Open a board, break one part and see which checks fail.",
    },
  },
  {
    slug: "ai-project-check",
    name: "AI project check",
    teaser: "Push your project to GitHub and get a checked result with numbered next steps.",
    seo: {
      title: "AI project check for your GitHub capstone",
      description: "Finish a course with a real project: push it to your own GitHub repository and an AI check reads it against the brief, then lists what is left to fix.",
    },
    eyebrow: "AI project check",
    headline: "Push your project.",
    headlineMark: "Know what is left.",
    lead: [
      "A course on Edorax can end in a project you build in your own GitHub repository. Paste the link and the check reads your work against the brief.",
      "You get a result, the percentage you reached against the pass mark, and numbered steps for what is left. Push a fix and check again.",
    ],
    points: [
      "Automatic checks first: public repository, CI run, required files",
      "Then an AI review against criteria you can see before you start",
      "A passed check goes to a mentor, who can confirm it or send it back",
    ],
    cta: {
      label: "Start Level 1 free",
      href: "/catalog/dw-level-1",
      note: "A free course with four checked projects. No AI key needed. Up to three checks a day on each project.",
    },
    demo: {
      // No recording yet, so the page shows no frame. Add public/video/feature-project-check.mp4 and .webp, then set video: "feature-project-check".
      address: "edorax.com/courses/dw-level-1",
      caption: "Filmed in the real product: a project check on a test repository.",
      label: "Recording of an AI project check on Edorax: a GitHub repository link is submitted and the report shows the checks, the rubric and what is left",
    },
    proof: {},
    steps: [
      { title: "Build it in your own repository", body: "The course gives you the brief. The work is yours, in a public repository on your own GitHub account." },
      { title: "Paste the link and press Check", body: "The check reads the latest commit on your default branch: the files, the tags and the result of your own CI run. It never runs your code." },
      { title: "Fix what is left and check again", body: "Each thing that is left comes with numbered steps. Push your fix and check again. Every attempt is kept." },
    ],
    parts: {
      title: "What is in it today",
      items: [
        { title: "Criteria you can see", body: "The block lists what the check looks for, and marks which criteria are required, before you submit anything." },
        { title: "Automatic checks", body: "Is the repository public, did the latest CI run pass, are the required files and tags there, and for some projects, does the live site respond." },
        { title: "A rubric, scored", body: "Each criterion gets a score. The report shows your percentage, the pass mark, what is working well and what would make it better." },
        { title: "A mentor in the loop", body: "A check that passes goes to your mentor with the evidence behind each score. On any other result you can press Ask my mentor to look." },
        { title: "A certificate at the end", body: "Finish the course and pass its project checks, and your certificate is issued with a link anyone can verify." },
        {
          title: "In four courses",
          body: "Seven checked projects today, in these courses.",
          links: [
            { label: "Level 1: Code Foundations", href: "/catalog/dw-level-1" },
            { label: "Level 2: Your Portfolio and Outreach Engine", href: "/catalog/site-and-outreach" },
            { label: "Level 3: Build a Support and Knowledge Agent", href: "/catalog/dw-level-3" },
            { label: "Terraform in Practice", href: "/catalog/terraform-in-practice" },
          ],
        },
      ],
    },
    questions: [
      ["Do I need my own AI key?", "No. The project check runs on the platform's key. You get up to three checks a day on each project."],
      ["Does it work with a private repository?", "No. The repository has to be public so the check can read it. It reads the latest commit on the default branch."],
      ["Does it run my code?", "No. It never clones, builds or runs your code. Test results come from your own GitHub Actions run, which the check reads."],
      ["How long does a check take?", "The page says about a minute, and it updates by itself when the result is ready. If nothing changed since your last check, you get the same result back."],
      ["Is the AI result final?", "No. A check that passes goes to your mentor, who can confirm it, change the score or send it back with feedback."],
    ],
    closing: {
      title: "End the course with something you built.",
      line: "Start the free Level 1 course and send in your first project.",
    },
  },
];

export function findFeaturePage(slug: string): FeaturePageContent | undefined {
  return FEATURE_PAGES.find((page) => page.slug === slug);
}

export function featurePath(slug: string): string {
  return `/features/${slug}`;
}
