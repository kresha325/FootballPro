import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  createCommentRequest,
  deleteCommentRequest,
  deletePostRequest,
  extractErrorMessage,
  likePostRequest,
  postCommentsRequest,
  unlikePostRequest,
} from '../api/client';
import PostSponsorStrip, { SponsoredLabel } from '../components/PostSponsorStrip';
import { useAuth } from '../context/AuthContext';

function normalizePostSponsors(p) {
  if (!p || typeof p !== 'object') return p;
  const raw = p.sponsors ?? p.Sponsors;
  const sponsors = Array.isArray(raw) ? raw : [];
  return { ...p, sponsors };
}

function postAuthorId(item) {
  if (!item || typeof item !== 'object') return null;
  const a = item.author;
  const id = a && typeof a === 'object' ? a.id : null;
  return id != null ? id : item.userId ?? null;
}

const viewabilityConfig = {
  itemVisiblePercentThreshold: 55,
};

const CHROME_SLIDE_DOWN = 520;
const CHROME_SLIDE_UP = 200;

function FeedPagerPage({
  item,
  index,
  isActive,
  isDark,
  pageW,
  pageH,
  insets,
  navigation,
  commentsOpen,
  commentsData,
  commentsLoading,
  commentDraft,
  onChangeDraft,
  sendingComment,
  onToggleLike,
  onToggleComments,
  onAddComment,
  onOpenAuthorProfile,
  currentUserId,
  onDeletePost,
  onDeleteComment,
  deletingPostId,
  deletingCommentId,
}) {
  const [chromeHidden, setChromeHidden] = useState(false);
  const bottomChromeAnim = useRef(new Animated.Value(0)).current;
  const topChromeAnim = useRef(new Animated.Value(0)).current;

  const author = item?.author ? `${item.author.firstName || ''} ${item.author.lastName || ''}`.trim() : 'Unknown';
  const authorId = postAuthorId(item);
  const avatarUrl = item?.author?.profilePhoto || null;
  const isLiked = !!item?.isLiked;
  const hasImage = !!item?.imageUrl;
  const hasVideo = !!item?.videoUrl;
  const sponsors = Array.isArray(item?.sponsors) ? item.sponsors : Array.isArray(item?.Sponsors) ? item.Sponsors : [];
  const hasSponsors = sponsors.length > 0;
  const isOwnPost =
    currentUserId != null && authorId != null && String(currentUserId) === String(authorId);

  useEffect(() => {
    setChromeHidden(false);
  }, [index, item?.id]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bottomChromeAnim, {
        toValue: chromeHidden ? 1 : 0,
        useNativeDriver: true,
        friction: 9,
        tension: 65,
      }),
      Animated.spring(topChromeAnim, {
        toValue: chromeHidden ? 1 : 0,
        useNativeDriver: true,
        friction: 9,
        tension: 65,
      }),
    ]).start();
  }, [chromeHidden, bottomChromeAnim, topChromeAnim]);

  const toggleChrome = useCallback(() => {
    if (commentsOpen) {
      onToggleComments(item.id);
      return;
    }
    setChromeHidden((v) => !v);
  }, [commentsOpen, item.id, onToggleComments]);

  const bottomSlide = bottomChromeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CHROME_SLIDE_DOWN],
  });
  const bottomOpacity = bottomChromeAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [1, 0.85, 0],
  });
  const topSlide = topChromeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -CHROME_SLIDE_UP],
  });
  const topOpacity = topChromeAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1, 0.9, 0],
  });

  return (
    <View style={[styles.page, { width: pageW, height: pageH, backgroundColor: isDark ? '#020617' : '#0f172a' }]}>
      <View style={styles.mediaTapLayer} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={toggleChrome}>
          {hasVideo ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <Video
                source={{ uri: item.videoUrl }}
                style={StyleSheet.absoluteFillObject}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay={isActive}
                isMuted={!isActive}
                useNativeControls={false}
              />
            </View>
          ) : hasImage ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[styles.noMedia, { backgroundColor: isDark ? '#0f172a' : '#1e293b' }]}>
              <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
            </View>
          )}
        </Pressable>
      </View>

      <View style={[styles.closeBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        {isOwnPost && onDeletePost ? (
          <TouchableOpacity
            onPress={() => onDeletePost(item)}
            style={styles.deleteBtn}
            disabled={deletingPostId === item.id}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Delete post"
          >
            <Ionicons name="trash-outline" size={24} color="#fca5a5" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 6 },
          {
            opacity: topOpacity,
            transform: [{ translateY: topSlide }],
          },
        ]}
        pointerEvents={chromeHidden ? 'none' : 'auto'}
      >
        <View style={styles.topBarSpacer} />
        <View style={styles.topBarSpacer} />
        {hasSponsors ? (
          <View style={styles.topSponsorSlot}>
            <SponsoredLabel isDark />
            <PostSponsorStrip sponsors={sponsors} isDark={false} variant="overlay" />
          </View>
        ) : (
          <View style={styles.topBarSpacer} />
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.bottomFade,
          { paddingBottom: insets.bottom + 10 },
          {
            opacity: bottomOpacity,
            transform: [{ translateY: bottomSlide }],
          },
        ]}
        pointerEvents={chromeHidden ? 'none' : 'auto'}
      >
        <TouchableOpacity
          style={styles.authorRow}
          activeOpacity={0.85}
          onPress={() => onOpenAuthorProfile?.(authorId)}
          disabled={!authorId || !onOpenAuthorProfile}
          accessibilityRole="button"
          accessibilityLabel="Hap profilin e autorit"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{(author || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.authorName} numberOfLines={1}>
            {author}
          </Text>
        </TouchableOpacity>

        {item?.content ? (
          <Text style={styles.caption} numberOfLines={6}>
            {item.content}
          </Text>
        ) : null}

        <Text style={styles.meta}>
          {item?.likes || 0} pëlqime · {item?.comments || 0} komente
        </Text>

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.actionPill, isLiked && styles.actionPillActive]}
            onPress={() => onToggleLike(item)}
          >
            <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>{isLiked ? 'Unlike' : 'Like'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionPill, styles.actionPillSecond]} onPress={() => onToggleComments(item.id)}>
            <Text style={styles.actionText}>{commentsOpen ? 'Mbyll komentet' : 'Komentet'}</Text>
          </TouchableOpacity>
        </View>

        {commentsOpen ? (
          <View style={styles.commentsBox}>
            {commentsLoading ? <ActivityIndicator color="#5eead4" /> : null}
            {(commentsData || []).slice(0, 8).map((comment) => {
              const commentUser = comment?.User;
              const name = commentUser ? `${commentUser.firstName || ''} ${commentUser.lastName || ''}`.trim() : 'User';
              const commentUserId = comment?.userId ?? commentUser?.id;
              const isOwnComment =
                currentUserId != null &&
                commentUserId != null &&
                String(currentUserId) === String(commentUserId);
              return (
                <View key={String(comment.id)} style={styles.commentRow}>
                  <View style={styles.commentRowHeader}>
                    <Text style={styles.commentAuthor}>{name}</Text>
                    {isOwnComment && onDeleteComment ? (
                      <TouchableOpacity
                        onPress={() => onDeleteComment(comment, item.id)}
                        disabled={deletingCommentId === comment.id}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#fca5a5" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.commentBody}>{comment.content}</Text>
                </View>
              );
            })}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={onChangeDraft}
                placeholder="Shkruaj koment..."
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={[styles.sendBtn, sendingComment && styles.sendBtnDisabled]}
                onPress={() => onAddComment(item.id)}
                disabled={sendingComment}
              >
                <Text style={styles.sendBtnText}>{sendingComment ? '…' : 'Dërgo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export default function FeedPostPagerScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const { posts: routePosts = [], initialIndex = 0, onPostUpdated } = route.params || {};

  const rawLenInit = Array.isArray(routePosts) ? routePosts.length : 0;
  const initialStartIdx = rawLenInit === 0 ? 0 : Math.min(Math.max(0, initialIndex), rawLenInit - 1);

  const [posts, setPosts] = useState(() =>
    (Array.isArray(routePosts) ? routePosts : []).map((p) => normalizePostSponsors(p))
  );
  const [activeIndex, setActiveIndex] = useState(initialStartIdx);
  const activeIndexRef = useRef(initialStartIdx);
  const flatRef = useRef(null);
  const [viewport, setViewport] = useState({ w: winW, h: winH });
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);
  const [commentsByPostId, setCommentsByPostId] = useState({});
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState(null);
  const [commentDraftByPostId, setCommentDraftByPostId] = useState({});
  const [sendingCommentPostId, setSendingCommentPostId] = useState(null);
  const [bannerError, setBannerError] = useState('');
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const notifyParent = useCallback(
    (postId, updates) => {
      try {
        onPostUpdated?.(postId, updates);
      } catch (_e) {}
    },
    [onPostUpdated]
  );

  const patchPost = useCallback(
    (postId, updates) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)));
      notifyParent(postId, updates);
    },
    [notifyParent]
  );

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useFocusEffect(
    useCallback(() => {
      const nextIdx = Math.min(Math.max(0, initialIndex ?? 0), Math.max(0, posts.length - 1));
      activeIndexRef.current = nextIdx;
      setActiveIndex(nextIdx);

      const p1 = navigation.getParent?.();
      p1?.setOptions?.({ tabBarStyle: { display: 'none', height: 0 } });
      const p2 = p1?.getParent?.();
      p2?.setOptions?.({ tabBarStyle: { display: 'none', height: 0 } });

      return () => {
        p1?.setOptions?.({ tabBarStyle: undefined });
        p2?.setOptions?.({ tabBarStyle: undefined });
      };
    }, [navigation, initialIndex, posts.length])
  );

  const onRootLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setViewport((prev) => {
      if (Math.abs(prev.h - height) < 1 && Math.abs(prev.w - width) < 1) return prev;
      return { w: width, h: height };
    });
  }, []);

  useLayoutEffect(() => {
    if (!posts.length || viewport.h <= 0) return;
    requestAnimationFrame(() => {
      flatRef.current?.scrollToOffset({
        offset: activeIndexRef.current * viewport.h,
        animated: false,
      });
    });
  }, [viewport.h, viewport.w, posts.length]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const i = viewableItems[0]?.index;
    if (typeof i === 'number') {
      setActiveIndex(i);
    }
  }).current;

  const onToggleLike = useCallback(
    async (post) => {
      const targetId = post.id;
      const currentlyLiked = !!post.isLiked;
      patchPost(targetId, {
        isLiked: !currentlyLiked,
        likes: Math.max(0, (post.likes || 0) + (currentlyLiked ? -1 : 1)),
      });
      try {
        if (currentlyLiked) {
          await unlikePostRequest(targetId);
        } else {
          await likePostRequest(targetId);
        }
      } catch (err) {
        patchPost(targetId, {
          isLiked: currentlyLiked,
          likes: Math.max(0, (post.likes || 0) + (currentlyLiked ? 1 : -1)),
        });
        setBannerError(extractErrorMessage(err, 'Could not update like'));
      }
    },
    [patchPost]
  );

  const loadComments = useCallback(async (postId) => {
    setCommentsLoadingPostId(postId);
    try {
      const response = await postCommentsRequest(postId);
      const list = Array.isArray(response.data) ? response.data : [];
      setCommentsByPostId((prev) => ({ ...prev, [postId]: list }));
    } catch (err) {
      setBannerError(extractErrorMessage(err, 'Could not load comments'));
    } finally {
      setCommentsLoadingPostId(null);
    }
  }, []);

  const onToggleComments = useCallback(
    async (postId) => {
      if (openCommentsPostId === postId) {
        setOpenCommentsPostId(null);
        return;
      }
      setOpenCommentsPostId(postId);
      await loadComments(postId);
    },
    [loadComments, openCommentsPostId]
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

  const onDeletePost = useCallback(
    (post) => {
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
              notifyParent(post.id, { deleted: true });
              setPosts((prev) => {
                const next = prev.filter((p) => p.id !== post.id);
                if (next.length === 0) {
                  navigation.goBack();
                }
                return next;
              });
            } catch (err) {
              setBannerError(extractErrorMessage(err, 'Could not delete post'));
            } finally {
              setDeletingPostId(null);
            }
          },
        },
      ]);
    },
    [deletingPostId, navigation, notifyParent]
  );

  const onDeleteComment = useCallback(
    (comment, postId) => {
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
              setPosts((prev) => {
                const next = prev.map((p) =>
                  p.id === postId ? { ...p, comments: Math.max(0, (p.comments || 0) - 1) } : p
                );
                const row = next.find((p) => p.id === postId);
                if (row) notifyParent(postId, { comments: row.comments });
                return next;
              });
            } catch (err) {
              setBannerError(extractErrorMessage(err, 'Could not delete comment'));
            } finally {
              setDeletingCommentId(null);
            }
          },
        },
      ]);
    },
    [deletingCommentId, notifyParent]
  );

  const onAddComment = useCallback(
    async (postId) => {
      const content = (commentDraftByPostId[postId] || '').trim();
      if (!content) return;
      try {
        setSendingCommentPostId(postId);
        await createCommentRequest(postId, content);
        setCommentDraftByPostId((prev) => ({ ...prev, [postId]: '' }));
        setPosts((prev) => {
          const next = prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p));
          const row = next.find((p) => p.id === postId);
          if (row) notifyParent(postId, { comments: row.comments });
          return next;
        });
        await loadComments(postId);
      } catch (err) {
        setBannerError(extractErrorMessage(err, 'Could not add comment'));
      } finally {
        setSendingCommentPostId(null);
      }
    },
    [commentDraftByPostId, loadComments, notifyParent]
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: viewport.h,
      offset: viewport.h * index,
      index,
    }),
    [viewport.h]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <FeedPagerPage
        item={item}
        index={index}
        isActive={index === activeIndex}
        isDark={isDark}
        pageW={viewport.w}
        pageH={viewport.h}
        insets={insets}
        navigation={navigation}
        commentsOpen={openCommentsPostId === item.id}
        commentsData={commentsByPostId[item.id]}
        commentsLoading={commentsLoadingPostId === item.id}
        commentDraft={commentDraftByPostId[item.id] || ''}
        onChangeDraft={(v) => setCommentDraftByPostId((prev) => ({ ...prev, [item.id]: v }))}
        sendingComment={sendingCommentPostId === item.id}
        onToggleLike={onToggleLike}
        onToggleComments={onToggleComments}
        onAddComment={onAddComment}
        onOpenAuthorProfile={openAuthorProfile}
        currentUserId={user?.id}
        onDeletePost={onDeletePost}
        onDeleteComment={onDeleteComment}
        deletingPostId={deletingPostId}
        deletingCommentId={deletingCommentId}
      />
    ),
    [
      activeIndex,
      commentDraftByPostId,
      commentsByPostId,
      commentsLoadingPostId,
      deletingCommentId,
      deletingPostId,
      insets,
      isDark,
      onDeleteComment,
      onDeletePost,
      user?.id,
      navigation,
      onAddComment,
      onToggleComments,
      onToggleLike,
      openAuthorProfile,
      openCommentsPostId,
      viewport.h,
      viewport.w,
      posts.length,
      sendingCommentPostId,
    ]
  );

  if (!posts.length) {
    return (
      <View style={[styles.emptyWrap, isDark && styles.emptyWrapDark]}>
        <Text style={styles.emptyText}>Nuk ka postime.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Kthehu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {bannerError ? (
        <View style={[styles.errorToast, { top: insets.top + 52 }]}>
          <Text style={styles.errorToastText}>{bannerError}</Text>
          <TouchableOpacity onPress={() => setBannerError('')}>
            <Text style={styles.errorDismiss}>OK</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        ref={flatRef}
        style={styles.listFill}
        data={posts}
        keyExtractor={(it, idx) => String(it?.id ?? idx)}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyboardShouldPersistTaps="handled"
        extraData={`${viewport.h}-${viewport.w}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  listFill: {
    flex: 1,
  },
  page: {
    position: 'relative',
  },
  mediaTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  closeBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
    elevation: 50,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMedia: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    zIndex: 30,
    elevation: 30,
  },
  topBarSpacer: {
    width: 44,
    minHeight: 44,
  },
  topSponsorSlot: {
    maxWidth: '46%',
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    elevation: 25,
    paddingHorizontal: 16,
    paddingTop: 48,
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  authorName: {
    flex: 1,
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  caption: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  meta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 10,
  },
  rowActions: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  actionPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  actionPillSecond: {
    marginLeft: 10,
  },
  actionPillActive: {
    borderColor: '#5eead4',
    backgroundColor: 'rgba(20,184,166,0.25)',
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  actionTextActive: {
    color: '#5eead4',
  },
  commentsBox: {
    maxHeight: 220,
    marginTop: 4,
  },
  commentRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentRow: {
    marginBottom: 8,
  },
  commentAuthor: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 13,
  },
  commentBody: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  errorToast: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(127,29,29,0.92)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 40,
    elevation: 8,
  },
  errorToastText: {
    color: '#fecaca',
    flex: 1,
    marginRight: 8,
    fontSize: 13,
  },
  errorDismiss: {
    color: '#fff',
    fontWeight: '800',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyWrapDark: {
    backgroundColor: '#020617',
  },
  emptyText: {
    color: '#64748b',
    marginBottom: 12,
  },
  backLink: {
    padding: 10,
  },
  backLinkText: {
    color: '#0f766e',
    fontWeight: '700',
  },
});
