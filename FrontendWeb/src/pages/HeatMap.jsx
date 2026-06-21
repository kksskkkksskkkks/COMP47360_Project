import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link, useLocation } from "react-router-dom";
import { mapApi, toLocalDateTimeString, readBoolField } from "../lib/api";
import { resolveImage } from "../lib/image";

// Manhattan, NYC — matches the backend's weather chatbot, which is fixed to
// this city, and is where the seed attraction data lives.
const MANHATTAN_CENTER = [40.7588, -73.9851];
const DEFAULT_ZOOM = 13;

// Two independent color signals on each marker:
// - the solid center dot's color = category (what kind of place this is)
// - the radiating glow around it = busyness level (how crowded it is)
// Closed locations get a flat gray dot with no glow at all, so "closed" is
// visually distinct from "open and just very quiet".
const CATEGORY_COLORS = {
  park: "#16A34A", // green
  culture: "#7C3AED", // violet
  landmark: "#2563EB", // blue
  museum: "#DB2777", // pink
};
const FALLBACK_CATEGORY_COLOR = "#475569"; // slate, for any category not in the map above
const CLOSED_COLOR = "rgba(17,19,21,0.89)";
const DOT_SIZE = 14;

// Sequential glow scale: emerald (quiet) -> gold (moderate) -> coral (busy).
function glowColorForLevel(level) {
  if (level == null) return "#94A3B8";
  if (level <= 1) return "#00685F"; // emerald
  if (level <= 3) return "#d6a52a"; // gold
  return "#f24b4b"; // coral
}

function categoryColor(category) {
  return CATEGORY_COLORS[(category || "").toLowerCase()] || FALLBACK_CATEGORY_COLOR;
}

// The glow and the dot are two SEPARATE Leaflet markers at the same
// coordinates, not one marker with nested divs. CSS pointer-events tricks
// don't work here because Leaflet attaches its own click listener directly
// to the marker icon's container element, which sits outside anything we
// can style from inside our html string. Leaflet's `interactive` marker
// option is the real fix: interactive={false} tells Leaflet not to attach
// any mouse listeners to that marker at all, so clicks over the glow pass
// straight through to whatever's underneath (the small dot marker, another
// point's glow, or just the map) instead of registering on this marker.
function buildGlowIcon(level) {
  const glowColor = glowColorForLevel(level);
  const outerSize = 48 + level * 20; // 48px (level 0) up to 148px (level 5)
  const html = `<div style="width:${outerSize}px;height:${outerSize}px;border-radius:50%;background:radial-gradient(circle, ${glowColor}80 0%, ${glowColor}50 30%, ${glowColor}22 60%, ${glowColor}00 100%);"></div>`;
  return L.divIcon({ html, className: "", iconSize: [outerSize, outerSize], iconAnchor: [outerSize / 2, outerSize / 2] });
}

