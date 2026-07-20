import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
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
import MapWebView from "../components/MapWebView";

// Height and color are driven by predictedDropoffs, normalized against a
// FIXED global denominator (not this attraction's own min/max), so bars are
// directly comparable across attractions. The denominator comes from real
// data: across 6528 busyness_forecast rows, min=0.7, max=20.3, avg=3.51 —
// using max≈20.3 (rounded up slightly for headroom) as the global ceiling
// means a place that's always quiet stays visibly short relative to a place
// that actually gets busy.
const GLOBAL_MAX_DROPOFFS = 21;
const CLOSED_BAR_HEIGHT = 4; // percent, deliberately tiny but still visible
const CHART_HEIGHT = 160;

function barHeightPct(slot) {
  if (slot.isOpen === false) return CLOSED_BAR_HEIGHT;
  const ratio = (slot.predictedDropoffs ?? 0) / GLOBAL_MAX_DROPOFFS;
  return Math.max(8, Math.min(100, ratio * 100));
}

function barColor(slot) {
  if (slot.isOpen === false) return "#bcc9c64d"; // outline-variant/30
  if (slot.isGem) return "#89f5e7"; // primary-fixed
  const ratio = (slot.predictedDropoffs ?? 0) / GLOBAL_MAX_DROPOFFS;
  if (ratio >= 0.66) return "#525E5Ccc"; // tertiary/80
  if (ratio >= 0.33) return "#00685F66"; // primary/40
  return "#00685F33"; // primary/20
}

function isCurrentSlot(slot, dayOffset) {
  if (dayOffset !== 0 || !slot.startTime) return false;
  const start = new Date(slot.startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const now = new Date();
  return now >= start && now < end;
}

function formatSlotTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", { hour: "numeric" });
}

function isoDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeSlot(slot) {
  return {
    ...slot,
    isGem: readBoolField(slot, "isGem", "gem", false),
    isOpen: readBoolField(slot, "isOpen", "open"),
  };
}

