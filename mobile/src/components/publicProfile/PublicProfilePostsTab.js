import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../../theme/nativeComponents';
import { VideoPlayerModal, VideoPoster } from '../media/LazyVideo';
import OptimizedImage from '../media/OptimizedImage';
import {
  createCommentRequest,
  extractErrorMessage,
  likePostRequest,
  postCommentsRequest,
  unlikePostRequest,
} from '../../api/client';
import PostSponsorStrip, { SponsoredLabel } from '../PostSponsorStrip';
import { profileRowFrame } from './profileListFrame';

function postSponsors(p) {
  const raw = p?.sponsors ?? p?.Sponsors;
  return Array.isArray(raw) ? raw : [];
}

const ProfilePostRow = React.memo(function ProfilePostRow({
  post,
  theme,
  expanded,
  comments,
  loadingComments,
  draft,
  sending,
  onLike,
  onToggleComments,
  onChangeDraft,
  onSend,
  onPlay,
}) {
  const sponsors = postSponsors(post);
  const hasSponsors = sponsors.length > 0;
  return (
    <View
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
        <OptimizedImage uri={post.imageUrl} style={styles.postMedia} width={600} contentFit="cover" />
      ) : null}
      {post.videoUrl ? (
        <VideoPoster
          style={styles.video}
          onPress={() => onPlay(post.videoUrl)}
          accessibilityLabel="Luaj videon e postimit"
        />
      ) : null}
      <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.actionBtn, post.isLiked && styles.actionBtnLiked]}
          onPress={() => onLike(post)}
        >
          <Text style={styles.actionEmoji}>👍</Text>
          <Text style={[styles.actionMeta, { color: theme.text }]}>{post.likes || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onToggleComments(post.id)}>
          <Text style={styles.actionEmoji}>💬</Text>
          <Text style={[styles.actionMeta, { color: theme.text }]}>{post.comments || 0}</Text>
        </TouchableOpacity>
        <Text style={[styles.date, { color: theme.muted }]}>
          {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}
        </Text>
      </View>
      {expanded ? (
        <View style={[styles.commentsBox, { borderTopColor: theme.border }]}>
          {loadingComments ? <ActivityIndicator color="#9A6B12" /> : null}
          <View style={styles.commentInputRow}>
            <TextInput
              style={[styles.commentInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="Write a comment..."
              placeholderTextColor={theme.muted}
              value={draft}
              onChangeText={(value) => onChangeDraft(post.id, value)}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { marginLeft: 8 }, sending && { opacity: 0.6 }]}
              onPress={() => onSend(post.id)}
              disabled={!!sending}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
          {(comments || []).map((c) => {
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
});

export default function PublicProfilePostsTab({
  posts = [],
  theme,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  listHeader = null,
  refreshControl,
  pageStyle,
  contentContainerStyle,
  frame = null,
  showEmpty = true,
}) {
  const [localPosts, setLocalPosts] = useState(posts);
  const [expanded, setExpanded] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [sending, setSending] = useState({});
  const [playingUri, setPlayingUri] = useState(null);

  useEffect(() => {
    setLocalPosts(Array.isArray(posts) ? posts : []);
  }, [posts]);

  const expandedRef = useRef(expanded);
  const commentsRef = useRef(commentsByPost);
  const draftsRef = useRef(drafts);
  expandedRef.current = expanded;
  commentsRef.current = commentsByPost;
  draftsRef.current = drafts;

  const onToggleComments = useCallback(async (postId) => {
    const opening = !expandedRef.current[postId];
    setExpanded((prev) => ({ ...prev, [postId]: !prev[postId] }));
    if (!opening || commentsRef.current[postId]) return;
    setLoadingComments((loading) => ({ ...loading, [postId]: true }));
    try {
      const res = await postCommentsRequest(postId);
      setCommentsByPost((comments) => ({
        ...comments,
        [postId]: Array.isArray(res.data) ? res.data : [],
      }));
    } catch (_err) {
      setCommentsByPost((comments) => ({ ...comments, [postId]: [] }));
    } finally {
      setLoadingComments((loading) => ({ ...loading, [postId]: false }));
    }
  }, []);

  const onLike = useCallback(async (post) => {
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
    } catch (_err) {
      setLocalPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, isLiked: was, likes: Math.max(0, (p.likes || 0) + (was ? 1 : -1)) }
            : p
        )
      );
    }
  }, []);

  const onChangeDraft = useCallback((postId, value) => {
    setDrafts((current) => ({ ...current, [postId]: value }));
  }, []);

  const onSend = useCallback(async (postId) => {
    const text = (draftsRef.current[postId] || '').trim();
    if (!text) return;
    setSending((current) => ({ ...current, [postId]: true }));
    try {
      await createCommentRequest(postId, text);
      setDrafts((current) => ({ ...current, [postId]: '' }));
      const res = await postCommentsRequest(postId);
      setCommentsByPost((current) => ({ ...current, [postId]: Array.isArray(res.data) ? res.data : [] }));
      setLocalPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))
      );
    } catch (err) {
      Alert.alert('Comment', extractErrorMessage(err, 'Could not post comment'));
    } finally {
      setSending((current) => ({ ...current, [postId]: false }));
    }
  }, []);

  const onPlay = useCallback((uri) => setPlayingUri(uri), []);

  const renderItem = useCallback(
    ({ item }) => (
      <View style={profileRowFrame(frame)}>
        <ProfilePostRow
          post={item}
          theme={theme}
          expanded={!!expanded[item.id]}
          comments={commentsByPost[item.id]}
          loadingComments={!!loadingComments[item.id]}
          draft={drafts[item.id] || ''}
          sending={!!sending[item.id]}
          onLike={onLike}
          onToggleComments={onToggleComments}
          onChangeDraft={onChangeDraft}
          onSend={onSend}
          onPlay={onPlay}
        />
      </View>
    ),
    [commentsByPost, drafts, expanded, frame, loadingComments, onChangeDraft, onLike, onPlay, onSend, onToggleComments, sending, theme]
  );

  const footer = (
    <View style={profileRowFrame(frame, 'end')}>
      {hasMore ? (
        <TouchableOpacity
          onPress={onLoadMore}
          disabled={loadingMore}
          style={styles.moreBtn}
          accessibilityRole="button"
          accessibilityLabel="Ngarko postime të tjera"
        >
          {loadingMore ? <ActivityIndicator color="#9A6B12" /> : <Text style={styles.moreText}>Më shumë</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={pageStyle}
        data={localPosts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={frame || hasMore ? footer : null}
        ListEmptyComponent={
          showEmpty ? (
            <View style={profileRowFrame(frame)}>
              <View style={styles.emptyWrap}>
                <Text style={[styles.empty, { color: theme.muted }]}>No posts yet</Text>
              </View>
            </View>
          ) : null
        }
        refreshControl={refreshControl}
        contentContainerStyle={contentContainerStyle}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
      />
      <VideoPlayerModal uri={playingUri} visible={!!playingUri} onClose={() => setPlayingUri(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { paddingVertical: 32, alignItems: 'center' },
  empty: { fontSize: 15 },
  postCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  sponsorBlock: { marginBottom: 8 },
  postContent: { fontSize: 15, marginBottom: 8 },
  postMedia: { width: '100%', height: 200, borderRadius: 8, marginTop: 4 },
  video: { width: '100%', height: 220, marginTop: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
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
  moreBtn: { alignItems: 'center', paddingVertical: 14 },
  moreText: { color: '#9A6B12', fontWeight: '700' },
});
