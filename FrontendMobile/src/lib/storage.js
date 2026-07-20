import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// @react-native-async-storage/async-storage's web implementation needs an
// extra polyfill step that this project doesn't have wired up, so calling it
// in the browser throws "AsyncStorage.default.multiSet is not a function" —
// that failure was previously getting swallowed by login()'s catch block and
// misreported as "Login failed", even though the actual network requests
// had already succeeded.
//
// Rather than chase that polyfill, this gives every caller the same
// multiGet/multiSet/multiRemove surface AsyncStorage has, backed by
// localStorage on web and the real AsyncStorage on iOS/Android — so nothing
// elsewhere in the app needs to know which platform it's running on.
const webStorage = {
  async getItem(key) {
    return window.localStorage.getItem(key);
  },
  async setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
  async removeItem(key) {
    window.localStorage.removeItem(key);
  },
  async multiGet(keys) {
    return keys.map((k) => [k, window.localStorage.getItem(k)]);
  },
  async multiSet(pairs) {
    pairs.forEach(([k, v]) => window.localStorage.setItem(k, v));
  },
  async multiRemove(keys) {
    keys.forEach((k) => window.localStorage.removeItem(k));
  },
};

// @react-native-async-storage/async-storage v3 renamed the batch methods:
//   multiGet    -> getMany   (and returns a Record<string, string|null> instead
//                              of an array of [key, value] pairs)
//   multiSet    -> setMany   (and takes a Record<string, string> instead of an
//                              array of [key, value] pairs)
//   multiRemove -> removeMany
// Rather than touch every call site, wrap the new API so it keeps exposing
// the old multiGet/multiSet/multiRemove names AND the old array-of-pairs
// shape that the rest of this app (AuthContext, api.js) already expects.
const nativeStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  async multiGet(keys) {
    const result = await AsyncStorage.getMany(keys);
    // Normalize to the old [key, value][] shape regardless of whether
    // getMany returns a Record or already an array of pairs.
    if (Array.isArray(result)) return result;
    return keys.map((k) => [k, result?.[k] ?? null]);
  },
  async multiSet(pairs) {
    const entries = Object.fromEntries(pairs);
    return AsyncStorage.setMany(entries);
  },
  async multiRemove(keys) {
    return AsyncStorage.removeMany(keys);
  },
};

const storage = Platform.OS === "web" ? webStorage : nativeStorage;

export default storage;