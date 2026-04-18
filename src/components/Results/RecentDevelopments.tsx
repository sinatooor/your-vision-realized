import { ExternalLink } from "lucide-react";
import type { RecentDevelopment } from "@/types";

interface RecentDevelopmentsProps {
  developments?: RecentDevelopment[];
}

export function RecentDevelopments({ developments }: RecentDevelopmentsProps) {
  if (!developments || developments.length === 0) return null;

  return (
    <div className="border border-outline-variant bg-surface">
      <div className="flex items-baseline justify-between px-5 py-3 border-b border-outline-variant">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-on-surface">
          Recent Regulatory Developments
        </h3>
        <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
          Last 30 days
        </span>
      </div>

      <div className="divide-y divide-outline-variant">
        {developments.map((d) => (
          <article key={d.countryIso} className="px-5 py-4">
            <header className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[10px] tracking-widest uppercase text-primary">
                {d.countryIso}
              </span>
              <span className="font-headline text-sm font-bold text-on-surface">
                {d.countryName}
              </span>
              <span
                className={`ml-auto font-mono text-[9px] tracking-widest uppercase ${
                  d.isLive ? "text-primary" : "text-outline"
                }`}
              >
                {d.isLive ? "● Live" : "○ Offline"}
              </span>
            </header>

            <p className="font-body text-sm text-on-surface-variant mb-3 leading-relaxed">
              {d.summary}
            </p>

            {d.highlights.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {d.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="font-body text-xs text-on-surface flex gap-2 items-start"
                  >
                    <span className="text-outline mt-0.5">›</span>
                    <span className="flex-1">{h}</span>
                  </li>
                ))}
              </ul>
            )}

            {d.citations.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/50">
                <span className="font-mono text-[9px] tracking-widest uppercase text-outline">
                  Sources:
                </span>
                {d.citations.map((c, i) => (
                  <a
                    key={i}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                  >
                    {c.title}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}

            {!d.isLive && d.reason && (
              <p className="font-mono text-[9px] tracking-widest uppercase text-outline mt-2">
                {d.reason}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
