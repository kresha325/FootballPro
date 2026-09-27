import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { messagingAPI } from "../services/api";
import { HomeIcon, ShoppingBagIcon, ChatBubbleLeftRightIcon, VideoCameraIcon } from "@heroicons/react/24/outline";

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
        `flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[var(--xt-color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--xt-color-gold-bright)] ${isActive ? "text-[var(--xt-color-gold-bright)]" : ""} ${extra}`
      }
      aria-label="Ballina"
    >
      <HomeIcon className="h-5 w-5" aria-hidden="true" />
      <span className="text-[10px] font-medium">Ballina</span>
    </NavLink>
  );

  const shopLink = (extra = "") => (
    <NavLink
      to="/marketplace"
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"} ${extra}`
      }
      aria-label="Tregu"
    >
      <span className="relative inline-flex items-center justify-center">
        <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
        {cartBadge ? (
          <span className="absolute -top-1 -right-2 min-h-[18px] min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {cartBadge}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] font-medium">Tregu</span>
    </NavLink>
  );

  const chatsLink = () => {
    if (!user) return null;
    return (
      <NavLink
        to="/messaging"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 px-3 py-2 transition-all hover:scale-110 ${isActive ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`
        }
        aria-label="Bisedat"
      >
        <span className="relative inline-flex items-center justify-center">
          <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
          {messagesBadge ? (
            <span className="absolute -top-1 -right-2 min-h-[18px] min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {messagesBadge}
            </span>
          ) : null}
        </span>
        <span className="text-[10px] font-medium">Biseda</span>
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
        className={`flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[var(--xt-color-danger)] transition-colors hover:bg-white/5 ${extra}`}
        aria-label="Dil LIVE"
      >
        <VideoCameraIcon className="h-5 w-5" aria-hidden="true" />
        <span className="text-[10px] font-medium">LIVE</span>
      </button>
    ) : null;

  const profileLink = (extra = "") => (
    <NavLink
      to={`/profile/${user?.id}`}
      className={({ isActive }) =>
        `flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[var(--xt-color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--xt-color-gold-bright)] ${isActive ? "text-[var(--xt-color-gold-bright)]" : ""} ${extra}`
      }
      aria-label="Profili"
    >
      {user?.profilePhoto && typeof user.profilePhoto === "string" && user.profilePhoto.trim() !== "" ? (
        <img
          src={getFullUrl(user.profilePhoto)}
          alt="Profile"
          className="h-7 w-7 rounded-full border border-white/20 object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = "none";
          }}
        />
      ) : (
        <div className="xt-avatar h-7 w-7 text-xs">
          {user?.firstName?.[0]}
        </div>
      )}
      <span className="text-[10px] font-medium">Profili</span>
    </NavLink>
  );

  return (
    <nav className="xt-bottom-nav fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
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
