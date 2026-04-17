export interface VatResult {
  valid: boolean | null;
  name: string;
  address: string;
  countryCode: string;
  error?: string;
}

export interface VatPresenceResult {
  byCountry: Record<string, boolean | null>;
}

export async function validateVat(countryCode: string, vatNumber: string): Promise<VatResult> {
  try {
    const clean = vatNumber.replace(/\s+/g, "").toUpperCase().replace(/^[A-Z]{2}/i, "");
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${clean}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { valid: null, name: "", address: "", countryCode, error: `VIES HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      valid?: boolean;
      name?: string;
      address?: string;
      countryCode?: string;
    };
    return {
      valid: data.valid ?? null,
      name: data.name ?? "",
      address: data.address ?? "",
      countryCode: data.countryCode ?? countryCode,
    };
  } catch (err) {
    return {
      valid: null,
      name: "",
      address: "",
      countryCode,
      error: err instanceof Error ? err.message : "VIES unavailable",
    };
  }
}

const EU_COUNTRIES = ["AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK"];

export async function checkEuPresence(companyName: string): Promise<VatPresenceResult> {
  // For a real check we'd need VAT numbers. Return empty map — VAT lookup needs known VAT numbers.
  void companyName;
  const byCountry: Record<string, boolean | null> = {};
  EU_COUNTRIES.forEach((cc) => { byCountry[cc] = null; });
  return { byCountry };
}
