import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { UserIcon } from '@heroicons/react/24/outline';
import { profileAPI } from '../services/api';
import { getFullUrl } from '../utils/mediaUrl';

/** Dwell times (ms) cycle so each profile stays on screen for a different duration. */
const DWELL_MS = [4200, 5600, 4800, 6400, 5000, 5800];

function playerMeta(player) {
  return [player.position, player.age != null ? `${player.age} vjeç` : null, player.club, player.city]
    .filter(Boolean)
    .join(' · ');
}

function playerName(player) {
  return [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Lojtar';
}

/**
 * Rotating real athlete cards for the landing platform preview.
 */
export default function LandingPlayerShowcase() {
  const reduceMotion = useReducedMotion();
  const [players, setPlayers] = useState([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.getLandingShowcase({ limit: 8 });
        const list = Array.isArray(res?.data?.players) ? res.data.players : [];
        if (!cancelled) setPlayers(list);
      } catch {
        if (!cancelled) setPlayers([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dwell = DWELL_MS[index % DWELL_MS.length];

  useEffect(() => {
    if (reduceMotion || players.length < 2) return undefined;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % players.length);
    }, dwell);
    return () => window.clearTimeout(timer);
  }, [index, dwell, players.length, reduceMotion]);

  const player = players[index] || null;
  const photo = player?.profilePhoto ? getFullUrl(player.profilePhoto) : '';
  const progressKey = useMemo(() => `${index}-${dwell}`, [index, dwell]);

  if (!loaded) {
    return (
      <div className="xt-preview-profile xt-preview-profile--live">
        <div className="xt-player-silhouette xt-player-silhouette--loading" />
        <span className="xt-preview-tag">LOJTARËT NË PLATFORMË</span>
        <h3>Duke ngarkuar…</h3>
        <p>Profile reale nga X TALENTI</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="xt-preview-profile">
        <div className="xt-player-silhouette">
          <UserIcon className="h-12 w-12" />
        </div>
        <span className="xt-preview-tag">PLAYER PROFILE</span>
        <h3>Player Profile</h3>
        <p>Profile · CV · Highlights</p>
        <div className="xt-progress">
          <span />
        </div>
        <small>PROFILE COMPLETION</small>
      </div>
    );
  }

  return (
    <div className="xt-preview-profile xt-preview-profile--live" aria-live="polite">
      <div className="xt-player-photo-wrap">
        {photo ? (
          <img
            key={player.id}
            src={photo}
            alt={playerName(player)}
            className="xt-player-photo"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="xt-player-silhouette">
            <span className="xt-player-initials" aria-hidden="true">
              {playerName(player)
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </span>
          </div>
        )}
        {players.length > 1 ? (
          <div className="xt-player-dots" aria-hidden="true">
            {players.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={i === index ? 'is-active' : ''}
                onClick={() => setIndex(i)}
                aria-label={`Shfaq ${playerName(p)}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <span className="xt-preview-tag">LOJTARËT NË PLATFORMË</span>
      <h3>
        {playerName(player)}
        {player.verified ? <span className="xt-verified-dot" title="I verifikuar" /> : null}
      </h3>
      <p>{playerMeta(player) || 'Profil publik në X TALENTI'}</p>
      <div className="xt-progress xt-progress--timed" key={progressKey}>
        <span
          style={
            reduceMotion || players.length < 2
              ? { width: '100%', animation: 'none' }
              : { animationDuration: `${dwell}ms` }
          }
        />
      </div>
      <small>
        {players.length > 1
          ? `${index + 1} / ${players.length} · ndërron çdo ${(dwell / 1000).toFixed(1)}s`
          : 'PROFIL REAL'}
      </small>
      <Link to="/register" className="xt-preview-cta">
        Krijo profilin tënd
      </Link>
    </div>
  );
}
