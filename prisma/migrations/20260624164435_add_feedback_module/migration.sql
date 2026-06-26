-- CreateEnum
CREATE TYPE "ReviewCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeedbackFormType" AS ENUM ('PM_FEEDBACK', 'CDM_ASSESSMENT', 'HR_FEEDBACK');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('RATING', 'TEXT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('READY_FOR_PROMOTION', 'NEAR_READY', 'NEEDS_DEVELOPMENT', 'NOT_ELIGIBLE_YET');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "project_manager_id" TEXT;

-- CreateTable
CREATE TABLE "review_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "ReviewCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_forms" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "form_type" "FeedbackFormType" NOT NULL,
    "review_cycle_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_form_sections" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_form_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_form_questions" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_form_assignments" (
    "id" TEXT NOT NULL,
    "review_cycle_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "project_id" TEXT,
    "assigned_by_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_form_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "rating_value" INTEGER,
    "text_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_summaries" (
    "id" TEXT NOT NULL,
    "review_cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "summary_text" TEXT NOT NULL,
    "key_strengths" TEXT NOT NULL,
    "development_areas" TEXT NOT NULL,
    "skill_readiness" DOUBLE PRECISION NOT NULL,
    "feedback_readiness" DOUBLE PRECISION NOT NULL,
    "composite_score" DOUBLE PRECISION NOT NULL,
    "promotion_status" "PromotionStatus" NOT NULL,
    "promotion_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_form_assignments_reviewer_id_idx" ON "feedback_form_assignments"("reviewer_id");

-- CreateIndex
CREATE INDEX "feedback_form_assignments_employee_id_idx" ON "feedback_form_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "feedback_form_assignments_review_cycle_id_idx" ON "feedback_form_assignments"("review_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_form_assignments_review_cycle_id_form_id_reviewer__key" ON "feedback_form_assignments"("review_cycle_id", "form_id", "reviewer_id", "employee_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_submissions_assignment_id_key" ON "feedback_submissions"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_responses_submission_id_question_id_key" ON "feedback_responses"("submission_id", "question_id");

-- CreateIndex
CREATE INDEX "feedback_summaries_employee_id_idx" ON "feedback_summaries"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_summaries_review_cycle_id_employee_id_key" ON "feedback_summaries"("review_cycle_id", "employee_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_sections" ADD CONSTRAINT "feedback_form_sections_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_questions" ADD CONSTRAINT "feedback_form_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "feedback_form_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_assignments" ADD CONSTRAINT "feedback_form_assignments_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_assignments" ADD CONSTRAINT "feedback_form_assignments_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "feedback_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_assignments" ADD CONSTRAINT "feedback_form_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_assignments" ADD CONSTRAINT "feedback_form_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_assignments" ADD CONSTRAINT "feedback_form_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_form_assignments" ADD CONSTRAINT "feedback_form_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "feedback_form_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "feedback_form_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_summaries" ADD CONSTRAINT "feedback_summaries_review_cycle_id_fkey" FOREIGN KEY ("review_cycle_id") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_summaries" ADD CONSTRAINT "feedback_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
