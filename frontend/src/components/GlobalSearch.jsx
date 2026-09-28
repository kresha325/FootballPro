import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { profileAPI, searchAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import VerifiedBadge from './VerifiedBadge';

const TABS = [
  { id: 'following', label: 'Duke ndjekur', icon: UserGroupIcon },
  { id: 'browse', label: 'Shfleto', icon: SparklesIcon },
  { id: 'all', label: 'Të gjitha' },
  { id: 'users', label: 'Përdorues' },
  { id: 'posts', label: 'Postime' },
  { id: 'tournaments', label: 'Turne' },
  { id: 'products', label: 'Tregu' },
  { id: 'streams', label: 'Transmetime' },
  { id: 'videos', label: 'Videot' },
  { id: 'matches', label: 'Ndeshje' },
];

const ROLE_ICONS = {
  athlete: '⚽',
  coach: '👨‍🏫',
  scout: '🔍',
  club: '🏟️',
};

function getApiRoot() {
  const raw = import.meta.env.VITE_API_URL || '';
  return raw ? raw.replace(/\/api\/?$/i, '').replace(/\/$/, '') : '';
}

function getFullUrl(url) {
  if (!url) return '';
  const apiRoot = getApiRoot();
  const normalized = url.startsWith('https//')
    ? url.replace('https//', 'https://')
    : url.startsWith('http//')
      ? url.replace('http//', 'http://')
      : url;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return apiRoot + (normalized.startsWith('/') ? normalized : `/${normalized}`);
}

const emptyResults = () => ({
  users: [],
  posts: [],
  tournaments: [],
  products: [],
  streams: [],
  videos: [],
  matches: [],
});

function mapFollowingRows(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((row) => {
      const u = row?.following || row;
      if (!u?.id) return null;
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        verified: u.verified,
        Profile: u.Profile || {
          profilePhoto: u.profilePhoto,
          club: u.club,
          position: u.position,
        },
      };
    })
    .filter(Boolean);
}

