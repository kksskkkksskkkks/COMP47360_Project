import { useEffect, useMemo, useRef, useState } from "react";
import { recommendationApi, readBoolField } from "../lib/api";
import AttractionCard from "../components/AttractionCard";

const categories = [
  { label: "Museum", value: "museum" },
  { label: "Park", value: "park" },
  { label: "Culture", value: "culture" },
  { label: "Landmark", value: "landmark" },
];

// wheelchair filtering on the backend is ">= 1", i.e. sending 1 matches both
// "limited" (1) and "fully accessible" (2). Sending 2 only matches fully
// accessible spots — that mismatch was why this filter looked like it
// returned nothing.
const ACCESSIBLE_FILTER_VALUE = 1;

// Force "en-US" rather than the browser's locale ([]) so times/dates always
// render in English (e.g. "9:30 AM", "Jun 22") regardless of the visitor's
// system language settings.
function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateLabel(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function dateOnlyLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Group the flat list of {timeBucket, attractions} slots into day buckets, so
// we can render "Today / Jun 21" and "Tomorrow / Jun 22" section headers like
// the original design, instead of one long undifferentiated timeline.
function groupByDay(slots) {
  const groups = [];
  let current = null;
  for (const slot of slots) {
    const date = new Date(slot.timeBucket);
    const key = date.toDateString();
    if (!current || current.key !== key) {
      current = { key, date, slots: [] };
      groups.push(current);
    }
    current.slots.push({ ...slot, _date: date });
  }
  return groups;
}

export default function Recommendations() {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [accessibleOnly, setAccessibleOnly] = useState(false);

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);
  const [nowKey, setNowKey] = useState(null);

  function toggleCategory(value) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  // requestIdRef guards against a stale response landing after a newer one
  // (e.g. the user clicks "Get Recommendations" twice in quick succession) —
  // only the most recent in-flight request is allowed to update state.
  const requestIdRef = useRef(0);

  function fetchRecommendations() {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setErrorMsg("");

    const params = {
      ...(selectedCategories.length ? { categories: selectedCategories } : {}),
      ...(accessibleOnly ? { wheelchair: ACCESSIBLE_FILTER_VALUE } : {}),
    };

    recommendationApi
      .list(params)
      .then((res) => {
        if (requestIdRef.current !== requestId) return;
        const data = res.data || [];

        if (import.meta.env.DEV) {
          console.debug("[Recommendations] params sent:", params);
          console.debug("[Recommendations] raw response:", data);
        }

        setSlots(data);

        // Default-expand whichever slot is "now" (the last one whose start
        // time has already passed), so the page opens with something useful
        // visible instead of every slot collapsed.
        const now = Date.now();
        let candidate = data[0];
        for (const slot of data) {
          if (new Date(slot.timeBucket).getTime() <= now) candidate = slot;
          else break;
        }
        setExpandedKey(candidate ? candidate.timeBucket : null);
        setNowKey(candidate ? candidate.timeBucket : null);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setErrorMsg(err.response?.data?.message || "Failed to load recommendations.");
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }

  // Only fetch once on initial mount. Changing category/accessible filters
  // no longer auto-refreshes — the user clicks "Get Recommendations" to
  // apply whatever filters are currently selected.
  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayGroups = useMemo(() => groupByDay(slots), [slots]);

  return (
    <main className="flex-grow max-w-[1440px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header className="flex flex-col gap-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Find Your Gem</h1>
        <p className="text-body-md font-body-md text-secondary">
          Precise recommendations based on live busyness and curated quality.
        </p>

        <div className="flex flex-col md:flex-row gap-sm items-center justify-between bg-surface-container-lowest p-sm rounded-xl border border-outline-variant/30 shadow-[0_10px_40px_rgba(0,104,95,0.04)]">
          <div className="flex flex-wrap gap-xs items-center">
            <button
              onClick={() => setSelectedCategories([])}
              className={
                selectedCategories.length === 0
                  ? "px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase bg-primary/10 text-primary-container border border-primary/20 transition-colors"
                  : "px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase bg-transparent text-secondary border border-outline-variant hover:border-primary hover:text-primary transition-colors"
              }
            >
              All Gems
            </button>
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => toggleCategory(cat.value)}
                className={
                  selectedCategories.includes(cat.value)
                    ? "px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase bg-primary/10 text-primary-container border border-primary/20 transition-colors"
                    : "px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase bg-transparent text-secondary border border-outline-variant hover:border-primary hover:text-primary transition-colors"
                }
              >
                {cat.label}
              </button>
            ))}
            <div className="w-px h-6 bg-outline-variant mx-xs" />
            <button
              onClick={() => setAccessibleOnly((v) => !v)}
              className={
                accessibleOnly
                  ? "px-sm py-[8px] rounded-full flex items-center gap-xs bg-primary/10 text-primary-container border border-primary/20 transition-colors"
                  : "px-sm py-[8px] rounded-full flex items-center gap-xs bg-transparent text-secondary border border-outline-variant hover:border-primary hover:text-primary transition-colors"
              }
            >
              <span className="material-symbols-outlined text-[18px]">accessible</span>
              <span className="font-label-caps text-label-caps uppercase">Accessible</span>
            </button>
          </div>

          {/* Filters above are only staged — nothing refetches until this is
              clicked, so picking multiple categories/accessible doesn't fire
              a request per click. */}
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="px-md py-[8px] rounded-full flex items-center gap-xs bg-primary text-on-primary font-label-caps text-label-caps uppercase hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">diamond</span>
            {loading ? "Loading…" : "Get Recommendations"}
          </button>
        </div>
      </header>

      {loading && <p className="text-secondary">Loading…</p>}
      {!loading && errorMsg && <p className="text-error">{errorMsg}</p>}
      {!loading && !errorMsg && dayGroups.length === 0 && (
        <p className="text-secondary">No recommendations available right now.</p>
      )}

      {!loading && !errorMsg && (
        <div className="flex flex-col">
          {dayGroups.map((group) => (
            <div key={group.key} className="mb-md">
              <div className="flex items-baseline gap-xs mb-sm">
                <h2 className="text-headline-lg font-headline-lg text-primary">{dateLabel(group.date)}</h2>
                <span className="text-secondary text-body-md font-body-md">/ {dateOnlyLabel(group.date)}</span>
              </div>

              <div className="flex flex-col gap-xs">
                {group.slots.map((slot) => {
                  const isExpanded = expandedKey === slot.timeBucket;
                  const isLive = nowKey === slot.timeBucket;
                  const isPast = nowKey != null && !isLive && slot.timeBucket < nowKey;
                  const isFuture = nowKey != null && !isLive && slot.timeBucket > nowKey;
                  const count = slot.attractions?.length ?? 0;

                  return (
                    <div
                      key={slot.timeBucket}
                      className={
                        isExpanded
                          ? "rounded-xl border-2 border-primary bg-surface-container-lowest transition-all"
                          : "rounded-xl border border-transparent hover:border-outline-variant bg-surface-container-lowest/60 transition-all"
                      }
                    >
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : slot.timeBucket)}
                        className="w-full flex items-center justify-between px-md py-sm text-left"
                      >
                        <div className="flex items-center gap-sm">
                          <span className="font-label-caps text-label-caps text-secondary w-16">
                            {formatTime(new Date(slot.timeBucket))}
                          </span>
                          {isLive && (
                            <span className="flex items-center gap-1 text-primary text-label-caps font-label-caps uppercase">
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Live Now
                            </span>
                          )}
                          {isPast && (
                            <span className="flex items-center gap-1 text-secondary/70 text-label-caps font-label-caps uppercase">
                              <span className="w-2 h-2 rounded-full bg-secondary/40" /> Past Gems
                            </span>
                          )}
                          {isFuture && (
                            <span className="flex items-center gap-1 text-primary text-label-caps font-label-caps uppercase">
                              <span className="w-2 h-2 rounded-full bg-primary" /> Future Gems
                            </span>
                          )}
                          <span className="text-body-md font-body-md text-on-surface">
                            {count > 0 ? `${count} recommendation${count > 1 ? "s" : ""}` : "No matches"}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-secondary">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>

                      {isExpanded && count > 0 && (
                        <div className="px-md pb-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-gutter gap-y-[0px]">
                          {slot.attractions.map((a) => (
                            <AttractionCard
                              key={a.id}
                              attraction={a}
                              isOpen={readBoolField(a, "isOpen", "open")}
                              busynessLevel={a.busynessLevel}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
