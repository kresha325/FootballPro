import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { createPostRequest, extractErrorMessage, setPostSponsorsRequest, sponsorsByUserRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AiCaptionButton from '../components/AiCaptionButton';

export default function CreatePostScreen({ navigation }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mySponsors, setMySponsors] = useState([]);
  const [selectedSponsorIds, setSelectedSponsorIds] = useState([]);

  React.useEffect(() => {
    let mounted = true;
    const loadMySponsors = async () => {
      try {
        if (!user?.id) return;
        const res = await sponsorsByUserRequest(user.id);
        if (!mounted) return;
        setMySponsors(Array.isArray(res?.data) ? res.data : []);
      } catch (_err) {
        if (!mounted) return;
        setMySponsors([]);
      }
    };
    loadMySponsors();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow media library access to create a post.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || String(asset.mimeType || '').startsWith('video/');
      const fileSize = Number(asset.fileSize || asset.filesize || 0);
      const maxBytes = isVideo ? 80 * 1024 * 1024 : 12 * 1024 * 1024;
      if (fileSize > 0 && fileSize > maxBytes) {
        Alert.alert(
          'Skedar i madh',
          isVideo
            ? 'Video max ~80MB. Kompreso ose zgjidh një video më të shkurtër.'
            : 'Foto max ~12MB. Zgjidh një imazh më të vogël.'
        );
        return;
      }
      const extension = isVideo ? 'mp4' : 'jpg';
      setMedia({
        uri: asset.uri,
        type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        name: `mobile-upload-${Date.now()}.${extension}`,
        kind: isVideo ? 'video' : 'image',
      });
    }
  };

  const onPublish = async () => {
    if (!content.trim() && !media) {
      Alert.alert('Missing content', 'Add text or choose an image/video.');
      return;
    }

    setSaving(true);
    try {
      const payload = { content: content.trim() };
      if (media?.kind === 'image') {
        payload.image = { uri: media.uri, name: media.name, type: media.type };
      }
      if (media?.kind === 'video') {
        payload.video = { uri: media.uri, name: media.name, type: media.type };
      }

      const created = await createPostRequest(payload);
      const createdPostId = created?.data?.id;
      if (createdPostId && selectedSponsorIds.length > 0) {
        await setPostSponsorsRequest(createdPostId, selectedSponsorIds);
      }
      Alert.alert('Success', 'Post created successfully.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Create failed', extractErrorMessage(err, 'Could not create post'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Post content</Text>
      <AiCaptionButton
        hints={{
          topic: content.trim().slice(0, 80) || 'futboll',
          hasMedia: Boolean(media),
          role: user?.role,
        }}
        onCaption={(caption) => setContent((prev) => (prev.trim() ? `${prev.trim()} ${caption}` : caption))}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={content}
        onChangeText={setContent}
        placeholder="Write something for your audience"
        multiline
      />

      <TouchableOpacity style={styles.secondaryButton} onPress={pickMedia}>
        <Text style={styles.secondaryButtonText}>{media ? 'Change Media' : 'Choose Image/Video'}</Text>
      </TouchableOpacity>

      {media?.kind === 'image' ? <Image source={{ uri: media.uri }} style={styles.previewImage} resizeMode="cover" /> : null}
      {media?.kind === 'video' ? (
        <View style={styles.videoWrap}>
          <Video source={{ uri: media.uri }} style={styles.video} useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping={false} />
        </View>
      ) : null}

      {mySponsors.length > 0 ? (
        <View style={styles.sponsorsWrap}>
          <Text style={styles.label}>Sponsors on this post</Text>
          <View style={styles.sponsorsRow}>
            {mySponsors.map((s) => {
              const active = selectedSponsorIds.includes(s.id);
              return (
                <TouchableOpacity
                  key={String(s.id)}
                  style={[styles.sponsorChip, active && styles.sponsorChipActive]}
                  onPress={() =>
                    setSelectedSponsorIds((prev) =>
                      prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                    )
                  }
                >
                  <Text style={[styles.sponsorChipText, active && styles.sponsorChipTextActive]} numberOfLines={1}>
                    {s?.name || 'Sponsor'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={onPublish} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Publish Post</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 28 },
  label: { color: '#334155', marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  previewImage: {
    marginTop: 12,
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  videoWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: 240,
  },
  sponsorsWrap: {
    marginTop: 14,
  },
  sponsorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  sponsorChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    maxWidth: '100%',
  },
  sponsorChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ccfbf1',
  },
  sponsorChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  sponsorChipTextActive: {
    color: '#0f766e',
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
