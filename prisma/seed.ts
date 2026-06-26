import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database (additive — safe to re-run)...\n");

  // ── 1. Competency Levels ─────────────────────────────────────────────────
  const competencyLevelsData = [
    { level: 1, name: "Beginner", description: "Foundational awareness" },
    { level: 2, name: "Basic", description: "Working knowledge" },
    { level: 3, name: "Intermediate", description: "Practical application and independence" },
    { level: 4, name: "Advanced", description: "Deep expertise and leadership" },
    { level: 5, name: "Expert", description: "Strategic mastery and innovation" },
  ];

  for (const cl of competencyLevelsData) {
    await prisma.competencyLevel.upsert({
      where: { level: cl.level },
      update: { name: cl.name, description: cl.description },
      create: cl,
    });
  }
  console.log("✓ Competency levels");

  // ── 2. COEs ──────────────────────────────────────────────────────────────
  const coeData = [
    { name: "Full Stack", description: "Full Stack Web Development" },
    { name: "Backend", description: "Backend Engineering and APIs" },
    { name: "Frontend", description: "Frontend Engineering and UI/UX" },
    { name: "Data Engineering", description: "Data Pipelines and Analytics" },
    { name: "DevOps", description: "Infrastructure and CI/CD" },
  ];

  const coes: Record<string, { id: string }> = {};
  for (const coe of coeData) {
    const record = await prisma.coe.upsert({
      where: { name: coe.name },
      update: { description: coe.description },
      create: coe,
    });
    coes[coe.name] = record;
  }
  console.log("✓ COEs");

  // ── 3. Designations ──────────────────────────────────────────────────────
  const designationData = [
    { name: "Software Engineer", level: 1, description: "Individual contributor" },
    { name: "Senior Software Engineer", level: 2, description: "Experienced individual contributor" },
    { name: "Lead Engineer", level: 3, description: "Technical team lead" },
    { name: "Principal Engineer", level: 4, description: "Senior technical leader" },
    { name: "Architect", level: 5, description: "System and solution architect" },
  ];

  const designations: Record<string, { id: string }> = {};
  for (const d of designationData) {
    const record = await prisma.designation.upsert({
      where: { name: d.name },
      update: { level: d.level, description: d.description },
      create: d,
    });
    designations[d.name] = record;
  }
  console.log("✓ Designations");

  // ── 4. Skills ────────────────────────────────────────────────────────────
  const skillData = [
    { name: "React", category: "FRAMEWORK" as const },
    { name: "Node.js", category: "FRAMEWORK" as const },
    { name: "TypeScript", category: "SKILL" as const },
    { name: "JavaScript", category: "SKILL" as const },
    { name: "Python", category: "SKILL" as const },
    { name: "System Design", category: "CONCEPT" as const },
    { name: "Design Patterns", category: "CONCEPT" as const },
    { name: "Data Analysis", category: "SKILL" as const },
    { name: "PostgreSQL", category: "TOOL" as const },
    { name: "Docker", category: "TOOL" as const },
    { name: "Kubernetes", category: "TOOL" as const },
    { name: "REST API Design", category: "CONCEPT" as const },
    { name: "Git", category: "TOOL" as const },
    { name: "AWS", category: "TOOL" as const },
    { name: "CI/CD", category: "CONCEPT" as const },
    { name: "Monitoring & Observability", category: "CONCEPT" as const },
    { name: "Problem Solving", category: "SKILL" as const },
    { name: "Code Review", category: "SKILL" as const },
    { name: "Technical Mentoring", category: "SKILL" as const },
  ];

  const skills: Record<string, { id: string }> = {};
  for (const s of skillData) {
    const record = await prisma.skill.upsert({
      where: { name: s.name },
      update: { category: s.category },
      create: s,
    });
    skills[s.name] = record;
  }
  console.log("✓ Skills");

  // ── 5. COE Skill Mappings ─────────────────────────────────────────────────
  const coeSkillMappings = [
    // Full Stack
    { coeName: "Full Stack", skillName: "React", targetCompetency: 4 },
    { coeName: "Full Stack", skillName: "Node.js", targetCompetency: 3 },
    { coeName: "Full Stack", skillName: "TypeScript", targetCompetency: 4 },
    { coeName: "Full Stack", skillName: "PostgreSQL", targetCompetency: 3 },
    { coeName: "Full Stack", skillName: "System Design", targetCompetency: 3 },
    // Backend
    { coeName: "Backend", skillName: "Node.js", targetCompetency: 4 },
    { coeName: "Backend", skillName: "PostgreSQL", targetCompetency: 4 },
    { coeName: "Backend", skillName: "REST API Design", targetCompetency: 4 },
    { coeName: "Backend", skillName: "System Design", targetCompetency: 3 },
    { coeName: "Backend", skillName: "Design Patterns", targetCompetency: 3 },
    // Frontend
    { coeName: "Frontend", skillName: "React", targetCompetency: 5 },
    { coeName: "Frontend", skillName: "TypeScript", targetCompetency: 4 },
    { coeName: "Frontend", skillName: "JavaScript", targetCompetency: 5 },
    { coeName: "Frontend", skillName: "Design Patterns", targetCompetency: 3 },
    // Data Engineering
    { coeName: "Data Engineering", skillName: "Python", targetCompetency: 4 },
    { coeName: "Data Engineering", skillName: "PostgreSQL", targetCompetency: 3 },
    { coeName: "Data Engineering", skillName: "Data Analysis", targetCompetency: 4 },
    { coeName: "Data Engineering", skillName: "System Design", targetCompetency: 3 },
    // DevOps
    { coeName: "DevOps", skillName: "Docker", targetCompetency: 4 },
    { coeName: "DevOps", skillName: "Kubernetes", targetCompetency: 3 },
    { coeName: "DevOps", skillName: "AWS", targetCompetency: 4 },
    { coeName: "DevOps", skillName: "CI/CD", targetCompetency: 4 },
    { coeName: "DevOps", skillName: "Monitoring & Observability", targetCompetency: 3 },
  ];

  for (const m of coeSkillMappings) {
    const coe = coes[m.coeName];
    const skill = skills[m.skillName];
    if (!coe || !skill) continue;
    await prisma.coeSkill.upsert({
      where: { coeId_skillId: { coeId: coe.id, skillId: skill.id } },
      update: { targetCompetency: m.targetCompetency },
      create: { coeId: coe.id, skillId: skill.id, targetCompetency: m.targetCompetency },
    });
  }
  console.log("✓ COE skill mappings");

  // ── 6. Designation Skill Mappings ─────────────────────────────────────────
  const designationSkillMappings = [
    // Software Engineer (level 1)
    { designationName: "Software Engineer", skillName: "React", targetCompetency: 2 },
    { designationName: "Software Engineer", skillName: "TypeScript", targetCompetency: 2 },
    { designationName: "Software Engineer", skillName: "JavaScript", targetCompetency: 2 },
    { designationName: "Software Engineer", skillName: "Git", targetCompetency: 3 },
    { designationName: "Software Engineer", skillName: "Problem Solving", targetCompetency: 2 },
    // Senior Software Engineer (level 2)
    { designationName: "Senior Software Engineer", skillName: "React", targetCompetency: 3 },
    { designationName: "Senior Software Engineer", skillName: "TypeScript", targetCompetency: 3 },
    { designationName: "Senior Software Engineer", skillName: "System Design", targetCompetency: 3 },
    { designationName: "Senior Software Engineer", skillName: "Code Review", targetCompetency: 3 },
    { designationName: "Senior Software Engineer", skillName: "Problem Solving", targetCompetency: 3 },
    { designationName: "Senior Software Engineer", skillName: "Design Patterns", targetCompetency: 2 },
    // Lead Engineer (level 3)
    { designationName: "Lead Engineer", skillName: "System Design", targetCompetency: 4 },
    { designationName: "Lead Engineer", skillName: "Technical Mentoring", targetCompetency: 4 },
    { designationName: "Lead Engineer", skillName: "Code Review", targetCompetency: 4 },
    { designationName: "Lead Engineer", skillName: "Design Patterns", targetCompetency: 4 },
    { designationName: "Lead Engineer", skillName: "REST API Design", targetCompetency: 3 },
    // Principal Engineer (level 4)
    { designationName: "Principal Engineer", skillName: "System Design", targetCompetency: 5 },
    { designationName: "Principal Engineer", skillName: "Technical Mentoring", targetCompetency: 5 },
    { designationName: "Principal Engineer", skillName: "Code Review", targetCompetency: 5 },
    { designationName: "Principal Engineer", skillName: "REST API Design", targetCompetency: 4 },
    { designationName: "Principal Engineer", skillName: "Design Patterns", targetCompetency: 4 },
    // Architect (level 5)
    { designationName: "Architect", skillName: "System Design", targetCompetency: 5 },
    { designationName: "Architect", skillName: "REST API Design", targetCompetency: 5 },
    { designationName: "Architect", skillName: "AWS", targetCompetency: 5 },
    { designationName: "Architect", skillName: "Technical Mentoring", targetCompetency: 5 },
    { designationName: "Architect", skillName: "Design Patterns", targetCompetency: 5 },
  ];

  for (const m of designationSkillMappings) {
    const designation = designations[m.designationName];
    const skill = skills[m.skillName];
    if (!designation || !skill) continue;
    await prisma.designationSkill.upsert({
      where: { designationId_skillId: { designationId: designation.id, skillId: skill.id } },
      update: { targetCompetency: m.targetCompetency },
      create: { designationId: designation.id, skillId: skill.id, targetCompetency: m.targetCompetency },
    });
  }
  console.log("✓ Designation skill mappings");

  // ── 7. Admin User + Employee record ──────────────────────────────────────
  // Admin needs an employee record so the "My Workspace" pages work for them.
  const adminPassword = await bcrypt.hash("admin123456", 12);

  const adminEmployee = await prisma.employee.upsert({
    where: { employeeCode: "ADM001" },
    update: {
      name: "System Admin",
      coeId: coes["Full Stack"]?.id ?? null,
      designationId: designations["Lead Engineer"]?.id ?? null,
    },
    create: {
      employeeCode: "ADM001",
      name: "System Admin",
      email: "admin@skillmatrix.com",
      coeId: coes["Full Stack"]?.id ?? null,
      designationId: designations["Lead Engineer"]?.id ?? null,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@skillmatrix.com" },
    update: { employeeId: adminEmployee.id },
    create: {
      email: "admin@skillmatrix.com",
      name: "System Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
      employeeId: adminEmployee.id,
    },
  });

  // Admin's own skill profile (Full Stack COE, Lead Engineer designation)
  // COE targets: React:4, Node.js:3, TypeScript:4, PostgreSQL:3, System Design:3
  // Designation targets: System Design:4, Technical Mentoring:4, Code Review:4, Design Patterns:4, REST API Design:3
  const adminSkillsInput = [
    { skillName: "System Design", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "Strong architectural thinking and distributed systems experience.", reviewedBy: "Michael Vance" },
    { skillName: "Technical Mentoring", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Good mentor but needs to formalise structured mentoring approach.", reviewedBy: "Michael Vance" },
    { skillName: "Code Review", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Thorough reviews. Needs to focus more on architectural feedback at scale.", reviewedBy: "Michael Vance" },
    { skillName: "REST API Design", selfAssessedLevel: 2, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Solid API design skills. Needs deeper versioning and contract-first approach.", reviewedBy: "Michael Vance" },
    { skillName: "React", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Competent React developer. Needs to strengthen advanced patterns and performance.", reviewedBy: "Michael Vance" },
    { skillName: "TypeScript", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Good TypeScript usage. Needs to master generics and complex type utilities.", reviewedBy: "Michael Vance" },
    { skillName: "Node.js", selfAssessedLevel: 3, validatedLevel: null, status: "PENDING" as const, reviewComment: null, reviewedBy: null },
    { skillName: "Design Patterns", selfAssessedLevel: 2, validatedLevel: 1, status: "APPROVED" as const, reviewComment: "Applies common patterns. Needs deeper enterprise and architectural patterns.", reviewedBy: "Michael Vance" },
  ];

  const adminSkillRecords: Record<string, { id: string }> = {};
  for (const es of adminSkillsInput) {
    const skill = skills[es.skillName];
    if (!skill) continue;
    const record = await prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: adminEmployee.id, skillId: skill.id } },
      update: { selfAssessedLevel: es.selfAssessedLevel, validatedLevel: es.validatedLevel, status: es.status, reviewComment: es.reviewComment, reviewedBy: es.reviewedBy, reviewedAt: es.reviewedBy ? new Date("2026-05-15") : null },
      create: { employeeId: adminEmployee.id, skillId: skill.id, selfAssessedLevel: es.selfAssessedLevel, validatedLevel: es.validatedLevel, status: es.status, reviewComment: es.reviewComment, reviewedBy: es.reviewedBy, reviewedAt: es.reviewedBy ? new Date("2026-05-15") : null },
    });
    adminSkillRecords[es.skillName] = record;
  }

  console.log("✓ Admin user + employee profile  (admin@skillmatrix.com / admin123456)");

  // ── 8. Managers ───────────────────────────────────────────────────────────
  const managerPassword = await bcrypt.hash("manager123", 12);
  const managersInput = [
    { code: "MGR001", name: "Sarah Jenkins", email: "manager.fullstack@skillmatrix.com", coeName: "Full Stack", designationName: "Lead Engineer" },
    { code: "MGR002", name: "Michael Vance", email: "manager.devops@skillmatrix.com", coeName: "DevOps", designationName: "Architect" },
  ];

  const managerRecords: Record<string, { id: string }> = {};
  for (const mgr of managersInput) {
    const employee = await prisma.employee.upsert({
      where: { employeeCode: mgr.code },
      update: { name: mgr.name, coeId: coes[mgr.coeName]?.id ?? null, designationId: designations[mgr.designationName]?.id ?? null },
      create: { employeeCode: mgr.code, name: mgr.name, email: mgr.email, coeId: coes[mgr.coeName]?.id ?? null, designationId: designations[mgr.designationName]?.id ?? null },
    });
    await prisma.user.upsert({
      where: { email: mgr.email },
      update: {},
      create: { email: mgr.email, name: mgr.name, passwordHash: managerPassword, role: "MANAGER", employeeId: employee.id },
    });
    managerRecords[mgr.name] = employee;
  }
  console.log("✓ Managers  (password: manager123)");

  // ── 9. Employees ──────────────────────────────────────────────────────────
  const employeePassword = await bcrypt.hash("employee123", 12);
  const employeesInput = [
    { code: "EMP001", name: "Alice Chen", email: "alice.fullstack@skillmatrix.com", coeName: "Full Stack", designationName: "Software Engineer", managerName: "Sarah Jenkins" },
    { code: "EMP002", name: "Bob Miller", email: "bob.backend@skillmatrix.com", coeName: "Backend", designationName: "Senior Software Engineer", managerName: "Sarah Jenkins" },
    { code: "EMP003", name: "Carol White", email: "carol.frontend@skillmatrix.com", coeName: "Frontend", designationName: "Software Engineer", managerName: "Sarah Jenkins" },
    { code: "EMP004", name: "Dave Clark", email: "dave.devops@skillmatrix.com", coeName: "DevOps", designationName: "Senior Software Engineer", managerName: "Michael Vance" },
    { code: "EMP005", name: "Eve Adams", email: "eve.data@skillmatrix.com", coeName: "Data Engineering", designationName: "Software Engineer", managerName: "Michael Vance" },
    { code: "EMP006", name: "Frank Miller", email: "frank.frontend@skillmatrix.com", coeName: "Frontend", designationName: "Senior Software Engineer", managerName: "Sarah Jenkins" },
    { code: "EMP007", name: "Grace Hopper", email: "grace.backend@skillmatrix.com", coeName: "Backend", designationName: "Principal Engineer", managerName: "Sarah Jenkins" },
  ];

  const employeeRecords: Record<string, { id: string }> = {};
  for (const emp of employeesInput) {
    const employee = await prisma.employee.upsert({
      where: { employeeCode: emp.code },
      update: {
        name: emp.name,
        coeId: coes[emp.coeName]?.id ?? null,
        designationId: designations[emp.designationName]?.id ?? null,
        managerId: managerRecords[emp.managerName]?.id ?? null,
      },
      create: {
        employeeCode: emp.code,
        name: emp.name,
        email: emp.email,
        coeId: coes[emp.coeName]?.id ?? null,
        designationId: designations[emp.designationName]?.id ?? null,
        managerId: managerRecords[emp.managerName]?.id ?? null,
      },
    });
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: { email: emp.email, name: emp.name, passwordHash: employeePassword, role: "EMPLOYEE", employeeId: employee.id },
    });
    employeeRecords[emp.name] = employee;
  }
  console.log("✓ Employees  (password: employee123)");

  // ── 10. Employee Skills ───────────────────────────────────────────────────
  // Gaps are deliberately realistic: employees have 1–3 level gaps in key COE
  // skills so that Gap Analysis, Learning Paths, and Transition Path all have
  // meaningful content to render.
  const employeeSkillsInput = [
    // ── Alice Chen (Full Stack SE) ──
    // COE targets: React:4, Node.js:3, TypeScript:4, PostgreSQL:3, System Design:3
    // Designation targets: React:2, TypeScript:2, JavaScript:2, Git:3, ProblemSolving:2
    { empName: "Alice Chen", skillName: "React", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Good foundational React. Needs to strengthen state management and performance patterns.", reviewedBy: "Sarah Jenkins" },
    { empName: "Alice Chen", skillName: "TypeScript", selfAssessedLevel: 2, validatedLevel: 1, status: "APPROVED" as const, reviewComment: "Familiar with basic types, needs work on generics and utility types.", reviewedBy: "Sarah Jenkins" },
    { empName: "Alice Chen", skillName: "Node.js", selfAssessedLevel: 2, validatedLevel: null, status: "PENDING" as const, reviewComment: null, reviewedBy: null },
    { empName: "Alice Chen", skillName: "JavaScript", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Solid fundamentals, needs to deepen async and closure patterns.", reviewedBy: "Sarah Jenkins" },
    { empName: "Alice Chen", skillName: "Git", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Solid git workflow and branching practices.", reviewedBy: "Sarah Jenkins" },
    { empName: "Alice Chen", skillName: "Problem Solving", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Shows good analytical thinking.", reviewedBy: "Sarah Jenkins" },

    // ── Bob Miller (Backend SSE) ──
    // COE targets: Node.js:4, PostgreSQL:4, REST API Design:4, System Design:3, Design Patterns:3
    // Designation targets: React:3, TypeScript:3, System Design:3, Code Review:3, Problem Solving:3, Design Patterns:2
    { empName: "Bob Miller", skillName: "Node.js", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "Designed primary microservices architecture.", reviewedBy: "Sarah Jenkins" },
    { empName: "Bob Miller", skillName: "PostgreSQL", selfAssessedLevel: 2, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Basic query proficiency. Needs advanced indexing and query optimization.", reviewedBy: "Sarah Jenkins" },
    { empName: "Bob Miller", skillName: "REST API Design", selfAssessedLevel: 2, validatedLevel: 1, status: "APPROVED" as const, reviewComment: "Understands basics. Needs deeper understanding of API versioning, caching, and contracts.", reviewedBy: "Sarah Jenkins" },
    { empName: "Bob Miller", skillName: "System Design", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Needs solid experience with load balancers and system reliability.", reviewedBy: "Sarah Jenkins" },
    { empName: "Bob Miller", skillName: "Code Review", selfAssessedLevel: 2, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Reviews are surface-level. Needs to focus on architectural concerns.", reviewedBy: "Sarah Jenkins" },
    { empName: "Bob Miller", skillName: "Design Patterns", selfAssessedLevel: 2, validatedLevel: null, status: "PENDING" as const, reviewComment: null, reviewedBy: null },

    // ── Carol White (Frontend SE) ──
    // COE targets: React:5, TypeScript:4, JavaScript:5, Design Patterns:3
    // Designation targets: React:2, TypeScript:2, JavaScript:2, Git:3, Problem Solving:2
    { empName: "Carol White", skillName: "React", selfAssessedLevel: 4, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Strong React skills. Needs hooks mastery and performance optimisation for COE level.", reviewedBy: "Sarah Jenkins" },
    { empName: "Carol White", skillName: "TypeScript", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Consistently uses TypeScript. Needs advanced type utility patterns.", reviewedBy: "Sarah Jenkins" },
    { empName: "Carol White", skillName: "JavaScript", selfAssessedLevel: 4, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Excellent fundamentals. Needs to master async patterns and browser performance.", reviewedBy: "Sarah Jenkins" },
    { empName: "Carol White", skillName: "Design Patterns", selfAssessedLevel: 2, validatedLevel: null, status: "PENDING" as const, reviewComment: null, reviewedBy: null },
    { empName: "Carol White", skillName: "Git", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Solid branching and PR practices.", reviewedBy: "Sarah Jenkins" },

    // ── Dave Clark (DevOps SSE) ──
    // COE targets: Docker:4, Kubernetes:3, AWS:4, CI/CD:4, Monitoring & Observability:3
    // Designation targets: React:3, TypeScript:3, System Design:3, Code Review:3, Problem Solving:3, Design Patterns:2
    { empName: "Dave Clark", skillName: "Docker", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "Spearheaded containerisation strategy.", reviewedBy: "Michael Vance" },
    { empName: "Dave Clark", skillName: "AWS", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Competent with EC2/S3. Needs deeper IAM and networking experience.", reviewedBy: "Michael Vance" },
    { empName: "Dave Clark", skillName: "CI/CD", selfAssessedLevel: 4, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Maintains standard deployment pipelines.", reviewedBy: "Michael Vance" },
    { empName: "Dave Clark", skillName: "Kubernetes", selfAssessedLevel: 1, validatedLevel: 1, status: "APPROVED" as const, reviewComment: "Beginner level — has set up basic clusters but lacks production experience.", reviewedBy: "Michael Vance" },
    { empName: "Dave Clark", skillName: "Monitoring & Observability", selfAssessedLevel: 2, validatedLevel: null, status: "PENDING" as const, reviewComment: null, reviewedBy: null },

    // ── Eve Adams (Data Engineering SE) ──
    // COE targets: Python:4, PostgreSQL:3, Data Analysis:4, System Design:3
    // Designation targets: React:2, TypeScript:2, JavaScript:2, Git:3, Problem Solving:2
    { empName: "Eve Adams", skillName: "Python", selfAssessedLevel: 2, validatedLevel: 1, status: "APPROVED" as const, reviewComment: "Knows Python basics. Needs significant improvement with pandas, NumPy, and data libraries.", reviewedBy: "Michael Vance" },
    { empName: "Eve Adams", skillName: "PostgreSQL", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Solid database knowledge and query profiling experience.", reviewedBy: "Michael Vance" },
    { empName: "Eve Adams", skillName: "Data Analysis", selfAssessedLevel: 2, validatedLevel: 1, status: "APPROVED" as const, reviewComment: "Understands basic analytics. Needs stronger statistical modelling skills.", reviewedBy: "Michael Vance" },
    { empName: "Eve Adams", skillName: "System Design", selfAssessedLevel: 2, validatedLevel: null, status: "PENDING" as const, reviewComment: null, reviewedBy: null },
    { empName: "Eve Adams", skillName: "Problem Solving", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Analytical mindset and good debugging skills.", reviewedBy: "Michael Vance" },

    // ── Frank Miller (Frontend SSE) ──
    // COE targets: React:5, TypeScript:4, JavaScript:5, Design Patterns:3
    // Designation targets: React:3, TypeScript:3, System Design:3, Code Review:3, Problem Solving:3, Design Patterns:2
    { empName: "Frank Miller", skillName: "React", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "High-quality modular component designer.", reviewedBy: "Sarah Jenkins" },
    { empName: "Frank Miller", skillName: "TypeScript", selfAssessedLevel: 4, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Strong TypeScript usage. Needs to master mapped types and conditional types.", reviewedBy: "Sarah Jenkins" },
    { empName: "Frank Miller", skillName: "JavaScript", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "Deep understanding of browser APIs.", reviewedBy: "Sarah Jenkins" },
    { empName: "Frank Miller", skillName: "Design Patterns", selfAssessedLevel: 3, validatedLevel: 2, status: "APPROVED" as const, reviewComment: "Applies common patterns. Needs to work on architectural and enterprise patterns.", reviewedBy: "Sarah Jenkins" },
    { empName: "Frank Miller", skillName: "Code Review", selfAssessedLevel: 3, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Thorough reviewer with constructive feedback.", reviewedBy: "Sarah Jenkins" },

    // ── Grace Hopper (Backend Principal Engineer) ── near 100% ready
    // COE targets: Node.js:4, PostgreSQL:4, REST API Design:4, System Design:3, Design Patterns:3
    // Designation targets: System Design:5, Technical Mentoring:5, Code Review:5, REST API Design:4, Design Patterns:4
    { empName: "Grace Hopper", skillName: "Node.js", selfAssessedLevel: 5, validatedLevel: 5, status: "APPROVED" as const, reviewComment: "Core contributor to system APIs and middleware layers.", reviewedBy: "Sarah Jenkins" },
    { empName: "Grace Hopper", skillName: "PostgreSQL", selfAssessedLevel: 5, validatedLevel: 5, status: "APPROVED" as const, reviewComment: "Designed entire migration strategy and schema optimisations.", reviewedBy: "Sarah Jenkins" },
    { empName: "Grace Hopper", skillName: "System Design", selfAssessedLevel: 5, validatedLevel: 5, status: "APPROVED" as const, reviewComment: "Strategic architect for global high-scale distributed systems.", reviewedBy: "Sarah Jenkins" },
    { empName: "Grace Hopper", skillName: "REST API Design", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "Excellent API contract design and versioning strategies.", reviewedBy: "Sarah Jenkins" },
    { empName: "Grace Hopper", skillName: "Technical Mentoring", selfAssessedLevel: 4, validatedLevel: 4, status: "APPROVED" as const, reviewComment: "Active mentor for junior engineers.", reviewedBy: "Sarah Jenkins" },
    { empName: "Grace Hopper", skillName: "Code Review", selfAssessedLevel: 5, validatedLevel: 5, status: "APPROVED" as const, reviewComment: "Sets team code quality standards.", reviewedBy: "Sarah Jenkins" },
    { empName: "Grace Hopper", skillName: "Design Patterns", selfAssessedLevel: 4, validatedLevel: 3, status: "APPROVED" as const, reviewComment: "Solid patterns knowledge. Needs to deepen enterprise architecture patterns.", reviewedBy: "Sarah Jenkins" },
  ];

  const employeeSkillRecords: Record<string, { id: string }> = {};
  for (const es of employeeSkillsInput) {
    const employee = employeeRecords[es.empName];
    const skill = skills[es.skillName];
    if (!employee || !skill) continue;
    const record = await prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: employee.id, skillId: skill.id } },
      update: {
        selfAssessedLevel: es.selfAssessedLevel,
        validatedLevel: es.validatedLevel,
        status: es.status,
        reviewComment: es.reviewComment,
        reviewedBy: es.reviewedBy,
        reviewedAt: es.reviewedBy ? new Date("2026-05-15") : null,
      },
      create: {
        employeeId: employee.id,
        skillId: skill.id,
        selfAssessedLevel: es.selfAssessedLevel,
        validatedLevel: es.validatedLevel,
        status: es.status,
        reviewComment: es.reviewComment,
        reviewedBy: es.reviewedBy,
        reviewedAt: es.reviewedBy ? new Date("2026-05-15") : null,
      },
    });
    employeeSkillRecords[`${es.empName}:${es.skillName}`] = record;
  }
  console.log("✓ Employee skills");

  // ── 11. Evidence & Certifications ─────────────────────────────────────────
  const evidenceInput = [
    {
      empName: "Dave Clark",
      skillName: "Docker",
      title: "Docker Certified Associate",
      type: "CERTIFICATION" as const,
      description: "Official Docker certification validating container orchestration expertise",
      score: "Pass",
      issuedAt: new Date("2025-06-15"),
      expiresAt: new Date("2027-06-15"),
    },
    {
      empName: "Dave Clark",
      skillName: "AWS",
      title: "AWS Solutions Architect – Associate",
      type: "CERTIFICATION" as const,
      description: "AWS certification for cloud architecture best practices",
      score: "Pass",
      issuedAt: new Date("2025-09-01"),
      expiresAt: new Date("2028-09-01"),
    },
    {
      empName: "Grace Hopper",
      skillName: "Node.js",
      title: "OpenJS Node.js Application Developer",
      type: "CERTIFICATION" as const,
      description: "Certified Node.js developer by the OpenJS Foundation",
      score: "Pass",
      issuedAt: new Date("2024-11-20"),
      expiresAt: null,
    },
    {
      empName: "Grace Hopper",
      skillName: "System Design",
      title: "Grokking System Design – Advanced Assessment",
      type: "ASSESSMENT_SCORE" as const,
      description: "Completed advanced system design assessment with distinction",
      score: "94/100",
      issuedAt: new Date("2025-03-10"),
      expiresAt: null,
    },
    {
      empName: "Frank Miller",
      skillName: "React",
      title: "Meta React Developer Certificate",
      type: "CERTIFICATION" as const,
      description: "Professional certificate from Meta React Developer specialisation",
      score: "Distinction",
      issuedAt: new Date("2025-08-01"),
      expiresAt: null,
    },
    {
      empName: "Alice Chen",
      skillName: "Git",
      title: "Git & GitHub Fundamentals – Internal Assessment",
      type: "ASSESSMENT_SCORE" as const,
      description: "Internal assessment on Git workflow and branching strategies",
      score: "87/100",
      issuedAt: new Date("2025-07-15"),
      expiresAt: null,
    },
    {
      empName: "Bob Miller",
      skillName: "Node.js",
      title: "Node.js Project – Microservices Platform",
      type: "PROJECT_DOCUMENT" as const,
      description: "Led design and implementation of core microservices platform on Project Hermes",
      score: null,
      issuedAt: new Date("2026-03-31"),
      expiresAt: null,
    },
  ];

  for (const ev of evidenceInput) {
    const employee = employeeRecords[ev.empName];
    const employeeSkill = employeeSkillRecords[`${ev.empName}:${ev.skillName}`];
    if (!employee || !employeeSkill) continue;
    const existing = await prisma.evidence.findFirst({
      where: { employeeSkillId: employeeSkill.id, title: ev.title },
    });
    if (!existing) {
      await prisma.evidence.create({
        data: {
          employeeSkillId: employeeSkill.id,
          employeeId: employee.id,
          type: ev.type,
          title: ev.title,
          description: ev.description,
          score: ev.score,
          issuedAt: ev.issuedAt,
          expiresAt: ev.expiresAt,
        },
      });
    }
  }
  console.log("✓ Evidence & certifications");

  // ── 12. Projects & Allocations ────────────────────────────────────────────
  // Project has no @@unique on name, so we check-then-create.
  const projectsInput = [
    {
      name: "Project Apollo",
      description: "Customer-facing portal with real-time dashboards and REST APIs",
      domain: "Full Stack Web Application",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-08-31"),
      teamSize: 4,
      status: "ACTIVE" as const,
      skillRequirements: [
        { skillName: "React", requiredLevel: 4, headcount: 2, priority: "CRITICAL" as const },
        { skillName: "Node.js", requiredLevel: 3, headcount: 2, priority: "CRITICAL" as const },
        { skillName: "TypeScript", requiredLevel: 3, headcount: 2, priority: "HIGH" as const },
        { skillName: "PostgreSQL", requiredLevel: 2, headcount: 1, priority: "MEDIUM" as const },
      ],
      allocations: [
        { empName: "Alice Chen", allocation: 75, role: "Frontend Developer", startDate: new Date("2026-01-01"), endDate: new Date("2026-08-31") },
        { empName: "Bob Miller", allocation: 50, role: "Backend Engineer", startDate: new Date("2026-01-01"), endDate: new Date("2026-08-31") },
      ],
    },
    {
      name: "Project Nexus",
      description: "Internal analytics and reporting dashboard",
      domain: "Frontend Application",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-07-15"),
      teamSize: 3,
      status: "ACTIVE" as const,
      skillRequirements: [
        { skillName: "React", requiredLevel: 4, headcount: 2, priority: "CRITICAL" as const },
        { skillName: "TypeScript", requiredLevel: 3, headcount: 2, priority: "HIGH" as const },
        { skillName: "JavaScript", requiredLevel: 3, headcount: 1, priority: "MEDIUM" as const },
      ],
      allocations: [
        { empName: "Carol White", allocation: 100, role: "Frontend Developer", startDate: new Date("2026-03-01"), endDate: new Date("2026-07-15") },
        { empName: "Frank Miller", allocation: 50, role: "UI Engineer", startDate: new Date("2026-03-01"), endDate: new Date("2026-07-15") },
      ],
    },
    {
      name: "Project Titan",
      description: "Microservices platform with DevOps automation",
      domain: "Backend + DevOps",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-02-28"),
      teamSize: 5,
      status: "PLANNING" as const,
      skillRequirements: [
        { skillName: "Node.js", requiredLevel: 4, headcount: 2, priority: "CRITICAL" as const },
        { skillName: "Docker", requiredLevel: 3, headcount: 2, priority: "HIGH" as const },
        { skillName: "CI/CD", requiredLevel: 3, headcount: 1, priority: "HIGH" as const },
        { skillName: "PostgreSQL", requiredLevel: 3, headcount: 1, priority: "MEDIUM" as const },
        { skillName: "System Design", requiredLevel: 3, headcount: 2, priority: "HIGH" as const },
      ],
      allocations: [] as Array<{ empName: string; allocation: number; role: string; startDate: Date; endDate: Date }>,
    },
    {
      name: "Project Hermes",
      description: "Legacy API migration to REST microservices",
      domain: "Backend Engineering",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-03-31"),
      teamSize: 3,
      status: "COMPLETED" as const,
      skillRequirements: [
        { skillName: "Node.js", requiredLevel: 4, headcount: 2, priority: "CRITICAL" as const },
        { skillName: "REST API Design", requiredLevel: 3, headcount: 2, priority: "HIGH" as const },
        { skillName: "PostgreSQL", requiredLevel: 3, headcount: 1, priority: "MEDIUM" as const },
      ],
      allocations: [
        { empName: "Grace Hopper", allocation: 100, role: "Tech Lead", startDate: new Date("2025-10-01"), endDate: new Date("2026-03-31") },
        { empName: "Bob Miller", allocation: 50, role: "Backend Engineer", startDate: new Date("2025-10-01"), endDate: new Date("2026-03-31") },
      ],
    },
  ];

  for (const proj of projectsInput) {
    const existing = await prisma.project.findFirst({ where: { name: proj.name } });
    const project = existing ?? await prisma.project.create({
      data: {
        name: proj.name,
        description: proj.description,
        domain: proj.domain,
        startDate: proj.startDate,
        endDate: proj.endDate,
        teamSize: proj.teamSize,
        status: proj.status,
      },
    });

    for (const req of proj.skillRequirements) {
      const skill = skills[req.skillName];
      if (!skill) continue;
      await prisma.projectSkillRequirement.upsert({
        where: { projectId_skillId: { projectId: project.id, skillId: skill.id } },
        update: { requiredLevel: req.requiredLevel, headcount: req.headcount, priority: req.priority },
        create: { projectId: project.id, skillId: skill.id, requiredLevel: req.requiredLevel, headcount: req.headcount, priority: req.priority },
      });
    }

    for (const alloc of proj.allocations) {
      const employee = employeeRecords[alloc.empName];
      if (!employee) continue;
      await prisma.projectAllocation.upsert({
        where: { projectId_employeeId: { projectId: project.id, employeeId: employee.id } },
        update: { allocation: alloc.allocation, role: alloc.role, startDate: alloc.startDate, endDate: alloc.endDate },
        create: { projectId: project.id, employeeId: employee.id, allocation: alloc.allocation, role: alloc.role, startDate: alloc.startDate, endDate: alloc.endDate },
      });
    }
  }
  console.log("✓ Projects & allocations");

  // ── 13. Feedback Module Data ──────────────────────────────────────────────
  const existingCyclesCount = await prisma.reviewCycle.count();

  if (existingCyclesCount === 0) {
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@skillmatrix.com" },
      select: { id: true },
    });

    const sarahEmployee = managerRecords["Sarah Jenkins"];
    const michaelEmployee = managerRecords["Michael Vance"];
    const aliceEmployee = employeeRecords["Alice Chen"];
    const bobEmployee = employeeRecords["Bob Miller"];
    const carolEmployee = employeeRecords["Carol White"];
    const daveEmployee = employeeRecords["Dave Clark"];
    const eveEmployee = employeeRecords["Eve Adams"];
    const graceEmployee = employeeRecords["Grace Hopper"];

    if (
      !adminUser || !sarahEmployee || !michaelEmployee || !aliceEmployee ||
      !bobEmployee || !carolEmployee || !daveEmployee || !eveEmployee || !graceEmployee
    ) {
      console.log("⚠ Missing employee records, skipping feedback module seed");
    } else {
      // Tag projects with project managers
      const apolloProject = await prisma.project.findFirst({ where: { name: "Project Apollo" } });
      const nexusProject = await prisma.project.findFirst({ where: { name: "Project Nexus" } });
      const hermesProject = await prisma.project.findFirst({ where: { name: "Project Hermes" } });

      if (apolloProject) await prisma.project.update({ where: { id: apolloProject.id }, data: { projectManagerId: sarahEmployee.id } });
      if (nexusProject) await prisma.project.update({ where: { id: nexusProject.id }, data: { projectManagerId: sarahEmployee.id } });
      if (hermesProject) await prisma.project.update({ where: { id: hermesProject.id }, data: { projectManagerId: michaelEmployee.id } });

      // ── Review Cycles ──────────────────────────────────────────────────
      const h1Cycle = await prisma.reviewCycle.create({
        data: { name: "H1 2026 Review", startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30"), status: "ACTIVE", createdById: adminUser.id },
      });
      const h2Cycle = await prisma.reviewCycle.create({
        data: { name: "H2 2025 Review", startDate: new Date("2025-07-01"), endDate: new Date("2025-12-31"), status: "CLOSED", createdById: adminUser.id },
      });

      // ── H1 2026 Forms ──────────────────────────────────────────────────
      const pmForm = await prisma.feedbackForm.create({
        data: {
          title: "H1 2026 - PM Feedback",
          formType: "PM_FEEDBACK",
          reviewCycleId: h1Cycle.id,
          createdById: adminUser.id,
          sections: {
            create: [
              {
                title: "Technical Delivery",
                order: 0,
                questions: {
                  create: [
                    { text: "Rate the employee's overall technical contribution to the project.", type: "RATING", required: true, order: 0 },
                    { text: "Rate the quality and reliability of their deliverables.", type: "RATING", required: true, order: 1 },
                    { text: "What specific technical contributions stood out?", type: "TEXT", required: false, order: 2 },
                  ],
                },
              },
              {
                title: "Collaboration & Communication",
                order: 1,
                questions: {
                  create: [
                    { text: "Rate their teamwork and collaboration with the project team.", type: "RATING", required: true, order: 0 },
                    { text: "Rate their communication and responsiveness.", type: "RATING", required: true, order: 1 },
                    { text: "Any additional observations about their performance?", type: "TEXT", required: false, order: 2 },
                  ],
                },
              },
            ],
          },
        },
        include: { sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
      });

      const cdmForm = await prisma.feedbackForm.create({
        data: {
          title: "H1 2026 - CDM Assessment",
          formType: "CDM_ASSESSMENT",
          reviewCycleId: h1Cycle.id,
          createdById: adminUser.id,
          sections: {
            create: [
              {
                title: "Skills & Growth",
                order: 0,
                questions: {
                  create: [
                    { text: "Rate overall technical skill alignment with the employee's designation level.", type: "RATING", required: true, order: 0 },
                    { text: "Rate learning agility and professional growth in this period.", type: "RATING", required: true, order: 1 },
                    { text: "What areas has the employee shown the most growth in?", type: "TEXT", required: false, order: 2 },
                  ],
                },
              },
              {
                title: "Ownership & Impact",
                order: 1,
                questions: {
                  create: [
                    { text: "Rate ownership, accountability, and initiative.", type: "RATING", required: true, order: 0 },
                    { text: "Rate overall impact and contribution to team goals.", type: "RATING", required: true, order: 1 },
                    { text: "Describe the employee's key accomplishments this half-year.", type: "TEXT", required: true, order: 2 },
                  ],
                },
              },
            ],
          },
        },
        include: { sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
      });

      const hrForm = await prisma.feedbackForm.create({
        data: {
          title: "H1 2026 - HR Assessment",
          formType: "HR_FEEDBACK",
          reviewCycleId: h1Cycle.id,
          createdById: adminUser.id,
          sections: {
            create: [
              {
                title: "Professional Conduct",
                order: 0,
                questions: {
                  create: [
                    { text: "Rate adherence to company values and culture.", type: "RATING", required: true, order: 0 },
                    { text: "Rate professionalism, work ethic, and reliability.", type: "RATING", required: true, order: 1 },
                    { text: "Any HR observations for this review period?", type: "TEXT", required: false, order: 2 },
                  ],
                },
              },
            ],
          },
        },
        include: { sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
      });

      const pmQ = pmForm.sections.flatMap((s) => s.questions);
      const cdmQ = cdmForm.sections.flatMap((s) => s.questions);
      const hrQ = hrForm.sections.flatMap((s) => s.questions);

      // ── H1 2026 Assignments ────────────────────────────────────────────
      const pmAlice = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: pmForm.id,
          reviewerId: sarahEmployee.id, employeeId: aliceEmployee.id,
          projectId: apolloProject?.id ?? null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2026-05-31"),
        },
      });

      const pmBob = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: pmForm.id,
          reviewerId: sarahEmployee.id, employeeId: bobEmployee.id,
          projectId: apolloProject?.id ?? null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2026-05-31"),
        },
      });

      await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: pmForm.id,
          reviewerId: sarahEmployee.id, employeeId: carolEmployee.id,
          projectId: nexusProject?.id ?? null,
          assignedById: adminUser.id, status: "PENDING", dueDate: new Date("2026-06-15"),
        },
      });

      const cdmAlice = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: cdmForm.id,
          reviewerId: sarahEmployee.id, employeeId: aliceEmployee.id,
          projectId: null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2026-06-15"),
        },
      });

      const cdmBob = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: cdmForm.id,
          reviewerId: sarahEmployee.id, employeeId: bobEmployee.id,
          projectId: null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2026-06-15"),
        },
      });

      await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: cdmForm.id,
          reviewerId: sarahEmployee.id, employeeId: carolEmployee.id,
          projectId: null,
          assignedById: adminUser.id, status: "PENDING", dueDate: new Date("2026-06-30"),
        },
      });

      const cdmDave = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: cdmForm.id,
          reviewerId: michaelEmployee.id, employeeId: daveEmployee.id,
          projectId: null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2026-06-15"),
        },
      });

      await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: cdmForm.id,
          reviewerId: michaelEmployee.id, employeeId: eveEmployee.id,
          projectId: null,
          assignedById: adminUser.id, status: "IN_PROGRESS", dueDate: new Date("2026-06-30"),
        },
      });

      const hrGrace = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h1Cycle.id, formId: hrForm.id,
          reviewerId: adminEmployee.id, employeeId: graceEmployee.id,
          projectId: null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2026-06-30"),
        },
      });

      // ── Submissions ────────────────────────────────────────────────────
      if (pmQ[0] && pmQ[1] && pmQ[2] && pmQ[3] && pmQ[4] && pmQ[5]) {
        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: pmAlice.id,
            submittedAt: new Date("2026-04-20"),
            responses: {
              create: [
                { questionId: pmQ[0].id, ratingValue: 4 },
                { questionId: pmQ[1].id, ratingValue: 4 },
                { questionId: pmQ[2].id, textValue: "Alice took strong ownership of the React dashboard components and delivered on time. Excellent attention to UX detail." },
                { questionId: pmQ[3].id, ratingValue: 4 },
                { questionId: pmQ[4].id, ratingValue: 3 },
                { questionId: pmQ[5].id, textValue: "Alice would benefit from sharing blockers earlier. Tends to work in isolation before escalating." },
              ],
            },
          },
        });

        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: pmBob.id,
            submittedAt: new Date("2026-04-22"),
            responses: {
              create: [
                { questionId: pmQ[0].id, ratingValue: 4 },
                { questionId: pmQ[1].id, ratingValue: 3 },
                { questionId: pmQ[2].id, textValue: "Bob designed clean REST API endpoints that the frontend team integrated with ease. Solid contribution to the backend foundation." },
                { questionId: pmQ[3].id, ratingValue: 4 },
                { questionId: pmQ[4].id, ratingValue: 4 },
              ],
            },
          },
        });
      }

      if (cdmQ[0] && cdmQ[1] && cdmQ[2] && cdmQ[3] && cdmQ[4] && cdmQ[5]) {
        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: cdmAlice.id,
            submittedAt: new Date("2026-05-10"),
            responses: {
              create: [
                { questionId: cdmQ[0].id, ratingValue: 3 },
                { questionId: cdmQ[1].id, ratingValue: 4 },
                { questionId: cdmQ[2].id, textValue: "Alice has shown significant improvement in TypeScript and is proactively exploring advanced React patterns." },
                { questionId: cdmQ[3].id, ratingValue: 4 },
                { questionId: cdmQ[4].id, ratingValue: 3 },
                { questionId: cdmQ[5].id, textValue: "Delivered all Project Apollo sprint commitments. Informally mentored a new joinee. Growing into a reliable contributor." },
              ],
            },
          },
        });

        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: cdmBob.id,
            submittedAt: new Date("2026-05-12"),
            responses: {
              create: [
                { questionId: cdmQ[0].id, ratingValue: 4 },
                { questionId: cdmQ[1].id, ratingValue: 3 },
                { questionId: cdmQ[2].id, textValue: "Bob has noticeably improved his PostgreSQL query optimisation skills this period." },
                { questionId: cdmQ[3].id, ratingValue: 3 },
                { questionId: cdmQ[4].id, ratingValue: 4 },
                { questionId: cdmQ[5].id, textValue: "Led the API integration layer for Project Apollo. Delivered the Node.js microservice ahead of schedule." },
              ],
            },
          },
        });

        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: cdmDave.id,
            submittedAt: new Date("2026-05-08"),
            responses: {
              create: [
                { questionId: cdmQ[0].id, ratingValue: 4 },
                { questionId: cdmQ[1].id, ratingValue: 3 },
                { questionId: cdmQ[2].id, textValue: "Dave has become more confident with AWS. Started self-study on Kubernetes for future projects." },
                { questionId: cdmQ[3].id, ratingValue: 4 },
                { questionId: cdmQ[4].id, ratingValue: 3 },
                { questionId: cdmQ[5].id, textValue: "Maintained all CI/CD pipelines and reduced deployment failures by 40% through improved pipeline design." },
              ],
            },
          },
        });
      }

      if (hrQ[0] && hrQ[1] && hrQ[2]) {
        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: hrGrace.id,
            submittedAt: new Date("2026-05-20"),
            responses: {
              create: [
                { questionId: hrQ[0].id, ratingValue: 5 },
                { questionId: hrQ[1].id, ratingValue: 5 },
                { questionId: hrQ[2].id, textValue: "Grace consistently models company values and is highly respected across all functions. An exemplary employee." },
              ],
            },
          },
        });
      }

      // ── FeedbackSummaries ──────────────────────────────────────────────
      // Alice: SE targets 4/5 met → 80% skill readiness. Feedback avg ~73%. Composite 76% → NEAR_READY
      await prisma.feedbackSummary.create({
        data: {
          reviewCycleId: h1Cycle.id,
          employeeId: aliceEmployee.id,
          generatedAt: new Date("2026-05-25"),
          skillReadiness: 80,
          feedbackReadiness: 73,
          compositeScore: 76,
          promotionStatus: "NEAR_READY",
          summaryText: "Composite score: 76% (Skill: 80%, Feedback: 73%). Based on 2 feedback submissions.",
          keyStrengths: "Strong ownership of UI deliverables. Improving TypeScript and React skills. Good teamwork observed by PM.",
          developmentAreas: "TypeScript needs to reach target level 2. Improve proactive communication of blockers.",
        },
      });

      // Bob: SSE targets 2/6 met → 33% skill readiness. Feedback avg ~73%. Composite 53% → NEEDS_DEVELOPMENT
      await prisma.feedbackSummary.create({
        data: {
          reviewCycleId: h1Cycle.id,
          employeeId: bobEmployee.id,
          generatedAt: new Date("2026-05-25"),
          skillReadiness: 33,
          feedbackReadiness: 73,
          compositeScore: 53,
          promotionStatus: "NEEDS_DEVELOPMENT",
          summaryText: "Composite score: 53% (Skill: 33%, Feedback: 73%). Based on 2 feedback submissions.",
          keyStrengths: "Strong Node.js expertise. Good collaboration and communication. Delivered API layer ahead of schedule.",
          developmentAreas: "Missing SSE designation target skills: React, TypeScript, Problem Solving. Broaden technical base beyond backend specialisation.",
        },
      });

      // ── H2 2025 Historical Data (CLOSED cycle) ─────────────────────────
      const h2PmForm = await prisma.feedbackForm.create({
        data: {
          title: "H2 2025 - PM Feedback",
          formType: "PM_FEEDBACK",
          reviewCycleId: h2Cycle.id,
          createdById: adminUser.id,
          sections: {
            create: [{
              title: "Project Performance",
              order: 0,
              questions: {
                create: [
                  { text: "Rate the employee's overall project contribution.", type: "RATING", required: true, order: 0 },
                  { text: "Rate their technical leadership on the project.", type: "RATING", required: true, order: 1 },
                  { text: "Key performance observations.", type: "TEXT", required: false, order: 2 },
                ],
              },
            }],
          },
        },
        include: { sections: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
      });

      const h2Q = h2PmForm.sections.flatMap((s) => s.questions);

      const h2GraceAssignment = await prisma.feedbackFormAssignment.create({
        data: {
          reviewCycleId: h2Cycle.id, formId: h2PmForm.id,
          reviewerId: michaelEmployee.id, employeeId: graceEmployee.id,
          projectId: hermesProject?.id ?? null,
          assignedById: adminUser.id, status: "SUBMITTED", dueDate: new Date("2025-12-15"),
        },
      });

      if (h2Q[0] && h2Q[1] && h2Q[2]) {
        await prisma.feedbackSubmission.create({
          data: {
            assignmentId: h2GraceAssignment.id,
            submittedAt: new Date("2025-11-30"),
            responses: {
              create: [
                { questionId: h2Q[0].id, ratingValue: 5 },
                { questionId: h2Q[1].id, ratingValue: 5 },
                { questionId: h2Q[2].id, textValue: "Grace led the Hermes migration with exceptional depth and precision. Delivered 2 weeks ahead of schedule with zero critical production issues." },
              ],
            },
          },
        });
      }

      await prisma.feedbackSummary.create({
        data: {
          reviewCycleId: h2Cycle.id,
          employeeId: graceEmployee.id,
          generatedAt: new Date("2025-12-10"),
          skillReadiness: 80,
          feedbackReadiness: 100,
          compositeScore: 90,
          promotionStatus: "READY_FOR_PROMOTION",
          summaryText: "Composite score: 90% (Skill: 80%, Feedback: 100%). Based on 1 feedback submission.",
          keyStrengths: "Exceptional technical leadership. Delivered Project Hermes migration ahead of schedule with zero critical issues.",
          developmentAreas: "Design Patterns needs to reach level 4 to fully satisfy Principal Engineer requirements.",
          promotionNotes: "Recommend Grace for Architect track promotion. Confirm readiness in H1 2026 review cycle.",
        },
      });

      console.log("✓ Feedback module (2 cycles, 4 forms, 9 assignments, 6 submissions, 3 summaries)");
    }
  } else {
    console.log("✓ Feedback module (already seeded, skipping)");
  }

  console.log("\n✅ Seeding complete.\n");
  console.log("Accounts:");
  console.log("  Admin   : admin@skillmatrix.com        / admin123456");
  console.log("  Manager : manager.fullstack@skillmatrix.com / manager123");
  console.log("  Manager : manager.devops@skillmatrix.com   / manager123");
  console.log("  Employee: alice.fullstack@skillmatrix.com  / employee123");
  console.log("  Employee: bob.backend@skillmatrix.com      / employee123");
  console.log("  Employee: carol.frontend@skillmatrix.com   / employee123");
  console.log("  Employee: dave.devops@skillmatrix.com      / employee123");
  console.log("  Employee: eve.data@skillmatrix.com         / employee123");
  console.log("  Employee: frank.frontend@skillmatrix.com   / employee123");
  console.log("  Employee: grace.backend@skillmatrix.com    / employee123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
