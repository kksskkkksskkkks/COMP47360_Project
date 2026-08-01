import { useEffect, useRef, useState } from "react";
import { weatherChatApi, streamWeatherChat } from "../lib/api";

// Rough WMO weather-code -> icon bucket. Good enough for a friendly icon
// next to the temperature; the actual description text (which the backend
// already provides) is what carries the real meaning.
function weatherIcon(code) {
  if (code == null) return "thermostat";
  if (code === 0) return "clear_day";
  if (code <= 3) return "partly_cloudy_day";
  if (code <= 48) return "foggy";
  if (code <= 67) return "rainy";
  if (code <= 77) return "weather_snowy";
  if (code <= 82) return "rainy";
  if (code <= 99) return "thunderstorm";
  return "cloud";
}

function formatTemp(value) {
  return value == null ? "--" : `${Math.round(value)}°`;
}

// Minimal markdown rendering for assistant replies — just enough to cover
// what the model actually produces (**bold**, "* " bullet lists, blank-line
// paragraph breaks). Not a full markdown parser; deliberately small so we
// don't need to add a dependency just to stop literal "**" from showing up
// in chat bubbles.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

function renderMarkdownLite(text) {
  const blocks = text.split(/\n\s*\n/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const isList = lines.length > 0 && lines.every((l) => /^[*-]\s+/.test(l.trim()));

    if (isList) {
      return (
        <ul key={`b-${bi}`} className="list-disc pl-5 my-1 space-y-1">
          {lines.map((l, li) => (
            <li key={`b-${bi}-${li}`}>
              {renderInline(l.trim().replace(/^[*-]\s+/, ""), `b-${bi}-${li}`)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`b-${bi}`} className={bi > 0 ? "mt-2" : ""}>
        {lines.map((l, li) => (
          <span key={`b-${bi}-${li}`}>
            {renderInline(l, `b-${bi}-${li}`)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

const SUGGESTIONS = [
  "What should I wear today?",
  "Will it rain this afternoon?",
  "Is tomorrow better for walking outside?",
];

export default function WeatherAssistant() {
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [resolvedLocation, setResolvedLocation] = useState("Manhattan, New York City");
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");

  // `messages` doubles as the chat transcript shown on screen AND the
  // `history` array sent back to the backend on every request (per the
  // docs, the server keeps no session state — the client resends it all).
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState("");

  const scrollRef = useRef(null);

  // Pre-fill the weather panel on load without spending a model call on it
  // — GET /forecast returns the same weather shape with reply always null.
  useEffect(() => {
    let active = true;
    weatherChatApi
      .forecast()
      .then((res) => {
        if (!active) return;
        const data = res.data;
        setCurrent(data.current);
        setForecast(data.forecast || []);
        setResolvedLocation(data.resolvedLocation || "Manhattan, New York City");
      })
      .catch((err) => active && setWeatherError(err.response?.data?.message || "Failed to load weather."))
      .finally(() => active && setWeatherLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const priorHistory = messages;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setChatError("");
    setStreaming(true);
    setStreamingText("");

    // Once we've received a "done" (or "error") SSE event, the turn is
    // already fully resolved as far as the UI is concerned. If the
    // underlying connection then closes in a way the browser treats as a
    // network failure (some servers don't end a chunked SSE response
    // cleanly), that's just noise from draining an already-finished
    // stream — not a real failure — so it shouldn't surface as an error
    // after a perfectly good reply was already shown.
    let finished = false;

    try {
      await streamWeatherChat(trimmed, priorHistory, ({ event, data }) => {
        if (event === "weather") {
          setCurrent(data.current);
          setForecast(data.forecast || []);
          setResolvedLocation(data.resolvedLocation || resolvedLocation);
        } else if (event === "token") {
          setStreamingText((prev) => prev + (typeof data === "string" ? data : ""));
        } else if (event === "done") {
          finished = true;
          setMessages((prev) =>
            data.updatedHistory && data.updatedHistory.length
              ? data.updatedHistory
              : [...prev, { role: "assistant", content: data.reply || "" }]
          );
          if (data.current) setCurrent(data.current);
          if (data.forecast) setForecast(data.forecast);
          if (data.resolvedLocation) setResolvedLocation(data.resolvedLocation);
          setStreamingText("");
        } else if (event === "error") {
          finished = true;
          setChatError(data?.message || "The assistant ran into a problem. Please try again.");
        }
      });
    } catch (err) {
      if (!finished) {
        setChatError(err.message || "Lost connection to the assistant.");
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <main className="flex-grow max-w-[1440px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header>
        <h1 className="font-display-lg text-display-lg text-on-surface">Weather Assistant</h1>
        <p className="text-body-md font-body-md text-secondary">
          Ask about today's weather in {resolvedLocation} and get outfit or activity advice.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-gutter items-start">
        {/* Weather panel */}
        <section className="flex flex-col gap-md">
          <div className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white">
            {weatherLoading ? (
              <p className="text-secondary">Loading…</p>
            ) : weatherError ? (
              <p className="text-error">{weatherError}</p>
            ) : (
              <>
                <p className="font-label-caps text-label-caps text-secondary uppercase mb-xs">
                  {resolvedLocation}
                </p>
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary text-[40px]">
                    {weatherIcon(current?.weatherCode)}
                  </span>
                  <div>
                    <p className="font-stats-numeric text-stats-numeric text-on-surface leading-none">
                      {formatTemp(current?.temperature)}
                    </p>
                    <p className="text-secondary text-[13px]">{current?.weatherDescription || "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-xs mt-md text-[13px] text-secondary">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">thermostat</span>
                    Feels like {formatTemp(current?.apparentTemperature)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">air</span>
                    {current?.windSpeed != null ? `${Math.round(current.windSpeed)} mph` : "--"}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">humidity_percentage</span>
                    {current?.relativeHumidity != null ? `${current.relativeHumidity}%` : "--"}
                  </div>
                </div>
              </>
            )}
          </div>

          {!weatherLoading && !weatherError && (
            <div className="flex flex-col gap-xs">
              {forecast.map((day) => (
                <div
                  key={day.date}
                  className="bg-surface-container-lowest rounded-lg p-sm shadow-[0_10px_30px_rgba(0,104,95,0.03)] border border-white flex items-center justify-between"
                >
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      {weatherIcon(day.weatherCode)}
                    </span>
                    <div>
                      <p className="font-body-md text-body-md font-semibold text-on-surface">{day.label}</p>
                      <p className="text-secondary text-[12px]">{day.weatherDescription}</p>
                    </div>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface shrink-0">
                    {formatTemp(day.tempMax)} / {formatTemp(day.tempMin)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Chat panel */}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white flex flex-col h-[560px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-md py-md flex flex-col gap-sm">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col gap-sm">
                <p className="text-secondary text-[13px]">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="self-start px-sm py-[8px] rounded-full border border-outline-variant text-secondary hover:border-primary hover:text-primary transition-colors text-body-md font-body-md text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] bg-primary text-on-primary rounded-2xl rounded-br-sm px-sm py-[10px] text-body-md font-body-md whitespace-pre-wrap"
                      : "max-w-[80%] bg-surface-container-low text-on-surface rounded-2xl rounded-bl-sm px-sm py-[10px] text-body-md font-body-md"
                  }
                >
                  {m.role === "user" ? m.content : renderMarkdownLite(m.content)}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-surface-container-low text-on-surface rounded-2xl rounded-bl-sm px-sm py-[10px] text-body-md font-body-md">
                  {streamingText ? (
                    renderMarkdownLite(streamingText)
                  ) : (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary/50 animate-bounce [animation-delay:-0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary/50 animate-bounce [animation-delay:-0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary/50 animate-bounce" />
                    </span>
                  )}
                </div>
              </div>
            )}

            {chatError && <p className="text-error text-[13px]">{chatError}</p>}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-sm border-t border-outline-variant/30 px-md py-sm shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the weather…"
              disabled={streaming}
              className="flex-1 px-sm py-[10px] rounded-full bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="p-[10px] rounded-full bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40"
              title="Send"
            >
              <span className="material-symbols-outlined text-[20px] block">send</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