export default function AttractionDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const id = route.params?.id;
  const { user } = useAuth();

  const [attraction, setAttraction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState("");

  const [isFavorited, setIsFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);

  const [liveStatus, setLiveStatus] = useState({ isOpen: null, busynessLevel: null });

  useEffect(() => {
    if (id == null) return;
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

  useEffect(() => {
    if (id == null) return;
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

      setAttraction((prev) => {
        if (!prev) return prev;
        const prevCount = prev.ratingCount ?? 0;
        const prevAvg = prev.avgRating ?? 0;

        if (previousMyRating > 0) {
          const nextAvg = prevCount > 0 ? (prevAvg * prevCount - previousMyRating + score) / prevCount : score;
          return { ...prev, avgRating: nextAvg };
        }

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

  if (id == null) {
    // route.params being undefined/missing an id means this screen got
    // mounted without ever being navigated to with { id: ... } — logging
    // here makes that visible (with a stack trace) instead of crashing
    // silently, since the actual trigger for this hasn't been confirmed yet.
    console.warn("[AttractionDetailScreen] mounted with no id in route.params", route);
    return (
        <View className="flex-1 items-center justify-center bg-background px-4">
          <Text className="text-secondary">No attraction selected.</Text>
        </View>
    );
  }

  if (loading) {
    return (
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator color="#00685F" />
        </View>
    );
  }
  if (errorMsg) {
    return (
        <View className="flex-1 items-center justify-center bg-background px-4">
          <Text className="text-error">{errorMsg}</Text>
        </View>
    );
  }
  if (!attraction) {
    return (
        <View className="flex-1 items-center justify-center bg-background">
          <Text className="text-secondary">Not found.</Text>
        </View>
    );
  }

  return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          <Pressable
              onPress={() => {
                // AttractionDetailScreen is a sibling of MainTabs inside the same
                // Stack.Navigator, so navigating straight to MainTabs and asking
                // for its Gems tab is the direct, single-step way there — no need
                // to goBack() first and separately reach for getParent() (that
                // split into two calls on a navigation object whose underlying
                // screen was already being torn down by the first call, which is
                // why it wasn't reliably switching tabs).
                navigation.navigate("MainTabs", { screen: "Gems" });
              }}
              className="flex-row items-center gap-1 mb-4"
          >
            <MaterialIcons name="arrow-back" size={18} color="#565E74" />
            <Text className="text-label-caps text-secondary uppercase">Back to Gems</Text>
          </Pressable>

          {attraction.category && (
              <View className="self-start bg-primary-container/20 px-3 py-1 rounded-full mb-2">
                <Text className="text-label-caps text-on-primary-fixed-variant">{attraction.category}</Text>
              </View>
          )}
          <Text className="text-display-lg text-on-surface font-bold mb-1">{attraction.name}</Text>
          {attraction.openingHours && (
              <Text className="text-body-md text-secondary mb-4">{attraction.openingHours}</Text>
          )}

          <View style={{ height: 220, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            <Image
                source={{ uri: resolveImage(attraction.imagePath) }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
            />
          </View>

          <View className="flex-row gap-3 mb-6">
            <Pressable
                onPress={toggleFavorite}
                disabled={!user || favBusy}
                className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-full border border-outline active:opacity-80"
                style={!user ? { opacity: 0.5 } : {}}
            >
              <MaterialIcons
                  name={isFavorited ? "favorite" : "favorite-border"}
                  size={18}
                  color="#00685F"
              />
              <Text className="text-primary font-medium text-body-md">
                {isFavorited ? "Saved" : "Save"}
              </Text>
            </Pressable>
            <Pressable
                onPress={handleCheckin}
                disabled={!user || checkinDone}
                className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-full bg-primary active:opacity-90"
                style={!user || checkinDone ? { opacity: 0.6 } : {}}
            >
              <MaterialIcons name="check-circle" size={18} color="#fff" />
              <Text className="text-on-primary font-medium text-body-md">
                {checkinDone ? "Checked In" : "Check In"}
              </Text>
            </Pressable>
          </View>

          {/* Busyness chart */}
          <View
              className="bg-surface-container-lowest rounded-xl p-4 mb-4"
              style={{ shadowColor: "#00685F", shadowOpacity: 0.04, shadowRadius: 20, elevation: 1 }}
          >
            <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-outline-variant/20">
              <View>
                <Text className="text-headline-md text-on-surface mb-1">Busyness Insights</Text>
                <Text className="text-body-md text-secondary">
                  Time-slot forecast for {dayOffset === 0 ? "today" : "tomorrow"}
                </Text>
              </View>
            </View>
            <View className="flex-row bg-surface p-1 rounded-lg mb-4 self-start">
              <Pressable
                  onPress={() => setDayOffset(0)}
                  className="px-4 py-1.5 rounded-md"
                  style={dayOffset === 0 ? { backgroundColor: "#fff" } : {}}
              >
                <Text
                    className="text-label-caps font-semibold"
                    style={{ color: dayOffset === 0 ? "#00685F" : "#565E74" }}
                >
                  Today
                </Text>
              </Pressable>
              <Pressable
                  onPress={() => setDayOffset(1)}
                  className="px-4 py-1.5 rounded-md"
                  style={dayOffset === 1 ? { backgroundColor: "#fff" } : {}}
              >
                <Text
                    className="text-label-caps font-semibold"
                    style={{ color: dayOffset === 1 ? "#00685F" : "#565E74" }}
                >
                  Tomorrow
                </Text>
              </Pressable>
            </View>

            {slotsLoading ? (
                <ActivityIndicator color="#00685F" />
            ) : slotsError ? (
                <Text className="text-error">{slotsError}</Text>
            ) : slots.length === 0 ? (
                <Text className="text-secondary">
                  No busyness data available for {dayOffset === 0 ? "today" : "tomorrow"}.
                </Text>
            ) : (
                <>
                  <View style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                    {slots.map((slot, idx) => {
                      const isNow = isCurrentSlot(slot, dayOffset);
                      return (
                          <View key={idx} style={{ flex: 1, alignItems: "center" }}>
                            {isNow && (
                                <>
                                  <Text style={{ fontSize: 9, fontWeight: "bold", color: "#0b1c30", marginBottom: 2 }}>
                                    NOW
                                  </Text>
                                  <View
                                      style={{
                                        width: "66%",
                                        height: 5,
                                        borderRadius: 999,
                                        backgroundColor: "#00685F",
                                        marginBottom: -3,
                                        zIndex: 1,
                                      }}
                                  />
                                </>
                            )}
                            <View
                                style={{
                                  width: "100%",
                                  height: (barHeightPct(slot) / 100) * CHART_HEIGHT,
                                  backgroundColor: barColor(slot),
                                  borderRadius: 2,
                                  borderTopWidth: slot.isOpen !== false && slot.isGem ? 2 : 0,
                                  borderTopColor: "#00685F",
                                }}
                            />
                          </View>
                      );
                    })}
                  </View>

                  <View style={{ height: 14, marginTop: 4, position: "relative" }}>
                    {slots.map((slot, idx) => {
                      if (idx % 8 !== 0) return null;
                      // Absolutely positioned at this slot's horizontal center,
                      // rather than each label sharing a flex:1 cell the width of
                      // a single bar — on a phone-width chart with 40+ slots, that
                      // cell is too narrow for even "9 AM" and RN clips it to "9..".
                      const leftPct = ((idx + 0.5) / slots.length) * 100;
                      return (
                          <Text
                              key={idx}
                              style={{
                                position: "absolute",
                                left: `${leftPct}%`,
                                transform: [{ translateX: -20 }],
                                width: 40,
                                textAlign: "center",
                                fontSize: 9,
                                color: "#565E74",
                              }}
                          >
                            {formatSlotTime(slot.startTime)}
                          </Text>
                      );
                    })}
                  </View>

                  <View className="flex-row flex-wrap gap-3 justify-center mt-4">
                    <Legend color="#89f5e7" label="Gem Period" />
                    <Legend color="#00685F33" label="Quiet" />
                    <Legend color="#00685F66" label="Moderate" />
                    <Legend color="#525E5Ccc" label="Busy" />
                    <Legend color="#bcc9c64d" label="Closed" />
                  </View>
                </>
            )}
          </View>

          <View style={{ height:220, borderRadius: 16, overflow: "hidden", position: "relative", marginBottom: 16 }}>
            <MapWebView
                points={[
                  {
                    id: attraction.id,
                    lat: attraction.lat,
                    lon: attraction.lon,
                    category: attraction.category,
                    isOpen: liveStatus.isOpen,
                    busynessLevel: liveStatus.busynessLevel,
                  },
                ]}
                center={[attraction.lat, attraction.lon]}
                zoom={15}
                interactive={false}
                glowOnly
                style={{ width: "100%", height: "100%" }}
            />
            {/* A WebView/iframe captures every tap itself and never lets it
            bubble up — wrapping it in a Pressable doesn't work, since the
            press never reaches that Pressable. This transparent layer
            sits on top instead, so the tap lands here first. */}
            <Pressable
                onPress={() =>
                    navigation.navigate("MainTabs", {
                      screen: "HeatMap",
                      params: { center: [attraction.lat, attraction.lon], zoom: 16 },
                    })
                }
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
          </View>

          {/* Info + rating */}
          <View
              className="bg-surface-container-lowest rounded-xl p-4 mb-4"
              style={{ shadowColor: "#00685F", shadowOpacity: 0.04, shadowRadius: 20, elevation: 1 }}
          >
            <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-outline-variant/20">
              <View>
                <Text className="text-label-caps text-secondary uppercase mb-1">Rating</Text>
                <Text className="text-body-lg text-on-surface">
                  {attraction.avgRating != null ? attraction.avgRating.toFixed(1) : "--"} ★{" "}
                  <Text className="text-secondary text-[13px]">({attraction.ratingCount ?? 0})</Text>
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-label-caps text-secondary uppercase mb-1">Duration</Text>
                <Text className="text-body-lg text-on-surface">
                  {attraction.suggestedDurationMin ? `${attraction.suggestedDurationMin} min` : "--"}
                </Text>
              </View>
            </View>
            {attraction.wheelchair != null && (
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="accessible" size={20} color="#00685F" />
                    <Text className="text-body-md font-medium">Accessibility</Text>
                  </View>
                  <View
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                            attraction.wheelchair === 2 ? "#00685F" : attraction.wheelchair === 1 ? "#dae2fd" : "#bcc9c6",
                      }}
                  >
                    <Text
                        className="text-[10px]"
                        style={{
                          color: attraction.wheelchair === 2 ? "#fff" : "#0b1c30",
                        }}
                    >
                      {attraction.wheelchair === 2
                          ? "Fully Accessible"
                          : attraction.wheelchair === 1
                              ? "Limited Access"
                              : "Not Accessible"}
                    </Text>
                  </View>
                </View>
            )}
          </View>

          <View
              className="bg-surface-container-lowest rounded-xl p-4 mb-4"
              style={{ shadowColor: "#00685F", shadowOpacity: 0.04, shadowRadius: 20, elevation: 1 }}
          >
            <Text className="text-body-lg font-semibold mb-3">
              {myRating > 0 ? "Update Your Rating" : "Leave a Rating"}
            </Text>
            <View className="flex-row gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} disabled={!user || ratingBusy} onPress={() => submitRating(star)}>
                    <MaterialCommunityIcons
                        name={star <= myRating ? "star" : "star-outline"}
                        size={28}
                        color={star <= myRating ? "#00685F" : "#bcc9c6"}
                    />
                  </Pressable>
              ))}
            </View>
            {!user && <Text className="text-secondary text-[13px] mt-2">Sign in to leave a rating.</Text>}
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

function Legend({ color, label }) {
  return (
      <View className="flex-row items-center gap-1">
        <View style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 2 }} />
        <Text className="text-[11px] text-secondary">{label}</Text>
      </View>
  );
}