import { useEffect, useRef, useState } from "react";
import { Check, Moon, Palette, Sun, ChevronUp } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

export function ThemeSelector() {
  const { mode, colorTheme, colorThemes, setMode, setColorTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Click outside to dismiss popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative select-none">
      {/* Bottom Segmented Theme Toolbar */}
      <div className="flex items-center justify-between rounded-xl bg-surfaceRaised/70 border border-border/70 p-1 text-xs">
        {/* Light / Dark Mode Toggle Buttons */}
        <div className="flex items-center gap-1 flex-1">
          <button
            onClick={() => setMode("light")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-[11px] font-medium transition ${
              mode === "light"
                ? "bg-white text-slate-900 shadow font-semibold border border-border/80"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sun size={13} className={mode === "light" ? "text-amber-500" : ""} />
            <span>Light</span>
          </button>

          <button
            onClick={() => setMode("dark")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-[11px] font-medium transition ${
              mode === "dark"
                ? "bg-surfaceRaised text-white shadow font-semibold border border-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Moon size={13} className={mode === "dark" ? "text-indigo-400" : ""} />
            <span>Dark</span>
          </button>
        </div>

        {/* Color Palette Popover Button */}
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          title="Change Color Theme"
          className={`flex items-center justify-center rounded-lg p-1.5 ml-1 transition border ${
            isOpen
              ? "bg-accent/20 border-accent text-accent"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Palette size={14} />
            <span
              style={{ backgroundColor: colorTheme.color }}
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-black/30"
            />
          </div>
        </button>
      </div>

      {/* Upward Color Theme Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full mb-2 left-0 right-0 sm:left-0 sm:right-auto sm:w-72 z-50 rounded-2xl border border-border bg-surface p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="border-b border-border/60 pb-2.5 mb-2 px-1">
            <div className="text-xs font-bold text-slate-100 flex items-center justify-between">
              <span>Color theme</span>
              <span
                style={{ backgroundColor: colorTheme.color }}
                className="h-2.5 w-2.5 rounded-full shadow-sm"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Independent from light and dark mode
            </p>
          </div>

          {/* Color Themes List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {colorThemes.map((theme) => {
              const isSelected = colorTheme.id === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    setColorTheme(theme.id);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl p-2 text-left transition ${
                    isSelected
                      ? "bg-surfaceRaised border border-border text-slate-900 dark:text-white shadow-sm font-medium"
                      : "text-slate-700 dark:text-slate-300 hover:bg-surfaceRaised/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch preview */}
                    <div
                      style={{ backgroundColor: theme.color }}
                      className="h-6 w-6 rounded-lg shadow shrink-0 border border-border"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {theme.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {theme.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check
                      size={14}
                      style={{ color: theme.color }}
                      className="shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
