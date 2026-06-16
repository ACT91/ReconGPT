import { ReactNode } from "react";

type SidebarSectionProps = {
  title: string;
  isCollapsed: boolean;
  children: ReactNode;
};

export function SidebarSection({ title, isCollapsed, children }: SidebarSectionProps) {
  return (
    <div className="mb-4">
      {!isCollapsed && (
        <div className="px-6 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {title}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
