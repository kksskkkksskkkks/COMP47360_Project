import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { recommendationApi, readBoolField } from "../lib/api";
import AttractionCard from "../components/AttractionCard";
import FilterBar from "../components/FilterBar";

const categories = [
  { label: "Museum", value: "museum" },
  { label: "Park", value: "park" },
  { label: "Culture", value: "culture" },
  { label: "Landmark", value: "landmark" },
];

// wheelchair filtering on the backend is ">= 1", i.e. sending 1 matches both
// "limited" (1) and "fully accessible" (2).
const ACCESSIBLE_FILTER_VALUE = 1;

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
// we can render "Today / Jun 21" and "Tomorrow / Jun 22" section headers
// instead of one long undifferentiated timeline.
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

export default function RecommendationsScreen() {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [accessibleOnly, setAccessibleOnly] = useState(false);

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);
  const [nowKey, setNowKey] = useState(null);

  function toggleCategory(value) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  const requestIdRef = useRef(0);

  function fetchRecommendations({ isRefresh = false } = {}) {
    const requestId = ++requestIdRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
        setSlots(data);

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
        if (requestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayGroups = useMemo(() => groupByDay(slots), [slots]);

  // Flatten day groups + their slots into a single FlatList data array with
  // typed rows, since RN doesn't have nested scroll containers the way the
  // web version could just stack <div>s.
  const rows = useMemo(() => {
    const out = [];
    for (const group of dayGroups) {
      out.push({ type: "day-header", key: `day-${group.key}`, date: group.date });
      for (const slot of group.slots) {
        out.push({ type: "slot", key: slot.timeBucket, slot });
      }
    }
    return out;
  }, [dayGroups]);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-3 gap-3">
        <Text className="text-display-lg text-on-surface font-bold">Find Your Gem</Text>
        <Text className="text-body-md text-secondary">
          Precise recommendations based on live busyness and curated quality.
        </Text>

        <FilterBar
          categories={categories}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          onClearCategories={() => setSelectedCategories([])}
          accessibleOnly={accessibleOnly}
          onToggleAccessible={() => setAccessibleOnly((v) => !v)}
        />

        <Pressable
          onPress={() => fetchRecommendations()}
          disabled={loading}
          className="self-start px-4 py-2 rounded-full bg-primary flex-row items-center gap-2 active:opacity-90"
          style={loading ? { opacity: 0.6 } : {}}
        >
          <MaterialIcons name="diamond" size={16} color="#fff" />
          <Text className="text-on-primary text-label-caps uppercase font-semibold">
            {loading ? "Loading…" : "Get Recommendations"}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#00685F" />
        </View>
      ) : errorMsg ? (
        <Text className="text-error px-4">{errorMsg}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 0 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRecommendations({ isRefresh: true })}
              tintColor="#00685F"
            />
          }
          ListEmptyComponent={
            <Text className="text-secondary">No recommendations available right now.</Text>
          }
          renderItem={({ item }) => {
            if (item.type === "day-header") {
              return (
                <View className="flex-row items-baseline gap-2 mb-3 mt-4">
                  <Text className="text-headline-lg text-primary font-semibold">
                    {dateLabel(item.date)}
                  </Text>
                  <Text className="text-secondary text-body-md">/ {dateOnlyLabel(item.date)}</Text>
                </View>
              );
            }

            const slot = item.slot;
            const isExpanded = expandedKey === slot.timeBucket;
            const isLive = nowKey === slot.timeBucket;
            const isPast = nowKey != null && !isLive && slot.timeBucket < nowKey;
            const isFuture = nowKey != null && !isLive && slot.timeBucket > nowKey;
            const count = slot.attractions?.length ?? 0;

            return (
              <View
                className="rounded-xl mb-2"
                style={{
                  borderWidth: isExpanded ? 2 : 1,
                  borderColor: isExpanded ? "#00685F" : "transparent",
                  backgroundColor: "#ffffff",
                }}
              >
                <Pressable
                  onPress={() => setExpandedKey(isExpanded ? null : slot.timeBucket)}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    <Text className="text-label-caps text-secondary w-16">
                      {formatTime(new Date(slot.timeBucket))}
                    </Text>
                    {isLive && (
                      <View className="flex-row items-center gap-1">
                        <View className="w-2 h-2 rounded-full bg-primary" />
                        <Text className="text-primary text-label-caps uppercase">Live Now</Text>
                      </View>
                    )}
                    {isPast && (
                      <View className="flex-row items-center gap-1">
                        <View className="w-2 h-2 rounded-full bg-secondary/40" />
                        <Text className="text-secondary/70 text-label-caps uppercase">Past Gems</Text>
                      </View>
                    )}
                    {isFuture && (
                      <View className="flex-row items-center gap-1">
                        <View className="w-2 h-2 rounded-full bg-primary" />
                        <Text className="text-primary text-label-caps uppercase">Future Gems</Text>
                      </View>
                    )}
                    <Text className="text-body-md text-on-surface" numberOfLines={1}>
                      {count > 0 ? `${count} recommendation${count > 1 ? "s" : ""}` : "No matches"}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isExpanded ? "expand-less" : "expand-more"}
                    size={22}
                    color="#565E74"
                  />
                </Pressable>

                {isExpanded && count > 0 && (
                  <View className="px-4 pb-4">
                    {slot.attractions.map((a) => (
                      <AttractionCard
                        key={a.id}
                        attraction={a}
                        isOpen={readBoolField(a, "isOpen", "open")}
                        busynessLevel={a.busynessLevel}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
