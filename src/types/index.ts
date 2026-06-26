import type { UserRole } from "@prisma/client";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId: string | null;
}

export interface SkillGapItem {
  skillId: string;
  skillName: string;
  targetLevel: number;
  currentLevel: number;
  gap: number;
  status: "met" | "in_progress" | "needs_development" | "not_started";
}

export interface ReadinessScore {
  skillsMet: number;
  skillsPartiallyMet: number;
  skillsNotStarted: number;
  totalSkills: number;
  percentage: number;
}

export interface TransitionGapItem extends SkillGapItem {
  priority: "critical" | "high" | "medium" | "low" | "none";
}

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles: UserRole[];
}
