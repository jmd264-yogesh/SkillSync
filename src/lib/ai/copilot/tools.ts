import type { Tool } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";

export const COPILOT_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "recommend_resources",
        description:
          "Get ranked employee recommendations for a pipeline request or ad-hoc skill requirements. Returns skill score, competency score, availability, and a hire/redeploy signal for each candidate.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            pipelineRequestId: {
              type: SchemaType.STRING,
              description: "UUID of a pipeline request (use this OR requiredSkills)",
            },
            requiredSkills: {
              type: SchemaType.ARRAY,
              description: "Ad-hoc skill requirements (use this OR pipelineRequestId)",
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  skillId: { type: SchemaType.STRING },
                  skillName: { type: SchemaType.STRING },
                  requiredLevel: { type: SchemaType.NUMBER, description: "1–5" },
                },
                required: ["skillId", "skillName", "requiredLevel"],
              },
            },
          },
        },
      },
      {
        name: "forecast_new_projects",
        description:
          "Forecast headcount demand for new projects. Returns demand vs supply by role, redeployment candidates, and a Yes/No/Yes-with-conditions decision.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            adHoc: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  category: {
                    type: SchemaType.STRING,
                    description:
                      "One of: D_AND_D, TACTICAL_BUILD, DATA_PLATFORM_BUILD, ENTERPRISE_BUILD, DATA_SCIENCE, AI_PROJECT, MS_PROJECT, FULL_STACK, VALUE_CREATION, OTHER",
                  },
                  count: { type: SchemaType.NUMBER },
                  start: { type: SchemaType.STRING, description: "ISO date string" },
                  weeks: { type: SchemaType.NUMBER },
                },
                required: ["category", "count", "start", "weeks"],
              },
            },
            pipelineRequestIds: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
          },
        },
      },
      {
        name: "get_pipeline_forecast",
        description:
          "Get 6-month pipeline forecast by cluster — demand vs supply, first shortfall month, confirmed vs probable breakdown.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            months: {
              type: SchemaType.NUMBER,
              description: "Forecast horizon in months (default 6)",
            },
            cluster: {
              type: SchemaType.NUMBER,
              description: "Filter by cluster number (omit for all clusters)",
            },
          },
        },
      },
      {
        name: "get_project_health",
        description:
          "Get health radar for active projects — RAG signals, billability leakage, shadow resources, releasable FTE.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            projectIds: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Specific project IDs (omit for all active projects)",
            },
          },
        },
      },
      {
        name: "get_allocation_report",
        description:
          "Get real utilisation and availability for employees — planned vs actual utilisation, billable%, status (OVER/FULL/UNDER/BENCH).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: {
              type: SchemaType.STRING,
              description: "Filter by utilisation status: ALL, OVER, FULL, UNDER, or BENCH",
            },
            coeId: { type: SchemaType.STRING, description: "Filter by COE UUID" },
            designationId: { type: SchemaType.STRING, description: "Filter by Designation UUID" },
          },
        },
      },
      {
        name: "get_availability",
        description: "Get available FTE for a role or skill within a date window.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            role: {
              type: SchemaType.STRING,
              description: "Job name / role to filter by (partial match)",
            },
            skillId: { type: SchemaType.STRING, description: "Skill UUID to require" },
            minSkillLevel: { type: SchemaType.NUMBER, description: "Minimum skill level 1–5" },
            windowStart: { type: SchemaType.STRING, description: "ISO date string" },
            windowEnd: { type: SchemaType.STRING, description: "ISO date string" },
          },
          required: ["windowStart", "windowEnd"],
        },
      },
    ],
  },
];
