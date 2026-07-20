import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { mapApi, toLocalDateTimeString, readBoolField } from "../lib/api";
import { resolveImage } from "../lib/image";
import MapWebView from "../components/MapWebView";

// Manhattan, NYC — matches the backend's weather chatbot, which is fixed to
// this city, and is where the seed attraction data lives.
const MANHATTAN_CENTER = [40.767, -73.973];
const DEFAULT_ZOOM = 15;

const CATEGORY_COLORS = {
    park: "#16A34A",
    culture: "#7C3AED",
    landmark: "#2563EB",
    museum: "#DB2777",
};
const CLOSED_COLOR = "rgba(17,19,21,0.89)";

function glowColorForLevel(level) {
    if (level == null) return "#94A3B8";
    if (level <= 1) return "#00685F";
    if (level <= 3) return "#d6a52a";
    return "#f24b4b";
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
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${dayLabel}, ${time}`;
}

export default function HeatMapScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    // If we got here from an attraction detail page's mini map, recenter on
    // that location instead of the default Manhattan-wide view.
    const mapCenter = route.params?.center || MANHATTAN_CENTER;
    const mapZoom = route.params?.zoom || DEFAULT_ZOOM;

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

    // Attach a resolved isOpen flag + full image URL — the map HTML builder
    // doesn't have access to readBoolField/resolveImage itself, since it runs
    // inside a plain HTML string with no imports.
    const mapPoints = useMemo(
        () =>
            points.map((p) => ({
                ...p,
                isOpen: readBoolField(p, "isOpen", "open"),
                imageUrl: p.imagePath ? resolveImage(p.imagePath) : null,
            })),
        [points]
    );

    return (
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
                <Text className="text-display-lg text-on-surface font-bold mb-2">Crowd Heat Map</Text>
                <Text className="text-body-md text-secondary mb-4">
                    Live snapshot of how busy each location is right now.
                </Text>

                <View
                    className="bg-surface-container-lowest rounded-xl p-3 mb-2"
                    style={{ shadowColor: "#00685F", shadowOpacity: 0.04, shadowRadius: 12, elevation: 1 }}
                >
                    <View className="flex-row items-center gap-2 mb-2">
                        <MaterialIcons name="schedule" size={18} color="#565E74" />
                        <Text className="text-label-caps text-on-surface" style={{ width: 130 }}>
                            {formatStepLabel(sliderStep)}
                        </Text>
                        <Pressable
                            onPress={jumpToNow}
                            className="px-3 py-1.5 rounded-full border border-outline-variant ml-auto"
                        >
                            <Text className="text-label-caps uppercase text-secondary">Now</Text>
                        </Pressable>
                    </View>
                    <Slider
                        minimumValue={0}
                        maximumValue={TOTAL_STEPS - 1}
                        step={1}
                        value={sliderStep}
                        onValueChange={setSliderStep}
                        minimumTrackTintColor="#00685F"
                        maximumTrackTintColor="#bcc9c6"
                        thumbTintColor="#00685F"
                    />
                    <View className="flex-row px-1 -mt-1">
                        <Text className="flex-1 text-center text-[11px] text-secondary">Today</Text>
                        <Text className="flex-1 text-center text-[11px] text-secondary">Tomorrow</Text>
                    </View>
                </View>

                {Boolean(errorMsg) && <Text className="text-error mb-2">{errorMsg}</Text>}

                <View
                    className="rounded-xl overflow-hidden border border-outline-variant/30 mb-4"
                    style={{ height: 420 }}
                >
                    {loading && (
                        <View
                            className="absolute inset-0 items-center justify-center bg-surface/70"
                            style={{ zIndex: 10 }}
                        >
                            <ActivityIndicator color="#00685F" />
                        </View>
                    )}
                    <MapWebView
                        points={mapPoints}
                        center={mapCenter}
                        zoom={mapZoom}
                        interactive
                        style={{ height: 420, width: "100%" }}
                        onViewDetails={(id) => navigation.navigate("AttractionDetail", { id: Number(id) })}
                    />
                </View>

                <View className="items-center gap-2">
                    <View className="flex-row flex-wrap gap-3 justify-center">
                        <Text className="text-[11px] text-secondary/70 uppercase">Category:</Text>
                        {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
                            <View key={key} className="flex-row items-center gap-1">
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                                <Text className="text-[11px] text-secondary capitalize">{key}</Text>
                            </View>
                        ))}
                    </View>

                    <View className="flex-row flex-wrap gap-3 justify-center">
                        <Text className="text-[11px] text-secondary/70 uppercase">Busyness glow:</Text>
                        <Legend level={0} label="Quiet" />
                        <Legend level={2} label="Moderate" />
                        <Legend level={5} label="Busy" />
                        <View className="flex-row items-center gap-1">
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CLOSED_COLOR }} />
                            <Text className="text-[11px] text-secondary">Closed (no glow)</Text>
                        </View>
                    </View>

                    <Text className="text-[11px] text-secondary">{points.length} locations shown</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function Legend({ level, label }) {
    const color = glowColorForLevel(level);
    return (
        <View className="flex-row items-center gap-1">
            <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                <View
                    style={{
                        position: "absolute",
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: `${color}22`,
                    }}
                />
                <View
                    style={{
                        position: "absolute",
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: `${color}80`,
                    }}
                />
            </View>
            <Text className="text-[11px] text-secondary">{label}</Text>
        </View>
    );
}