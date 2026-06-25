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

const storage = Platform.OS === "web" ? webStorage : AsyncStorage;

export default storage;
