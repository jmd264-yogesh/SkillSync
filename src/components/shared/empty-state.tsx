import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center bg-white/50">
      <div className="h-16 w-16 rounded-2xl gradient-primary-soft flex items-center justify-center mb-5">
        <Icon className="h-8 w-8 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
