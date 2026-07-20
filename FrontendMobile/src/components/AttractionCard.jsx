import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { resolveImage } from "../lib/image";

// wheelchair: 2 = fully accessible, 1 = limited access, 0 = not accessible
export const WHEELCHAIR = { NO: 0, LIMITED: 1, YES: 2 };

// Same tier colors as the busyness chart / heat map glow, so "quiet" /
// "moderate" / "busy" mean the same color everywhere in the app.
function levelColor(level) {
  if (level <= 2) return "#00685F"; // emerald — quiet (1-2)
  if (level <= 3) return "#D97706"; // gold — moderate (3)
  return "#f26a4b"; // coral — busy (4-5)
}

export function CrowdBars({ level, isOpen }) {
  // Closed locations don't have a meaningful "how busy is it" — show all
  // five bars in the same light, unfilled tint used by the "Quiet" tier,
  // instead of coloring them by level.
  if (isOpen === false) {
    return (
        <View className="flex-row gap-[2px]">
          {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ width: 8, height: 16, borderRadius: 8, backgroundColor: "#00685F33" }} />
          ))}
        </View>
    );
  }

  if (level == null) {
    return <Text className="text-secondary text-[12px]">--</Text>;
  }
  const color = levelColor(level);
  return (
      <View className="flex-row gap-[2px]">
        {[1, 2, 3, 4, 5].map((i) => (
            <View
                key={i}
                style={{
                  width: 8,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: i <= level ? color : `${color}33`,
                }}
            />
        ))}
      </View>
  );
}

// Shared card used on the list screen and the recommendations timeline.
// `isOpen`/`busynessLevel` aren't on every attraction shape (AttractionDTO vs
// RecommendedAttractionDTO), so they're passed in explicitly rather than read
// off `attraction` directly.
export default function AttractionCard({ attraction, isOpen, busynessLevel }) {
  const a = attraction;
  const navigation = useNavigation();

  return (
      <Pressable
          onPress={() => navigation.navigate("AttractionDetail", { id: a.id })}
          className="bg-surface-container-lowest rounded-xl overflow-hidden border border-transparent active:opacity-90"
          style={{
            shadowColor: "#00685F",
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            marginBottom: 16,
          }}
      >
        <View style={{ height: 180 }} className="relative overflow-hidden">
          <Image
              source={{ uri: resolveImage(a.imagePath) }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
          />
          <View className="absolute top-sm right-sm bg-surface-container-lowest/90 px-xs py-[6px] rounded-full flex-row items-center gap-1">
            <MaterialIcons name="star" size={14} color="#F59E0B" />
            <Text className="font-semibold text-[13px] text-on-surface">
              {a.avgRating != null ? a.avgRating.toFixed(1) : "--"}
            </Text>
          </View>
          {a.category && (
              <View className="absolute top-sm left-sm bg-primary/90 px-xs py-[5px] rounded-full">
                <Text className="text-[10px] uppercase text-on-primary tracking-wider font-medium">
                  {a.category}
                </Text>
              </View>
          )}
        </View>

        <View className="p-md">
          <View className="flex-row justify-between items-start mb-1">
            <Text numberOfLines={1} className="flex-1 font-headline-md text-headline-md text-on-surface mr-2">
              {a.name}
            </Text>
            {(a.wheelchair === WHEELCHAIR.YES || a.wheelchair === WHEELCHAIR.LIMITED) && (
                <MaterialIcons
                    name="accessible"
                    size={20}
                    color={a.wheelchair === WHEELCHAIR.YES ? "#565E74" : "#565E7499"}
                />
            )}
          </View>

          <View className="mt-2 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-label-caps uppercase text-secondary tracking-wider">
                Crowd Level
              </Text>
              <CrowdBars level={busynessLevel} isOpen={isOpen} />
            </View>
            <View className="flex-row items-center gap-2">
              <View
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isOpen ? "#00685F" : "#565E74" }}
              />
              <Text
                  className="text-[13px] font-medium"
                  style={{ color: isOpen ? "#008378" : "#565E74" }}
              >
                {isOpen == null ? "Status unknown" : isOpen ? "Open Now" : "Closed"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
  );
}
