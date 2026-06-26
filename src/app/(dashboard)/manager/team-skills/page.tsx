import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TeamSkillsClient } from "./team-skills-client";

export default async function TeamSkillsPage() {
  const session = await auth();
  if (!session?.user?.employeeId) return null;

  const isAdmin = session.user.role === "ADMIN";

  const reportees = await db.employee.findMany({
    where: isAdmin ? {} : { managerId: session.user.employeeId },
    include: {
      coe: { select: { name: true } },
      designation: { select: { name: true } },
      employeeSkills: {
        where: { status: "APPROVED" },
        include: { skill: { select: { name: true, category: true } } },
        orderBy: { validatedLevel: "desc" },
      },
      _count: { select: { employeeSkills: true } },
    },
    orderBy: { name: "asc" },
  });

  return <TeamSkillsClient reportees={reportees} />;
}
