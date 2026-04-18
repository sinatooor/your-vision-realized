export interface SideNavSection {
  id: string;
  icon: string;
  label: string;
}

export const SIDE_NAV_SECTIONS: Record<string, { title: string; sections: SideNavSection[] }> = {
  "/": {
    title: "Overview",
    sections: [
      { id: "region-select", icon: "public", label: "Region Select" },
      { id: "regulatory-scope", icon: "gavel", label: "Regulatory Scope" },
      { id: "tax-exposure", icon: "payments", label: "Tax Exposure" },
      { id: "entity-structure", icon: "account_tree", label: "Entity Structure" },
    ],
  },
  "/conflicts": {
    title: "Conflicts",
    sections: [
      { id: "conflicts-summary", icon: "warning", label: "Summary" },
      { id: "conflicts-critical", icon: "priority_high", label: "Critical" },
      { id: "conflicts-mitigation", icon: "shield", label: "Mitigation" },
      { id: "conflicts-obligations", icon: "list_alt", label: "Obligations" },
    ],
  },
  "/scenarios": {
    title: "Scenarios",
    sections: [
      { id: "scenarios-overview", icon: "account_tree", label: "Overview" },
      { id: "scenarios-recommended", icon: "star", label: "Recommended" },
      { id: "scenarios-comparison", icon: "compare_arrows", label: "Comparison" },
      { id: "scenarios-rationale", icon: "psychology", label: "Rationale" },
    ],
  },
  "/plan": {
    title: "Action Plan",
    sections: [
      { id: "plan-summary", icon: "checklist", label: "Summary" },
      { id: "plan-blocking", icon: "block", label: "Blocking" },
      { id: "plan-timeline", icon: "schedule", label: "Timeline" },
      { id: "plan-owners", icon: "groups", label: "Owners" },
    ],
  },
  "/memo": {
    title: "Memo",
    sections: [
      { id: "memo-summary", icon: "subject", label: "Executive Summary" },
      { id: "memo-body", icon: "description", label: "Memo Body" },
      { id: "memo-export", icon: "download", label: "Export" },
    ],
  },
  "/settings": {
    title: "Settings",
    sections: [
      { id: "settings-session", icon: "analytics", label: "Session" },
      { id: "settings-defaults", icon: "tune", label: "Defaults" },
      { id: "settings-status", icon: "monitoring", label: "System Status" },
      { id: "settings-about", icon: "info", label: "About" },
    ],
  },
  "/help": {
    title: "Help",
    sections: [
      { id: "help-intro", icon: "help", label: "Introduction" },
      { id: "help-overview", icon: "public", label: "Overview" },
      { id: "help-conflicts", icon: "warning", label: "Conflicts" },
      { id: "help-scenarios", icon: "account_tree", label: "Scenarios" },
      { id: "help-plan", icon: "checklist", label: "Action Plan" },
      { id: "help-memo", icon: "description", label: "Memo" },
    ],
  },
};
