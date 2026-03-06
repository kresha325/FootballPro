import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function BottomNav() {
  const { user } = useAuth();
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');
  const getFullUrl = (url) => {
    if (!url) return '';
    const normalized = url.startsWith('https//')
      ? url.replace('https//', 'https://')
      : url.startsWith('http//')
        ? url.replace('http//', 'http://')
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:fixed md:right-6 md:top-1/2 md:-translate-y-1/2 md:left-auto md:bottom-auto bg-white dark:bg-gray-800 border-t md:border md:border-gray-200 dark:border-gray-700 md:rounded-full shadow-lg z-50 md:py-4 md:px-2 md:w-auto">
      <div className="flex md:flex-col gap-0 md:gap-6 items-center justify-around md:justify-center py-2 md:py-0 md:items-center">

        <NavLink
          to="/feed"
          className={({ isActive }) =>
            `flex flex-col md:flex-row items-center gap-1 px-4 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`
          }
          aria-label="Home"
        >
          <span className="text-2xl">🏠</span>
          <span className="text-xs md:hidden">Home</span>
        </NavLink>

        <NavLink
          to="/marketplace"
          className={({ isActive }) =>
            `flex flex-col md:flex-row items-center gap-1 px-4 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`
          }
          aria-label="Marketplace"
        >
          <span className="text-2xl">🛒</span>
          <span className="text-xs md:hidden">Shop</span>
        </NavLink>

        <NavLink
          to="/tournaments"
          className={({ isActive }) =>
            `flex flex-col md:flex-row items-center gap-1 px-4 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`
          }
          aria-label="Tournaments"
        >
          <span className="text-2xl">🏆</span>
          <span className="text-xs md:hidden">Cups</span>
        </NavLink>

        {user && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-live-modal'))}
            className={`flex flex-col md:flex-row items-center gap-1 px-4 py-2 transition-all hover:scale-110 text-red-600`}
            aria-label="Go Live"
          >
            <span className="text-2xl">🔴</span>
            <span className="text-xs md:hidden">Live</span>
          </button>
        )}



        <NavLink
          to={`/profile/${user?.id}`}
          className={({ isActive }) =>
            `flex flex-col md:flex-row items-center gap-1 px-4 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`
          }
          aria-label="Profile"
        >
          {user?.profilePhoto && typeof user.profilePhoto === 'string' && user.profilePhoto.trim() !== '' ? (
            <img
              src={getFullUrl(user.profilePhoto)}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover shadow-md border-2 border-blue-500"
              onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-md text-sm">
              {user?.firstName?.[0]}
            </div>
          )}
          <span className="text-xs md:hidden">Profile</span>
        </NavLink>

      </div>
    </nav>
  );
}

export default BottomNav;
