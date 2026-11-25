import { NextResponse, type NextRequest } from "next/server";
import { setActiveSurfaceCookie } from "@/server/auth/surface";

// Organisation pages live in the learner area, because most organisation teachers are not
// platform instructors. An instructor working on the teaching side reaches them through this
// link, which switches to the learner side first so the learner area does not send them back.
export async function GET(request: NextRequest) {
  await setActiveSurfaceCookie("learn");
  return NextResponse.redirect(new URL("/organizations", request.url));
}
