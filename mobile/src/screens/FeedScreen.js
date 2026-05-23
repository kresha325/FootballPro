import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import {
  adsRequest,
  createCommentRequest,
  deleteCommentRequest,
  deletePostRequest,
  extractErrorMessage,
  likePostRequest,
  postCommentsRequest,
  postsRequest,
  streamsRequest,
  unlikePostRequest,
} from '../api/client';
import FeedAdSlot from '../components/FeedAdSlot';
import NotificationHeaderButton from '../components/NotificationHeaderButton';
import PostSponsorStrip from '../components/PostSponsorStrip';
import { useAuth } from '../context/AuthContext';

function postAuthorId(item) {
  if (!item || typeof item !== 'object') return null;
  const a = item.author;
  const id = a && typeof a === 'object' ? a.id : null;
  return id != null ? id : item.userId ?? null;
}

const FEED_CACHE_KEY_PREFIX = 'mobile_feed_cache_v2';
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_FILTER_KEY = 'feed_followed_only';

function feedCacheKey(scope, userId) {
  const sid = userId != null ? String(userId) : 'anon';
  return `${FEED_CACHE_KEY_PREFIX}:${scope}:${sid}`;
}

function shuffleAds(array) {
  const arr = Array.isArray(array) ? [...array] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pas çdo 3 posteve një rresht reklamë (si `Feed.jsx` në web). */
function mergePostsWithAdSlots(postsList) {
  const list = Array.isArray(postsList) ? postsList : [];
  const out = [];
  list.forEach((post, i) => {
    out.push({ type: 'post', post, key: `post-${post.id}` });
    if ((i + 1) % 3 === 0) {
      out.push({ type: 'ad', key: `ad-after-${post.id}-${i}` });
    }
  });
  return out;
}

function postSponsorsList(item) {
  const raw = item?.sponsors ?? item?.Sponsors;
  return Array.isArray(raw) ? raw : [];
}

function PostCard({
  item,
  onToggleLike,
  onToggleComments,
  commentsOpen,
  commentsData,
  loadingComments,
  newComment,
  setNewComment,
  onAddComment,
  isSendingComment,
  isDark,
  onOpenPost,
  onOpenAuthorProfile,
  currentUserId,
  onDeletePost,
  onDeleteComment,
  deletingPostId,
  deletingCommentId,
}) {
  const author = item?.author ? `${item.author.firstName || ''} ${item.author.lastName || ''}`.trim() : 'Unknown';
  const avatarUrl = item?.author?.profilePhoto || null;
  const authorId = postAuthorId(item);
  const isOwnPost =
    currentUserId != null && authorId != null && String(currentUserId) === String(authorId);
  const isLiked = !!item?.isLiked;
  const sponsors = postSponsorsList(item);
  const hasSponsors = sponsors.length > 0;

  const imageUrl = item?.imageUrl;
  const hasVideo = !!item?.videoUrl;
  const imageIsVideo =
    imageUrl && typeof imageUrl === 'string' && /\.(mp4|mov|avi|webm)$/i.test(imageUrl);
  const hasImage = !!imageUrl && !imageIsVideo;

  const dateStr = item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';

  const openLocation = () => {
    const loc = item?.location;
    if (!loc || typeof loc !== 'string') return;
    const lat = item?.locationLat;
    const lng = item?.locationLng;
    const url =
      lat != null && lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View
      style={[
        styles.card,
        isDark && styles.cardDark,
        hasSponsors && styles.cardSponsored,
        isDark && hasSponsors && styles.cardSponsoredDark,
      ]}
    >
      {hasSponsors ? (
        <View style={styles.sponsoredBanner}>
          <Text style={styles.sponsoredBannerText}>Sponsored</Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpenAuthorProfile?.(authorId)}
        disabled={!authorId || !onOpenAuthorProfile}
        accessibilityRole="button"
        accessibilityLabel="Hap profilin e autorit"
        style={styles.authorRowHit}
      >
        <View style={styles.authorHeaderRow}>
          <View style={styles.authorHeaderLeft}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, isDark && styles.avatarFallbackDark]}>
                <Text style={styles.avatarFallbackText}>
                  {`${(item?.author?.firstName || author || 'U').charAt(0).toUpperCase()}${(item?.author?.lastName || '').charAt(0).toUpperCase()}`}
                </Text>
              </View>
            )}
            <View style={styles.authorTextCol}>
              <Text style={[styles.authorName, isDark && styles.textPrimaryDark]} numberOfLines={1}>
                {author}
              </Text>
              {dateStr ? (
                <Text style={[styles.authorDate, isDark && styles.textMutedDark]}>{dateStr}</Text>
              ) : null}
            </View>
          </View>
          {hasSponsors ? (
            <View style={styles.headerSponsorWrap}>
              <PostSponsorStrip sponsors={sponsors} isDark={isDark} variant="overlay" />
            </View>
          ) : null}
          {isOwnPost && onDeletePost ? (
            <TouchableOpacity
              style={styles.deletePostBtn}
              onPress={() => onDeletePost(item)}
              disabled={deletingPostId === item.id}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Delete post"
            >
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onOpenPost?.(item)}
        disabled={!onOpenPost}
        accessibilityRole="button"
        accessibilityLabel="Hap postin në ekran të plotë"
      >
        {item?.content ? (
          <Text style={[styles.content, isDark && styles.textBodyDark]}>{item.content}</Text>
        ) : null}
        {hasImage ? <Image source={{ uri: imageUrl }} style={styles.media} resizeMode="cover" /> : null}
      </TouchableOpacity>

      {item?.location ? (
        <TouchableOpacity style={styles.locationRow} onPress={openLocation} activeOpacity={0.8}>
          <Text style={styles.locationEmoji}>📍</Text>
          <Text style={[styles.locationText, isDark && styles.locationTextDark]} numberOfLines={2}>
            {item.location}
          </Text>
        </TouchableOpacity>
      ) : null}

      {hasVideo || imageIsVideo ? (
        <View style={[styles.videoWrap, isDark && styles.videoWrapDark]}>
          <Video
            source={{ uri: hasVideo ? item.videoUrl : imageUrl }}
            style={styles.videoPlayer}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
          />
          {onOpenPost ? (
            <TouchableOpacity
              style={styles.videoFsBtn}
              onPress={() => onOpenPost(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Hap videon në ekran të plotë"
            >
              <Ionicons name="expand" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[
            styles.pillBtn,
            isLiked ? styles.pillBtnLikeActive : styles.pillBtnNeutral,
            isDark && !isLiked && styles.pillBtnNeutralDark,
            isDark && isLiked && styles.pillBtnLikeActiveDark,
          ]}
          onPress={() => onToggleLike(item)}
        >
          <Text style={styles.pillEmoji}>👍</Text>
          <Text
            style={[
              styles.pillCount,
              isLiked ? styles.pillCountActive : styles.pillCountNeutral,
              isDark && !isLiked && styles.pillCountNeutralDark,
              isDark && isLiked && styles.pillCountActiveDark,
            ]}
          >
            {item?.likes || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.pillBtn,
            styles.pillBtnNeutral,
            isDark && styles.pillBtnNeutralDark,
            commentsOpen && styles.pillBtnCommentOpen,
          ]}
          onPress={() => onToggleComments(item.id)}
        >
          <Text style={styles.pillEmoji}>💬</Text>
          <Text style={[styles.pillCount, styles.pillCountNeutral, isDark && styles.pillCountNeutralDark]}>
            {item?.comments || 0}
          </Text>
        </TouchableOpacity>
      </View>

      {commentsOpen ? (
        <View style={[styles.commentsWrap, isDark && styles.commentsWrapDark]}>
          {loadingComments ? <ActivityIndicator color="#0f766e" /> : null}
          {(commentsData || []).map((comment) => {
            const commentUser = comment?.User;
            const name = commentUser ? `${commentUser.firstName || ''} ${commentUser.lastName || ''}`.trim() : 'User';
            const commentUserId = comment?.userId ?? commentUser?.id;
            const isOwnComment =
              currentUserId != null &&
              commentUserId != null &&
              String(currentUserId) === String(commentUserId);
            return (
              <View key={String(comment.id)} style={[styles.commentItem, isDark && styles.commentItemDark]}>
                <View style={styles.commentHeaderRow}>
                  <Text style={[styles.commentAuthor, isDark && styles.textPrimaryDark]}>{name}</Text>
                  {isOwnComment && onDeleteComment ? (
                    <TouchableOpacity
                      onPress={() => onDeleteComment(comment, item.id)}
                      disabled={deletingCommentId === comment.id}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel="Delete comment"
                    >
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  ) : null}
                </View>
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

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const navigateToGoLive = useCallback(
    (params) => {
      const parent = navigation.getParent?.();
      if (parent?.navigate) {
        parent.navigate('More', { screen: 'GoLive', params: params || undefined });
      } else {
        navigation.navigate('GoLive', params);
      }
    },
    [navigation]
  );

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  const [commentsByPostId, setCommentsByPostId] = useState({});
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState(null);
  const [commentDraftByPostId, setCommentDraftByPostId] = useState({});
  const [sendingCommentPostId, setSendingCommentPostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [liveStreams, setLiveStreams] = useState([]);
  const [feedAds, setFeedAds] = useState([]);
  const [feedScope, setFeedScope] = useState('all');

  const feedListData = useMemo(() => mergePostsWithAdSlots(posts), [posts]);

  const openPostFullscreen = useCallback(
    (post) => {
      const index = posts.findIndex((p) => p.id === post.id);
      navigation.navigate('FeedPostPager', {
        posts,
        initialIndex: Math.max(0, index),
        onPostUpdated: (postId, updates) => {
          if (updates?.deleted) {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            return;
          }
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)));
        },
      });
    },
    [navigation, posts]
  );

  const openAuthorProfile = useCallback(
    (authorId) => {
      if (authorId == null) return;
      const parent = navigation.getParent?.();
      if (!parent?.navigate) return;
      const mine = user?.id != null && String(authorId) === String(user.id);
      if (mine) {
        parent.navigate('Profile', { screen: 'MyProfile' });
        return;
      }
      parent.navigate('Profile', { screen: 'PublicProfile', params: { userId: authorId } });
    },
    [navigation, user?.id]
  );

  const loadPosts = useCallback(async ({ silent, useCache, scope } = { silent: false, useCache: false, scope: feedScope }) => {
    const selectedScope = scope || feedScope;
    const cacheKey = feedCacheKey(selectedScope, user?.id);
    if (!silent) {
      setLoading(true);
    }
    setError('');

    if (useCache) {
      try {
        const cachedRaw = await AsyncStorage.getItem(cacheKey);
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
      const postsRes = await postsRequest({ followed: selectedScope === 'my' ? true : undefined });
      const data = Array.isArray(postsRes.data) ? postsRes.data : [];
      setPosts(data);
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load feed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    try {
      const adsRes = await adsRequest();
      const raw = Array.isArray(adsRes?.data) ? adsRes.data : [];
      setFeedAds(shuffleAds(raw));
    } catch (_err) {
      setFeedAds([]);
    }

    try {
      const liveRes = await streamsRequest({ isLive: true, limit: 12 });
      const liveData = Array.isArray(liveRes.data) ? liveRes.data : [];
      setLiveStreams(liveData);
    } catch (_err) {
      setLiveStreams([]);
    }
  }, [feedScope, user?.id]);

  useEffect(() => {
    AsyncStorage.getItem(FEED_FILTER_KEY)
      .then((v) => {
        if (v === 'true') setFeedScope('my');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(FEED_FILTER_KEY, feedScope === 'my' ? 'true' : 'false').catch(() => {});
  }, [feedScope]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <View style={[styles.headerScopeWrap, { marginLeft: 8 }]}>
          <TouchableOpacity
            onPress={() => setFeedScope('my')}
            style={[styles.headerScopeBtn, feedScope === 'my' && styles.headerScopeBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Show My feed"
          >
            <Text style={[styles.headerScopeBtnText, feedScope === 'my' && styles.headerScopeBtnTextActive]}>My</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFeedScope('all')}
            style={[styles.headerScopeBtn, feedScope === 'all' && styles.headerScopeBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Show All feed"
          >
            <Text style={[styles.headerScopeBtnText, feedScope === 'all' && styles.headerScopeBtnTextActive]}>All</Text>
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => <NotificationHeaderButton />,
    });
  }, [feedScope, navigation]);

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

  const onDeletePost = (post) => {
    if (!post?.id || deletingPostId) return;
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingPostId(post.id);
          try {
            await deletePostRequest(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            if (openCommentsPostId === post.id) setOpenCommentsPostId(null);
          } catch (err) {
            setError(extractErrorMessage(err, 'Could not delete post'));
          } finally {
            setDeletingPostId(null);
          }
        },
      },
    ]);
  };

  const onDeleteComment = (comment, postId) => {
    if (!comment?.id || deletingCommentId) return;
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingCommentId(comment.id);
          try {
            await deleteCommentRequest(comment.id);
            setCommentsByPostId((prev) => ({
              ...prev,
              [postId]: (prev[postId] || []).filter((c) => c.id !== comment.id),
            }));
            setPosts((prev) =>
              prev.map((p) =>
                p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 0) - 1) } : p
              )
            );
          } catch (err) {
            setError(extractErrorMessage(err, 'Could not delete comment'));
          } finally {
            setDeletingCommentId(null);
          }
        },
      },
    ]);
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
      data={feedListData}
      keyExtractor={(item) => item.key}
      contentContainerStyle={[styles.listContent, isDark && styles.screenDark]}
      ListHeaderComponent={
        <View>
          {liveStreams.length > 0 ? (
            <View style={[styles.liveWidget, isDark && styles.liveWidgetDark]}>
              <View style={styles.liveHeaderRow}>
                <Text style={[styles.liveTitle, isDark && styles.textPrimaryDark]}>Live Now</Text>
                <TouchableOpacity onPress={() => navigateToGoLive()}>
                  <Text style={styles.liveSeeAll}>See all</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveUsersRow}>
                {liveStreams.map((stream) => {
                  const streamer = stream?.streamer || {};
                  const name = `${streamer?.firstName || ''} ${streamer?.lastName || ''}`.trim() || stream?.title || 'Live user';
                  const photo = streamer?.photoUrl || streamer?.profilePhoto || null;
                  return (
                    <TouchableOpacity
                      key={`live-user-${stream.id}`}
                      style={styles.liveUserChip}
                      onPress={() => navigateToGoLive({ streamId: stream.id })}
                    >
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.liveAvatar} />
                      ) : (
                        <View style={styles.liveAvatarFallback}>
                          <Text style={styles.liveAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text numberOfLines={1} style={[styles.liveName, isDark && styles.textPrimaryDark]}>{name}</Text>
                      <View style={styles.liveDotWrap}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveTag}>LIVE</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.feedActionsWrap}>
            <TouchableOpacity style={styles.createPostButton} onPress={() => navigation.navigate('CreatePost')}>
              <Text style={styles.createPostButtonText}>Create Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryButton} onPress={() => navigation.navigate('Gallery')}>
              <Text style={styles.galleryButtonText}>My Gallery</Text>
            </TouchableOpacity>
          </View>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) =>
        item.type === 'ad' ? (
          <FeedAdSlot ads={feedAds} isDark={isDark} />
        ) : (
          <PostCard
            item={item.post}
            onToggleLike={onToggleLike}
            onToggleComments={onToggleComments}
            commentsOpen={openCommentsPostId === item.post.id}
            commentsData={commentsByPostId[item.post.id]}
            loadingComments={commentsLoadingPostId === item.post.id}
            newComment={commentDraftByPostId[item.post.id] || ''}
            setNewComment={(value) => setCommentDraftByPostId((prev) => ({ ...prev, [item.post.id]: value }))}
            onAddComment={onAddComment}
            isSendingComment={sendingCommentPostId === item.post.id}
            isDark={isDark}
            onOpenPost={openPostFullscreen}
            onOpenAuthorProfile={openAuthorProfile}
            currentUserId={user?.id}
            onDeletePost={onDeletePost}
            onDeleteComment={onDeleteComment}
            deletingPostId={deletingPostId}
            deletingCommentId={deletingCommentId}
          />
        )
      }
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: '#f1f5f9',
    minHeight: '100%',
  },
  screenDark: {
    backgroundColor: '#020617',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 22,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    shadowOpacity: 0.2,
  },
  cardSponsored: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  cardSponsoredDark: {
    borderColor: '#166534',
    backgroundColor: 'rgba(6,78,59,0.22)',
  },
  sponsoredBanner: {
    marginBottom: 12,
  },
  sponsoredBannerText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ca8a04',
    letterSpacing: 0.5,
  },
  authorRowHit: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  authorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  authorTextCol: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  deletePostBtn: {
    marginLeft: 8,
    padding: 4,
  },
  headerSponsorWrap: {
    marginLeft: 8,
    width: '44%',
    alignItems: 'flex-end',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackDark: {
    borderColor: '#1e293b',
    backgroundColor: '#2563eb',
  },
  avatarFallbackText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  authorName: {
    fontWeight: '700',
    fontSize: 16,
    color: '#0f172a',
  },
  authorDate: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748b',
  },
  textPrimaryDark: {
    color: '#e2e8f0',
  },
  textSecondaryDark: {
    color: '#cbd5e1',
  },
  textBodyDark: {
    color: '#e2e8f0',
  },
  textMutedDark: {
    color: '#94a3b8',
  },
  content: {
    color: '#1e293b',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationEmoji: {
    fontSize: 16,
    marginRight: 6,
    marginTop: 1,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  locationTextDark: {
    color: '#60a5fa',
  },
  media: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#f1f5f9',
  },
  videoWrap: {
    overflow: 'hidden',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
    backgroundColor: '#000',
  },
  videoWrapDark: {
    borderColor: '#334155',
  },
  videoFsBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderRadius: 10,
    padding: 8,
  },
  videoPlayer: {
    width: '100%',
    height: 240,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
    marginTop: 8,
  },
  pillBtnNeutral: {
    backgroundColor: '#f1f5f9',
  },
  pillBtnNeutralDark: {
    backgroundColor: '#334155',
  },
  pillBtnLikeActive: {
    backgroundColor: '#fee2e2',
  },
  pillBtnLikeActiveDark: {
    backgroundColor: '#7f1d1d',
  },
  pillBtnCommentOpen: {
    borderWidth: 1,
    borderColor: '#0f766e',
  },
  pillEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  pillCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  pillCountNeutral: {
    color: '#475569',
  },
  pillCountNeutralDark: {
    color: '#cbd5e1',
  },
  pillCountActive: {
    color: '#dc2626',
  },
  pillCountActiveDark: {
    color: '#fca5a5',
  },
  commentsWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
  },
  commentsWrapDark: {
    borderTopColor: '#334155',
  },
  commentItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  commentItemDark: {
    backgroundColor: '#111827',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  feedActionsWrap: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  headerScopeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    overflow: 'hidden',
    marginRight: 2,
  },
  headerScopeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  headerScopeBtnActive: {
    backgroundColor: '#0f766e',
  },
  headerScopeBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  headerScopeBtnTextActive: {
    color: '#fff',
  },
  liveWidget: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  liveWidgetDark: {
    backgroundColor: '#0f172a',
    borderColor: '#7f1d1d',
  },
  liveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveTitle: {
    fontWeight: '800',
    color: '#991b1b',
    fontSize: 16,
  },
  liveSeeAll: {
    color: '#0f766e',
    fontWeight: '700',
  },
  liveUsersRow: {
    paddingRight: 6,
  },
  liveUserChip: {
    width: 96,
    marginRight: 10,
    alignItems: 'center',
  },
  liveAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#e2e8f0',
  },
  liveAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveAvatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  liveName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  liveDotWrap: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveTag: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 11,
  },
  createPostButton: {
    flex: 1,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  createPostButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  galleryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  galleryButtonText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
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
