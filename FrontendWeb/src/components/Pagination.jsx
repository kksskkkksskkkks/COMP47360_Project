import { useEffect, useState } from "react";

// Prev/Next plus a "jump to page" input — useful once totalPages gets large
// (e.g. dozens of pages), where clicking Next repeatedly isn't practical.
export default function Pagination({ page, totalPages, canPrev, canNext, onChange }) {
  const [inputValue, setInputValue] = useState(String(page + 1));

  useEffect(() => {
    setInputValue(String(page + 1));
  }, [page]);

  function commitJump() {
    const parsed = parseInt(inputValue, 10);
    if (Number.isNaN(parsed)) {
      setInputValue(String(page + 1));
      return;
    }
    const clamped = Math.min(Math.max(1, parsed), totalPages);
    setInputValue(String(clamped));
    onChange(clamped - 1);
  }

  return (
    <div className="flex items-center justify-center gap-sm">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={!canPrev}
        className="px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase border border-outline-variant text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:text-secondary"
      >
        Prev
      </button>

      <span className="flex items-center gap-xs text-body-md font-body-md text-secondary">
        Page
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitJump}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-14 text-center bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 rounded-md py-1 outline-none transition-all text-on-surface"
        />
        of {totalPages}
      </span>

      <button
        onClick={() => onChange(page + 1)}
        disabled={!canNext}
        className="px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase border border-outline-variant text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:text-secondary"
      >
        Next
      </button>
    </div>
  );
}
