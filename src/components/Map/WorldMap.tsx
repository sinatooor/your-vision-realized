import { useState, useCallback, useRef, useEffect } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { EntityType, PresenceData } from "@/types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO 3166-1 numeric → alpha-2 mapping (subset covering map countries)
const NUMERIC_TO_ALPHA2: Record<number, string> = {
  8: "AL", 12: "DZ", 24: "AO", 32: "AR", 36: "AU", 40: "AT", 50: "BD",
  56: "BE", 68: "BO", 76: "BR", 100: "BG", 116: "KH", 120: "CM", 124: "CA",
  140: "CF", 144: "LK", 152: "CL", 156: "CN", 170: "CO", 180: "CD",
  188: "CR", 192: "CU", 196: "CY", 203: "CZ", 204: "BJ", 208: "DK",
  214: "DO", 218: "EC", 818: "EG", 222: "SV", 231: "ET", 246: "FI",
  250: "FR", 266: "GA", 276: "DE", 288: "GH", 300: "GR", 320: "GT",
  332: "HT", 340: "HN", 348: "HU", 356: "IN", 360: "ID", 364: "IR",
  368: "IQ", 372: "IE", 376: "IL", 380: "IT", 388: "JM", 392: "JP",
  400: "JO", 398: "KZ", 404: "KE", 408: "KP", 410: "KR", 414: "KW",
  418: "LA", 422: "LB", 430: "LR", 434: "LY", 458: "MY", 484: "MX",
  504: "MA", 508: "MZ", 516: "NA", 524: "NP", 528: "NL", 540: "NC",
  554: "NZ", 558: "NI", 562: "NE", 566: "NG", 578: "NO", 586: "PK",
  591: "PA", 598: "PG", 600: "PY", 604: "PE", 608: "PH", 616: "PL",
  620: "PT", 630: "PR", 634: "QA", 642: "RO", 643: "RU", 682: "SA",
  686: "SN", 694: "SL", 706: "SO", 710: "ZA", 724: "ES", 729: "SD",
  752: "SE", 756: "CH", 760: "SY", 764: "TH", 768: "TG", 780: "TT",
  788: "TN", 792: "TR", 800: "UG", 804: "UA", 784: "AE", 826: "GB",
  840: "US", 858: "UY", 860: "UZ", 862: "VE", 704: "VN", 887: "YE",
  894: "ZM", 702: "SG",
};

const COUNTRY_NAMES: Record<string, string> = {
  SE: "Sweden", DE: "Germany", GB: "United Kingdom", SG: "Singapore",
  VN: "Vietnam", FR: "France", NL: "Netherlands", US: "United States",
  NO: "Norway", DK: "Denmark", FI: "Finland", PL: "Poland",
  CH: "Switzerland", IN: "India", JP: "Japan", AU: "Australia",
  ZA: "South Africa", AE: "United Arab Emirates", BR: "Brazil",
  CN: "China", CA: "Canada",
};

// Country centroids for marker placement [longitude, latitude]
const CENTROIDS: Record<string, [number, number]> = {
  SE: [18.0, 62.0],
  DE: [10.4, 51.2],
  GB: [-1.5, 52.5],
  SG: [103.8, 1.35],
  VN: [108.0, 16.0],
  FR: [2.3, 46.2],
  NL: [5.3, 52.1],
  US: [-95.7, 37.1],
  NO: [8.5, 60.5],
  DK: [10.0, 56.0],
  FI: [26.0, 64.0],
  PL: [19.1, 52.0],
  CH: [8.2, 46.8],
  IN: [78.9, 20.6],
  JP: [138.0, 36.2],
  AU: [133.8, -25.3],
  ZA: [25.1, -29.0],
  AE: [53.8, 23.4],
  BR: [-51.9, -14.2],
  CN: [104.2, 35.9],
  CA: [-96.8, 56.1],
};

