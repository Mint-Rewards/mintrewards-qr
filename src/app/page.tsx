import { redirect } from "next/navigation";

/** The app has no public landing page; middleware sends signed-out users to /login. */
export default function Home() {
  redirect("/dashboard");
}
