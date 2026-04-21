import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import {
  createCommentRequest,
  extractErrorMessage,
  likePostRequest,
  postCommentsRequest,
  unlikePostRequest,
} from '../../api/client';
import PostSponsorStrip, { SponsoredLabel } from '../PostSponsorStrip';

function postSponsors(p) {
  const raw = p?.sponsors ?? p?.Sponsors;
  return Array.isArray(raw) ? raw : [];
}

export default function PublicProfilePostsTab({ posts = [], theme }) {
  const [localPosts, setLocalPosts] = useState(posts);
  const [expanded, setExpanded] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [sending, setSending] = useState({});

  useEffect(() => {
    setLocalPosts(Array.isArray(posts) ? posts : []);
  }, [posts]);

  const toggleExpand = async (postId) => {
    setExpanded((prev) => ({ ...prev, [postId]: !prev[postId] }));
    if (!commentsByPost[postId] && !expanded[postId]) {
      setLoadingComments((l) => ({ ...l, [postId]: true }));
      try {
        const res = await postCommentsRequest(postId);
        setCommentsByPost((c) => ({ ...c, [postId]: Array.isArray(res.data) ? res.data : [] }));
      } catch (_e) {
        setCommentsByPost((c) => ({ ...c, [postId]: [] }));
      } finally {
        setLoadingComments((l) => ({ ...l, [postId]: false }));
      }
    }
  };

  const onLike = async (post) => {
    const id = post.id;
    const was = !!post.isLiked;
    setLocalPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, isLiked: !was, likes: Math.max(0, (p.likes || 0) + (was ? -1 : 1)) }
          : p
      )
    );
    try {
      if (was) await unlikePostRequest(id);
      else await likePostRequest(id);
    } catch (err) {
      setLocalPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, isLiked: was, likes: Math.max(0, (p.likes || 0) + (was ? 1 : -1)) }
            : p
        )
      );
    }
  };

  const sendComment = async (postId) => {
    const text = (drafts[postId] || '').trim();
    if (!text) return;
    setSending((s) => ({ ...s, [postId]: true }));
    try {
      await createCommentRequest(postId, text);
      setDrafts((d) => ({ ...d, [postId]: '' }));
      const res = await postCommentsRequest(postId);
      setCommentsByPost((c) => ({ ...c, [postId]: Array.isArray(res.data) ? res.data : [] }));
      setLocalPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))
      );
    } catch (err) {
      Alert.alert('Comment', extractErrorMessage(err, 'Could not post comment'));
    } finally {
      setSending((s) => ({ ...s, [postId]: false }));
    }
  };

  if (!localPosts.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.empty, { color: theme.muted }]}>No posts yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {localPosts.map((post) => {
        const sponsors = postSponsors(post);
        const hasSponsors = sponsors.length > 0;
        return (
          <View
            key={String(post.id)}
            style={[
              styles.postCard,
              { backgroundColor: theme.card, borderColor: hasSponsors ? '#86efac' : theme.border },
            ]}
          >
            {hasSponsors ? (
              <View style={styles.sponsorBlock}>
                <SponsoredLabel isDark={theme.isDark} />
                <PostSponsorStrip sponsors={sponsors} isDark={theme.isDark} />
              </View>
            ) : null}
            {post.content ? (
              <Text style={[styles.postContent, { color: theme.text }]}>{post.content}</Text>
            ) : null}
            {post.imageUrl ? (
              <Image source={{ uri: post.imageUrl }} style={styles.postMedia} resizeMode="cover" />
            ) : null}
            {post.videoUrl ? (
              <View style={styles.videoWrap}>
                <Video
                  source={{ uri: post.videoUrl }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                />
              </View>
            ) : null}
            <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.actionBtn, post.isLiked && styles.actionBtnLiked]}
                onPress={() => onLike(post)}
              >
                <Text style={styles.actionEmoji}>👍</Text>
                <Text style={[styles.actionMeta, { color: theme.text }]}>{post.likes || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => toggleExpand(post.id)}>
                <Text style={styles.actionEmoji}>💬</Text>
                <Text style={[styles.actionMeta, { color: theme.text }]}>{post.comments || 0}</Text>
              </TouchableOpacity>
              <Text style={[styles.date, { color: theme.muted }]}>
                {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}
              </Text>
            </View>
            {expanded[post.id] ? (
              <View style={[styles.commentsBox, { borderTopColor: theme.border }]}>
                {loadingComments[post.id] ? <ActivityIndicator color="#0f766e" /> : null}
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={[styles.commentInput, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Write a comment..."
                    placeholderTextColor={theme.muted}
                    value={drafts[post.id] || ''}
                    onChangeText={(v) => setDrafts((d) => ({ ...d, [post.id]: v }))}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, { marginLeft: 8 }, sending[post.id] && { opacity: 0.6 }]}
                    onPress={() => sendComment(post.id)}
                    disabled={!!sending[post.id]}
                  >
                    <Text style={styles.sendBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
                {(commentsByPost[post.id] || []).map((c) => {
                  const u = c.User;
                  const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'User';
                  return (
                    <View key={String(c.id)} style={styles.commentRow}>
                      <Text style={[styles.commentAuthor, { color: theme.text }]}>{name}</Text>
                      <Text style={[styles.commentBody, { color: theme.muted }]}>{c.content}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {},
  emptyWrap: { paddingVertical: 32, alignItems: 'center' },
  empty: { fontSize: 15 },
  postCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  sponsorBlock: { marginBottom: 8 },
  postContent: { fontSize: 15, marginBottom: 8 },
  postMedia: { width: '100%', height: 200, borderRadius: 8, marginTop: 4 },
  videoWrap: { marginTop: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', height: 220 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 12,
  },
  actionBtnLiked: { backgroundColor: 'rgba(239,68,68,0.12)' },
  actionEmoji: { fontSize: 16, marginRight: 4 },
  actionMeta: { fontSize: 14, fontWeight: '700' },
  date: { marginLeft: 'auto', fontSize: 12 },
  commentsBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  commentRow: { marginBottom: 10 },
  commentAuthor: { fontWeight: '700', fontSize: 13 },
  commentBody: { fontSize: 13, marginTop: 2 },
});
