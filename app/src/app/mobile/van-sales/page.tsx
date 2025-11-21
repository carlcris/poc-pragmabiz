import { redirect } from "next/navigation";

export default function VanSalesPage() {
  // Redirect to dashboard by default
  redirect("/mobile/van-sales/dashboard");
}