interface WorldMapProps {
  presenceData: Record<string, PresenceData>;
  onCountryClick: (isoCode: string, countryName: string) => void;
  activeCountry: string | null;
  panelOpen: boolean;
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  iso: string;
}

function getAlpha2(geo: { id?: string | number }): string {
  if (!geo.id) return "";
  const num = typeof geo.id === "string" ? parseInt(geo.id, 10) : geo.id;
  return NUMERIC_TO_ALPHA2[num] ?? "";
}

function getCountryName(geo: { properties?: { name?: string } }): string {
  return geo.properties?.name ?? "";
}

const COUNTRY_ZOOM = 6;          // zoom level when a country is clicked
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_DURATION = 600;       // ms
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function WorldMap({ presenceData, onCountryClick, activeCountry, panelOpen }: WorldMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });
  // Centroid cache: ISO → [lon, lat], populated from geo features as they render
  const centroidCacheRef = useRef<Record<string, [number, number]>>({});
  const centroidsBuiltRef = useRef(false);
  // Bump on cache update so the activeCountry effect re-runs once the cache is ready
  const [centroidsReady, setCentroidsReady] = useState(0);

  // Live camera state — driven by ZoomableGroup (wheel/pinch/drag) AND by click-animation
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 15],
    zoom: 1,
  });
  // Mirror in a ref so the animation loop can read the latest value WITHOUT
  // calling setState inside a setState updater (which causes infinite re-renders).
  const positionRef = useRef(position);
  positionRef.current = position;
  const animRef = useRef<number | null>(null);

  const animateTo = useCallback((target: { coordinates: [number, number]; zoom: number }) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const from = positionRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_DURATION);
      const k = easeInOutCubic(t);
      const next = {
        coordinates: [
          from.coordinates[0] + (target.coordinates[0] - from.coordinates[0]) * k,
          from.coordinates[1] + (target.coordinates[1] - from.coordinates[1]) * k,
        ] as [number, number],
        zoom: from.zoom + (target.zoom - from.zoom) * k,
      };
      positionRef.current = next;
      setPosition(next);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // Zoom-to-country on click; reset to world when cleared.
  // Prefer dynamic centroid (works for every country in the geo dataset),
  // fall back to the curated CENTROIDS table for marker-only countries.
  useEffect(() => {
    if (activeCountry) {
      const coords = centroidCacheRef.current[activeCountry] ?? CENTROIDS[activeCountry];
      if (coords) {
        animateTo({ coordinates: coords, zoom: COUNTRY_ZOOM });
      }
      // If centroids aren't loaded yet, the centroidsReady bump will re-trigger this effect
    } else {
      animateTo({ coordinates: [0, 15], zoom: 1 });
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountry, centroidsReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Disable wheel/trackpad-scroll zoom — only pinch gestures should zoom.
  // On macOS trackpads, real pinch gestures fire wheel events with `ctrlKey === true`
  // (synthetic), while two-finger scroll fires wheel events with `ctrlKey === false`.
  // We block the latter from reaching ZoomableGroup so scrolling does nothing on the map.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) {
        // Two-finger scroll / mouse wheel — stop ZoomableGroup from handling it.
        e.stopPropagation();
        e.preventDefault();
      }
      // ctrlKey === true means a pinch gesture — let it through to zoom.
    };
    // capture: true so we intercept BEFORE ZoomableGroup's listener runs
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, iso: string, name: string) => {
      setHovered(iso);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setTooltip({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 14, name, iso });
    },
    [],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 14 } : null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const getFill = (iso: string): string => {
    if (iso === activeCountry) return "#0A0A0A";
    if (hovered === iso) return "#C8C5BE";
    if (presenceData[iso]) return "#D8D4CC";
    return "#ECEAE3";
  };

  const getStroke = (iso: string): string => {
    if (iso === activeCountry) return "#0A0A0A";
    return "#C8C5BE";
  };

  // Base scale fills the container width
  const baseScale = (dims.width - (panelOpen ? 340 : 0)) / 5.5;
  // Counter-scale so circles + strokes stay visually constant at any zoom (wheel, pinch, click)
  const inv = 1 / position.zoom;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rsm-map"
      style={{ paddingRight: panelOpen ? 340 : 0, transition: "padding-right 350ms cubic-bezier(0.4,0,0.2,1)" }}
      onMouseMove={handleMouseMove}
    >
      <ComposableMap
        width={dims.width - (panelOpen ? 340 : 0)}
        height={dims.height}
        projectionConfig={{ scale: baseScale, center: [0, 15] }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={(pos) => {
            positionRef.current = pos;
            setPosition(pos);
          }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => {
              // Populate centroid cache exactly once per dataset load (covers ALL countries)
              if (geographies.length && !centroidsBuiltRef.current) {
                const next: Record<string, [number, number]> = {};
                for (const g of geographies) {
                  const code = getAlpha2(g);
                  if (!code) continue;
                  const c = geoCentroid(g as Parameters<typeof geoCentroid>[0]);
                  if (Number.isFinite(c[0]) && Number.isFinite(c[1])) {
                    next[code] = [c[0], c[1]];
                  }
                }
                centroidCacheRef.current = next;
                centroidsBuiltRef.current = true;
                // Defer state bump out of render
                queueMicrotask(() => setCentroidsReady((n) => n + 1));
              }
              return geographies.map((geo) => {
                const iso = getAlpha2(geo);
                const name = getCountryName(geo);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => iso && onCountryClick(iso, name)}
                    onMouseEnter={(e) => iso && handleMouseEnter(e, iso, name)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      default: {
                        fill: getFill(iso),
                        stroke: getStroke(iso),
                        strokeWidth: 0.4 * inv,
                        outline: "none",
                        cursor: iso ? "pointer" : "default",
                        transition: "fill 120ms ease",
                      },
                      hover: {
                        fill: iso === activeCountry ? "#0A0A0A" : "#C8C5BE",
                        stroke: getStroke(iso),
                        strokeWidth: 0.5 * inv,
                        outline: "none",
                        cursor: iso ? "pointer" : "default",
                      },
                      pressed: {
                        fill: "#0A0A0A",
                        stroke: "#0A0A0A",
                        strokeWidth: 0.5 * inv,
                        outline: "none",
                      },
                    }}
                  />
                );
              });
            }}
          </Geographies>

          {/* Employee presence markers — counter-scaled so size adapts to zoom */}
          {Object.entries(presenceData).map(([iso, data]) => {
            const coords = CENTROIDS[iso];
            if (!coords) return null;
            const isActive = iso === activeCountry;
            const isHq = data.entityType === "hq";
            const circleFill = isActive ? "#FFFFFF" : isHq ? "#C9A227" : "#0A0A0A";
            const circleStroke = isActive ? "#0A0A0A" : "none";
            const textFill = isActive ? "#0A0A0A" : "#FFFFFF";
            return (
              <Marker key={iso} coordinates={coords}>
                <g transform={`scale(${inv})`}>
                  <circle
                    r={11}
                    fill={circleFill}
                    stroke={circleStroke}
                    strokeWidth={1.5}
                    onClick={() => onCountryClick(iso, COUNTRY_NAMES[iso] ?? iso)}
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                  />
                  <text
                    textAnchor="middle"
                    y={4}
                    onClick={() => onCountryClick(iso, COUNTRY_NAMES[iso] ?? iso)}
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      fill: textFill,
                      pointerEvents: "auto",
                      userSelect: "none",
                      cursor: "pointer",
                    }}
                  >
                    {data.employees}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase px-3 py-2 z-50"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div>{tooltip.name || tooltip.iso}</div>
          {presenceData[tooltip.iso] && (
            <div className="opacity-70 mt-0.5">
              {presenceData[tooltip.iso].employees} employees · {presenceData[tooltip.iso].entityType.toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
