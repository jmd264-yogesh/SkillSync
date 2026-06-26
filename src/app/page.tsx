import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "ADMIN":
      redirect("/admin/analytics");
    case "MANAGER":
      redirect("/manager/approvals");
    default:
      redirect("/employee/my-skills");
  }
}
