import { ChapterMdx } from "@/mdx/compile";

// Dev-only specimen sheet of the runnable JavaScript fence, like /zz-diagram-gallery.
// Public, no auth, no data. Each example goes through the real chapter pipeline
// (remark-runnable-js, then the RunnableJs block). See docs/runnable-js-block.md.

const TICKS = "```";

const SOURCE = `## A three line example

Change the numbers and press Run.

${TICKS}js run
const price = 4;
const count = 3;
console.log("Total:", price * count);
${TICKS}

## An example that throws

${TICKS}js run
console.log("Before the mistake");
const user = null;
console.log(user.name);
console.log("This line never runs");
${TICKS}

## An endless loop

${TICKS}js run
console.log("Starting");
while (true) {
  // never ends
}
${TICKS}

## A plain js fence stays read only

${TICKS}js
console.log("I cannot be run");
${TICKS}
`;

export default function RunJsGalleryPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Runnable JavaScript examples</h1>
      <div className="mt-6">
        <ChapterMdx source={SOURCE} />
      </div>
    </main>
  );
}