export default function GlobalSearch() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState(initialQ ? 'all' : 'following');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(emptyResults);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [browseUsers, setBrowseUsers] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingUsers, setTrendingUsers] = useState([]);

  const fetchFollowing = useCallback(async () => {
    if (!user?.id) {
      setFollowingUsers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await profileAPI.getFollowing(user.id);
      setFollowingUsers(mapFollowingRows(res.data));
    } catch (err) {
      console.error('Following list error:', err);
      setFollowingUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchBrowse = useCallback(async () => {
    setLoading(true);
    try {
      const [browseRes, trending, trendingUsersRes] = await Promise.all([
        searchAPI.getBrowseUsers({ limit: 40 }),
        searchAPI.getTrendingPosts().catch(() => ({ data: [] })),
        searchAPI.getTrendingUsers().catch(() => ({ data: [] })),
      ]);
      const rows = Array.isArray(browseRes.data) ? browseRes.data : browseRes.data?.users || [];
      setBrowseUsers(rows);
      setTrendingPosts(trending.data || []);
      setTrendingUsers(trendingUsersRes.data || []);
    } catch (err) {
      console.error('Browse error:', err);
      setBrowseUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (q, tab) => {
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setResults(emptyResults());
      if (tab === 'following') fetchFollowing();
      else if (tab === 'browse') fetchBrowse();
      return;
    }

    setLoading(true);
    setSearchParams({ q: trimmed }, { replace: true });

    try {
      if (tab === 'users') {
        const res = await searchAPI.searchUsers({ q: trimmed });
        setResults({ ...emptyResults(), users: res.data?.users || [] });
      } else if (tab === 'posts') {
        const res = await searchAPI.searchPosts({ q: trimmed });
        setResults({ ...emptyResults(), posts: res.data?.posts || [] });
      } else {
        const res = await searchAPI.search(trimmed);
        const data = res.data || {};
        setResults({
          users: data.users || [],
          posts: data.posts || [],
          tournaments: data.tournaments || [],
          products: data.products || [],
          streams: data.streams || [],
          videos: data.videos || [],
          matches: data.matches || [],
        });
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults(emptyResults());
    } finally {
      setLoading(false);
    }
  }, [fetchBrowse, fetchFollowing, setSearchParams]);

  useEffect(() => {
    if (initialQ) {
      runSearch(initialQ, activeTab === 'following' || activeTab === 'browse' ? 'all' : activeTab);
    } else if (activeTab === 'following') {
      fetchFollowing();
    } else if (activeTab === 'browse') {
      fetchBrowse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if ((activeTab === 'following' || activeTab === 'browse') && query.trim()) {
      setActiveTab('all');
      runSearch(query, 'all');
      return;
    }
    if (activeTab === 'following' || activeTab === 'browse') return;
    runSearch(query, activeTab);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'following') {
      setSearchParams({}, { replace: true });
      fetchFollowing();
      return;
    }
    if (tab === 'browse') {
      setSearchParams({}, { replace: true });
      fetchBrowse();
      return;
    }
    if (query.trim()) runSearch(query, tab);
  };

  const pick = (key) => {
    if (activeTab === 'all') return results[key] || [];
    if (activeTab === key) return results[key] || [];
    return [];
  };

  const users = pick('users');
  const posts = pick('posts');
  const tournaments = pick('tournaments');
  const products = pick('products');
  const streams = pick('streams');
  const videos = pick('videos');
  const matches = pick('matches');

  const hasAnyResult =
    users.length +
      posts.length +
      tournaments.length +
      products.length +
      streams.length +
      videos.length +
      matches.length >
    0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-[var(--xt-color-text)]">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-[var(--xt-color-text)]">Kërkim</h1>
        <p className="text-[var(--xt-color-text-muted)]">
          Duke ndjekur, Shfleto njerëz të rinj, ose kërko postime, turne dhe më shumë.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko për emër, turne, produkt, stream…"
            className="w-full rounded-2xl border border-[var(--xt-color-border-strong)] bg-[var(--xt-color-surface)] py-4 pl-14 pr-28 text-lg text-[var(--xt-color-text)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--xt-color-gold)]"
          />
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[var(--xt-color-text-subtle)]" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[var(--xt-color-gold)] px-6 py-2 font-medium text-[#101114] hover:opacity-95 disabled:opacity-50"
          >
            {loading ? '…' : 'Kërko'}
          </button>
        </div>
      </form>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 hide-scrollbar-mobile">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--xt-color-gold)] text-[#101114]'
                : 'bg-[var(--xt-color-surface-raised)] text-[var(--xt-color-text-muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--xt-color-gold)]" />
        </div>
      ) : activeTab === 'following' ? (
        <FollowingPanel users={followingUsers} getFullUrl={getFullUrl} />
      ) : activeTab === 'browse' ? (
        <BrowsePanel
          browseUsers={browseUsers}
          trendingPosts={trendingPosts}
          trendingUsers={trendingUsers}
          getFullUrl={getFullUrl}
        />
      ) : !query.trim() ? (
        <EmptyHint />
      ) : !hasAnyResult ? (
        <p className="py-16 text-center text-[var(--xt-color-text-muted)]">
          Nuk u gjet asgjë për &quot;{query}&quot;
        </p>
      ) : (
        <div className="space-y-10">
          {users.length > 0 ? <UserResults users={users} getFullUrl={getFullUrl} /> : null}
          {posts.length > 0 ? <PostResults posts={posts} getFullUrl={getFullUrl} /> : null}
          {tournaments.length > 0 ? <TournamentResults items={tournaments} /> : null}
          {products.length > 0 ? <ProductResults items={products} getFullUrl={getFullUrl} /> : null}
          {streams.length > 0 ? <StreamResults items={streams} /> : null}
          {videos.length > 0 ? <VideoResults items={videos} /> : null}
          {matches.length > 0 ? <MatchResults items={matches} /> : null}
        </div>
      )}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="py-16 text-center text-[var(--xt-color-text-muted)]">
      <div className="mb-4 text-5xl">🔍</div>
      <p>Shkruaj diçka, ose hap Shfleto për të gjetur njerëz të rinj.</p>
    </div>
  );
}

function FollowingPanel({ users, getFullUrl }) {
  if (!users.length) {
    return (
      <div className="py-16 text-center text-[var(--xt-color-text-muted)]">
        <p className="mb-2 font-semibold text-[var(--xt-color-text)]">Nuk po ndjek askënd ende</p>
        <p>Hap tab-in Shfleto për të zbuluar përdorues të tjerë.</p>
      </div>
    );
  }
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-[var(--xt-color-text)]">Duke ndjekur · {users.length}</h2>
      <UserResults users={users} getFullUrl={getFullUrl} compact />
    </section>
  );
}

function BrowsePanel({ browseUsers, trendingPosts, trendingUsers, getFullUrl }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-xl font-bold text-[var(--xt-color-text)]">Shfleto</h2>
        <p className="mb-4 text-sm text-[var(--xt-color-text-muted)]">
          Përdorues që nuk i ndjek — zbuloi dhe ndiq ata që të interesojnë.
        </p>
        {browseUsers.length > 0 ? (
          <UserResults users={browseUsers} getFullUrl={getFullUrl} compact />
        ) : (
          <p className="py-8 text-center text-[var(--xt-color-text-muted)]">
            Nuk ka përdorues të rinj për t’u shfletuar tani.
          </p>
        )}
      </section>
      {trendingPosts.length > 0 ? (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--xt-color-text)]">
            <ArrowTrendingUpIcon className="h-6 w-6 text-orange-500" />
            Postime trending
          </h2>
          <PostResults posts={trendingPosts} getFullUrl={getFullUrl} compact />
        </section>
      ) : null}
      {trendingUsers.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-bold text-[var(--xt-color-text)]">Përdorues trending</h2>
          <UserResults users={trendingUsers} getFullUrl={getFullUrl} compact />
        </section>
      ) : null}
    </div>
  );
}

