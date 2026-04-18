import fetch from "node-fetch";

const BASE_URL = "https://api.company-information.service.gov.uk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CHCompany = {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  companyType: string;
  dateOfCreation: string | null;
  registeredAddress: {
    addressLine1: string | null;
    locality: string | null;
    postalCode: string | null;
    country: string | null;
  };
  sicCodes: string[];
  sourceUrl: string;
  retrievedAt: string;
};

export type CHOfficer = {
  name: string;
  role: string;
  appointedOn: string | null;
  resignedOn: string | null;
  nationality: string | null;
  countryOfResidence: string | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.COMPANIES_HOUSE_API_KEY ?? null;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

interface RawCHAddress {
  address_line_1?: string;
  locality?: string;
  postal_code?: string;
  country?: string;
}

interface RawCHCompany {
  company_number?: string;
  title?: string;
  company_name?: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
  address?: RawCHAddress;
  registered_office_address?: RawCHAddress;
  sic_codes?: string[];
}

function parseCHCompany(item: RawCHCompany, sourceUrl: string): CHCompany {
  const addr: RawCHAddress = item.registered_office_address ?? item.address ?? {};
  return {
    companyNumber: item.company_number ?? "",
    companyName: item.title ?? item.company_name ?? "",
    companyStatus: item.company_status ?? "",
    companyType: item.company_type ?? "",
    dateOfCreation: item.date_of_creation ?? null,
    registeredAddress: {
      addressLine1: addr.address_line_1 ?? null,
      locality: addr.locality ?? null,
      postalCode: addr.postal_code ?? null,
      country: addr.country ?? null,
    },
    sicCodes: item.sic_codes ?? [],
    sourceUrl,
    retrievedAt: new Date().toISOString(),
  };
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Searches Companies House for companies matching a name.
 * Only called when UK is a target or home jurisdiction.
 */
export async function searchCompany(name: string): Promise<CHCompany[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[CompaniesHouse] No API key — skipping UK registry lookup");
    return [];
  }

  try {
    const sourceUrl = `${BASE_URL}/search/companies?q=${encodeURIComponent(name)}&items_per_page=5`;
    const res = await fetch(sourceUrl, {
      headers: { Authorization: authHeader(apiKey) },
    });
    if (!res.ok) {
      console.error(
        `[CompaniesHouse] searchCompany HTTP ${res.status} for "${name}"`,
      );
      return [];
    }
    const data = (await res.json()) as { items?: RawCHCompany[] };
    return (data.items ?? []).map((item) => parseCHCompany(item, sourceUrl));
  } catch (err) {
    console.error(`[CompaniesHouse] searchCompany("${name}") error:`, err);
    return [];
  }
}

/**
 * Fetches full company details by company number including SIC codes.
 */
export async function getCompanyDetails(
  companyNumber: string,
): Promise<CHCompany | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[CompaniesHouse] No API key — skipping UK registry lookup");
    return null;
  }

  try {
    const sourceUrl = `${BASE_URL}/company/${companyNumber}`;
    const res = await fetch(sourceUrl, {
      headers: { Authorization: authHeader(apiKey) },
    });
    if (!res.ok) {
      console.error(
        `[CompaniesHouse] getCompanyDetails HTTP ${res.status} for "${companyNumber}"`,
      );
      return null;
    }
    const data = (await res.json()) as RawCHCompany;
    return parseCHCompany(data, sourceUrl);
  } catch (err) {
    console.error(
      `[CompaniesHouse] getCompanyDetails("${companyNumber}") error:`,
      err,
    );
    return null;
  }
}

/**
 * Fetches current officers (directors, secretaries) for a company.
 * Used to identify directors for sanctions screening.
 */
export async function getCompanyOfficers(
  companyNumber: string,
): Promise<CHOfficer[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[CompaniesHouse] No API key — skipping UK registry lookup");
    return [];
  }

  try {
    const url = `${BASE_URL}/company/${companyNumber}/officers?items_per_page=50`;
    const res = await fetch(url, {
      headers: { Authorization: authHeader(apiKey) },
    });
    if (!res.ok) {
      console.error(
        `[CompaniesHouse] getCompanyOfficers HTTP ${res.status} for "${companyNumber}"`,
      );
      return [];
    }
    const data = (await res.json()) as {
      items?: Array<{
        name?: string;
        officer_role?: string;
        appointed_on?: string;
        resigned_on?: string;
        nationality?: string;
        country_of_residence?: string;
      }>;
    };
    return (data.items ?? [])
      .filter((item) => !item.resigned_on)
      .map((item) => ({
        name: item.name ?? "",
        role: item.officer_role ?? "",
        appointedOn: item.appointed_on ?? null,
        resignedOn: item.resigned_on ?? null,
        nationality: item.nationality ?? null,
        countryOfResidence: item.country_of_residence ?? null,
      }));
  } catch (err) {
    console.error(
      `[CompaniesHouse] getCompanyOfficers("${companyNumber}") error:`,
      err,
    );
    return [];
  }
}
