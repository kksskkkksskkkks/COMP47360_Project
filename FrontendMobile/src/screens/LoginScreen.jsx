import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const { login, register, loading, error } = useAuth();
  const isLogin = mode === "login";

  async function handleSubmit() {
    setLocalError("");

    if (!isLogin && password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    if (isLogin) {
      await login(email, password);
    } else {
      await register(username, email, password);
    }
    // On success, the root navigator swaps to the main app automatically
    // because `user` becomes non-null in AuthContext — no manual navigate
    // needed here.
  }

  return (
      <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-background"
      >
        <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }}
            keyboardShouldPersistTaps="handled"
        >
          <View
              className="w-full bg-surface-container-lowest rounded-xl p-lg"
              style={{
                shadowColor: "#00685F",
                shadowOpacity: 0.08,
                shadowRadius: 30,
                shadowOffset: { width: 0, height: 10 },
                elevation: 3,
              }}
          >
            <View className="items-center mb-lg">
              <Text className="text-headline-md font-bold text-primary">Gem Finder</Text>
            </View>

            {/* Tabs */}
            <View className="flex-row border-b border-outline-variant mb-md">
              <Pressable onPress={() => setMode("login")} className="flex-1 pb-2">
                <Text
                    className={
                      isLogin
                          ? "text-center text-label-caps uppercase text-primary font-semibold"
                          : "text-center text-label-caps uppercase text-secondary"
                    }
                    style={isLogin ? { borderBottomWidth: 2, borderColor: "#00685F", paddingBottom: 8 } : {}}
                >
                  Login
                </Text>
              </Pressable>
              <Pressable onPress={() => setMode("signup")} className="flex-1 pb-2">
                <Text
                    className={
                      !isLogin
                          ? "text-center text-label-caps uppercase text-primary font-semibold"
                          : "text-center text-label-caps uppercase text-secondary"
                    }
                    style={!isLogin ? { borderBottomWidth: 2, borderColor: "#00685F", paddingBottom: 8 } : {}}
                >
                  Sign Up
                </Text>
              </Pressable>
            </View>

            <Text className="text-headline-md text-on-surface mb-1">
              {isLogin ? "Welcome Back" : "Create an Account"}
            </Text>
            <Text className="text-body-md text-secondary mb-md">
              {isLogin
                  ? "Enter your details to access your curated gems."
                  : "Join the exclusive community of explorers."}
            </Text>

            <View className="gap-3">
              {!isLogin && (
                  <View>
                    <Text className="text-label-caps uppercase text-on-surface-variant mb-1">
                      Username
                    </Text>
                    <TextInput
                        className="w-full px-4 py-3 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                        placeholder="3-64 characters"
                        placeholderTextColor="#565E7480"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        maxLength={64}
                    />
                  </View>
              )}

              <View>
                <Text className="text-label-caps uppercase text-on-surface-variant mb-1">
                  Email Address
                </Text>
                <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                    placeholder="name@example.com"
                    placeholderTextColor="#565E7480"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
              </View>

              <View>
                <Text className="text-label-caps uppercase text-on-surface-variant mb-1">
                  Password
                </Text>
                <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                    placeholder={isLogin ? "••••••••" : "6-128 characters"}
                    placeholderTextColor="#565E7480"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    maxLength={128}
                />
              </View>

              {!isLogin && (
                  <View>
                    <Text className="text-label-caps uppercase text-on-surface-variant mb-1">
                      Confirm Password
                    </Text>
                    <TextInput
                        className="w-full px-4 py-3 rounded-lg bg-surface-container-low text-on-surface text-body-md"
                        placeholder="6-128 characters"
                        placeholderTextColor="#565E7480"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        maxLength={128}
                    />
                  </View>
              )}

              {Boolean(localError || error) && (
                  <Text className="text-error text-[14px]">{localError || error}</Text>
              )}

              <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-primary items-center mt-1 active:opacity-90"
                  style={loading ? { opacity: 0.6 } : {}}
              >
                <Text className="text-on-primary font-semibold text-body-md">
                  {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
  );
}