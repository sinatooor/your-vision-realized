import { useState, useCallback } from "react";
import { EntityType, PresenceData } from "@/types";

interface WorldMapProps {
  presenceData: Record<string, PresenceData>;
  onCountryClick: (isoCode: string, countryName: string) => void;
  activeCountry: string | null;
  panelOpen: boolean;
}

interface CountryInfo {
  name: string;
  centroid?: [number, number];
}

const COUNTRY_INFO: Record<string, CountryInfo> = {
  SE: { name: "Sweden", centroid: [459, 83] },
  DE: { name: "Germany", centroid: [443, 125] },
  GB: { name: "United Kingdom", centroid: [408, 115] },
  SG: { name: "Singapore", centroid: [702, 264] },
  VN: { name: "Vietnam", centroid: [718, 212] },
  FR: { name: "France", centroid: [420, 140] },
  NL: { name: "Netherlands", centroid: [430, 112] },
  US: { name: "United States", centroid: [140, 185] },
  NO: { name: "Norway", centroid: [448, 62] },
  DK: { name: "Denmark", centroid: [445, 93] },
  FI: { name: "Finland", centroid: [472, 70] },
  PL: { name: "Poland", centroid: [470, 112] },
  CH: { name: "Switzerland", centroid: [440, 145] },
  IN: { name: "India", centroid: [655, 210] },
  JP: { name: "Japan", centroid: [785, 148] },
  AU: { name: "Australia", centroid: [800, 370] },
  ZA: { name: "South Africa", centroid: [505, 385] },
  AE: { name: "UAE", centroid: [593, 200] },
  BR: { name: "Brazil", centroid: [248, 315] },
  CN: { name: "China", centroid: [730, 175] },
  CA: { name: "Canada", centroid: [110, 130] },
};

const ENTITY_LABELS: Record<EntityType, string> = {
  hq: "HQ",
  eor: "EOR",
  branch: "Branch",
  subsidiary: "Sub.",
  representative: "Rep.",
  contractor: "Contr.",
  none: "—",
};

