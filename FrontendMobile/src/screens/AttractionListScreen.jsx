import { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { attractionApi, mapApi, currentSnapshotTimeBucket, readBoolField } from "../lib/api";
import AttractionCard from "../components/AttractionCard";
import FilterBar from "../components/FilterBar";

const categories = [
  { label: "Park", value: "park" },
  { label: "Culture", value: "culture" },
  { label: "Landmark", value: "landmark" },
  { label: "Museum", value: "museum" },
];

const ACCESSIBLE_FILTER_VALUE = 1;
const PAGE_SIZE = 20;

export default function AttractionListScreen() {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [attractions, setAttractions] = useState([]);
  const [statusById, setStatusById] = useState({});
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function toggleCategory(value) {
    setSelectedCategories((prev) =>
        prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  // Whenever a filter changes, reset to page 0 and load in the same effect
  // pass (rather than two separate effects) — otherwise the "load" effect
  // can fire once with the *old* page number before the "reset page" effect's
  // setPage(0) has taken effect, briefly requesting a stale/out-of-range page
  // with the new filters and appending mismatched (sometimes empty) results.
  useEffect(() => {
    setPage(0);
    loadPage({ pageToLoad: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, accessibleOnly, search]);

  useEffect(() => {
    if (page === 0) return; // already handled by the effect above
    loadPage({ pageToLoad: page, append: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function loadPage({ pageToLoad, append, isRefresh = false }) {
    if (append) setLoadingMore(true);
    else if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg("");

    const params = {
      page: pageToLoad,
      size: PAGE_SIZE,
      ...(search ? { keyword: search } : {}),
      ...(selectedCategories.length ? { category: selectedCategories } : {}),
      ...(accessibleOnly ? { wheelchair: ACCESSIBLE_FILTER_VALUE } : {}),
    };

    Promise.all([attractionApi.list(params), mapApi.attractions(currentSnapshotTimeBucket())])
        .then(([listRes, mapRes]) => {
          const pageData = listRes.data;
          const snapshot = mapRes.data || [];

          const statusMap = append ? { ...statusById } : {};
          snapshot.forEach((p) => {
            statusMap[p.id] = {
              isOpen: readBoolField(p, "isOpen", "open"),
              busynessLevel: p.busynessLevel,
            };
          });

          setAttractions((prev) => (append ? [...prev, ...(pageData.content || [])] : pageData.content || []));
          setStatusById(statusMap);
          setTotalPages(pageData.totalPages ?? 0);
        })
        .catch((err) => {
          setErrorMsg(
              err.response?.data?.message || "Failed to load. Check that the backend is running and CORS is configured."
          );
        })
        .finally(() => {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        });
  }

  function handleEndReached() {
    if (loadingMore || loading || page + 1 >= totalPages) return;
    setPage((p) => p + 1);
  }

  function handleRefresh() {
    setPage(0);
    loadPage({ pageToLoad: 0, append: false, isRefresh: true });
  }

  return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="px-4 pt-4 pb-3 gap-3">
          <Text className="text-display-lg text-on-surface font-bold">Curated Gems</Text>

          <View className="relative">
            <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
              <MaterialIcons name="search" size={20} color="#565E74" />
            </View>
            <TextInput
                className="w-full bg-[#F1F5F9] text-on-surface text-body-md rounded-lg pl-10 pr-4 py-3"
                placeholder="Search curated locations..."
                placeholderTextColor="#565E7499"
                value={search}
                onChangeText={setSearch}
            />
          </View>

          <FilterBar
              categories={categories}
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              onClearCategories={() => setSelectedCategories([])}
              accessibleOnly={accessibleOnly}
              onToggleAccessible={() => setAccessibleOnly((v) => !v)}
          />
        </View>

        {loading && attractions.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#00685F" />
            </View>
        ) : errorMsg ? (
            <Text className="text-error px-4">{errorMsg}</Text>
        ) : (
            <FlatList
                data={attractions}
                keyExtractor={(a) => String(a.id)}
                contentContainerStyle={{ padding: 16, paddingTop: 0 }}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00685F" />
                }
                onEndReachedThreshold={0.4}
                onEndReached={handleEndReached}
                ListHeaderComponent={
                  loading ? (
                      <View className="py-3">
                        <ActivityIndicator color="#00685F" />
                      </View>
                  ) : null
                }
                ListEmptyComponent={
                  loading ? null : <Text className="text-secondary">No locations match these filters.</Text>
                }
                ListFooterComponent={
                  loadingMore ? (
                      <View className="py-4">
                        <ActivityIndicator color="#00685F" />
                      </View>
                  ) : null
                }
                renderItem={({ item: a }) => {
                  const status = statusById[a.id];
                  return (
                      <AttractionCard
                          attraction={a}
                          isOpen={status?.isOpen}
                          busynessLevel={status?.busynessLevel ?? null}
                      />
                  );
                }}
            />
        )}
      </SafeAreaView>
  );
}