function buildDotIcon(color, size = DOT_SIZE) {
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

// The slider only covers "today" and "tomorrow" — busyness snapshots are
// forecast data on a fixed 30-minute grid, and that's the realistic window
// the backend actually has data for. Step 0 = today 00:00, step 95 =
// tomorrow 23:30 (48 half-hour slots per day × 2 days).
const STEP_MINUTES = 30;
const STEPS_PER_DAY = (24 * 60) / STEP_MINUTES; // 48
const TOTAL_STEPS = STEPS_PER_DAY * 2; // today + tomorrow

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function stepToDate(step) {
  return new Date(todayStart().getTime() + step * STEP_MINUTES * 60 * 1000);
}

function dateToStep(date) {
  const diffMinutes = (date.getTime() - todayStart().getTime()) / 60000;
  const step = Math.round(diffMinutes / STEP_MINUTES);
  return Math.max(0, Math.min(TOTAL_STEPS - 1, step));
}

function formatStepLabel(step) {
  const date = stepToDate(step);
  const dayLabel = step < STEPS_PER_DAY ? "Today" : "Tomorrow";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${dayLabel}, ${time}`;
}

export default function HeatMap() {
  // If we got here from an attraction detail page's mini map, recenter on
  // that location instead of the default Manhattan-wide view.
  const location = useLocation();
  const mapCenter = location.state?.center || MANHATTAN_CENTER;
  const mapZoom = location.state?.zoom || DEFAULT_ZOOM;

  const [sliderStep, setSliderStep] = useState(() => dateToStep(new Date()));

  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const timeBucket = useMemo(() => toLocalDateTimeString(stepToDate(sliderStep)), [sliderStep]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg("");

    mapApi
      .attractions(timeBucket)
      .then((res) => {
        if (!active) return;
        setPoints(res.data || []);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(
          err.response?.data?.message ||
            "Failed to load the heat map. Check that the backend is running and that this exact timeBucket has data."
        );
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [timeBucket]);

  function jumpToNow() {
    setSliderStep(dateToStep(new Date()));
  }

  return (
    <main className="flex-grow max-w-[1440px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header className="flex flex-col gap-md">
        <h1 className="font-display-lg text-display-lg text-on-surface">Crowd Heat Map</h1>
        <p className="text-body-md font-body-md text-secondary">
          Live snapshot of how busy each location is right now, sourced from{" "}
          <span className="font-label-caps text-label-caps">/api/map/attractions</span>.
        </p>

        <div className="flex items-center gap-sm bg-surface-container-lowest p-sm rounded-xl border border-outline-variant/30 shadow-[0_10px_40px_rgba(0,104,95,0.04)]">
          <span className="material-symbols-outlined text-secondary shrink-0">schedule</span>
          <span className="font-label-caps text-label-caps text-on-surface whitespace-nowrap w-[150px]">
            {formatStepLabel(sliderStep)}
          </span>
          <input
            type="range"
            min={0}
            max={TOTAL_STEPS - 1}
            step={1}
            value={sliderStep}
            onChange={(e) => setSliderStep(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <button
            onClick={jumpToNow}
            className="px-sm py-[8px] rounded-full text-label-caps font-label-caps uppercase bg-transparent text-secondary border border-outline-variant hover:border-primary hover:text-primary transition-colors shrink-0"
          >
            Now
          </button>
        </div>

        {/* Today / Tomorrow tick marks under the slider, so the midpoint where
            the window flips to the next day is visible at a glance. */}
        <div className="flex text-[11px] text-secondary px-sm -mt-2">
          <span className="flex-1 text-center">Today</span>
          <span className="flex-1 text-center">Tomorrow</span>
        </div>
      </header>

      {errorMsg && <p className="text-error">{errorMsg}</p>}

      <div className="relative isolate rounded-xl overflow-hidden border border-outline-variant/30 shadow-[0_10px_40px_rgba(0,104,95,0.04)] h-[600px]">
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-surface/60 backdrop-blur-sm flex items-center justify-center">
            <p className="text-secondary font-label-caps text-label-caps uppercase">Loading…</p>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          {/* OpenStreetMap tiles — free, no API key required */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Layer 1: glows, all non-interactive — purely decorative, never
              intercept a click no matter how many overlap. */}
          {points.map((p) => {
            const closed = readBoolField(p, "isOpen", "open") === false;
            if (closed) return null;
            return (
              <Marker
                key={`glow-${p.id}`}
                position={[p.lat, p.lon]}
                icon={buildGlowIcon(p.busynessLevel ?? 0)}
                interactive={false}
              />
            );
          })}

          {/* Layer 2: the solid dots, rendered after (so they paint on top of
              every glow) and the only thing that's actually clickable. */}
          {points.map((p) => {
            const closed = readBoolField(p, "isOpen", "open") === false;
            const dotColor = closed ? CLOSED_COLOR : categoryColor(p.category);
            return (
              <Marker key={`dot-${p.id}`} position={[p.lat, p.lon]} icon={buildDotIcon(dotColor)}>
                <Popup>
                  <div className="flex flex-col gap-1 min-w-[180px]">
                    {p.imagePath && (
                      <img
                        src={resolveImage(p.imagePath)}
                        alt={p.name}
                        className="w-full h-[90px] object-cover rounded-md mb-1"
                      />
                    )}
                    <span className="font-semibold text-on-surface">{p.name}</span>
                    {p.category && (
                      <span className="flex items-center gap-1 text-secondary text-xs uppercase">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ background: categoryColor(p.category) }}
                        />
                        {p.category}
                      </span>
                    )}
                    <span className={`text-xs font-medium ${closed ? "text-secondary" : "text-primary"}`}>
                      {closed ? "Closed" : "Open Now"}
                      {p.busynessLevel != null && !closed ? ` · Busyness ${p.busynessLevel}/5` : ""}
                    </span>
                    {p.avgRating != null && (
                      <span className="text-xs text-secondary">★ {p.avgRating.toFixed(1)}</span>
                    )}
                    <Link to={`/gems/${p.id}`} className="text-primary text-xs font-medium underline mt-1">
                      View details
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex flex-col items-center gap-sm text-xs text-secondary">
        <div className="flex flex-wrap gap-md items-center justify-center">
          <span className="font-label-caps text-label-caps uppercase text-secondary/70">Category:</span>
          {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1 capitalize">
              <span className="w-3 h-3 rounded-full" style={{ background: color }} /> {key}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-md items-center justify-center">
          <span className="font-label-caps text-label-caps uppercase text-secondary/70">Busyness glow:</span>
          <span className="flex items-center gap-1">
            <span
              className="w-5 h-5 rounded-full"
              style={{
                background: `radial-gradient(circle, ${glowColorForLevel(0)}80 0%, ${glowColorForLevel(0)}22 60%, transparent 100%)`,
              }}
            />{" "}
            Quiet
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-5 h-5 rounded-full"
              style={{
                background: `radial-gradient(circle, ${glowColorForLevel(2)}80 0%, ${glowColorForLevel(2)}22 60%, transparent 100%)`,
              }}
            />{" "}
            Moderate
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-5 h-5 rounded-full"
              style={{
                background: `radial-gradient(circle, ${glowColorForLevel(5)}80 0%, ${glowColorForLevel(5)}22 60%, transparent 100%)`,
              }}
            />{" "}
            Busy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: CLOSED_COLOR }} /> Closed (no glow)
          </span>
        </div>
        <span>{points.length} locations shown</span>
      </div>
    </main>
  );
}
