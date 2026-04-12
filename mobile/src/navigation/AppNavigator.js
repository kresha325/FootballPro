import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/LoginScreen';
import FeedScreen from '../screens/FeedScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import GalleryScreen from '../screens/GalleryScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import WalletScreen from '../screens/WalletScreen';
import VideosScreen from '../screens/VideosScreen';
import InsightsScreen from '../screens/InsightsScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import ScoutingScreen from '../screens/ScoutingScreen';
import MoreScreen from '../screens/MoreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import BrowseProfilesScreen from '../screens/BrowseProfilesScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import GoLiveScreen from '../screens/GoLiveScreen';
import MessagingScreen from '../screens/MessagingScreen';
import ConversationScreen from '../screens/ConversationScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useAuth } from '../context/AuthContext';
import { messagingUnreadCountRequest, unreadNotificationsCountRequest } from '../api/client';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const MessagingStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();

const formatBadge = (value) => {
  const n = Number(value || 0);
  if (!n || n <= 0) return undefined;
  if (n > 99) return '99+';
  return n;
};

function MessagingNavigator() {
  return (
    <MessagingStack.Navigator>
      <MessagingStack.Screen name="MessagingHome" component={MessagingScreen} options={{ title: 'Messages' }} />
      <MessagingStack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Conversation' }} />
    </MessagingStack.Navigator>
  );
}

function FeedNavigator() {
  return (
    <FeedStack.Navigator>
      <FeedStack.Screen name="FeedHome" component={FeedScreen} options={{ title: 'Feed' }} />
      <FeedStack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'Create Post' }} />
      <FeedStack.Screen name="Gallery" component={GalleryScreen} options={{ title: 'My Gallery' }} />
    </FeedStack.Navigator>
  );
}

function ProfileNavigator() {
  const { logout } = useAuth();

  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="MyProfile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          headerRight: () => (
            <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 8 }}>
              <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Logout</Text>
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileStack.Screen name="BrowseProfiles" component={BrowseProfilesScreen} options={{ title: 'Browse Profiles' }} />
      <ProfileStack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Profile' }} />
    </ProfileStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <MoreStack.Screen name="Insights" component={InsightsScreen} options={{ title: 'Insights' }} />
      <MoreStack.Screen name="Tournaments" component={TournamentsScreen} options={{ title: 'Tournaments' }} />
      <MoreStack.Screen name="Scouting" component={ScoutingScreen} options={{ title: 'Scouting' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <MoreStack.Screen name="GoLive" component={GoLiveScreen} options={{ title: 'Go Live' }} />
    </MoreStack.Navigator>
  );
}

function AppTabs() {
  const [notificationsBadge, setNotificationsBadge] = React.useState(0);
  const [messagesBadge, setMessagesBadge] = React.useState(0);

  const refreshBadges = React.useCallback(async () => {
    try {
      const [notifRes, msgRes] = await Promise.all([
        unreadNotificationsCountRequest(),
        messagingUnreadCountRequest(),
      ]);
      setNotificationsBadge(Number(notifRes?.data?.count || notifRes?.data?.unread || 0));
      setMessagesBadge(Number(msgRes?.data?.count || msgRes?.data?.unreadCount || 0));
    } catch (_err) {
      // Keep previous badge values on failure.
    }
  }, []);

  React.useEffect(() => {
    refreshBadges();
    const id = setInterval(refreshBadges, 30000);
    return () => clearInterval(id);
  }, [refreshBadges]);

  useFocusEffect(
    React.useCallback(() => {
      refreshBadges();
    }, [refreshBadges])
  );

  return (
    <Tabs.Navigator
      screenListeners={{
        state: () => {
          refreshBadges();
        },
      }}
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#0f766e',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            Feed: 'home-outline',
            Marketplace: 'bag-outline',
            Videos: 'videocam-outline',
            Messages: 'chatbubble-ellipses-outline',
            More: 'grid-outline',
            Profile: 'person-outline',
          };
          const iconName = iconMap[route.name] || 'ellipse-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Feed" component={FeedNavigator} options={{ headerShown: false, tabBarLabel: 'Feed' }} />
      <Tabs.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: 'Marketplace', tabBarLabel: 'Market' }} />
      <Tabs.Screen name="Videos" component={VideosScreen} options={{ title: 'Videos' }} />
      <Tabs.Screen
        name="Messages"
        component={MessagingNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Chats',
          tabBarBadge: formatBadge(messagesBadge),
        }}
      />
      <Tabs.Screen
        name="More"
        component={MoreNavigator}
        options={{
          headerShown: false,
          tabBarBadge: formatBadge(notificationsBadge),
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Me',
        }}
      />
    </Tabs.Navigator>
  );
}

export default function AppNavigator() {
  const { token, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={AppTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
