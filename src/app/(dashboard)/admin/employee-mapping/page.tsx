import { getEmployees } from "@/server/actions/employee";
import { getCoes } from "@/server/actions/coe";
import { getDesignations } from "@/server/actions/designation";
import { getSkills } from "@/server/actions/skill";
import { getClusters } from "@/server/actions/cluster";
import { EmployeesClient } from "./employees-client";

export default async function EmployeeMappingPage() {
  const [employees, coes, designations, skills, clusters] = await Promise.all([
    getEmployees(),
    getCoes(),
    getDesignations(),
    getSkills(),
    getClusters(),
  ]);

  return (
    <EmployeesClient
      employees={employees}
      coes={coes}
      designations={designations}
      clusters={clusters}
      allSkills={skills}
    />
  );
}

