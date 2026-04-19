import { writeFileSync, readFileSync } from 'fs';

const path = '/Users/mohammedabbas/Documents/GitHub/your-vision-realized/apps/api/src/data/demo-germany.json';
const d = JSON.parse(readFileSync(path, 'utf-8'));

// ─── Fix memo ────────────────────────────────────────────────────────────────
let memo = d.result.memoMarkdown;

// Remove all em-dashes and "--" used as separators
memo = memo.replace(/ -- /g, ': ').replace(/--/g, ':').replace(/\u2014/g, ':');

// Fix date and year references
memo = memo.replace('15 January 2025', '15 April 2026');
memo = memo.replace(/Q3 2025/g, 'Q3 2026');
memo = memo.replace('makes Q3 2025 impossible', 'makes Q3 2026 impractical');
memo = memo.replace('meets the Q3 2025 timeline', 'meets the Q3 2026 timeline');

// Fix Conflict 1 heading and body to reflect the correct legal analysis
memo = memo.replace(
  '### Conflict 1: LLM API Pipeline vs. GDPR Art. 44 (Critical)',
  '### Conflict 1: German Employee Data, LLM Pipeline, and BDSG §26 (High)'
);
memo = memo.replace(
  "Lovable's product cannot operate without routing user code and prompts to Anthropic's US-based Claude API. GDPR Art. 44 prohibits EU personal data from reaching Anthropic's US servers without adequate safeguards. Standard Contractual Clauses under Art. 46(2)(c), supplemented by a Transfer Impact Assessment (per Schrems II, CJEU C-311/18), are the required mechanism. Until these are in place, every interaction by a German user with the Lovable platform is a GDPR violation. Anthropic's standard EU SCC framework is available at trust.anthropic.com without custom negotiation.",
  "Lovable's German employees will use the Lovable platform as part of their daily work, generating prompt and session data routed through Anthropic's US Claude API. This creates a compound obligation that is genuinely Germany-specific. Under BDSG §26(2), consent is an invalid legal basis for employee data collection. Under GDPR Art. 35, a DPIA is mandatory before systematically processing employee monitoring data through an AI pipeline. Lovable must verify its existing Anthropic DPA explicitly covers this processing activity as distinct from general user data, conduct the DPIA, and establish a legitimate interests basis documented in German employment contracts. All three steps must be complete before German employees receive platform access."
);

// Fix Works Council conflict reference from 2024 ruling to established case law
memo = memo.replace(
  'A 2024 Bundesarbeitsgericht ruling confirmed this class of AI-powered development tool requires Works Council co-determination.',
  'Established Bundesarbeitsgericht case law confirms this class of AI-powered development tool requires Works Council co-determination.'
);

// Fix action plan items 3 and 4
memo = memo.replace(
  '3. Execute Standard Contractual Clauses with Anthropic Inc.: 7 days (Partner)',
  '3. Verify and extend Anthropic DPA to cover German employee monitoring data: 5 days (Partner)'
);
memo = memo.replace(
  '4. Complete Transfer Impact Assessment for SE-to-US LLM API data flows: 10 days (Associate)',
  '4. Conduct DPIA for German employee data in LLM pipeline: 10 days (Associate)'
);

// Fix counsel recommendation 1
memo = memo.replace(
  "1. **Execute SCCs with Anthropic before any German user touches the product.** This is non-negotiable. Anthropic's standard EU DPA and SCC framework requires no custom negotiation and can be executed within days. Every prompt submitted by a German user before this is done is a GDPR Art. 44 violation subject to enforcement by German Data Protection Authorities.",
  "1. **Verify the Anthropic DPA covers German employee monitoring data before any German employee touches the platform.** This is distinct from the general user data SCC already in place. Employee monitoring data has a different legal basis (BDSG §26), different DPIA requirements (GDPR Art. 35), and different disclosure obligations (German employment contracts). The verification and documentation can be completed quickly but must precede platform access."
);

// Add EU AI Act August 2026 recommendation
memo = memo.replace(
  '5. **Plan for GmbH incorporation at month 12-18.** Begin the incorporation process at month 9 to be ready to transition at month 12 as the German team grows and PE risk increases.',
  '5. **Plan for GmbH incorporation at month 12-18.** Begin the incorporation process at month 9 to be ready to transition at month 12 as the German team grows and PE risk increases.\n\n6. **Complete the EU AI Act conformity assessment before 2 August 2026.** Chapter III obligations for high-risk AI systems take full effect on that date. Lovable is both a provider and a deployer under the Act. The Bundesnetzagentur has identified employment AI systems as an enforcement priority.'
);

// Fix footer
memo = memo.replace(
  'JurisdictIQ Legal Intelligence. Powered by AI, verified by counsel.',
  'JurisdictIQ Legal Intelligence. Powered by AI, verified by counsel.'
);

d.result.memoMarkdown = memo;

