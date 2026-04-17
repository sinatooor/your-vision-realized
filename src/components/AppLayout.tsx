import { useState } from "react";
import { Outlet } from "react-router-dom";
import { TopAppBar } from "@/components/TopAppBar";
import { SideNav } from "@/components/SideNav";
import { StatusFooter } from "@/components/StatusFooter";
import { useAnalysis } from "@/contexts/AnalysisContext";

export function AppLayout() {
  const [sideNavOpen, setSideNavOpen] = useState(false);
  const { result } = useAnalysis();

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col overflow-hidden">
      <TopAppBar
        onMenuToggle={() => setSideNavOpen((v) => !v)}
        menuOpen={sideNavOpen}
        conflictCount={result?.conflicts.length}
        actionCount={result?.actions.length}
      />
      <SideNav open={sideNavOpen} />
      <Outlet />
      <StatusFooter />
    </div>
  );
}
