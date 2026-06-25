import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RecommendationsScreen from "../screens/RecommendationsScreen";
import AttractionListScreen from "../screens/AttractionListScreen";
import AttractionDetailScreen from "../screens/AttractionDetailScreen";
import HeatMapScreen from "../screens/HeatMapScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Discover: "explore",
  Gems: "diamond",
  HeatMap: "map",
  Profile: "person",
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#00685F",
        tabBarInactiveTintColor: "#565E74",
        tabBarIcon: ({ color, size }) =>
          route.name === "Gems" ? (
            <MaterialCommunityIcons name="diamond-stone" size={size} color={color} />
          ) : (
            <MaterialIcons name={TAB_ICONS[route.name]} size={size} color={color} />
          ),
      })}
    >
      <Tab.Screen name="Discover" component={RecommendationsScreen} />
      <Tab.Screen name="Gems" component={AttractionListScreen} />
      <Tab.Screen name="HeatMap" component={HeatMapScreen} options={{ title: "Heat Map" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="AttractionDetail"
        component={AttractionDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#00685F" size="large" />
      </View>
    );
  }

  return user ? <AppStack /> : <AuthStack />;
}
