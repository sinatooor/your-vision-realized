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

  // Scroll-spy: track active section by measuring positions in the scroll container
  useEffect(() => {
    // Wait a tick for sections to mount
    let raf = 0;
    let scrollEl: HTMLElement | Window | null = null;

    const setup = () => {
      const elements = items
        .map((i) => document.getElementById(i.id))
        .filter((el): el is HTMLElement => !!el);

      if (elements.length === 0) {
        raf = requestAnimationFrame(setup);
        return;
      }

      // Find the actual scroll container (a <main> with overflow-auto, or window)
      const firstParent = elements[0].closest("main") as HTMLElement | null;
      scrollEl =
        firstParent && firstParent.scrollHeight > firstParent.clientHeight + 1
          ? firstParent
          : window;

      const compute = () => {
        // Anchor line: 120px below top of scroll container (accounts for 89px header + padding)
        const anchorY =
          scrollEl === window
            ? 120
            : (scrollEl as HTMLElement).getBoundingClientRect().top + 120;

        let currentId = elements[0].id;
        for (const el of elements) {
          const top = el.getBoundingClientRect().top;
          if (top - anchorY <= 0) {
            currentId = el.id;
          } else {
            break;
          }
        }
        setActive((prev) => (prev === currentId ? prev : currentId));
      };

      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          compute();
          ticking = false;
        });
      };

      compute();
      (scrollEl as any).addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);

      // Store cleanup on the ref-like closure
      cleanup = () => {
        (scrollEl as any).removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      };
    };

    let cleanup: (() => void) | null = null;
    raf = requestAnimationFrame(setup);

    return () => {
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [items, location.pathname]);

  const handleClick = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (!el) return;

    const main = el.closest("main") as HTMLElement | null;
    const usesMainScroll = main && main.scrollHeight > main.clientHeight + 1;

    if (usesMainScroll && main) {
      const top =
        el.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop -
        100;
      main.scrollTo({ top, behavior: "smooth" });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: "smooth" });
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
    </aside>
  );
};
