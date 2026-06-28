import { View, Text, Pressable, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

// Shared category pill row + "Accessible" toggle, used by both the
// Recommendations and Gems list screens. Horizontal scroll instead of wrap,
// since mobile screens are narrower than the web layout this was ported from.
export default function FilterBar({
  categories,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  accessibleOnly,
  onToggleAccessible,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16, alignItems: "center" }}
    >
      <Pill
        label="All Gems"
        active={selectedCategories.length === 0}
        onPress={onClearCategories}
      />
      {categories.map((cat) => (
        <Pill
          key={cat.value}
          label={cat.label}
          active={selectedCategories.includes(cat.value)}
          onPress={() => onToggleCategory(cat.value)}
        />
      ))}
      <View className="w-px h-6 bg-outline-variant mx-1" />
      <Pressable
        onPress={onToggleAccessible}
        className="px-3 py-2 rounded-full flex-row items-center gap-1 border"
        style={{
          backgroundColor: accessibleOnly ? "#00685F1A" : "transparent",
          borderColor: accessibleOnly ? "#00685F33" : "#bcc9c6",
        }}
      >
        <MaterialIcons name="accessible" size={16} color={accessibleOnly ? "#008378" : "#565E74"} />
        <Text
          className="text-label-caps uppercase"
          style={{ color: accessibleOnly ? "#008378" : "#565E74" }}
        >
          Accessible
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Pill({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="px-3 py-2 rounded-full border"
      style={{
        backgroundColor: active ? "#00685F1A" : "transparent",
        borderColor: active ? "#00685F33" : "#bcc9c6",
      }}
    >
      <Text
        className="text-label-caps uppercase"
        style={{ color: active ? "#008378" : "#565E74" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
