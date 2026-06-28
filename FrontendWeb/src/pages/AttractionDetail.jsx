import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import {
  attractionApi,
  busynessApi,
  favoriteApi,
  checkinApi,
  ratingApi,
  mapApi,
  currentSnapshotTimeBucket,
  readBoolField,
} from "../lib/api";
import { resolveImage } from "../lib/image";
import { useAuth } from "../context/AuthContext";

// Leaflet is only loaded when someone actually scrolls to this hero section,
// not bundled into the main chunk that every page pays for.
const MiniMap = lazy(() => import("../components/MiniMap"));

// The chart bar height is driven by predictedDropoffs (a continuous value),
// not busynessLevel, so the bars actually vary in height instead of looking
// like a flat wall. Closed time slots still render a bar — just pinned to a
// very low height — so it's clear "this is closed", not "data is missing".
const CLOSED_BAR_HEIGHT = 4; // percent, deliberately tiny but still visible

// Height and color are driven by predictedDropoffs, normalized against a
// FIXED global denominator (not this attraction's own min/max), so bars are
// directly comparable across attractions. The denominator comes from real
// data: across 6528 busyness_forecast rows, min=0.7, max=20.3, avg=3.51 —
// using max≈20.3 (rounded up slightly for headroom) as the global ceiling
// means a place that's always quiet stays visibly short relative to a place
// that actually gets busy, instead of both looking "100% busy at their own
// peak" the way per-attraction normalization did.
const GLOBAL_MAX_DROPOFFS = 21;

function barHeight(slot) {
  if (slot.isOpen === false) return CLOSED_BAR_HEIGHT;
  const ratio = (slot.predictedDropoffs ?? 0) / GLOBAL_MAX_DROPOFFS;
  return Math.max(8, Math.min(100, ratio * 100));
}

function barColor(slot) {
  if (slot.isOpen === false) return "bg-outline-variant/30";
  if (slot.isGem) return "bg-primary-fixed hover:bg-primary-fixed-dim border-t-2 border-primary";
  const ratio = (slot.predictedDropoffs ?? 0) / GLOBAL_MAX_DROPOFFS;
  if (ratio >= 0.66) return "bg-tertiary/80 hover:bg-tertiary";
  if (ratio >= 0.33) return "bg-primary/40 hover:bg-primary/60";
  return "bg-primary/20 hover:bg-primary/40";
}

// Whether this slot is the one containing "right now" — only meaningful
// when looking at today's chart, since "now" doesn't apply to tomorrow.
function isCurrentSlot(slot, dayOffset) {
  if (dayOffset !== 0 || !slot.startTime) return false;
  const start = new Date(slot.startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const now = new Date();
  return now >= start && now < end;
}
// "2026-06-21T09:00:00" -> "9 AM", used for the chart's x-axis time labels.
// Forcing en-US formatting so it's always "9 AM" / "1 PM", regardless of the
// browser's locale settings (some locales default to 24-hour time).
function formatSlotTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", { hour: "numeric" });
}
// "date" param for /api/attractions/{id}/busyness wants a plain ISO date
// (YYYY-MM-DD), no time component.
function isoDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Defensive against a common Jackson quirk: a boolean field with an isXxx()
// getter on a plain class (not a record) often gets serialized as "xxx"
// instead of "isXxx" (the "is" prefix is stripped). Accept either spelling
// so the chart doesn't silently break if the backend's DTO implementation
// changes between a record and a regular class.
function normalizeSlot(slot) {
  return {
    ...slot,
    isGem: readBoolField(slot, "isGem", "gem", false),
    isOpen: readBoolField(slot, "isOpen", "open"),
  };
}

