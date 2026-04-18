# JurisdictIQ — Data Layer

## What this directory contains
- `sources/`  — one-time download modules (German law, UK law)
- `raw/`       — output of `fetch:sources` (gitignored, regenerate if missing)

## What the integrations directory contains (`apps/api/src/integrations/`)
- `eurlex.ts`          — EUR-Lex CELLAR (SPARQL + REST, called live at runtime)
- `gleif.ts`           — GLEIF LEI register (called live at runtime)
- `vies.ts`            — EU VIES VAT validation (called live at runtime)
- `opensanctions.ts`   — Sanctions + PEP screening (called live at runtime)
- `companies-house.ts` — UK Companies House (called live at runtime, GB only)

## How to regenerate raw source files
```
cd apps/api && npm run fetch:sources
```

## Environment variables required
| Variable | Source |
|---|---|
| `OPENSANCTIONS_API_KEY` | Free trial at [opensanctions.org/api](https://opensanctions.org/api) |
| `COMPANIES_HOUSE_API_KEY` | Free key at [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk) |

## Which APIs are called at runtime vs pre-fetched
| API | Mode |
|---|---|
| EUR-Lex CELLAR | Runtime + build cache warm |
| GLEIF | Runtime |
| VIES | Runtime |
| OpenSanctions | Runtime |
| Companies House | Runtime (GB only) |
| German law XML | Build only |
| UK law XML | Build only |

## Source URLs
| Source | URL |
|---|---|
| German law | https://www.gesetze-im-internet.de/gii-toc.xml |
| UK law | https://www.legislation.gov.uk |
| EU law | https://publications.europa.eu/webapi/rdf/sparql |
| GLEIF | https://api.gleif.org/api/v1 |
| VIES | https://ec.europa.eu/taxation_customs/vies/rest-api |
| OpenSanctions | https://api.opensanctions.org |
| Companies House | https://api.company-information.service.gov.uk |
