import { LandingPage } from "../components/landing/LandingPage";

// Signed-in visitors are redirected to /home in proxy.ts, so this page can be static.
export default function Page() {
  return <LandingPage />;
}
