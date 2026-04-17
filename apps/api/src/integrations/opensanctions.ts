const BASE_URL = "https://api.opensanctions.org";

export interface ScreeningMatch {
  entity: { id: string; caption: string; schema: string };
  score: number;
  datasets: string[];
}

export interface ScreeningResult {
  name: string;
  matched: boolean;
  matchCount: number;
  highestScore: number;
  matches: ScreeningMatch[];
  isClean: boolean;
}

function getApiKey(): string | null {
  return process.env.OPENSANCTIONS_API_KEY ?? null;
}

export async function screenEntity(
  name: string,
  country?: string,
): Promise<ScreeningResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      name,
      matched: false,
      matchCount: 0,
      highestScore: 0,
      matches: [],
      isClean: true,
    };
  }

  const properties: Record<string, string[]> = { name: [name] };
  if (country) properties.country = [country];

  const body = {
    queries: {
      entity: {
        schema: "Person",
        properties,
      },
    },
  };

  const res = await fetch(`${BASE_URL}/match/default`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { name, matched: false, matchCount: 0, highestScore: 0, matches: [], isClean: true };
  }

  const data = (await res.json()) as {
    responses: {
      entity: {
        results: Array<{
          entity: { id: string; caption: string; schema: string };
          score: number;
          datasets: string[];
        }>;
      };
    };
  };

  const results = data?.responses?.entity?.results ?? [];
  const matches: ScreeningMatch[] = results.map((r) => ({
    entity: r.entity,
    score: r.score,
    datasets: r.datasets,
  }));

  const highestScore = matches.reduce((max, m) => Math.max(max, m.score), 0);

  return {
    name,
    matched: highestScore > 0.5,
    matchCount: matches.length,
    highestScore,
    matches,
    isClean: highestScore <= 0.7,
  };
}

export async function screenMultiple(names: string[]): Promise<ScreeningResult[]> {
  const apiKey = getApiKey();
  if (!apiKey || names.length === 0) {
    return names.map((name) => ({
      name,
      matched: false,
      matchCount: 0,
      highestScore: 0,
      matches: [],
      isClean: true,
    }));
  }

  const queries: Record<string, { schema: string; properties: { name: string[] } }> = {};
  names.forEach((name, i) => {
    queries[`entity_${i}`] = { schema: "Person", properties: { name: [name] } };
  });

  const res = await fetch(`${BASE_URL}/match/default`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ queries }),
  });

  if (!res.ok) {
    return names.map((name) => ({
      name,
      matched: false,
      matchCount: 0,
      highestScore: 0,
      matches: [],
      isClean: true,
    }));
  }

  const data = (await res.json()) as {
    responses: Record<
      string,
      {
        results: Array<{
          entity: { id: string; caption: string; schema: string };
          score: number;
          datasets: string[];
        }>;
      }
    >;
  };

  return names.map((name, i) => {
    const key = `entity_${i}`;
    const results = data?.responses?.[key]?.results ?? [];
    const matches: ScreeningMatch[] = results.map((r) => ({
      entity: r.entity,
      score: r.score,
      datasets: r.datasets,
    }));
    const highestScore = matches.reduce((max, m) => Math.max(max, m.score), 0);
    return {
      name,
      matched: highestScore > 0.5,
      matchCount: matches.length,
      highestScore,
      matches,
      isClean: highestScore <= 0.7,
    };
  });
}
