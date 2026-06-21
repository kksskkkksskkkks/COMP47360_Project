import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

// Same color logic as the Heat Map page, kept in sync deliberately —
// this preview should look like a zoomed-in crop of that page, not a
// different visual language.
const CATEGORY_COLORS = {
  park: "#16A34A",
  culture: "#7C3AED",
  landmark: "#2563EB",
  museum: "#DB2777",
};
const FALLBACK_CATEGORY_COLOR = "#475569";
const CLOSED_COLOR = "rgba(17,19,21,0.89)";
const DOT_SIZE = 16;

function glowColorForLevel(level) {
  if (level == null) return "#94A3B8";
  if (level <= 1) return "#00685F";
  if (level <= 3) return "#d6a52a";
  return "#f24b4b";
}

function categoryColor(category) {
  return CATEGORY_COLORS[(category || "").toLowerCase()] || FALLBACK_CATEGORY_COLOR;
}

// Two stacked, non-interactive divIcons (glow behind, dot on top) — same
// approach as the Heat Map page. Nothing here needs to be independently
// clickable since the whole map is one big "go to Heat Map" button.
function buildGlowIcon(level) {
  const glowColor = glowColorForLevel(level);
  const outerSize = 60 + level * 22;
  const html = `<div class="glow-breathe" style="width:${outerSize}px;height:${outerSize}px;border-radius:50%;background:radial-gradient(circle, ${glowColor}80 0%, ${glowColor}50 30%, ${glowColor}22 60%, ${glowColor}00 100%);"></div>`;
  return L.divIcon({ html, className: "", iconSize: [outerSize, outerSize], iconAnchor: [outerSize / 2, outerSize / 2] });
}

function buildDotIcon(color) {
  const html = `<div style="width:${DOT_SIZE}px;height:${DOT_SIZE}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`;
  return L.divIcon({ html, className: "", iconSize: [DOT_SIZE, DOT_SIZE], iconAnchor: [DOT_SIZE / 2, DOT_SIZE / 2] });
}

export default function MiniMap({ attraction, isOpen, busynessLevel }) {
  const navigate = useNavigate();
  const closed = isOpen === false;
  const center = [attraction.lat, attraction.lon];
  const dotColor = closed ? CLOSED_COLOR : categoryColor(attraction.category);

  function goToHeatMap() {
    // Heat Map reads this via useLocation().state to recenter on this
    // attraction instead of its default Manhattan-wide view.
    navigate("/heatmap", { state: { center, zoom: 16 } });
  }

  return (
    <div
      onClick={goToHeatMap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && goToHeatMap()}
      className="relative w-full h-full cursor-pointer group minimap-root"
      title="View on Heat Map"
    >
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={center} icon={buildGlowIcon(busynessLevel ?? 0)} interactive={false} />
        <Marker position={center} icon={buildDotIcon(dotColor)} interactive={false} />
      </MapContainer>

      {/* This div sits on top of the map and is what actually receives the
          click — the map itself has all interaction disabled above, so it
          behaves like a static preview image, not a draggable map. */}
      <div className="absolute inset-0 bg-on-surface/0 group-hover:bg-on-surface/10 transition-colors flex items-end justify-center pb-3 pointer-events-none">
        <span className="bg-surface-container-lowest/95 text-on-surface text-[12px] font-label-caps uppercase px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
          View on Heat Map
        </span>
      </div>
    </div>
  );
}
