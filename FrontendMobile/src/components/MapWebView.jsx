import { WebView } from "react-native-webview";
import { buildMapHtml } from "../lib/leafletHtml";

// Native (iOS/Android) implementation. A sibling MapWebView.web.jsx exists
// for the web platform — react-native-webview has no web build at all, so
// Metro's platform-extension resolution (.web.jsx wins on web, this file
// wins everywhere else) is what makes `import MapWebView from
// "./MapWebView"` pick the right one automatically per platform.
export default function MapWebView({ points, center, zoom, interactive = true, glowOnly = false, onViewDetails, style }) {
  const html = buildMapHtml({ points, center, zoom, interactive, glowOnly });

  return (
    <WebView
      source={{ html }}
      style={style}
      scrollEnabled={false}
      bounces={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "viewDetails" && onViewDetails) {
            onViewDetails(data.id);
          }
        } catch {
          // ignore malformed messages
        }
      }}
    />
  );
}
