import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "../components/landing/LandingPage";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";

export default async function Page() {
  const { userId } = await auth();
  if (userId) {
    redirect(SIGNED_IN_HOME_HREF);
  }
  return <LandingPage />;
}
