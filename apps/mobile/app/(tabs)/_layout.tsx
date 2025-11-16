import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// Tab Bar Icon Component
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#60a5fa', // Blue-400
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
          backgroundColor: colors.background === '#fff' ? '#f9fafb' : '#111111',
          borderTopColor: colors.border || '#e5e7eb',
          borderTopWidth: 1,
        },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: colors.background === '#fff' ? '#ffffff' : '#000000',
          borderBottomColor: colors.border || '#e5e7eb',
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Help Now',
          tabBarIcon: ({ color }) => <TabBarIcon name="phone" color={color} />,
        }}
      />
      <Tabs.Screen
        name="find-help"
        options={{
          title: 'Find Help',
          tabBarIcon: ({ color }) => <TabBarIcon name="map-marker" color={color} />,
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color }) => <TabBarIcon name="location-arrow" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
