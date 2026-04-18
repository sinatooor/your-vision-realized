import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";
import {
  COMPANY_PRESETS,
  useCompany,
  type PresetId,
} from "@/contexts/CompanyContext";

export function ProfileMenu() {
  const {
    activePreset,
    company,
    customCompanies,
    loadPreset,
    loadCustom,
    addCustomCompany,
    removeCustomCompany,
  } = useCompany();

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setNewName("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setAdding(false);
        setNewName("");
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const presetIds = Object.keys(COMPANY_PRESETS) as PresetId[];
  const initials = (company.name || "??")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const handleSelectPreset = (id: PresetId) => {
    loadPreset(id);
    setOpen(false);
  };

  const handleSelectCustom = (id: string) => {
    loadCustom(id);
    setOpen(false);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    addCustomCompany(name);
    setNewName("");
    setAdding(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase transition-colors px-3 py-2 ${
          open ? "text-primary" : "text-outline hover:text-primary"
        }`}
      >
        <span className="w-6 h-6 flex items-center justify-center border border-outline-variant text-[9px] font-bold text-primary bg-surface-container">
          {initials || "·"}
        </span>
        <span className="hidden sm:inline max-w-[140px] truncate">
          {company.name || "Profile"}
        </span>
        <MaterialIcon
          name={open ? "expand_less" : "expand_more"}
          className="text-[16px]"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-80 bg-surface border border-outline-variant shadow-lg z-50"
        >
          <div className="px-4 py-3 border-b border-outline-variant">
            <p className="font-mono text-[9px] tracking-widest uppercase text-outline">
              Active Profile
            </p>
            <p className="font-body text-sm font-medium text-primary mt-0.5 truncate">
              {company.name}
            </p>
          </div>

          <div className="max-h-72 overflow-auto">
            <p className="px-4 pt-3 pb-1 font-mono text-[9px] tracking-widest uppercase text-outline">
              Presets
            </p>
            {presetIds.map((id) => {
              const p = COMPANY_PRESETS[id];
              const isActive = activePreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectPreset(id)}
                  className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 hover:bg-surface-container transition-colors ${
                    isActive ? "bg-surface-container" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-primary truncate">
                      {p.label}
                    </p>
                    <p className="font-mono text-[9px] tracking-widest uppercase text-outline truncate">
                      {p.tagline}
                    </p>
                  </div>
                  {isActive && (
                    <MaterialIcon
                      name="check"
                      className="text-[16px] text-primary shrink-0"
                    />
                  )}
                </button>
              );
            })}

            {customCompanies.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 font-mono text-[9px] tracking-widest uppercase text-outline">
                  Your Companies
                </p>
                {customCompanies.map((c) => {
                  const isActive = activePreset === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustom(c.id)}
                      className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 hover:bg-surface-container transition-colors ${
                        isActive ? "bg-surface-container" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-body text-sm text-primary truncate">
                          {c.company.name || c.label}
                        </p>
                        <p className="font-mono text-[9px] tracking-widest uppercase text-outline truncate">
                          {c.tagline}
                        </p>
                      </div>
                      {isActive && (
                        <MaterialIcon
                          name="check"
                          className="text-[16px] text-primary shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <div className="border-t border-outline-variant px-4 py-3">
            {adding ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="Company name"
                  className="flex-1 bg-surface border border-outline-variant px-2 py-1.5 font-body text-sm text-primary placeholder:text-outline focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="font-mono text-[9px] tracking-widest uppercase border border-primary text-primary px-2.5 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                  }}
                  aria-label="Cancel"
                  className="text-outline hover:text-primary"
                >
                  <MaterialIcon name="close" className="text-[18px]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-primary hover:bg-surface-container px-2 py-1.5 transition-colors"
              >
                <MaterialIcon name="add" className="text-[16px]" />
                Add new company
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
