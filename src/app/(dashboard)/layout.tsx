import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { DashboardHeader } from "@/components/layouts/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar role={session.user.role} />
      <SidebarInset>
        <DashboardHeader
          userName={session.user.name}
          userRole={session.user.role}
        />
        <main className="flex-1 p-8 gradient-mesh min-h-[calc(100vh-4rem)] overflow-x-hidden">
          <div className=" animate-fade-in">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
