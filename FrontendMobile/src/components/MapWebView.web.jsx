import { useEffect, useRef } from "react";
import { buildMapHtml } from "../lib/leafletHtml";

// Web implementation, picked automatically over MapWebView.jsx by Metro's
// platform resolution when bundling for `expo start --web`. There's no web
// build of react-native-webview, so a plain <iframe srcDoc=...> with the
// same generated Leaflet HTML is the equivalent here — same map, same
// markers, same postMessage bridge for "View details" taps.
export default function MapWebView({ points, center, zoom, interactive = true, glowOnly = false, onViewDetails, style }) {
  const html = buildMapHtml({ points, center, zoom, interactive, glowOnly });
  const iframeRef = useRef(null);

  useEffect(() => {
    function handleMessage(event) {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "viewDetails" && onViewDetails) {
          onViewDetails(data.id);
        }
      } catch {
        // ignore messages that aren't ours (other libraries also postMessage
        // on the same window)
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onViewDetails]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      style={{ border: "none", width: "100%", height: "100%", ...style }}
      title="map"
    />
  );
}
