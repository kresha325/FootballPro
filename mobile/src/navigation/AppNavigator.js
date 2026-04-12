import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from '../screens/LoginScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import BrowseProfilesScreen from '../screens/BrowseProfilesScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import GoLiveScreen from '../screens/GoLiveScreen';
import MessagingScreen from '../screens/MessagingScreen';
import ConversationScreen from '../screens/ConversationScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MessagingStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function MessagingNavigator() {
  return (
    <MessagingStack.Navigator>
      <MessagingStack.Screen name="MessagingHome" component={MessagingScreen} options={{ title: 'Messages' }} />
      <MessagingStack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Conversation' }} />
    </MessagingStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="MyProfile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileStack.Screen name="BrowseProfiles" component={BrowseProfilesScreen} options={{ title: 'Browse Profiles' }} />
      <ProfileStack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Profile' }} />
    </ProfileStack.Navigator>
  );
}

function AppTabs() {
  const { logout } = useAuth();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#0f766e',
      }}
    >
      <Tabs.Screen name="Feed" component={FeedScreen} />
      <Tabs.Screen name="Messages" component={MessagingNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} />
      <Tabs.Screen name="GoLive" component={GoLiveScreen} options={{ title: 'Go Live' }} />
      <Tabs.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          headerShown: false,
          headerRight: () => (
            <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 8 }}>
              <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Logout</Text>
              </View>
            </TouchableOpacity>
          ),
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
