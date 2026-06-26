import { PageHeader } from "@/components/shared/page-header";
import { CopilotChat } from "./copilot-chat";

export default function CopilotPage() {
  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      <PageHeader
        title="RM Copilot"
        description="Ask resourcing questions in plain English. The Copilot calls live data tools and answers decision-first."
      />
      <CopilotChat />
    </div>
  );
}