function UserResults({ users, getFullUrl, compact }) {
  return (
    <section>
      {!compact ? <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Përdorues</h2> : null}
      <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {users.map((user) => (
          <Link
            key={user.id}
            to={`/profile/${user.id}`}
            className="flex items-center gap-4 rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--xt-color-gold-deep)] to-[var(--xt-color-gold)] text-xl font-bold text-white">
              {user.Profile?.profilePhoto ? (
                <img
                  src={getFullUrl(user.Profile.profilePhoto)}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
              )}
            </div>
            <div className="min-w-0">
              <p className="inline-flex max-w-full items-center gap-1 font-bold text-[var(--xt-color-text)]">
                <span className="truncate">
                  {user.firstName} {user.lastName}
                </span>
                <VerifiedBadge verified={user.verified} size="sm" />
              </p>
              <p className="text-sm capitalize text-[var(--xt-color-text-muted)]">
                {ROLE_ICONS[user.role] || '👤'} {user.role}
              </p>
              {user.Profile?.club ? (
                <p className="truncate text-xs text-[var(--xt-color-text-subtle)]">{user.Profile.club}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PostResults({ posts, compact }) {
  return (
    <section>
      {!compact ? <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Postime</h2> : null}
      <div className="space-y-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/feed?post=${post.id}`}
            className="block rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4 hover:bg-[var(--xt-color-surface-hover)]"
          >
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--xt-color-text)]">
              {post.User?.firstName || post.author?.firstName}{' '}
              {post.User?.lastName || post.author?.lastName}
              <VerifiedBadge verified={post.User?.verified || post.author?.verified} size="sm" />
            </p>
            <p className="mt-1 line-clamp-2 text-[var(--xt-color-text-muted)]">{post.content}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TournamentResults({ items }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Turne</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((t) => (
          <Link
            key={t.id}
            to={`/tournaments?tournamentId=${t.id}`}
            className="rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4"
          >
            <p className="font-bold text-[var(--xt-color-text)]">🏆 {t.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--xt-color-text-muted)]">{t.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductResults({ items, getFullUrl }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Produkte</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Link
            key={p.id}
            to="/marketplace"
            className="rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4"
          >
            {p.imageUrl ? (
              <img src={getFullUrl(p.imageUrl)} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
            ) : null}
            <p className="font-bold text-[var(--xt-color-text)]">{p.name}</p>
            <p className="text-sm font-semibold text-emerald-600">{p.price} XCoin</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StreamResults({ items }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Stream</h2>
      <div className="space-y-2">
        {items.map((s) => (
          <Link
            key={s.id}
            to={`/live/${s.id}`}
            className="flex items-center justify-between rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4"
          >
            <span className="font-semibold text-[var(--xt-color-text)]">
              {s.isLive ? '🔴 ' : ''}
              {s.title}
            </span>
            <span className="text-sm text-[var(--xt-color-text-muted)]">
              {s.streamer?.firstName} {s.streamer?.lastName}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function VideoResults({ items }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Video</h2>
      <div className="space-y-2">
        {items.map((v) => (
          <Link
            key={v.id}
            to={`/video/${v.id}`}
            className="block rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4"
          >
            <p className="font-semibold text-[var(--xt-color-text)]">{v.title}</p>
            <p className="text-sm text-[var(--xt-color-text-muted)]">
              {v.User?.firstName} {v.User?.lastName}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MatchResults({ items }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-[var(--xt-color-text)]">Ndeshje</h2>
      <div className="space-y-2">
        {items.map((m) => {
          const row = m.toJSON ? m.toJSON() : m;
          const home = `${row.homeUser?.firstName || ''} ${row.homeUser?.lastName || ''}`.trim();
          const away = `${row.awayUser?.firstName || ''} ${row.awayUser?.lastName || ''}`.trim();
          return (
            <Link
              key={row.id}
              to="/matches"
              className="block rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4"
            >
              <p className="font-semibold text-[var(--xt-color-text)]">
                {home || 'Home'} vs {away || 'Away'}
              </p>
              <p className="text-sm text-[var(--xt-color-text-muted)]">
                {row.Tournament?.name} · {row.status}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
