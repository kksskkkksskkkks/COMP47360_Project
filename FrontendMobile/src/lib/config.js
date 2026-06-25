// Spring backend base URL.
//
// For Expo Go / physical devices and the Android emulator, "localhost"
// refers to the device itself, not your computer — you must use your
// computer's LAN IP (e.g. http://192.168.1.23:8080/api) so the phone can
// reach your dev machine. For the web preview (expo start --web) and the
// iOS simulator, "localhost" works fine.
//
// Easiest way to override without editing code: set EXPO_PUBLIC_API_BASE_URL
// in a .env file at the project root, e.g.:
//   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:8080/api
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

export const ASSET_BASE_URL =
  process.env.EXPO_PUBLIC_ASSET_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, "");
