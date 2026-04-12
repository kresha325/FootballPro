import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import {
  createCommentRequest,
  extractErrorMessage,
  likePostRequest,
  postCommentsRequest,
  postsRequest,
  unlikePostRequest,
} from '../api/client';

const FEED_CACHE_KEY = 'mobile_feed_cache_v1';
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

function PostCard({ item, onToggleLike, onToggleComments, commentsOpen, commentsData, loadingComments, newComment, setNewComment, onAddComment, isSendingComment, isDark }) {
  const author = item?.author ? `${item.author.firstName || ''} ${item.author.lastName || ''}`.trim() : 'Unknown';
  const avatarUrl = item?.author?.profilePhoto || null;
  const isLiked = !!item?.isLiked;

  const hasImage = !!item?.imageUrl;
  const hasVideo = !!item?.videoUrl;

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.authorRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{(author || 'U').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={[styles.author, isDark && styles.textPrimaryDark]}>{author}</Text>
      </View>
      <Text style={[styles.content, isDark && styles.textSecondaryDark]}>{item?.content || 'No text content'}</Text>
      {hasImage ? <Image source={{ uri: item.imageUrl }} style={styles.media} resizeMode="cover" /> : null}
      {hasVideo ? (
        <View style={styles.videoWrap}>
          <Video
            source={{ uri: item.videoUrl }}
            style={styles.videoPlayer}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
          />
        </View>
      ) : null}
      <Text style={[styles.meta, isDark && styles.textMutedDark]}>Likes: {item?.likes || 0} | Comments: {item?.comments || 0}</Text>

      <View style={styles.rowActions}>
        <TouchableOpacity style={[styles.actionBtn, isLiked && styles.actionBtnActive]} onPress={() => onToggleLike(item)}>
          <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>{isLiked ? 'Unlike' : 'Like'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, isDark && styles.actionBtnDark]} onPress={() => onToggleComments(item.id)}>
          <Text style={[styles.actionText, isDark && styles.textSecondaryDark]}>{commentsOpen ? 'Hide Comments' : 'Comments'}</Text>
        </TouchableOpacity>
      </View>

      {commentsOpen ? (
        <View style={styles.commentsWrap}>
          {loadingComments ? <ActivityIndicator color="#0f766e" /> : null}
          {(commentsData || []).map((comment) => {
            const commentUser = comment?.User;
            const name = commentUser ? `${commentUser.firstName || ''} ${commentUser.lastName || ''}`.trim() : 'User';
            return (
              <View key={String(comment.id)} style={[styles.commentItem, isDark && styles.commentItemDark]}>
                <Text style={[styles.commentAuthor, isDark && styles.textPrimaryDark]}>{name}</Text>
                <Text style={[styles.commentText, isDark && styles.textSecondaryDark]}>{comment.content}</Text>
              </View>
            );
          })}

          <View style={styles.commentInputWrap}>
            <TextInput
              style={[styles.commentInput, isDark && styles.inputDark]}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Write a comment"
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
            />
            <TouchableOpacity style={[styles.sendBtn, isSendingComment && styles.sendBtnDisabled]} onPress={() => onAddComment(item.id)} disabled={isSendingComment}>
              <Text style={styles.sendBtnText}>{isSendingComment ? 'Sending...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function FeedSkeleton({ isDark }) {
  return (
    <View style={[styles.listContent, isDark && styles.screenDark]}>
      {[1, 2, 3].map((i) => (
        <View key={`s-${i}`} style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.skelRow}>
            <View style={styles.skelAvatar} />
            <View style={styles.skelLineShort} />
          </View>
          <View style={styles.skelLine} />
          <View style={styles.skelMedia} />
          <View style={styles.skelLineShort} />
        </View>
      ))}
    </View>
  );
}

export default function FeedScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  const [commentsByPostId, setCommentsByPostId] = useState({});
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState(null);
  const [commentDraftByPostId, setCommentDraftByPostId] = useState({});
  const [sendingCommentPostId, setSendingCommentPostId] = useState(null);

  const loadPosts = useCallback(async ({ silent, useCache } = { silent: false, useCache: false }) => {
    if (!silent) {
      setLoading(true);
    }
    setError('');

    if (useCache) {
      try {
        const cachedRaw = await AsyncStorage.getItem(FEED_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.ts && Array.isArray(cached?.data) && Date.now() - cached.ts < FEED_CACHE_TTL_MS) {
            setPosts(cached.data);
            setLoading(false);
          }
        }
      } catch (_e) {}
    }

    try {
      const response = await postsRequest();
      const data = Array.isArray(response.data) ? response.data : [];
      setPosts(data);
      await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load feed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts({ useCache: true });
  }, [loadPosts]);

  useEffect(() => {
    let intervalId = null;

    const startAutoRefresh = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        loadPosts({ silent: true });
      }, 45000);
    };

    const stopAutoRefresh = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    startAutoRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadPosts({ silent: true });
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });

    return () => {
      stopAutoRefresh();
      subscription.remove();
    };
  }, [loadPosts]);

  const onToggleLike = async (post) => {
    const targetId = post.id;
    const currentlyLiked = !!post.isLiked;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
              ...p,
              isLiked: !currentlyLiked,
              likes: Math.max(0, (p.likes || 0) + (currentlyLiked ? -1 : 1)),
            }
          : p
      )
    );

    try {
      if (currentlyLiked) {
        await unlikePostRequest(targetId);
      } else {
        await likePostRequest(targetId);
      }
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === targetId
            ? {
                ...p,
                isLiked: currentlyLiked,
                likes: Math.max(0, (p.likes || 0) + (currentlyLiked ? 1 : -1)),
              }
            : p
        )
      );
      setError(extractErrorMessage(err, 'Could not update like'));
    }
  };

  const loadComments = async (postId) => {
    setCommentsLoadingPostId(postId);
    try {
      const response = await postCommentsRequest(postId);
      const list = Array.isArray(response.data) ? response.data : [];
      setCommentsByPostId((prev) => ({ ...prev, [postId]: list }));
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load comments'));
    } finally {
      setCommentsLoadingPostId(null);
    }
  };

  const onToggleComments = async (postId) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }
    setOpenCommentsPostId(postId);
    await loadComments(postId);
  };

  const onAddComment = async (postId) => {
    const content = (commentDraftByPostId[postId] || '').trim();
    if (!content) {
      return;
    }

    try {
      setSendingCommentPostId(postId);
      await createCommentRequest(postId, content);
      setCommentDraftByPostId((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p)));
      await loadComments(postId);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not add comment'));
    } finally {
      setSendingCommentPostId(null);
    }
  };

  if (loading) {
    return <FeedSkeleton isDark={isDark} />;
  }

  if (error && posts.length === 0) {
    return (
      <View style={[styles.centered, isDark && styles.screenDark]}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => loadPosts()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item, idx) => String(item?.id || idx)}
      contentContainerStyle={[styles.listContent, isDark && styles.screenDark]}
      ListHeaderComponent={
        error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <PostCard
          item={item}
          onToggleLike={onToggleLike}
          onToggleComments={onToggleComments}
          commentsOpen={openCommentsPostId === item.id}
          commentsData={commentsByPostId[item.id]}
          loadingComments={commentsLoadingPostId === item.id}
          newComment={commentDraftByPostId[item.id] || ''}
          setNewComment={(value) => setCommentDraftByPostId((prev) => ({ ...prev, [item.id]: value }))}
          onAddComment={onAddComment}
          isSendingComment={sendingCommentPostId === item.id}
          isDark={isDark}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadPosts({ silent: true });
          }}
          colors={['#0f766e']}
        />
      }
      ListEmptyComponent={<Text style={styles.empty}>No posts yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 14,
    backgroundColor: '#f8fafc',
    minHeight: '100%',
  },
  screenDark: {
    backgroundColor: '#020617',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    backgroundColor: '#0f766e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontWeight: '700',
  },
  author: {
    fontWeight: '700',
    color: '#0f172a',
  },
  textPrimaryDark: {
    color: '#e2e8f0',
  },
  textSecondaryDark: {
    color: '#cbd5e1',
  },
  textMutedDark: {
    color: '#94a3b8',
  },
  content: {
    color: '#1f2937',
    marginBottom: 8,
  },
  media: {
    width: '100%',
    height: 190,
    borderRadius: 10,
    marginBottom: 8,
  },
  videoWrap: {
    overflow: 'hidden',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  videoPlayer: {
    width: '100%',
    height: 220,
  },
  meta: {
    color: '#64748b',
    fontSize: 12,
  },
  rowActions: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  actionBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#0b1220',
  },
  actionBtnActive: {
    borderColor: '#0f766e',
    backgroundColor: '#e6fffa',
  },
  actionText: {
    color: '#334155',
    fontWeight: '600',
  },
  actionTextActive: {
    color: '#0f766e',
  },
  commentsWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  commentItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  commentItemDark: {
    backgroundColor: '#111827',
  },
  commentAuthor: {
    fontWeight: '700',
    color: '#1e293b',
  },
  commentText: {
    color: '#334155',
    marginTop: 2,
  },
  commentInputWrap: {
    marginTop: 8,
    flexDirection: 'row',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    color: '#e2e8f0',
  },
  sendBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    color: '#991b1b',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skelAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  skelLineShort: {
    width: '45%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  skelMedia: {
    width: '100%',
    height: 190,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
});
