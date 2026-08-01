-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "employee_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "designations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "competency_levels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "weekly_capacity" REAL NOT NULL DEFAULT 40,
    "available_from" DATETIME,
    "cost_rate" REAL,
    "external_id" TEXT,
    "job_name" TEXT,
    "department" TEXT,
    "location" TEXT,
    "date_of_join" DATETIME,
    "date_of_resignation" DATETIME,
    "coe_id" TEXT,
    "designation_id" TEXT,
    "manager_id" TEXT,
    "cluster_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employees_coe_id_fkey" FOREIGN KEY ("coe_id") REFERENCES "coes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "employees_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "employees_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clusters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'SKILL',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "coe_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coe_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "target_competency" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "coe_skills_coe_id_fkey" FOREIGN KEY ("coe_id") REFERENCES "coes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coe_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "designation_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "designation_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "target_competency" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "designation_skills_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "designation_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "self_assessed_level" INTEGER NOT NULL,
    "validated_level" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "review_comment" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_skill_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT,
    "score" TEXT,
    "issued_at" DATETIME,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "evidences_employee_skill_id_fkey" FOREIGN KEY ("employee_skill_id") REFERENCES "employee_skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "skill_id" TEXT NOT NULL,
    "from_level" INTEGER NOT NULL,
    "to_level" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "learning_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learning_path_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "duration" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "learning_items_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'BRONZE',
    "relationship_since" DATETIME,
    "is_new" BOOLEAN NOT NULL DEFAULT false,
    "industry" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "team_size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT NOT NULL DEFAULT 'TACTICAL_BUILD',
    "pipeline_stage" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sow_signed" BOOLEAN NOT NULL DEFAULT false,
    "sow_signed_date" DATETIME,
    "planned_end_date" DATETIME,
    "expected_start" DATETIME,
    "win_probability" INTEGER,
    "client_priority" INTEGER,
    "fund_type" TEXT,
    "bill_rate" REAL,
    "tech_coe" TEXT,
    "proposition_coe" TEXT,
    "client_id" TEXT,
    "client_ref_id" TEXT,
    "actual_end_date" DATETIME,
    "external_id" TEXT,
    "project_key" TEXT,
    "reporter_external_id" TEXT,
    "approver_external_id" TEXT,
    "project_manager_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_client_ref_id_fkey" FOREIGN KEY ("client_ref_id") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_skill_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "required_level" INTEGER NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_skill_requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_skill_requirements_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "allocation" REAL NOT NULL,
    "role" TEXT,
    "billability" TEXT NOT NULL DEFAULT 'BILLABLE',
    "resourcing_status" TEXT,
    "external_id" TEXT,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "planned_end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_allocations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_mix_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "designation_id" TEXT,
    "fte" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DERIVED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'UNPLANNED',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_cycles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "review_cycles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_forms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "form_type" TEXT NOT NULL,
    "review_cycle_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_forms_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "review_cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "feedback_forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_form_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "form_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_form_sections_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "feedback_forms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_form_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_form_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "feedback_form_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_form_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "review_cycle_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "project_id" TEXT,
    "assigned_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "due_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_form_assignments_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "review_cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "feedback_form_assignments_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "feedback_forms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "feedback_form_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "feedback_form_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "feedback_form_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "feedback_form_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignment_id" TEXT NOT NULL,
    "submitted_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "feedback_form_assignments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submission_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "rating_value" INTEGER,
    "text_value" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "feedback_submissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "feedback_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "feedback_form_questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "review_cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL,
    "summary_text" TEXT NOT NULL,
    "key_strengths" TEXT NOT NULL,
    "development_areas" TEXT NOT NULL,
    "skill_readiness" REAL NOT NULL,
    "feedback_readiness" REAL NOT NULL,
    "composite_score" REAL NOT NULL,
    "promotion_status" TEXT NOT NULL,
    "promotion_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "feedback_summaries_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "review_cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "feedback_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "project_id" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT false,
    "hours" REAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "status" TEXT,
    "external_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "timesheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "behaviour" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "competencies_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pipeline_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cluster" INTEGER,
    "client" TEXT,
    "request_type" TEXT,
    "client_priority" TEXT,
    "likely_start" DATETIME,
    "number_of_weeks" REAL,
    "deal_stage" TEXT,
    "solution" TEXT,
    "resources_requested" TEXT,
    "resource_recommended" REAL,
    "percent_available" REAL,
    "skillset" TEXT,
    "skillset_match" TEXT,
    "sow_signed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "comments" TEXT,
    "service_line" TEXT,
    "solution_priority" INTEGER,
    "confidence" INTEGER NOT NULL DEFAULT 20,
    "is_new_client" BOOLEAN NOT NULL DEFAULT false,
    "client_relationship_months" INTEGER,
    "client_tier" TEXT,
    "deal_lost_at" DATETIME,
    "hiring_lead_time_alert" BOOLEAN NOT NULL DEFAULT false,
    "project_key" TEXT,
    "tech_coe" TEXT,
    "proposition_coe" TEXT,
    "reporter_external_id" TEXT,
    "approver_external_id" TEXT,
    "client_external_id" TEXT,
    "type_of_project" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "weekly_statuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "week_start" DATETIME NOT NULL,
    "week_end" DATETIME NOT NULL,
    "scope_status" TEXT,
    "schedule_status" TEXT,
    "quality_status" TEXT,
    "csat_status" TEXT,
    "team_status" TEXT,
    "external_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_statuses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "utilisation_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "week_start" DATETIME NOT NULL,
    "total_hours" REAL NOT NULL DEFAULT 0,
    "billable_hours" REAL NOT NULL DEFAULT 0,
    "utilisation" REAL NOT NULL DEFAULT 0,
    "billable_util" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "utilisation_snapshots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shadow_flags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "detected_at" DATETIME NOT NULL,
    "hours" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shadow_flags_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_experience_docs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_industry" TEXT,
    "project_type" TEXT NOT NULL,
    "tech_stack" TEXT,
    "business_context" TEXT,
    "solution_provided" TEXT,
    "my_role" TEXT,
    "team_size" INTEGER,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "raw_text" TEXT,
    "extraction_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "extracted_skills" TEXT,
    "ai_summary" TEXT,
    "project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_experience_docs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_experience_docs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ingest_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_at" DATETIME NOT NULL,
    "file_name" TEXT NOT NULL,
    "rows_loaded" INTEGER NOT NULL DEFAULT 0,
    "rows_dropped" INTEGER NOT NULL DEFAULT 0,
    "nulls_coerced" INTEGER NOT NULL DEFAULT 0,
    "unmapped_values" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "project_resourcing_statuses" (
    "project_id" TEXT NOT NULL PRIMARY KEY,
    "is_submitted" BOOLEAN NOT NULL DEFAULT false,
    "is_negotiated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "project_resourcing_statuses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resource_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "resource_key" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "justifications" TEXT NOT NULL,
    CONSTRAINT "resource_decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project_resourcing_statuses" ("project_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resource_swaps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "resource_key" TEXT NOT NULL,
    "swapped_name" TEXT NOT NULL,
    CONSTRAINT "resource_swaps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project_resourcing_statuses" ("project_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "coes_name_key" ON "coes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "designations_name_key" ON "designations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "competency_levels_level_key" ON "competency_levels"("level");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_external_id_key" ON "employees"("external_id");

-- CreateIndex
CREATE INDEX "employees_cluster_id_idx" ON "employees"("cluster_id");

-- CreateIndex
CREATE UNIQUE INDEX "clusters_name_key" ON "clusters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coe_skills_coe_id_skill_id_key" ON "coe_skills"("coe_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "designation_skills_designation_id_skill_id_key" ON "designation_skills"("designation_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skills_employee_id_skill_id_key" ON "employee_skills"("employee_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_external_id_key" ON "projects"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_skill_requirements_project_id_skill_id_key" ON "project_skill_requirements"("project_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_allocations_external_id_key" ON "project_allocations"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_allocations_project_id_employee_id_key" ON "project_allocations"("project_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_mix_templates_category_role_key" ON "role_mix_templates"("category", "role");

-- CreateIndex
CREATE INDEX "feedback_form_assignments_reviewer_id_idx" ON "feedback_form_assignments"("reviewer_id");

-- CreateIndex
CREATE INDEX "feedback_form_assignments_employee_id_idx" ON "feedback_form_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "feedback_form_assignments_review_cycle_id_idx" ON "feedback_form_assignments"("review_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_form_assignments_review_cycle_id_form_id_reviewer_id_employee_id_project_id_key" ON "feedback_form_assignments"("review_cycle_id", "form_id", "reviewer_id", "employee_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_submissions_assignment_id_key" ON "feedback_submissions"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_responses_submission_id_question_id_key" ON "feedback_responses"("submission_id", "question_id");

-- CreateIndex
CREATE INDEX "feedback_summaries_employee_id_idx" ON "feedback_summaries"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_summaries_review_cycle_id_employee_id_key" ON "feedback_summaries"("review_cycle_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_external_key_key" ON "timesheets"("external_key");

-- CreateIndex
CREATE INDEX "timesheets_employee_id_date_idx" ON "timesheets"("employee_id", "date");

-- CreateIndex
CREATE INDEX "timesheets_project_id_date_idx" ON "timesheets"("project_id", "date");

-- CreateIndex
CREATE INDEX "competencies_employee_id_idx" ON "competencies"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_employee_id_behaviour_key" ON "competencies"("employee_id", "behaviour");

-- CreateIndex
CREATE INDEX "pipeline_requests_cluster_idx" ON "pipeline_requests"("cluster");

-- CreateIndex
CREATE INDEX "pipeline_requests_sow_signed_idx" ON "pipeline_requests"("sow_signed");

-- CreateIndex
CREATE INDEX "pipeline_requests_deal_lost_at_idx" ON "pipeline_requests"("deal_lost_at");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_statuses_external_key_key" ON "weekly_statuses"("external_key");

-- CreateIndex
CREATE INDEX "weekly_statuses_project_id_week_start_idx" ON "weekly_statuses"("project_id", "week_start");

-- CreateIndex
CREATE INDEX "utilisation_snapshots_employee_id_idx" ON "utilisation_snapshots"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisation_snapshots_employee_id_week_start_key" ON "utilisation_snapshots"("employee_id", "week_start");

-- CreateIndex
CREATE INDEX "shadow_flags_project_id_idx" ON "shadow_flags"("project_id");

-- CreateIndex
CREATE INDEX "shadow_flags_employee_id_idx" ON "shadow_flags"("employee_id");

-- CreateIndex
CREATE INDEX "project_experience_docs_employee_id_idx" ON "project_experience_docs"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_decisions_project_id_resource_key_key" ON "resource_decisions"("project_id", "resource_key");

-- CreateIndex
CREATE UNIQUE INDEX "resource_swaps_project_id_resource_key_key" ON "resource_swaps"("project_id", "resource_key");
