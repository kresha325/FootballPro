import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '../config/constants';

const { width, height } = Dimensions.get('window');

export default function LiveViewerScreen({ route, navigation }) {
  const streamId = route?.params?.streamId;
  const streamTitle = route?.params?.streamTitle || 'Live Stream';
  const hostName = route?.params?.hostName || 'Unknown';
  const [viewerCount, setViewerCount] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, name: 'John Doe', message: 'Great stream!', timestamp: '12:05 PM' },
    { id: 2, name: 'Jane Smith', message: 'Amazing content', timestamp: '12:06 PM' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('Auto');

  const frontendBase = BACKEND_URL.replace(/\/api\/?$/, '');

  useEffect(() => {
    // Simulate viewer count updates
    const interval = setInterval(() => {
      setViewerCount(Math.floor(Math.random() * 5000) + 100);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!streamId) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Missing stream ID</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const uri = `${frontendBase}/live/${streamId}`;

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          name: 'You',
          message: newMessage,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
      setNewMessage('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* WebView for Stream */}
      <View style={styles.streamContainer}>
        <WebView
          source={{ uri }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading stream...</Text>
            </View>
          )}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          scrollEnabled={false}
        />

        {/* Stream Info Overlay */}
        <View style={styles.streamOverlay}>
          {/* Top Overlay - Title & Viewers */}
          <View style={styles.topOverlay}>
            <View style={styles.streamInfo}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.streamTitle} numberOfLines={1}>
                {streamTitle}
              </Text>
              <Text style={styles.hostName}>by {hostName}</Text>
            </View>
            <View style={styles.viewerBadge}>
              <MaterialCommunityIcons name="eye" size={16} color="white" />
              <Text style={styles.viewerCount}>{viewerCount}</Text>
            </View>
          </View>

          {/* Bottom Overlay - Controls */}
          <View style={styles.bottomOverlay}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
            >
              <MaterialCommunityIcons name="video-box" size={20} color="white" />
              <Text style={styles.controlText}>{selectedQuality}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowChat(!showChat)}
            >
              <MaterialCommunityIcons
                name={showChat ? 'close' : 'chat-outline'}
                size={20}
                color="white"
              />
              <Text style={styles.controlText}>{showChat ? 'Hide' : 'Chat'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton}>
              <MaterialCommunityIcons name="heart" size={20} color="#ef4444" />
              <Text style={styles.controlText}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="close" size={20} color="white" />
              <Text style={styles.controlText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quality Menu */}
        {isQualityMenuOpen && (
          <View style={styles.qualityMenu}>
            {['Auto', '720p', '480p', '360p', '240p'].map((quality) => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.qualityOption,
                  selectedQuality === quality && styles.qualityOptionActive,
                ]}
                onPress={() => {
                  setSelectedQuality(quality);
                  setIsQualityMenuOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.qualityText,
                    selectedQuality === quality && styles.qualityTextActive,
                  ]}
                >
                  {quality}
                </Text>
                {selectedQuality === quality && (
                  <MaterialCommunityIcons name="check" size={16} color="#2563eb" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Chat Panel */}
      {showChat && (
        <View style={styles.chatPanel}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Live Chat</Text>
            <TouchableOpacity onPress={() => setShowChat(false)}>
              <MaterialCommunityIcons name="close" size={20} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.chatMessage}>
                <View style={styles.messageAvatar}>
                  <Text style={styles.avatarInitial}>
                    {item.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.messageContent}>
                  <View style={styles.messageMeta}>
                    <Text style={styles.messageName}>{item.name}</Text>
                    <Text style={styles.messageTime}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
              </View>
            )}
            style={styles.chatMessages}
            contentContainerStyle={styles.chatMessagesContent}
            scrollEnabled
            nestedScrollEnabled
          />

          <View style={styles.chatInput}>
            <TextInput
              style={styles.messageInput}
              placeholder="Say something..."
              placeholderTextColor="#9ca3af"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxHeight={80}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <MaterialCommunityIcons
                name="send"
                size={20}
                color={newMessage.trim() ? '#2563eb' : '#d1d5db'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  streamContainer: {
    flex: showChat => (showChat ? 0.6 : 1),
    position: 'relative',
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  errorText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 12,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  backText: {
    color: 'white',
    fontWeight: '600',
  },
  streamOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  topOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 12,
    pointerEvents: 'auto',
  },
  streamInfo: {
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 12,
  },
  streamTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  hostName: {
    color: '#ccc',
    fontSize: 12,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewerCount: {
    color: 'white',
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 12,
  },
  bottomOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  controlText: {
    color: 'white',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  qualityMenu: {
    position: 'absolute',
    top: 60,
    right: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 1000,
    minWidth: 100,
  },
  qualityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  qualityOptionActive: {
    backgroundColor: '#ecf0ff',
  },
  qualityText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  qualityTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  chatPanel: {
    flex: 0.4,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'column',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    paddingVertical: 8,
  },
  chatMessage: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarInitial: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageContent: {
    flex: 1,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  messageName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 8,
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  messageText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1f2937',
    maxHeight: 80,
  },
  sendButton: {
    marginLeft: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

