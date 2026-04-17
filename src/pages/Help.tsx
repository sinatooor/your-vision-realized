import { Link } from "react-router-dom";
import { MaterialIcon } from "@/components/MaterialIcon";

const sections = [
  {
    icon: "public",
    title: "Overview",
    route: "/",
    description:
      "The interactive world map shows your client's current jurisdictional footprint. Click any country to open the analysis panel, configure expansion parameters, and initiate the AI analysis pipeline.",
    steps: [
      "Click a target country on the map",
      "Set headcount, entity structure, and data types",
      "Run analysis — results appear across all sections",
    ],
  },
  {
    icon: "warning",
    title: "Conflicts",
    route: "/conflicts",
    description:
      "Displays cross-border regulatory conflicts identified between the client's current presence and the target expansion. Each conflict is rated by severity and includes structured mitigation options.",
    steps: [
      "Review critical and blocking conflicts first",
      "Expand each conflict for detailed mitigation strategies",
      "Use severity ratings to prioritise client advice",
    ],
  },
  {
    icon: "account_tree",
    title: "Scenarios",
    route: "/scenarios",
    description:
      "Compares alternative entity structures — EOR, subsidiary, contractor-first, distributor — across legal risk, compliance burden, time-to-launch, and operational complexity dimensions.",
    steps: [
      "Review the recommended scenario (lowest total score)",
      "Compare trade-offs across risk dimensions",
      "Expand scenario rationale for detailed assumptions",
    ],
  },
  {
    icon: "checklist",
    title: "Action Plan",
    route: "/plan",
    description:
      "A sequenced timeline of legal tasks organised across a 90-day horizon. Each action has a designated owner (partner, associate, local counsel, or client) and estimated duration.",
    steps: [
      "Address blocking actions in Days 0–30 first",
      "Assign partner and associate tasks to the matter team",
      "Instruct local counsel for jurisdiction-specific obligations",
    ],
  },
  {
    icon: "description",
    title: "Memo",
    route: "/memo",
    description:
      "An AI-drafted legal memorandum covering the executive summary, identified obligations, conflict analysis, scenario recommendation, and action plan. Formatted for partner review and client delivery.",
    steps: [
      "Review executive summary with client before full delivery",
      "Export as Markdown for further editing in your document system",
      "Always verify AI-generated content with qualified local counsel",
    ],
  },
];

export default function Help() {
  return (
    <main
      className="flex-1 pt-[89px] pb-8 overflow-auto"
      style={{ height: "calc(100vh - 32px)" }}
    >
      <div className="px-12 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-headline text-3xl font-bold text-primary">Help & Documentation</h1>
          <p className="font-body text-base text-on-surface-variant mt-2 max-w-xl">
            JurisdictIQ assists law firms in assessing international expansion compliance risk.
            The AI analysis pipeline identifies regulatory obligations, cross-border conflicts, and
            generates structured legal output for partner review.
          </p>
          <div className="mt-4 border-l-4 border-medium bg-surface-container px-4 py-3 max-w-xl">
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
              Important Notice
            </p>
            <p className="font-body text-sm text-on-surface">
              JurisdictIQ is a research and drafting aid. All AI-generated analysis must be
              reviewed and verified by qualified legal counsel before reliance or client delivery.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
            Platform Sections
          </p>
          {sections.map((section) => (
            <div key={section.title} className="border border-outline-variant">
              <div className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <MaterialIcon
                    name={section.icon}
                    className="text-[22px] text-primary shrink-0 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="font-headline text-lg font-bold text-primary">
                        {section.title}
                      </h2>
                      <Link
                        to={section.route}
                        className="font-mono text-[9px] tracking-widest uppercase text-outline border border-outline-variant px-2 py-0.5 hover:text-primary hover:border-primary transition-colors"
                      >
                        Open →
                      </Link>
                    </div>
                    <p className="font-body text-sm text-on-surface leading-relaxed mb-4">
                      {section.description}
                    </p>
                    <div>
                      <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-2">
                        Workflow
                      </p>
                      <ol className="space-y-1">
                        {section.steps.map((step, i) => (
                          <li
                            key={i}
                            className="font-body text-sm text-on-surface-variant flex gap-3"
                          >
                            <span className="font-mono text-[9px] text-outline mt-0.5 shrink-0">
                              {i + 1}.
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 border-t border-outline-variant pt-6">
          <p className="font-mono text-[9px] tracking-widest uppercase text-outline mb-1">
            About This Tool
          </p>
          <p className="font-body text-sm text-on-surface-variant max-w-xl">
            JurisdictIQ uses a multi-agent AI pipeline to research regulatory obligations,
            identify cross-border conflicts, and generate legal analysis. Source citations are
            included with each obligation for independent verification.
          </p>
        </div>
      </div>
    </main>
  );
}
