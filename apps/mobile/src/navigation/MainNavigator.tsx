import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '@/src/screens/main/HomeScreen';
import { FindScreen } from '@/src/screens/main/FindScreen';
import { HistoryScreen } from '@/src/screens/main/HistoryScreen';
import { MoreScreen } from '@/src/screens/main/MoreScreen';
import { ProfileScreen } from '@/src/screens/main/ProfileScreen';
import { SettingsScreen } from '@/src/screens/main/SettingsScreen';
import { NewRequestScreen } from '@/src/screens/request/NewRequestScreen';
import { SearchingScreen } from '@/src/screens/request/SearchingScreen';
import { ActiveJobScreen } from '@/src/screens/request/ActiveJobScreen';
import { RequestDetailScreen } from '@/src/screens/request/RequestDetailScreen';
import { BreakdownRequest } from '@/src/types';
import { Home, Search, History, Menu } from 'lucide-react-native';

interface MainNavigatorProps {
  onLogout: () => void;
}

type Tab = 'home' | 'find' | 'history' | 'more';
type RequestFlow =
  | 'none'
  | 'new-request'
  | 'searching'
  | 'active-job'
  | 'request-detail';

type MoreFlow = 'menu' | 'profile' | 'settings';

export function MainNavigator({ onLogout }: MainNavigatorProps) {
  const insets = useSafeAreaInsets();
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [requestFlow, setRequestFlow] = useState<RequestFlow>('none');
  const [moreFlow, setMoreFlow] = useState<MoreFlow>('menu');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<BreakdownRequest | null>(null);

  const handleRequestHelp = () => {
    setRequestFlow('new-request');
  };

  const handleRequestCreated = (requestId: string) => {
    setCurrentRequestId(requestId);
    setRequestFlow('searching');
  };

  const handleMechanicAccepted = () => {
    setRequestFlow('active-job');
  };

  const handleJobCompleted = () => {
    setRequestFlow('none');
    setCurrentRequestId(null);
    setCurrentTab('home');
  };

  const handleViewActiveJob = () => {
    if (currentRequestId) {
      setRequestFlow('active-job');
    }
  };

  const handleViewDetail = (request: BreakdownRequest) => {
    setSelectedRequest(request);
    setRequestFlow('request-detail');
  };

  const handleCloseDetail = () => {
    setSelectedRequest(null);
    setRequestFlow('none');
  };

  const handleCancelRequest = () => {
    setRequestFlow('none');
    setCurrentRequestId(null);
  };

  const handleNavigateToProfile = () => {
    setMoreFlow('profile');
  };

  const handleNavigateToSettings = () => {
    setMoreFlow('settings');
  };

  const handleBackToMore = () => {
    setMoreFlow('menu');
  };

  const handleEditProfile = () => {
    setMoreFlow('profile');
  };

  if (requestFlow === 'new-request') {
    return (
      <NewRequestScreen
        onRequestCreated={handleRequestCreated}
        onCancel={handleCancelRequest}
      />
    );
  }

  if (requestFlow === 'searching' && currentRequestId) {
    return (
      <SearchingScreen
        requestId={currentRequestId}
        onMechanicAccepted={handleMechanicAccepted}
      />
    );
  }

  if (requestFlow === 'active-job' && currentRequestId) {
    return (
      <ActiveJobScreen
        requestId={currentRequestId}
        onJobCompleted={handleJobCompleted}
      />
    );
  }

  if (requestFlow === 'request-detail' && selectedRequest) {
    return (
      <RequestDetailScreen
        request={selectedRequest}
        onClose={handleCloseDetail}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {currentTab === 'home' && (
          <HomeScreen
            onRequestHelp={handleRequestHelp}
            onViewActiveJob={handleViewActiveJob}
          />
        )}
        {currentTab === 'find' && <FindScreen />}
        {currentTab === 'history' && (
          <HistoryScreen onViewDetail={handleViewDetail} />
        )}
        {currentTab === 'more' && moreFlow === 'menu' && (
          <MoreScreen
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToSettings={handleNavigateToSettings}
            onLogout={onLogout}
          />
        )}
        {currentTab === 'more' && moreFlow === 'profile' && (
          <ProfileScreen
            onEditProfile={handleEditProfile}
            onLogout={onLogout}
            onBack={handleBackToMore}
          />
        )}
        {currentTab === 'more' && moreFlow === 'settings' && (
          <SettingsScreen onBack={handleBackToMore} />
        )}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentTab('home')}>
          <Home
            size={24}
            color={currentTab === 'home' ? '#007AFF' : '#8E8E93'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'home' && styles.tabLabelActive,
            ]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentTab('find')}>
          <Search
            size={24}
            color={currentTab === 'find' ? '#007AFF' : '#8E8E93'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'find' && styles.tabLabelActive,
            ]}>
            Find
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentTab('history')}>
          <History
            size={24}
            color={currentTab === 'history' ? '#007AFF' : '#8E8E93'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'history' && styles.tabLabelActive,
            ]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => setCurrentTab('more')}>
          <Menu
            size={24}
            color={currentTab === 'more' ? '#007AFF' : '#8E8E93'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'more' && styles.tabLabelActive,
            ]}>
            More
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