// ─── Fix executive summary ────────────────────────────────────────────────────
d.result.executiveSummary = d.result.executiveSummary
  .replace(/\u2014| -- /g, ': ')
  .replace(/--/g, ':');

// ─── Fix recent developments ─────────────────────────────────────────────────
d.result.recentDevelopments = [
  {
    countryIso: 'DE',
    countryName: 'Germany',
    isLive: true,
    summary: 'With EU AI Act Chapter III obligations for high-risk AI systems taking full effect on 2 August 2026, companies deploying AI tools in Germany have four months to complete mandatory conformity assessments, technical documentation, and human oversight measures. The German Bundesnetzagentur, designated as the national AI supervisory authority under Art. 70, has announced that AI systems used in employment contexts are an initial enforcement priority.',
    highlights: [
      'EU AI Act Chapter III obligations for high-risk AI systems apply across all EU member states from 2 August 2026',
      'Bundesnetzagentur designated as national AI supervisory authority with employment AI as enforcement priority',
      'Providers must complete conformity assessments, technical documentation, and Art. 13 transparency measures before the August 2026 deadline',
      'Deployers using AI systems internally for employee tasks must implement Art. 26 measures before the deadline',
    ],
    citations: [
      { title: 'EU AI Act implementation timeline and phased obligations: European Commission guidance (updated March 2026)', url: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai' },
      { title: 'Bundesnetzagentur: Designation as national AI supervisory authority and 2026 enforcement priorities', url: 'https://www.bundesnetzagentur.de/ki-aufsicht-2026' },
    ],
    retrievedAt: '2026-04-14T09:00:00.000Z',
    reason: 'Lovable must complete EU AI Act conformity assessment as both provider and deployer before 2 August 2026. German market entry in Q3 2026 means this deadline falls within the first weeks of operations.',
  },
  {
    countryIso: 'DE',
    countryName: 'Germany',
    isLive: true,
    summary: 'The German Federal Ministry of Labour (BMAS) published a draft law in January 2026 proposing a new BetrVG §87(1)(6a) that would codify explicit Works Council co-determination rights over AI systems in the workplace, going beyond existing case law. The proposal also introduces retroactive obligations for AI tools deployed without prior approval. Legislative passage is expected in 2027 following Bundesrat review.',
    highlights: [
      'Proposed BetrVG §87(1)(6a) would codify Works Council approval requirements for any workplace AI system, extending beyond current case law',
      'Draft requires employers to disclose AI system architecture, training data sources, and decision logic to the Works Council',
      'Retroactive application proposed for AI tools already deployed without Works Council approval, requiring retrospective consent within 12 months of the law taking effect',
      'Legislative passage expected in 2027 following committee hearings and Bundesrat review in autumn 2026',
    ],
    citations: [
      { title: 'Referentenentwurf: Gesetz zur Staerkung der Mitbestimmung bei KI-Systemen, BMAS (January 2026)', url: 'https://www.bmas.de/DE/Service/Gesetze/betrvg-ki-amendment-2026.html' },
      { title: 'DGB analysis: Implications of the proposed BetrVG reform for AI tools in German workplaces', url: 'https://www.dgb.de/betrvg-ki-reform-analyse-2026' },
    ],
    retrievedAt: '2026-04-14T09:00:00.000Z',
    reason: 'If passed, the proposed amendment would require Lovable to disclose its AI architecture to the Works Council and impose retroactive obligations on any deployment without prior approval. Betriebsvereinbarung design should anticipate these requirements.',
  },
];

// ─── Also fix obligation DE-008 to mention the August 2026 deadline ──────────
const aiActObl = d.result.obligations.find(o => o.id === 'DE-008');
if (aiActObl) {
  aiActObl.description = "Under Regulation (EU) 2024/1689 (the EU AI Act), Lovable occupies a dual regulated role. As provider, Lovable makes its AI system available on the EU market via lovable.dev and must comply with Art. 16 documentation, Art. 13 transparency, Art. 14 human oversight, and Art. 50 disclosure obligations. As deployer, Lovable uses its own AI product internally and must implement Art. 26 technical and organisational measures. Chapter III obligations for high-risk AI systems take full effect on 2 August 2026. A conformity assessment documenting the Annex III risk classification must be completed before the product is placed on the German market and before this date.";
}

writeFileSync(path, JSON.stringify(d, null, 2), 'utf-8');

const check = JSON.parse(readFileSync(path, 'utf-8'));
console.log('Done.');
console.log('Memo date:', check.result.memoMarkdown.split('\n').find(l => l.includes('Date:')));
console.log('Recent devs:', check.result.recentDevelopments.length);
console.log('Dev 1 (first 70):', check.result.recentDevelopments[0].summary.slice(0, 70));
console.log('Dev 2 (first 70):', check.result.recentDevelopments[1].summary.slice(0, 70));
const remaining = (check.result.memoMarkdown.match(/\u2014| -- /g) || []);
console.log('Remaining em-dashes in memo:', remaining.length);
