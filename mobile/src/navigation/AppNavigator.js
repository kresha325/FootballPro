import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/LoginScreen';
import FeedScreen from '../screens/FeedScreen';
import FeedPostPagerScreen from '../screens/FeedPostPagerScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import GalleryScreen from '../screens/GalleryScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import CartScreen from '../screens/CartScreen';
import CreateProductScreen from '../screens/CreateProductScreen';
import EditProductScreen from '../screens/EditProductScreen';
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
import OutgoingCallScreen from '../screens/OutgoingCallScreen';
import GoLiveScreen from '../screens/GoLiveScreen';
import MessagingScreen from '../screens/MessagingScreen';
import ConversationScreen from '../screens/ConversationScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SponsorsScreen from '../screens/SponsorsScreen';
import AdsScreen from '../screens/AdsScreen';
import SearchScreen from '../screens/SearchScreen';
import MatchesScreen from '../screens/MatchesScreen';
import PremiumScreen from '../screens/PremiumScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ClubRosterScreen from '../screens/ClubRosterScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ParentVerificationScreen from '../screens/ParentVerificationScreen';
import LiveViewerScreen from '../screens/LiveViewerScreen';
import NotificationHeaderButton from '../components/NotificationHeaderButton';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { messagingUnreadCountRequest } from '../api/client';
import { APP_BRAND_NAME } from '../config/branding';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const MessagingStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const MarketplaceStack = createNativeStackNavigator();

const formatBadge = (value) => {
  const n = Number(value || 0);
  if (!n || n <= 0) return undefined;
  if (n > 99) return '99+';
  return n;
};

function MessagingNavigator() {
  return (
    <MessagingStack.Navigator
      screenOptions={{
        headerTitle: APP_BRAND_NAME,
        headerTitleAlign: 'center',
        headerRight: () => <NotificationHeaderButton />,
      }}
    >
      <MessagingStack.Screen name="MessagingHome" component={MessagingScreen} options={{ title: APP_BRAND_NAME }} />
      <MessagingStack.Screen name="Conversation" component={ConversationScreen} options={{ title: APP_BRAND_NAME }} />
    </MessagingStack.Navigator>
  );
}

function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={{ headerTitle: APP_BRAND_NAME, headerTitleAlign: 'center' }}>
      <FeedStack.Screen name="FeedHome" component={FeedScreen} options={{ title: APP_BRAND_NAME }} />
      <FeedStack.Screen name="FeedPostPager" component={FeedPostPagerScreen} options={{ headerShown: false }} />
      <FeedStack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: APP_BRAND_NAME, headerRight: () => <NotificationHeaderButton /> }}
      />
      <FeedStack.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ title: APP_BRAND_NAME, headerRight: () => <NotificationHeaderButton /> }}
      />
    </FeedStack.Navigator>
  );
}

function MarketplaceNavigator() {
  return (
    <MarketplaceStack.Navigator
      screenOptions={({ route }) => ({
        headerTitle: APP_BRAND_NAME,
        headerTitleAlign: 'center',
        ...(route.name !== 'MarketplaceHome' ? { headerRight: () => <NotificationHeaderButton /> } : {}),
      })}
    >
      <MarketplaceStack.Screen name="MarketplaceHome" component={MarketplaceScreen} options={{ title: 'Marketplace' }} />
      <MarketplaceStack.Screen
        name="CreateProduct"
        component={CreateProductScreen}
        options={{ title: 'Shto produkt' }}
      />
      <MarketplaceStack.Screen
        name="EditProduct"
        component={EditProductScreen}
        options={{ title: 'Ndrysho produktin' }}
      />
      <MarketplaceStack.Screen name="Cart" component={CartScreen} options={{ title: 'Shporta' }} />
    </MarketplaceStack.Navigator>
  );
}

function ProfileNavigator() {
  const { logout } = useAuth();

  return (
    <ProfileStack.Navigator screenOptions={{ headerTitle: APP_BRAND_NAME, headerTitleAlign: 'center' }}>
      <ProfileStack.Screen
        name="MyProfile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
              <NotificationHeaderButton />
              <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 8 }}>
                <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Logout</Text>
                </View>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: APP_BRAND_NAME }} />
      <ProfileStack.Screen name="BrowseProfiles" component={BrowseProfilesScreen} options={{ title: APP_BRAND_NAME }} />
      <ProfileStack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: APP_BRAND_NAME }} />
      <ProfileStack.Screen
        name="OutgoingCall"
        component={OutgoingCallScreen}
        options={{ title: 'Thirrje', headerBackTitleVisible: true }}
      />
    </ProfileStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerTitle: APP_BRAND_NAME,
        headerTitleAlign: 'center',
        headerRight: () => <NotificationHeaderButton />,
      }}
    >
      <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Wallet" component={WalletScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Insights" component={InsightsScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Tournaments" component={TournamentsScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Videos" component={VideosScreen} options={{ title: 'Videos' }} />
      <MoreStack.Screen name="Scouting" component={ScoutingScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="GoLive" component={GoLiveScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Sponsors" component={SponsorsScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Ads" component={AdsScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Search" component={SearchScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Matches" component={MatchesScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Premium" component={PremiumScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="ClubRoster" component={ClubRosterScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="ParentVerification" component={ParentVerificationScreen} options={{ title: APP_BRAND_NAME }} />
      <MoreStack.Screen name="LiveViewer" component={LiveViewerScreen} options={{ title: APP_BRAND_NAME }} />
    </MoreStack.Navigator>
  );
}

function AppTabs() {
  const { getSocket } = useAuth();
  const { totalPieces } = useCart();
  const [messagesBadge, setMessagesBadge] = React.useState(0);

  const refreshBadges = React.useCallback(async () => {
    try {
      const msgRes = await messagingUnreadCountRequest();
      setMessagesBadge(
        Number(msgRes?.data?.count ?? msgRes?.data?.unreadCount ?? msgRes?.data?.unread ?? 0)
      );
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

  React.useEffect(() => {
    const socket = getSocket?.();
    if (!socket) return undefined;
    const bumpMessages = () => {
      refreshBadges();
    };
    socket.on('newMessage', bumpMessages);
    socket.on('messageUpdated', bumpMessages);
    socket.on('messageDeleted', bumpMessages);
    return () => {
      socket.off('newMessage', bumpMessages);
      socket.off('messageUpdated', bumpMessages);
      socket.off('messageDeleted', bumpMessages);
    };
  }, [getSocket, refreshBadges]);

  return (
    <Tabs.Navigator
        screenListeners={{
          state: () => {
            refreshBadges();
          },
        }}
        screenOptions={({ route }) => ({
          headerTitle: APP_BRAND_NAME,
          headerTitleAlign: 'center',
          tabBarActiveTintColor: '#0f766e',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, size }) => {
            const iconMap = {
              Feed: 'home-outline',
              Marketplace: 'cart-outline',
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
      <Tabs.Screen
        name="Marketplace"
        component={MarketplaceNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Market',
          tabBarBadge: formatBadge(totalPieces),
        }}
      />
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
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Me',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Profile', { screen: 'MyProfile' });
          },
        })}
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
