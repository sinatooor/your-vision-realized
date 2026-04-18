import fetch from "node-fetch";

const VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export type VATResult = {
  countryCode: string;
  vatNumber: string;
  valid: boolean | null;
  name: string | null;
  address: string | null;
  requestDate: string;
  retrievedAt: string;
  serviceAvailable: boolean;
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const vatCache = new Map<string, { data: VATResult; cachedAt: number }>();

function getCached(key: string): VATResult | null {
  const entry = vatCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    vatCache.delete(key);
    return null;
  }
  return entry.data;
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Validates a single VAT number against the EU VIES service.
 * Returns valid: null if the VIES service is unavailable —
 * callers must handle this case gracefully.
 */
export async function validateVATNumber(
  countryCode: string,
  vatNumber: string,
): Promise<VATResult> {
  const clean = vatNumber
    .replace(/\s+/g, "")
    .replace(new RegExp(`^${countryCode}`, "i"), "");

  const cacheKey = `${countryCode}:${clean}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const now = new Date().toISOString();
  const unavailable: VATResult = {
    countryCode,
    vatNumber: clean,
    valid: null,
    name: null,
    address: null,
    requestDate: now,
    retrievedAt: now,
    serviceAvailable: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${VIES_BASE}/ms/${countryCode}/vat/${clean}`;
    const res = await fetch(url, {
      signal: controller.signal as Parameters<typeof fetch>[1] extends { signal?: infer S } ? S : never,
    });
    clearTimeout(timer);

    if (res.status === 404) {
      const result: VATResult = { ...unavailable, valid: false, serviceAvailable: true };
      vatCache.set(cacheKey, { data: result, cachedAt: Date.now() });
      return result;
    }

    if (!res.ok) {
      console.warn(
        `[VIES] Service unavailable for ${countryCode}:${clean} (HTTP ${res.status})`,
      );
      vatCache.set(cacheKey, { data: unavailable, cachedAt: Date.now() });
      return unavailable;
    }

    const data = (await res.json()) as {
      valid?: boolean;
      name?: string;
      address?: string;
    };

    const result: VATResult = {
      countryCode,
      vatNumber: clean,
      valid: data.valid ?? null,
      name: data.name ?? null,
      address: data.address ?? null,
      requestDate: now,
      retrievedAt: new Date().toISOString(),
      serviceAvailable: true,
    };
    vatCache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    clearTimeout(timer);
    console.warn(
      `[VIES] Service unavailable for ${countryCode}:${clean}:`,
      err instanceof Error ? err.message : err,
    );
    vatCache.set(cacheKey, { data: unavailable, cachedAt: Date.now() });
    return unavailable;
  }
}

/**
 * Checks VAT registration status across multiple EU countries in parallel.
 * Used by Agent 2 to detect existing EU VAT presence.
 * Note: VIES requires a known VAT number — this is a hook for intake form data.
 */
export async function checkEUPresence(
  companyName: string,
  countriesToCheck: string[],
): Promise<Map<string, VATResult>> {
  void companyName;
  console.log(
    `[VIES] checkEUPresence requires VAT numbers — use for validation only`,
  );
  const result = new Map<string, VATResult>();
  const now = new Date().toISOString();
  for (const cc of countriesToCheck) {
    result.set(cc, {
      countryCode: cc,
      vatNumber: "",
      valid: null,
      name: null,
      address: null,
      requestDate: now,
      retrievedAt: now,
      serviceAvailable: false,
    });
  }
  return result;
}

/**
 * Validates a list of known VAT numbers.
 * Called when the partner intake form includes existing VAT registrations.
 */
export async function validateKnownVATNumbers(
  numbers: Array<{ countryCode: string; vatNumber: string }>,
): Promise<Map<string, VATResult>> {
  const settled = await Promise.allSettled(
    numbers.map(({ countryCode, vatNumber }) =>
      validateVATNumber(countryCode, vatNumber),
    ),
  );

  const resultMap = new Map<string, VATResult>();
  let ok = 0;
  let invalid = 0;
  let unavailable = 0;

  settled.forEach((r, i) => {
    const { countryCode, vatNumber } = numbers[i]!;
    const clean = vatNumber
      .replace(/\s+/g, "")
      .replace(new RegExp(`^${countryCode}`, "i"), "");
    const key = `${countryCode}:${clean}`;
    if (r.status === "fulfilled") {
      resultMap.set(key, r.value);
      if (r.value.valid === true) ok++;
      else if (r.value.valid === false) invalid++;
      else unavailable++;
    }
  });

  console.log(
    `[VIES] Validated ${numbers.length} VAT numbers: ${ok} valid, ${invalid} invalid, ${unavailable} service unavailable`,
  );
  return resultMap;
}
