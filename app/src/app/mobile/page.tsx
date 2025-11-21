import { redirect } from "next/navigation";

export default function MobilePage() {
  // Redirect to mobile login page
  redirect("/mobile/login");
}
