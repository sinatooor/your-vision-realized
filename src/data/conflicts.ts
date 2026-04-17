import type { Conflict } from "@/components/ConflictCard";

export const conflicts: Conflict[] = [
  {
    id: "c1",
    severity: "critical",
    severityLabel: "Critical Severity",
    titleLeft: "GDPR Centralised Storage",
    titleRight: "VN Data Localisation",
    body:
      "A fundamental architectural conflict exists. The European Union's GDPR framework encourages centralised data stewardship for compliance auditing, which natively conflicts with Vietnam's Decree 53/2022/ND-CP mandate dictating strict localized data storage and domestic server housing for resident user data. Proceeding without mitigation exposes the entity to immediate regulatory censure in both jurisdictions.",
    directives: ["Data Segregation Protocol", "Defer Processing"],
  },
  {
    id: "c2",
    severity: "high",
    severityLabel: "High Exposure",
    titleLeft: "Germany PE Risk from EOR Headcount",
    body:
      "Engaging three or more full-time equivalent employees via an Employer of Record (EOR) within the German jurisdiction elevates the probability of establishing a Permanent Establishment (PE) for corporate tax purposes. Local tax authorities frequently interpret sustained domestic operational capacity beyond sales representation as sufficient grounds for corporate tax liability.",
  },
  {
    id: "c3",
    severity: "high",
    severityLabel: "High Exposure",
    titleLeft: "Betriebsrat Trigger",
    titleRight: "Headcount Plan",
    body:
      "Crossing five permanent employees in Germany activates a Works Council (Betriebsrat) formation right under the Betriebsverfassungsgesetz. Once initiated, co-determination obligations attach to operational decisions including working hours, performance monitoring, and use of HR analytics — materially constraining executive prerogative on day-to-day operations.",
    directives: ["Stagger Hiring", "Pre-empt Council Charter"],
  },
  {
    id: "c4",
    severity: "low",
    severityLabel: "Low Risk",
    titleLeft: "DAC7 Reporting Cadence",
    body:
      "Platform reporting obligations under DAC7 apply on a calendar-year basis. Existing finance close cycles align cleanly with required submission windows; minor tooling adjustment needed to capture seller-side metadata, but no structural exposure detected.",
  },
];
