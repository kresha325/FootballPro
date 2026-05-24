import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/LoginScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
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
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import ScoutingScreen from '../screens/ScoutingScreen';
import MoreScreen from '../screens/MoreScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import BrowseProfilesScreen from '../screens/BrowseProfilesScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import OutgoingCallScreen from '../screens/OutgoingCallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import IncomingCallListener from '../components/IncomingCallListener';
import { navigationRef } from './navigationRef';
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
import { APP_BRAND_NAME } from '../config/branding';
import { absoluteBackendUrl } from '../config/constants';
import { useUnreadBadges } from '../hooks/useUnreadBadges';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const FeedStack = createNativeStackNavigator();
const MessagingStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const MarketplaceStack = createNativeStackNavigator();

const linking = {
  prefixes: ['footballpro://', 'https://footballpro.al', 'https://www.footballpro.al'],
  config: {
    screens: {
      ResetPassword: 'reset-password/:token',
      Login: 'login',
    },
  },
};

const formatBadge = (value) => {
  const n = Number(value || 0);
  if (!n || n <= 0) return undefined;
  if (n > 99) return '99+';
  return n;
};

function tabProfilePhotoUri(user, imgErr) {
  if (!user || imgErr) return null;
  const raw =
    user?.Profile?.profilePhoto ||
    user?.profile?.profilePhoto ||
    user?.profilePhoto;
  if (raw == null || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return absoluteBackendUrl(s);
}

function ProfileTabBarIcon({ user, focused, size = 26 }) {
  const [imgErr, setImgErr] = React.useState(false);
  const raw =
    user?.Profile?.profilePhoto ||
    user?.profile?.profilePhoto ||
    user?.profilePhoto;
  const rawKey = typeof raw === 'string' ? raw.trim() : '';
  React.useEffect(() => {
    setImgErr(false);
  }, [rawKey]);

  const uri = tabProfilePhotoUri(user, imgErr);
  const initial = String(user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase();
  const dim = Math.round(Math.max(24, Math.min(Number(size) + 6, 34)));
  const borderColor = focused ? '#0f766e' : '#cbd5e1';

  return (
    <View style={[profileTabStyles.ring, { width: dim, height: dim, borderRadius: dim / 2, borderColor }]}>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[profileTabStyles.fallback, { width: dim, height: dim, borderRadius: dim / 2 }]}>
          <Text style={profileTabStyles.initial}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

/** Tab bar merr `user` nga konteksti që të rifreskohet pas `refreshMe` / login. */
function ProfileTabBarIconConnected({ focused, size }) {
  const { user } = useAuth();
  return <ProfileTabBarIcon user={user} focused={focused} size={size} />;
}

const profileTabStyles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  initial: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
});

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
      <MessagingStack.Screen
        name="OutgoingCall"
        component={OutgoingCallScreen}
        options={{ title: 'Thirrje', headerShown: false }}
      />
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
        component={PublicProfileScreen}
        initialParams={{ ownProfile: true }}
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
      <ProfileStack.Screen
        name="GoLive"
        component={GoLiveScreen}
        options={{ title: 'Go Live', headerShown: true, headerBackTitleVisible: true }}
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
      <MoreStack.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
        options={{ title: 'Tournament', headerBackTitleVisible: true }}
      />
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
  const { getSocket, socketConnected } = useAuth();
  const { totalPieces } = useCart();
  const { notificationsCount, messagesCount, refresh: refreshBadges } = useUnreadBadges(
    getSocket,
    socketConnected
  );

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
        name="Profile"
        component={ProfileNavigator}
        options={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarAccessibilityLabel: 'Me',
          tabBarIcon: ({ focused, size }) => <ProfileTabBarIconConnected focused={focused} size={size} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Profile', { screen: 'MyProfile' });
          },
        })}
      />
      <Tabs.Screen
        name="Messages"
        component={MessagingNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Chats',
          tabBarBadge: formatBadge(messagesCount),
        }}
      />
      <Tabs.Screen
        name="More"
        component={MoreNavigator}
        options={{
          headerShown: false,
          tabBarBadge: formatBadge(notificationsCount),
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
    <NavigationContainer ref={navigationRef} linking={linking}>
      <>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!token ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{ headerShown: true, title: 'Reset password' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Main" component={AppTabs} />
              <Stack.Screen
                name="IncomingCall"
                component={IncomingCallScreen}
                options={{ presentation: 'fullScreenModal', headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
        {token ? <IncomingCallListener /> : null}
      </>
    </NavigationContainer>
  );
}
