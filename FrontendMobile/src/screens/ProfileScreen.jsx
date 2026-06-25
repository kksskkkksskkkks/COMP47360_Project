import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  authApi,
  activityStatsApi,
  favoriteApi,
  checkinApi,
  ratingApi,
  attractionApi,
  mapApi,
  currentSnapshotTimeBucket,
  readBoolField,
  isSessionExpired,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AttractionCard from "../components/AttractionCard";

function pick(obj, keys, fallback = null) {
  if (!obj) return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CheckinRow({ c, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-container-lowest p-3 rounded-lg flex-row items-center justify-between mb-2"
      style={{ shadowColor: "#00685F", shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 }}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
          <MaterialIcons name="location-on" size={20} color="#00685F" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-body-md text-on-surface" numberOfLines={1}>
            {c.attraction?.name || "Unknown location"}
          </Text>
          <Text className="text-secondary text-[13px]">{formatDate(c.visitedAt)}</Text>
        </View>
      </View>
      {c.busynessAtVisit != null && (
        <Text className="text-label-caps text-secondary uppercase">Level {c.busynessAtVisit}/5</Text>
      )}
    </Pressable>
  );
}

function RatingRow({ r, onPress }) {
  const score = Math.round(Number(r.rating) || 0);
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-container-lowest p-3 rounded-lg flex-row items-center justify-between mb-2"
      style={{ shadowColor: "#00685F", shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 }}
    >
      <View className="flex-1">
        <Text className="font-semibold text-body-md text-on-surface" numberOfLines={1}>
          {r.attraction?.name || "Unknown location"}
        </Text>
        <Text className="text-secondary text-[13px]">{formatDate(r.updatedAt || r.createdAt)}</Text>
      </View>
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialIcons
            key={star}
            name={star <= score ? "star" : "star-border"}
            size={16}
            color={star <= score ? "#00685F" : "#bcc9c6"}
          />
        ))}
      </View>
    </Pressable>
  );
}

