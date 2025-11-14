import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Driver tab layout updated per requirement: Home, Find, Analysis, More
// Styling inspired by landing page (dark background + accent colors)
export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#60A5FA', // blue-400
        tabBarInactiveTintColor: '#9CA3AF', // gray-400
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#1F2937',
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={Platform.OS === 'ios' ? 'home-outline' : 'home'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="find"
        options={{
          title: 'Find',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={Platform.OS === 'ios' ? 'map-outline' : 'map'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analysis',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={Platform.OS === 'ios' ? 'analytics-outline' : 'stats-chart'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={Platform.OS === 'ios' ? 'ellipsis-horizontal' : 'menu'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
