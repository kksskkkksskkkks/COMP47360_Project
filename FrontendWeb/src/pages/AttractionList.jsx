import { useEffect, useState } from "react";
import { attractionApi, mapApi, currentSnapshotTimeBucket, readBoolField } from "../lib/api";
import AttractionCard from "../components/AttractionCard";
import Pagination from "../components/Pagination";

// category is confirmed to include "park" (visible from the imagePath folder
// name). The remaining options are guessed lowercase values matching the UI
// labels until we get the full enum list.
const categories = [
  { label: "Park", value: "park" },
  { label: "Culture", value: "culture" },
  { label: "Landmark", value: "landmark" },
  { label: "Museum", value: "museum" },
];

// wheelchair filtering on the backend is ">= 1", i.e. sending 1 matches both
// "limited" (1) and "fully accessible" (2). Confirmed against real seed data
// once 1/2 records existed.
const ACCESSIBLE_FILTER_VALUE = 1;

const PAGE_SIZE = 20;

export default function AttractionList() {
  // Backend now accepts multiple `category` values (List<String>), so this
  // is back to multi-select, same pattern as the Recommendations page.
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [attractions, setAttractions] = useState([]);
  const [statusById, setStatusById] = useState({}); // id -> { isOpen, busynessLevel }
  const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  function toggleCategory(value) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  // Reset back to the first page whenever a filter changes
  useEffect(() => {
    setPage(0);
  }, [selectedCategories, accessibleOnly, search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg("");

    // Sent as repeated query params: category=a&category=b. Axios does this
    // automatically for array values, and Spring binds repeated same-name
    // params straight into a List<String> controller parameter.
    const params = {
      page,
      size: PAGE_SIZE,
      ...(search ? { keyword: search } : {}),
      ...(selectedCategories.length ? { category: selectedCategories } : {}),
      ...(accessibleOnly ? { wheelchair: ACCESSIBLE_FILTER_VALUE } : {}),
    };

    // Fetch base attraction info plus an open/busyness snapshot in parallel,
    // then merge them by id. Open status and busyness level aren't part of
    // AttractionDTO itself; they come from the heat map snapshot endpoint.
    // The snapshot is pre-computed on a fixed 30-minute grid, so we floor
    // "now" to the nearest half hour instead of sending an exact timestamp.
    Promise.all([
      attractionApi.list(params),
      mapApi.attractions(currentSnapshotTimeBucket()),
    ])
      .then(([listRes, mapRes]) => {
        if (!active) return;
        const pageData = listRes.data; // Page<AttractionDTO>
        const snapshot = mapRes.data || []; // List<HeatMapAttractionPointDTO>

        const statusMap = {};
        snapshot.forEach((p) => {
          statusMap[p.id] = {
            isOpen: readBoolField(p, "isOpen", "open"),
            busynessLevel: p.busynessLevel,
          };
        });

        setAttractions(pageData.content || []);
        setStatusById(statusMap);
        setPageInfo({
          totalPages: pageData.totalPages ?? 0,
          totalElements: pageData.totalElements ?? (pageData.content || []).length,
        });
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(err.response?.data?.message || "Failed to load. Check that the backend is running and CORS is configured.");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [selectedCategories, accessibleOnly, search, page]);

  const canPrev = page > 0;
  const canNext = page + 1 < pageInfo.totalPages;

  return (
    <main className="flex-grow max-w-[1440px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header className="flex flex-col gap-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Curated Gems</h1>

        <div className="flex flex-col md:flex-row gap-sm items-center justify-between bg-surface-container-lowest p-sm rounded-xl border border-outline-variant/30 shadow-[0_10px_40px_rgba(0,104,95,0.04)]">
          <div className="relative w-full md:w-[400px]">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-secondary">
              search
            </span>
            <input
              className="w-full bg-[#F1F5F9] focus:bg-white border-transparent focus:border-primary focus:ring-0 text-body-md font-body-md text-on-surface rounded-lg pl-xl pr-sm py-[12px] transition-all duration-200 placeholder:text-secondary/70"
              placeholder="Search curated locations..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-gutter gap-y-[0px]">
        {loading && <p className="text-secondary">Loading…</p>}
        {!loading && errorMsg && <p className="text-error col-span-full">{errorMsg}</p>}
        {!loading && !errorMsg && attractions.length === 0 && (
          <p className="text-secondary col-span-full">No locations match these filters.</p>
        )}
        {!loading &&
          !errorMsg &&
          attractions.map((a) => {
            const status = statusById[a.id];
            return (
              <AttractionCard
                key={a.id}
                attraction={a}
                isOpen={status?.isOpen}
                busynessLevel={status?.busynessLevel ?? null}
              />
            );
          })}
      </section>

      {!loading && !errorMsg && pageInfo.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pageInfo.totalPages}
          canPrev={canPrev}
          canNext={canNext}
          onChange={setPage}
        />
      )}
    </main>
  );
}
