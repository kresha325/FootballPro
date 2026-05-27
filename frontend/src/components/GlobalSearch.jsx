import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { searchAPI } from '../services/api';

const TABS = [
  { id: 'discover', label: 'Zbulo', icon: SparklesIcon },
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

export default function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState(initialQ ? 'all' : 'discover');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(emptyResults);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingUsers, setTrendingUsers] = useState([]);
  const [recommendedUsers, setRecommendedUsers] = useState([]);

  const fetchDiscovery = useCallback(async () => {
    setLoading(true);
    try {
      const [trending, trendingUsersRes, recommended] = await Promise.all([
        searchAPI.getTrendingPosts(),
        searchAPI.getTrendingUsers(),
        searchAPI.getRecommended(),
      ]);
      setTrendingPosts(trending.data || []);
      setTrendingUsers(trendingUsersRes.data || []);
      setRecommendedUsers(recommended.data || []);
    } catch (err) {
      console.error('Discovery error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (q, tab) => {
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setResults(emptyResults());
      if (tab === 'discover') fetchDiscovery();
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
  }, [fetchDiscovery, setSearchParams]);

  useEffect(() => {
    if (initialQ) {
      runSearch(initialQ, activeTab === 'discover' ? 'all' : activeTab);
    } else if (activeTab === 'discover') {
      fetchDiscovery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (activeTab === 'discover' && query.trim()) {
      setActiveTab('all');
      runSearch(query, 'all');
      return;
    }
    if (activeTab === 'discover') return;
    runSearch(query, activeTab);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'discover') {
      setSearchParams({}, { replace: true });
      fetchDiscovery();
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
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Kërkim</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Përdorues, postime, turne, treg, transmetime, video dhe ndeshje — një vend për gjithçka.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko për emër, turne, produkt, stream…"
            className="w-full px-6 py-4 pl-14 text-lg border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50"
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
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : activeTab === 'discover' ? (
        <DiscoverPanel
          trendingPosts={trendingPosts}
          trendingUsers={trendingUsers}
          recommendedUsers={recommendedUsers}
          getFullUrl={getFullUrl}
        />
      ) : !query.trim() ? (
        <EmptyHint />
      ) : !hasAnyResult ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-16">Nuk u gjet asgjë për &quot;{query}&quot;</p>
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
    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
      <div className="text-5xl mb-4">🔍</div>
      <p>Shkruaj diçka ose zgjidh tab Discover për sugjerime.</p>
    </div>
  );
}

function DiscoverPanel({ trendingPosts, trendingUsers, recommendedUsers, getFullUrl }) {
  return (
    <div className="space-y-8">
      {trendingPosts.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <ArrowTrendingUpIcon className="w-6 h-6 text-orange-500" />
            Postime trending
          </h2>
          <PostResults posts={trendingPosts} getFullUrl={getFullUrl} compact />
        </section>
      ) : null}
      {trendingUsers.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Përdorues trending</h2>
          <UserResults users={trendingUsers} getFullUrl={getFullUrl} compact />
        </section>
      ) : null}
      {recommendedUsers.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Rekomanduar për ty</h2>
          <UserResults users={recommendedUsers} getFullUrl={getFullUrl} compact />
        </section>
      ) : null}
    </div>
  );
}

function UserResults({ users, getFullUrl, compact }) {
  return (
    <section>
      {!compact ? <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Përdorues</h2> : null}
      <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {users.map((user) => (
          <Link
            key={user.id}
            to={`/profile/${user.id}`}
            className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
              {user.Profile?.profilePhoto ? (
                <img src={getFullUrl(user.Profile.profilePhoto)} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-500 capitalize">
                {ROLE_ICONS[user.role] || '👤'} {user.role}
              </p>
              {user.Profile?.club ? (
                <p className="text-xs text-gray-500 truncate">{user.Profile.club}</p>
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
      {!compact ? <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Postime</h2> : null}
      <div className="space-y-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/feed?post=${post.id}`}
            className="block p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
          >
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {post.User?.firstName} {post.User?.lastName}
            </p>
            <p className="text-gray-700 dark:text-gray-300 line-clamp-2 mt-1">{post.content}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TournamentResults({ items }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Turne</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((t) => (
          <Link
            key={t.id}
            to={`/tournaments?tournamentId=${t.id}`}
            className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <p className="font-bold text-gray-900 dark:text-white">🏆 {t.name}</p>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductResults({ items, getFullUrl }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Produkte</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <Link
            key={p.id}
            to="/marketplace"
            className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            {p.imageUrl ? (
              <img src={getFullUrl(p.imageUrl)} alt="" className="h-24 w-full object-cover rounded-lg mb-2" />
            ) : null}
            <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
            <p className="text-sm text-emerald-600 font-semibold">{p.price} JonCoin</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StreamResults({ items }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Stream</h2>
      <div className="space-y-2">
        {items.map((s) => (
          <Link
            key={s.id}
            to={`/live/${s.id}`}
            className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <span className="font-semibold text-gray-900 dark:text-white">
              {s.isLive ? '🔴 ' : ''}
              {s.title}
            </span>
            <span className="text-sm text-gray-500">
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
      <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Video</h2>
      <div className="space-y-2">
        {items.map((v) => (
          <Link
            key={v.id}
            to={`/video/${v.id}`}
            className="block p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <p className="font-semibold text-gray-900 dark:text-white">{v.title}</p>
            <p className="text-sm text-gray-500">
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
      <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Ndeshje</h2>
      <div className="space-y-2">
        {items.map((m) => {
          const row = m.toJSON ? m.toJSON() : m;
          const home = `${row.homeUser?.firstName || ''} ${row.homeUser?.lastName || ''}`.trim();
          const away = `${row.awayUser?.firstName || ''} ${row.awayUser?.lastName || ''}`.trim();
          return (
            <Link
              key={row.id}
              to="/matches"
              className="block p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <p className="font-semibold text-gray-900 dark:text-white">
                {home || 'Home'} vs {away || 'Away'}
              </p>
              <p className="text-sm text-gray-500">
                {row.Tournament?.name} · {row.status}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