export default function AttractionDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [attraction, setAttraction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState("");

  const [isFavorited, setIsFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);

  // Current open/busyness status for the mini map — same source as the list
  // and heat map pages (AttractionDTO itself doesn't carry this).
  const [liveStatus, setLiveStatus] = useState({ isOpen: null, busynessLevel: null });

  // Base attraction info + the user's own favorite/rating state — doesn't
  // depend on which day is selected, so it's its own effect.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg("");

    attractionApi
      .detail(id)
      .then((res) => active && setAttraction(res.data))
      .catch((err) => active && setErrorMsg(err.response?.data?.message || "Failed to load."))
      .finally(() => active && setLoading(false));

    mapApi
      .attractions(currentSnapshotTimeBucket())
      .then((res) => {
        if (!active) return;
        const match = (res.data || []).find((p) => String(p.id) === String(id));
        if (match) {
          setLiveStatus({
            isOpen: readBoolField(match, "isOpen", "open"),
            busynessLevel: match.busynessLevel ?? null,
          });
        }
      })
      .catch(() => {});

    if (user) {
      favoriteApi
        .isFavorited(user.id, id)
        .then((res) => active && setIsFavorited(!!res.data))
        .catch(() => {});
      ratingApi
        .getOne(user.id, id)
        .then((res) => active && setMyRating(res.data?.rating || 0))
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [id, user]);

  // Busyness slots depend on which day is selected (Today / Tomorrow).
  useEffect(() => {
    let active = true;
    setSlotsLoading(true);
    setSlotsError("");

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);

    busynessApi
      .forAttraction(id, isoDate(targetDate))
      .then((res) => {
        if (!active) return;
        const raw = res.data || [];

        // Debug aid: Spring/Jackson sometimes serializes a boolean getter like
        // isGem() as the JSON key "gem" instead of "isGem" (it strips the "is"
        // prefix for non-record beans). Log the first raw slot once so it's
        // easy to confirm the actual key names coming back from the backend.
        if (import.meta.env.DEV && raw.length > 0) {
          console.debug("[AttractionDetail] raw busyness slot keys:", Object.keys(raw[0]), raw[0]);
        }

        setSlots(raw.map(normalizeSlot));
      })
      .catch((err) => active && setSlotsError(err.response?.data?.message || "Failed to load busyness data."))
      .finally(() => active && setSlotsLoading(false));

    return () => {
      active = false;
    };
  }, [id, dayOffset]);

  async function toggleFavorite() {
    if (!user) return;
    setFavBusy(true);
    try {
      if (isFavorited) {
        await favoriteApi.remove(user.id, id);
        setIsFavorited(false);
      } else {
        await favoriteApi.add(user.id, id);
        setIsFavorited(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFavBusy(false);
    }
  }

  async function handleCheckin() {
    if (!user) return;
    try {
      await checkinApi.create(user.id, id);
      setCheckinDone(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function submitRating(score) {
    if (!user) return;
    setRatingBusy(true);
    const previousMyRating = myRating;
    try {
      if (previousMyRating > 0) {
        await ratingApi.update(user.id, id, score);
      } else {
        await ratingApi.create(user.id, id, score);
      }
      setMyRating(score);

      // Optimistically update the average/count shown at the top of the page
      // right away, instead of waiting on a refetch/refresh to see it move.
      setAttraction((prev) => {
        if (!prev) return prev;
        const prevCount = prev.ratingCount ?? 0;
        const prevAvg = prev.avgRating ?? 0;

        if (previousMyRating > 0) {
          // Updating an existing rating: count stays the same, swap this
          // rating's old contribution to the average for the new one.
          const nextAvg = prevCount > 0 ? (prevAvg * prevCount - previousMyRating + score) / prevCount : score;
          return { ...prev, avgRating: nextAvg };
        }

        // Brand new rating: count goes up by one.
        const nextCount = prevCount + 1;
        const nextAvg = (prevAvg * prevCount + score) / nextCount;
        return { ...prev, avgRating: nextAvg, ratingCount: nextCount };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setRatingBusy(false);
    }
  }

  if (loading) return <p className="p-lg text-secondary">Loading…</p>;
  if (errorMsg) return <p className="p-lg text-error">{errorMsg}</p>;
  if (!attraction) return <p className="p-lg text-secondary">Not found.</p>;

  return (
    <main className="max-w-[1440px] mx-auto px-lg py-xl w-full">
      <Link to="/gems" className="text-label-caps font-label-caps text-secondary hover:text-primary flex items-center gap-1 mb-md">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Gems
      </Link>

      <header className="mb-lg flex flex-col md:flex-row justify-between items-start md:items-end gap-sm">
        <div>
          {attraction.category && (
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary-container/20 text-on-primary-fixed-variant text-label-caps font-label-caps px-3 py-1 rounded-full">
                {attraction.category}
              </span>
            </div>
          )}
          <h1 className="text-display-lg font-display-lg text-on-surface mb-2">{attraction.name}</h1>
          {attraction.openingHours && (
            <p className="text-body-md font-body-md text-secondary">{attraction.openingHours}</p>
          )}
        </div>
        <div className="flex gap-sm">
          <button
            onClick={toggleFavorite}
            disabled={!user || favBusy}
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-outline hover:border-primary text-primary text-body-md font-body-md font-medium transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${isFavorited ? "icon-fill" : ""}`}>favorite</span>
            {isFavorited ? "Saved" : "Save"}
          </button>
          <button
            onClick={handleCheckin}
            disabled={!user || checkinDone}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary text-body-md font-body-md font-medium transition-colors disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {checkinDone ? "Checked In" : "Check In"}
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-[0px] mb-xl h-[260px] md:h-[400px]">
        <div className="flex-[2] rounded-xl overflow-hidden shadow-[0_10px_40px_rgba(0,104,95,0.05)]">
          <img className="w-full h-full object-cover" src={resolveImage(attraction.imagePath)} alt={attraction.name} />
        </div>
        <div className="flex-1 rounded-xl overflow-hidden shadow-[0_10px_40px_rgba(0,104,95,0.05)] bg-surface-container-low relative isolate">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-secondary text-[13px]">
                Loading map…
              </div>
            }
          >
            <MiniMap attraction={attraction} isOpen={liveStatus.isOpen} busynessLevel={liveStatus.busynessLevel} />
          </Suspense>
        </div>
      </div>


      <div className="grid grid-cols-12 gap-gutter">
        {/* Busyness chart: data comes from /api/attractions/{id}/busyness, returned as time slots for the day */}
        <div className="col-span-12 md:col-span-8">
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white h-full flex flex-col">
            <div className="flex justify-between items-center mb-md pb-4 border-b border-outline-variant/20">
              <div>
                <h2 className="text-headline-md font-headline-md mb-1">Busyness Insights</h2>
                <p className="text-body-md font-body-md text-secondary">
                  Time-slot forecast for {dayOffset === 0 ? "today" : "tomorrow"}
                </p>
              </div>
              <div className="flex gap-2 bg-surface p-1 rounded-lg">
                <button
                  onClick={() => setDayOffset(0)}
                  className={
                    dayOffset === 0
                      ? "px-4 py-1.5 rounded-md bg-white shadow-sm text-primary text-label-caps font-label-caps font-bold"
                      : "px-4 py-1.5 rounded-md text-secondary hover:text-primary transition-colors text-label-caps font-label-caps"
                  }
                >
                  Today
                </button>
                <button
                  onClick={() => setDayOffset(1)}
                  className={
                    dayOffset === 1
                      ? "px-4 py-1.5 rounded-md bg-white shadow-sm text-primary text-label-caps font-label-caps font-bold"
                      : "px-4 py-1.5 rounded-md text-secondary hover:text-primary transition-colors text-label-caps font-label-caps"
                  }
                >
                  Tomorrow
                </button>
              </div>
            </div>

            {slotsLoading ? (
              <p className="text-secondary">Loading…</p>
            ) : slotsError ? (
              <p className="text-error">{slotsError}</p>
            ) : slots.length === 0 ? (
              <p className="text-secondary">
                No busyness data available for {dayOffset === 0 ? "today" : "tomorrow"}.
              </p>
            ) : (
              <>
                <div className="relative h-[220px]">
                  <div className="absolute inset-0 flex items-end gap-1">
                    {slots.map((slot, idx) => {
                      const isNow = isCurrentSlot(slot, dayOffset);
                      return (
                        <div
                          key={idx}
                          className={`relative flex-1 rounded-t-sm transition-colors cursor-pointer ${barColor(slot)}`}
                          style={{ height: `${barHeight(slot)}%` }}
                          title={`${slot.startTime}: ${
                            slot.isOpen === false ? "Closed" : `level ${slot.busynessLevel ?? "--"}/5`
                          }${slot.isGem ? " · Gem Period" : ""}`}
                        >
                          {isNow && (
                            <>
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface whitespace-nowrap">
                                NOW
                              </span>
                              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2/3 h-2 rounded-full bg-primary" />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X axis: time of day, labeled every 4 hours (every 8th
                    half-hour slot) so it doesn't get crowded */}
                <div className="flex gap-1 mt-1">
                  {slots.map((slot, idx) => (
                    <span key={idx} className="flex-1 text-center text-[10px] text-secondary whitespace-nowrap">
                      {idx % 8 === 0 ? formatSlotTime(slot.startTime) : ""}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex gap-4 text-xs text-secondary justify-center flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-primary-fixed border border-primary rounded-sm" /> Gem Period
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-primary/20 rounded-sm" /> Quiet
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-primary/40 rounded-sm" /> Moderate
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-tertiary/80 rounded-sm" /> Busy
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-outline-variant/30 rounded-sm" /> Closed
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest rounded-xl p-md shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-outline-variant/20">
              <div>
                <p className="text-label-caps font-label-caps text-secondary uppercase tracking-wider mb-1">Rating</p>
                <p className="text-body-lg font-body-lg text-on-surface">
                  {attraction.avgRating != null ? attraction.avgRating.toFixed(1) : "--"} ★{" "}
                  <span className="text-secondary text-[13px]">({attraction.ratingCount ?? 0})</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-label-caps font-label-caps text-secondary uppercase tracking-wider mb-1">Duration</p>
                <p className="text-body-lg font-body-lg text-on-surface">
                  {attraction.suggestedDurationMin ? `${attraction.suggestedDurationMin} min` : "--"}
                </p>
              </div>
            </div>
            {attraction.wheelchair != null && (
              <div className="flex justify-between items-center">
                <p className="text-body-md font-body-md font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">accessible</span> Accessibility
                </p>
                <span
                  className={`text-[10px] font-label-caps px-2 py-0.5 rounded-full ${
                    attraction.wheelchair === 2
                      ? "bg-primary text-on-primary"
                      : attraction.wheelchair === 1
                      ? "bg-secondary-container text-on-secondary-container"
                      : "bg-outline-variant text-on-surface"
                  }`}
                >
                  {attraction.wheelchair === 2
                    ? "Fully Accessible"
                    : attraction.wheelchair === 1
                    ? "Limited Access"
                    : "Not Accessible"}
                </span>
              </div>
            )}
          </div>

          {/* The ratings endpoint only stores a numeric score, no review text or avatar,
              so this only supports rating, not a review list. */}
          <section className="bg-surface-container-lowest rounded-xl p-md shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white flex-1">
            <h2 className="text-body-lg font-body-lg font-semibold mb-sm">
              {myRating > 0 ? "Update Your Rating" : "Leave a Rating"}
            </h2>
            <div className="flex gap-1 text-outline-variant">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  disabled={!user || ratingBusy}
                  onClick={() => submitRating(star)}
                  className={`material-symbols-outlined text-[28px] transition-colors disabled:opacity-50 ${
                    star <= myRating ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  star
                </button>
              ))}
            </div>
            {!user && <p className="text-secondary text-[13px] mt-2">Sign in to leave a rating.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