export function WorldMap({ presenceData, onCountryClick, activeCountry, panelOpen }: WorldMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; country: string; iso: string } | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGPathElement>, iso: string, name: string) => {
      const rect = (e.currentTarget.closest("svg") as SVGElement)?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          x: e.clientX - rect.left + 10,
          y: e.clientY - rect.top - 10,
          country: name,
          iso,
        });
      }
      setHovered(iso);
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const getCountryFill = (iso: string) => {
    if (iso === activeCountry) return "#0A0A0A";
    if (hovered === iso) return "#D0CCC5";
    if (presenceData[iso]) return "#E0DDD6";
    return "#ECEAE3";
  };

  return (
    <div
      className="relative w-full h-full transition-all duration-350"
      style={{ paddingRight: panelOpen ? 340 : 0 }}
    >
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-full"
        style={{ background: "transparent" }}
      >
        {/* Simplified world map paths */}
        <WorldPaths
          presenceData={presenceData}
          activeCountry={activeCountry}
          onCountryClick={onCountryClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          getCountryFill={getCountryFill}
        />

        {/* Presence badges */}
        {Object.entries(presenceData).map(([iso, data]) => {
          const info = COUNTRY_INFO[iso];
          if (!info?.centroid) return null;
          const [cx, cy] = info.centroid;
          return (
            <g key={iso} style={{ pointerEvents: "none" }}>
              <circle cx={cx} cy={cy} r={12} fill={iso === activeCountry ? "#F5F2EC" : "#0A0A0A"} />
              <text
                x={cx}
                y={cy + 3.5}
                textAnchor="middle"
                fontSize={9}
                fontFamily="DM Mono, monospace"
                fill={iso === activeCountry ? "#0A0A0A" : "#F5F2EC"}
              >
                {data.employees}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase px-3 py-2"
          style={{ left: tooltip.x, top: tooltip.y, zIndex: 100 }}
        >
          <div>{tooltip.country}</div>
          {presenceData[tooltip.iso] && (
            <div className="text-primary-foreground/70">
              {presenceData[tooltip.iso].employees} emp · {ENTITY_LABELS[presenceData[tooltip.iso].entityType]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface WorldPathsProps {
  presenceData: Record<string, PresenceData>;
  activeCountry: string | null;
  onCountryClick: (iso: string, name: string) => void;
  onMouseMove: (e: React.MouseEvent<SVGPathElement>, iso: string, name: string) => void;
  onMouseLeave: () => void;
  getCountryFill: (iso: string) => string;
}

function WorldPaths({ onCountryClick, onMouseMove, onMouseLeave, getCountryFill }: WorldPathsProps) {
  const countries: Array<{ iso: string; d: string }> = [
    // Europe
    { iso: "GB", d: "M390,95 L395,90 L408,88 L420,90 L422,100 L415,108 L405,120 L395,118 L388,110 Z" },
    { iso: "NO", d: "M430,45 L450,40 L470,50 L468,65 L455,75 L440,72 L428,60 Z" },
    { iso: "SE", d: "M450,60 L470,52 L478,65 L475,85 L462,92 L448,88 L445,72 Z" },
    { iso: "FI", d: "M473,52 L490,45 L500,55 L498,70 L485,80 L472,75 L470,63 Z" },
    { iso: "DK", d: "M438,85 L448,83 L452,93 L445,98 L436,95 Z" },
    { iso: "NL", d: "M422,103 L434,100 L436,110 L424,112 Z" },
    { iso: "BE", d: "M420,110 L432,108 L434,118 L422,120 Z" },
    { iso: "DE", d: "M432,108 L460,105 L465,118 L460,132 L445,138 L430,132 L428,120 Z" },
    { iso: "PL", d: "M462,105 L488,102 L492,118 L480,128 L462,124 L460,115 Z" },
    { iso: "FR", d: "M402,120 L428,118 L432,140 L418,152 L400,148 L395,130 Z" },
    { iso: "CH", d: "M428,135 L444,132 L445,145 L428,148 Z" },
    { iso: "AT", d: "M444,130 L462,128 L462,140 L444,142 Z" },
    { iso: "ES", d: "M380,150 L410,148 L408,168 L380,170 Z" },
    { iso: "IT", d: "M432,140 L448,138 L452,160 L440,172 L428,165 L428,152 Z" },
    { iso: "PT", d: "M370,150 L382,148 L380,170 L368,168 Z" },
    { iso: "RU", d: "M490,60 L620,55 L625,100 L590,110 L495,105 L488,80 Z" },
    { iso: "TR", d: "M490,155 L540,150 L542,165 L490,168 Z" },
    // Americas
    { iso: "US", d: "M60,130 L220,128 L225,195 L200,220 L70,218 L55,195 Z" },
    { iso: "CA", d: "M60,60 L240,58 L242,130 L62,132 Z" },
    { iso: "MX", d: "M65,218 L135,215 L140,245 L90,260 L62,245 Z" },
    { iso: "BR", d: "M200,270 L280,265 L285,340 L240,360 L195,345 Z" },
    { iso: "AR", d: "M195,345 L240,340 L242,390 L195,392 Z" },
    // Africa
    { iso: "ZA", d: "M472,360 L530,355 L540,400 L490,408 L468,392 Z" },
    { iso: "NG", d: "M410,270 L450,268 L452,300 L408,302 Z" },
    { iso: "EG", d: "M490,200 L525,198 L528,228 L488,230 Z" },
    // Middle East
    { iso: "AE", d: "M568,192 L600,188 L605,205 L568,208 Z" },
    { iso: "IL", d: "M510,188 L522,186 L524,200 L508,202 Z" },
    // Asia
    { iso: "IN", d: "M615,180 L680,175 L685,248 L640,262 L608,238 Z" },
    { iso: "CN", d: "M680,120 L780,115 L785,175 L720,188 L678,180 Z" },
    { iso: "JP", d: "M788,130 L805,125 L808,160 L790,165 Z" },
    { iso: "SG", d: "M698,258 L710,256 L712,268 L698,270 Z" },
    { iso: "VN", d: "M708,190 L725,185 L730,230 L710,235 Z" },
    { iso: "KR", d: "M770,148 L785,145 L788,162 L770,165 Z" },
    { iso: "ID", d: "M700,265 L760,260 L765,285 L700,288 Z" },
    // Oceania
    { iso: "AU", d: "M740,330 L855,325 L860,405 L740,408 Z" },
    { iso: "NZ", d: "M865,375 L880,370 L882,405 L864,408 Z" },
  ];

  return (
    <>
      {countries.map(({ iso, d }) => {
        const info = COUNTRY_INFO[iso];
        const name = info?.name ?? iso;
        return (
          <path
            key={iso}
            d={d}
            fill={getCountryFill(iso)}
            stroke="#0A0A0A"
            strokeWidth={0.4}
            className="cursor-pointer transition-colors duration-100"
            onClick={() => onCountryClick(iso, name)}
            onMouseMove={(e) => onMouseMove(e, iso, name)}
            onMouseLeave={onMouseLeave}
          />
        );
      })}
    </>
  );
}
