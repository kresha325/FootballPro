import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { messagingAPI } from "../services/api";

function formatCartBadge(value) {
  const n = Number(value || 0);
  if (!n || n <= 0) return null;
  if (n > 99) return "99+";
  return String(n);
}

function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const { totalPieces } = useCart();
  const cartBadge = formatCartBadge(totalPieces);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const messagesBadge = formatCartBadge(messagesUnread);

  const fetchMessagesUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await messagingAPI.getUnreadCount();
      setMessagesUnread(
        Number(res?.data?.count ?? res?.data?.unreadCount ?? res?.data?.unread ?? 0)
      );
    } catch (_e) {
      // mbaj numrin e mëparshëm
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchMessagesUnread();
    const id = setInterval(fetchMessagesUnread, 30000);
    return () => clearInterval(id);
  }, [user, fetchMessagesUnread]);

  useEffect(() => {
    fetchMessagesUnread();
  }, [location.pathname, fetchMessagesUnread]);

  useEffect(() => {
    if (!user) return undefined;
    const onBump = () => {
      void fetchMessagesUnread();
    };
    window.addEventListener("messaging-unread-changed", onBump);
    return () => window.removeEventListener("messaging-unread-changed", onBump);
  }, [user, fetchMessagesUnread]);

  const rawApiUrl = import.meta.env.VITE_API_URL || "";
  const apiRoot = rawApiUrl ? rawApiUrl.replace("/api", "") : "";
  const getFullUrl = (url) => {
    if (!url) return "";
    const normalized = url.startsWith("https//")
      ? url.replace("https//", "https://")
      : url.startsWith("http//")
        ? url.replace("http//", "http://")
        : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    if (/(^|\/)default-avatar\.png$/i.test(normalized)) return "/default-avatar.svg";
    return apiRoot + (normalized.startsWith("/") ? normalized : "/" + normalized);
  };

  const homeLink = (extra = "") => (
    <NavLink
      to="/feed"
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"} ${extra}`
      }
      aria-label="Home"
    >
      <span className="text-2xl">🏠</span>
      <span className="text-xs">Home</span>
    </NavLink>
  );

  const shopLink = (extra = "") => (
    <NavLink
      to="/marketplace"
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"} ${extra}`
      }
      aria-label="Marketplace"
    >
      <span className="relative inline-flex items-center justify-center">
        <span className="text-2xl">🛒</span>
        {cartBadge ? (
          <span className="absolute -top-1 -right-2 min-h-[18px] min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {cartBadge}
          </span>
        ) : null}
      </span>
      <span className="text-xs">Shop</span>
    </NavLink>
  );

  const chatsLink = (opts = {}) => {
    const { elevated = false } = opts;
    if (!user) return null;
    return (
      <NavLink
        to="/messaging"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`
        }
        aria-label="Chats"
      >
        <span className="relative inline-flex items-center justify-center">
          <span className="text-2xl">💬</span>
          {messagesBadge ? (
            <span className="absolute -top-1 -right-2 min-h-[18px] min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {messagesBadge}
            </span>
          ) : null}
        </span>
        <span className="text-xs">Chats</span>
      </NavLink>
    );
  };

  const liveButton = (extra = "") =>
    user ? (
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("open-live-modal", { detail: { openCameraFirst: true } }))
        }
        className={`flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 text-red-600 ${extra}`}
        aria-label="Go Live"
      >
        <span className="text-2xl">🔴</span>
        <span className="text-xs">Live</span>
      </button>
    ) : null;

  const profileLink = (extra = "") => (
    <NavLink
      to={`/profile/${user?.id}`}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"} ${extra}`
      }
      aria-label="Profile"
    >
      {user?.profilePhoto && typeof user.profilePhoto === "string" && user.profilePhoto.trim() !== "" ? (
        <img
          src={getFullUrl(user.profilePhoto)}
          alt="Profile"
          className="w-8 h-8 rounded-full object-cover shadow-md border-2 border-blue-500"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = "none";
          }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-md text-sm">
          {user?.firstName?.[0]}
        </div>
      )}
      <span className="text-xs">Profile</span>
    </NavLink>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40 pb-[env(safe-area-inset-bottom,0px)]">
      {user ? (
        <div className="relative flex w-full items-end justify-between min-h-[56px] px-1 pb-1 pt-0.5">
          <div className="flex flex-1 justify-evenly items-end min-w-0 pr-11">{homeLink()} {shopLink()}</div>
          <div className="absolute left-1/2 bottom-1 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-auto">
            {chatsLink({ elevated: true })}
          </div>
          <div className="flex flex-1 justify-evenly items-end min-w-0 pl-11">{liveButton()} {profileLink()}</div>
        </div>
      ) : (
        <div className="flex items-center justify-around py-2">
          {homeLink()}
          {shopLink()}
          {profileLink()}
        </div>
      )}
    </nav>
  );
}

export default BottomNav;
