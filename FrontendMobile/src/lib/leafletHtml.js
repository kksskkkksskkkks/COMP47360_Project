// Builds a self-contained HTML document with a Leaflet map inside it. This
// same HTML string is fed to react-native-webview's <WebView> on iOS/Android
// and to a plain <iframe srcDoc=...> on web — react-native-webview has no
// web implementation at all, so this is the one approach that actually
// renders a real interactive map on every target, including the
// `expo start --web` preview the person specifically asked to keep working.
//
// Color/marker logic mirrors the web app's HeatMap.jsx and MiniMap.jsx
// exactly, so the look matches across platforms.

const CATEGORY_COLORS = {
    park: "#16A34A",
    culture: "#7C3AED",
    landmark: "#2563EB",
    museum: "#DB2777",
};
const FALLBACK_CATEGORY_COLOR = "#475569";
const CLOSED_COLOR = "rgba(17,19,21,0.89)";
const DOT_SIZE = 10;

function glowColorForLevel(level) {
    if (level == null) return "#94A3B8";
    if (level <= 1) return "#00685F";
    if (level <= 3) return "#d6a52a";
    return "#f24b4b";
}

function categoryColor(category) {
    return CATEGORY_COLORS[(category || "").toLowerCase()] || FALLBACK_CATEGORY_COLOR;
}

// Builds the full HTML document. `points` is the same shape as
// HeatMapAttractionPointDTO. `interactive` controls whether markers are
// clickable/show popups and whether map drag/scroll is enabled (false for
// the small MiniMap preview, true for the full Heat Map page).
export function buildMapHtml({
                                 points,
                                 center,
                                 zoom,
                                 interactive = true,
                                 glowOnly = false, // MiniMap uses a slightly larger glow size preset to read well at a small map size; the solid dot marker always renders regardless of this flag
                             }) {
    const markersJs = points
        .map((p) => {
            const closed = p.isOpen === false;
            const dotColor = closed ? CLOSED_COLOR : categoryColor(p.category);
            const glowLevel = p.busynessLevel ?? 0;
            const glowColor = glowColorForLevel(glowLevel);
            const outerSize = glowOnly ? 60 + glowLevel * 22 : 48 + glowLevel * 20;

            const popupHtml = interactive
                ? `
        <div style="display:flex;flex-direction:column;gap:4px;min-width:160px;font-family:-apple-system,sans-serif;">
          ${p.imagePath ? `<img src="${escapeHtml(p.imageUrl || "")}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:4px;" />` : ""}
          <span style="font-weight:600;color:#0b1c30;">${escapeHtml(p.name || "")}</span>
          ${p.category ? `<span style="display:flex;align-items:center;gap:4px;color:#565E74;font-size:11px;text-transform:uppercase;"><span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;"></span>${escapeHtml(p.category)}</span>` : ""}
          <span style="font-size:12px;font-weight:500;color:${closed ? "#565E74" : "#00685F"};">
            ${closed ? "Closed" : "Open Now"}${p.busynessLevel != null && !closed ? ` &middot; Busyness ${p.busynessLevel}/5` : ""}
          </span>
          ${p.avgRating != null ? `<span style="font-size:12px;color:#565E74;">&#9733; ${Number(p.avgRating).toFixed(1)}</span>` : ""}
          <a href="#" data-attraction-id="${p.id}" class="view-details-link" style="color:#00685F;font-size:12px;font-weight:500;text-decoration:underline;margin-top:4px;">View details</a>
        </div>
      `
                : "";

            return `
        if (!${closed}) {
          L.marker([${p.lat}, ${p.lon}], {
            icon: L.divIcon({
              html: '<div style="width:${outerSize}px;height:${outerSize}px;border-radius:50%;background:radial-gradient(circle, ${glowColor}80 0%, ${glowColor}50 30%, ${glowColor}22 60%, ${glowColor}00 100%);"></div>',
              className: '',
              iconSize: [${outerSize}, ${outerSize}],
              iconAnchor: [${outerSize / 2}, ${outerSize / 2}],
            }),
            interactive: false,
          }).addTo(map);
        }
        L.marker([${p.lat}, ${p.lon}], {
          icon: L.divIcon({
            html: '<div style="width:${DOT_SIZE}px;height:${DOT_SIZE}px;border-radius:50%;background:${dotColor};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>',
            className: '',
            iconSize: [${DOT_SIZE}, ${DOT_SIZE}],
            iconAnchor: [${DOT_SIZE / 2}, ${DOT_SIZE / 2}],
          }),
          interactive: ${interactive},
        })${interactive ? `.bindPopup(\`${popupHtml.replace(/`/g, "\\`")}\`)` : ""}.addTo(map);
      `;
        })
        .join("\n");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #eff4ff; }
    .leaflet-popup-content-wrapper { border-radius: 10px; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      center: [${center[0]}, ${center[1]}],
      zoom: ${zoom},
      zoomControl: ${interactive},
      dragging: ${interactive},
      scrollWheelZoom: ${interactive},
      doubleClickZoom: ${interactive},
      touchZoom: ${interactive},
      boxZoom: ${interactive},
      keyboard: ${interactive},
      attributionControl: ${interactive},
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    ${markersJs}

    // Forward "View details" link taps out to the host app (RN WebView /
    // web iframe both listen via postMessage) instead of trying to
    // navigate inside the iframe itself, which has no router.
    document.addEventListener('click', function (e) {
      var link = e.target.closest('.view-details-link');
      if (link) {
        e.preventDefault();
        var id = link.getAttribute('data-attraction-id');
        var message = JSON.stringify({ type: 'viewDetails', id: id });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(message);
        } else if (window.parent) {
          window.parent.postMessage(message, '*');
        }
      }
    });
  </script>
</body>
</html>
  `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}