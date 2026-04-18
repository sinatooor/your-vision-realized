import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MaterialIcon } from "./MaterialIcon";
import { SIDE_NAV_SECTIONS } from "@/config/sideNavSections";

interface SideNavProps {
  open: boolean;
}

export const SideNav = ({ open }: SideNavProps) => {
  const location = useLocation();
  const config = SIDE_NAV_SECTIONS[location.pathname] ?? SIDE_NAV_SECTIONS["/"];
  const items = config.sections;
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  // Reset active when route changes
  useEffect(() => {
    setActive(items[0]?.id ?? "");
  }, [location.pathname, items]);

  // Scroll-spy: observe sections and update active
  useEffect(() => {
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to top that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        // Account for the 89px top header
        rootMargin: "-100px 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items, location.pathname]);

  const handleClick = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) {
      // Find scrollable parent (main with overflow-auto)
      const main = el.closest("main") || document.scrollingElement;
      if (main && main !== document.scrollingElement) {
        const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 24;
        (main as HTMLElement).scrollTo({ top, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <aside
      className={`fixed left-0 top-[89px] bottom-8 w-80 bg-surface-container flex flex-col py-12 px-6 z-40 transition-transform duration-300 ease-in-out shadow-xl ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-12 px-2">
        <h2 className="font-headline text-2xl text-primary mb-2">{config.title}</h2>
        <p className="mono-label">Section Navigation</p>
      </div>
      <nav className="flex flex-col space-y-2 flex-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={`flex items-center space-x-4 px-4 py-3 transition-all duration-200 text-left ${
                isActive
                  ? "bg-surface-lowest text-primary font-bold border-l-4 border-primary"
                  : "text-outline hover:bg-surface-high hover:text-primary border-l-4 border-transparent"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[20px]" />
              <span className="font-mono uppercase tracking-widest text-xs">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto">
        <button className="w-full bg-primary text-primary-foreground font-mono text-xs tracking-widest uppercase py-4 hover:bg-primary-container transition-colors">
          Generate Brief
        </button>
      </div>
    </aside>
  );
};