function EditProfileModal({ visible, onClose, user, highContrast, onSaved, onSessionExpired }) {
  const { login } = useAuth();
  const [tab, setTab] = useState("general");

  const [draftUsername, setDraftUsername] = useState(user.username);
  const [draftEmail, setDraftEmail] = useState(user.email);
  const [draftHighContrast, setDraftHighContrast] = useState(highContrast);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTab("general");
    setDraftUsername(user.username);
    setDraftEmail(user.email);
    setDraftHighContrast(highContrast);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
  }, [visible, user, highContrast]);

  async function handleSave() {
    setError("");

    if (await isSessionExpired()) {
      onSessionExpired();
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setTab("security");
      setError("New passwords do not match.");
      return;
    }
    if (newPassword && !currentPassword) {
      setTab("security");
      setError("Enter your current password to set a new one.");
      return;
    }

    setSaving(true);
    try {
      let latestUser = user;

      if (draftUsername !== user.username) {
        const res = await authApi.updateUsername(draftUsername);
        latestUser = res.data;
      }
      if (draftEmail !== user.email) {
        const res = await authApi.updateEmail(draftEmail);
        latestUser = res.data;
      }
      if (draftHighContrast !== highContrast) {
        const res = await authApi.updateHighContrast(draftHighContrast);
        latestUser = res.data;
      }

      if (newPassword) {
        try {
          await authApi.changePassword(currentPassword, newPassword);
        } catch (err) {
          const backendMessage = err.response?.data?.message;
          if (backendMessage) throw new Error(backendMessage);
          if (err.response?.status === 403) {
            throw new Error("Current password does not match. Please try again.");
          }
          throw new Error("Failed to change password. Please try again.");
        }

        const ok = await login(latestUser.email, newPassword);
        if (!ok) {
          throw new Error("Password changed, but automatic re-login failed. Please sign in again.");
        }
        onClose();
      } else {
        onSaved(latestUser);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-on-background/40 justify-center px-4">
        <View
          className="bg-surface-container-lowest rounded-xl overflow-hidden"
          style={{ maxHeight: "85%" }}
        >
          <View className="px-4 pt-4 flex-row items-center justify-between">
            <Text className="text-headline-md text-on-surface">Edit Profile</Text>
            <Pressable onPress={onClose} className="p-1">
              <MaterialIcons name="close" size={20} color="#565E74" />
            </Pressable>
          </View>

          <View className="flex-row border-b border-outline-variant/30 px-4 mt-3">
            <Pressable
              onPress={() => {
                setTab("general");
                setError("");
              }}
              className="px-4 py-2"
              style={tab === "general" ? { borderBottomWidth: 2, borderColor: "#00685F" } : {}}
            >
              <Text style={{ color: tab === "general" ? "#00685F" : "#565E74", fontWeight: tab === "general" ? "600" : "400" }}>
                General
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setTab("security");
                setError("");
              }}
              className="px-4 py-2"
              style={tab === "security" ? { borderBottomWidth: 2, borderColor: "#00685F" } : {}}
            >
              <Text style={{ color: tab === "security" ? "#00685F" : "#565E74", fontWeight: tab === "security" ? "600" : "400" }}>
                Security
              </Text>
            </Pressable>
          </View>

          <ScrollView className="px-4 py-4" style={{ maxHeight: 380 }}>
            {tab === "general" && (
              <View className="gap-4">
                <View>
                  <Text className="text-label-caps text-on-surface-variant mb-1 uppercase">Username</Text>
                  <TextInput
                    value={draftUsername}
                    onChangeText={setDraftUsername}
                    maxLength={64}
                    className="px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                  />
                </View>

                <View className="flex-row items-center justify-between pt-3 border-t border-outline-variant/30">
                  <View className="flex-1 mr-3">
                    <Text className="font-medium text-body-md text-on-surface">High Contrast Mode</Text>
                    <Text className="text-secondary text-[13px]">Increases contrast for better readability.</Text>
                  </View>
                  <Switch
                    value={draftHighContrast}
                    onValueChange={setDraftHighContrast}
                    trackColor={{ true: "#00685F", false: "#bcc9c6" }}
                  />
                </View>
              </View>
            )}

            {tab === "security" && (
              <View className="gap-4">
                <View>
                  <Text className="text-label-caps text-on-surface-variant mb-1 uppercase">Email Address</Text>
                  <TextInput
                    value={draftEmail}
                    onChangeText={setDraftEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                  />
                </View>

                <View className="h-px bg-outline-variant/30" />

                <View>
                  <Text className="text-label-caps text-secondary uppercase mb-2">Change Password</Text>
                  <View className="gap-3">
                    <View>
                      <Text className="text-[13px] font-medium text-on-surface-variant mb-1">Current Password</Text>
                      <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        placeholder="••••••••"
                        className="px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                      />
                    </View>
                    <View>
                      <Text className="text-[13px] font-medium text-on-surface-variant mb-1">New Password</Text>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        maxLength={128}
                        placeholder="6-128 characters"
                        className="px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                      />
                    </View>
                    <View>
                      <Text className="text-[13px] font-medium text-on-surface-variant mb-1">Confirm New Password</Text>
                      <TextInput
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                        secureTextEntry
                        maxLength={128}
                        placeholder="6-128 characters"
                        className="px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {error && <Text className="text-error text-[13px] mt-3">{error}</Text>}
          </ScrollView>

          <View className="px-4 py-3 border-t border-outline-variant/30 flex-row justify-end gap-3">
            <Pressable onPress={onClose} disabled={saving} className="px-4 py-2.5 rounded-lg border border-outline-variant/50">
              <Text className="text-secondary font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg bg-primary flex-row items-center gap-2"
              style={saving ? { opacity: 0.6 } : {}}
            >
              <MaterialIcons name="check" size={16} color="#fff" />
              <Text className="text-on-primary font-medium">{saving ? "Saving…" : "Save Changes"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { user, setUserLocal, logout } = useAuth();
  const navigation = useNavigation();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [favorites, setFavorites] = useState([]);
  const [favoriteStatusById, setFavoriteStatusById] = useState({});
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState("");

  const [recentCheckins, setRecentCheckins] = useState([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);

  const [recentRatings, setRecentRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  const highContrast = readBoolField(user || {}, "isHighContrast", "highContrast", false);

  const [editOpen, setEditOpen] = useState(false);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;

    activityStatsApi
      .get(user.id)
      .then((res) => active && setStats(res.data))
      .catch(() => {})
      .finally(() => active && setStatsLoading(false));

    favoriteApi
      .list(user.id)
      .then((res) => {
        if (!active) return;
        const favs = extractList(res.data);
        if (favs.length === 0) return [[], []];
        return Promise.all([
          Promise.all(
            favs.map((f) =>
              attractionApi
                .detail(f.attractionId)
                .then((r) => r.data)
                .catch(() => null)
            )
          ),
          mapApi
            .attractions(currentSnapshotTimeBucket())
            .then((r) => r.data || [])
            .catch(() => []),
        ]);
      })
      .then(([attractions, snapshot]) => {
        if (!active) return;
        const statusMap = {};
        (snapshot || []).forEach((p) => {
          statusMap[p.id] = {
            isOpen: readBoolField(p, "isOpen", "open"),
            busynessLevel: p.busynessLevel,
          };
        });
        setFavorites((attractions || []).filter(Boolean));
        setFavoriteStatusById(statusMap);
      })
      .catch((err) => active && setFavoritesError(err.response?.data?.message || "Failed to load favorites."))
      .finally(() => active && setFavoritesLoading(false));

    checkinApi
      .listByUser(user.id, { size: 5, sort: "visitedAt,desc" })
      .then((res) => {
        if (!active) return;
        const list = extractList(res.data);
        if (list.length === 0) return [];
        return Promise.all(
          list.map((c) =>
            attractionApi
              .detail(c.attractionId)
              .then((r) => ({ ...c, attraction: r.data }))
              .catch(() => ({ ...c, attraction: null }))
          )
        );
      })
      .then((items) => active && setRecentCheckins(items || []))
      .catch(() => {})
      .finally(() => active && setCheckinsLoading(false));

    ratingApi
      .listByUser(user.id, { size: 5, sort: "updatedAt,desc" })
      .then((res) => {
        if (!active) return;
        const list = extractList(res.data);
        if (list.length === 0) return [];
        return Promise.all(
          list.map((r) =>
            attractionApi
              .detail(r.attractionId)
              .then((res2) => ({ ...r, attraction: res2.data }))
              .catch(() => ({ ...r, attraction: null }))
          )
        );
      })
      .then((items) => active && setRecentRatings(items || []))
      .catch(() => {})
      .finally(() => active && setRatingsLoading(false));

    return () => {
      active = false;
    };
  }, [user]);

  function handleProfileSaved(latestUser) {
    setUserLocal(latestUser);
    setEditOpen(false);
  }

  async function handleLogoutAll() {
    setLogoutAllBusy(true);
    try {
      await authApi.logoutAll();
    } catch (err) {
      console.error(err);
    } finally {
      setLogoutAllBusy(false);
      logout();
    }
  }

  function handleSessionExpired() {
    setEditOpen(false);
    logout();
  }

  if (!user) return null;

  const favoritesCount = pick(stats, ["favoriteCount"], favorites.length);
  const visitedPlaceCount = pick(stats, ["visitedPlaceCount"], null);
  const ratingsCount = pick(stats, ["ratingCount"], null);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      <View className="flex-row items-center gap-4 mb-4">
        <View className="w-16 h-16 rounded-full bg-primary items-center justify-center">
          <Text className="text-headline-md text-on-primary font-bold">
            {user.username?.[0]?.toUpperCase() || "U"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-headline-lg text-on-surface font-bold" numberOfLines={1}>
            {user.username}
          </Text>
          <Text className="text-body-md text-secondary" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3 mb-5">
        <Pressable
          onPress={() => setEditOpen(true)}
          className="flex-1 py-2.5 border border-primary rounded-lg items-center"
        >
          <Text className="text-primary font-medium">Edit Profile</Text>
        </Pressable>
        <Pressable onPress={() => logout()} className="px-4 py-2.5 items-center justify-center">
          <Text className="text-secondary font-medium">Log Out</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleLogoutAll} disabled={logoutAllBusy} className="mb-5">
        <Text className="text-error text-body-md" style={logoutAllBusy ? { opacity: 0.6 } : {}}>
          {logoutAllBusy ? "Signing out everywhere…" : "Log Out Everywhere"}
        </Text>
      </Pressable>

      {/* Activity stats */}
      <View className="flex-row gap-3 mb-6">
        {[
          { label: "Favorites", value: favoritesCount, icon: "favorite" },
          { label: "Visited", value: visitedPlaceCount, icon: "check-circle" },
          { label: "Ratings", value: ratingsCount, icon: "star" },
        ].map((stat) => (
          <View
            key={stat.label}
            className="flex-1 bg-surface-container-lowest rounded-xl p-3 items-center gap-1"
            style={{ shadowColor: "#00685F", shadowOpacity: 0.04, shadowRadius: 12, elevation: 1 }}
          >
            <MaterialIcons name={stat.icon} size={22} color="#00685F" />
            <Text className="text-stats-numeric text-on-surface font-semibold">
              {statsLoading ? "—" : stat.value ?? "—"}
            </Text>
            <Text className="text-[10px] text-secondary uppercase">{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent check-ins */}
      <View className="mb-6">
        <Text className="text-headline-md text-on-surface mb-3 pb-2 border-b border-outline-variant/30">
          Recent Check-Ins
        </Text>
        {checkinsLoading ? (
          <ActivityIndicator color="#00685F" />
        ) : recentCheckins.length === 0 ? (
          <Text className="text-secondary text-[13px]">No check-ins yet.</Text>
        ) : (
          recentCheckins.map((c) => (
            <CheckinRow
              key={c.id}
              c={c}
              onPress={() => c.attraction && navigation.navigate("AttractionDetail", { id: c.attraction.id })}
            />
          ))
        )}
      </View>

      {/* Recent ratings */}
      <View className="mb-6">
        <Text className="text-headline-md text-on-surface mb-3 pb-2 border-b border-outline-variant/30">
          Recent Ratings
        </Text>
        {ratingsLoading ? (
          <ActivityIndicator color="#00685F" />
        ) : recentRatings.length === 0 ? (
          <Text className="text-secondary text-[13px]">No ratings yet.</Text>
        ) : (
          recentRatings.map((r) => (
            <RatingRow
              key={r.id}
              r={r}
              onPress={() => r.attraction && navigation.navigate("AttractionDetail", { id: r.attraction.id })}
            />
          ))
        )}
      </View>

      {/* Favorites */}
      <View>
        <Text className="text-headline-md text-on-surface mb-3">Your Favorites</Text>
        {favoritesLoading ? (
          <ActivityIndicator color="#00685F" />
        ) : favoritesError ? (
          <Text className="text-error">{favoritesError}</Text>
        ) : favorites.length === 0 ? (
          <Text className="text-secondary">
            No favorites yet — save a gem from its detail page and it'll show up here.
          </Text>
        ) : (
          favorites.map((a) => (
            <AttractionCard
              key={a.id}
              attraction={a}
              isOpen={favoriteStatusById[a.id]?.isOpen ?? null}
              busynessLevel={favoriteStatusById[a.id]?.busynessLevel ?? null}
            />
          ))
        )}
      </View>

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        highContrast={highContrast}
        onSaved={handleProfileSaved}
        onSessionExpired={handleSessionExpired}
      />
    </ScrollView>
  );
}
