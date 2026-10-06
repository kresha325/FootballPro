import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const PlatformContext = createContext({ features: null, maintenance: null });

export function PlatformProvider({ children }) {
  const [data, setData] = useState({ features: null, maintenance: null });
  useEffect(() => {
    api.get('/config/public')
      .then((res) => setData({
        features: res.data?.features || {},
        maintenance: res.data?.maintenance || null,
      }))
      .catch(() => setData({ features: {}, maintenance: null }));
    const onMaintenance = (event) => {
      setData((prev) => ({ ...prev, maintenance: event.detail }));
    };
    window.addEventListener('xt-maintenance', onMaintenance);
    return () => window.removeEventListener('xt-maintenance', onMaintenance);
  }, []);
  return <PlatformContext.Provider value={data}>{children}</PlatformContext.Provider>;
}

export function MaintenanceBanner() {
  const { user } = useAuth();
  const { maintenance } = useContext(PlatformContext);
  if (!maintenance?.enabled || user?.role === 'admin') return null;
  return (
    <div className="bg-amber-100 px-4 py-3 text-center text-sm text-amber-950">
      {maintenance.message || 'FootballPro is under maintenance.'}
      {maintenance.estimatedMinutes ? ` Estimated ${maintenance.estimatedMinutes} minutes.` : ''}
    </div>
  );
}

export function FeatureGate({ flag, children }) {
  const { user } = useAuth();
  const { features } = useContext(PlatformContext);
  if (user?.role === 'admin') return children;
  if (!features || features[flag] !== false) return children;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">This feature is disabled</h1>
      <p className="mt-2 text-sm text-gray-600">An administrator has turned off {flag.split('_').join(' ').toLowerCase()}.</p>
    </div>
  );
}
