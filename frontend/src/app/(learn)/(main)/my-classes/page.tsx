import type { Metadata } from "next";
import Link from "next/link";
import { Dot } from "@/components/brand/dot";
import { buttonVariants } from "@/components/ui/button";
import { MyClassCard } from "@/components/classes/my-class-card";
import type { MyClassesView } from "@/shared/api/classes";
import { requireLearnSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";

export const metadata: Metadata = { title: "My classes" };

export default async function MyClassesPage() {
  await requireLearnSurface();
  const { classes } = await serverApiFetch<MyClassesView>("/api/v1/classes");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <h1 className="text-[32px] leading-tight tracking-[-0.035em] sm:text-[40px]">My classes</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">The classes you have joined, with each course, your progress and what is due next.</p>
      </header>

      <p className="mt-4 text-base text-muted-foreground">
        Teach a class?{" "}
        <Link href="/organizations" className="font-bold text-primary underline-offset-4 hover:underline">
          Create an organisation.
        </Link>
      </p>

      {classes.length > 0 ? (
        <ul className="mt-8 space-y-5">
          {classes.map((item) => (
            <MyClassCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <div className="mt-8 flex flex-col items-center border border-border bg-card px-6 py-14 text-center">
          <Dot mood="sleep" size={112} />
          <h2 className="mt-4 text-xl tracking-[-0.02em]">You are not in a class yet</h2>
          <p className="mt-2 max-w-sm text-base text-muted-foreground">If your teacher sent you a join link, open it to join their class.</p>
          <Link href="/my-courses" className={buttonVariants({ className: "mt-6" })}>
            Go to my learning
          </Link>
        </div>
      )}
    </div>
  );
}
