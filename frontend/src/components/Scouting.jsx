import { useLocation } from 'react-router-dom';
import ScoutingCompare from './scouting/ScoutingCompare';
import ScoutingDashboard from './scouting/ScoutingDashboard';
import ScoutingDiscover from './scouting/ScoutingDiscover';
import ScoutingLayout from './scouting/ScoutingLayout';
import ScoutingReports from './scouting/ScoutingReports';
import ScoutingShortlist from './scouting/ScoutingShortlist';
import ScoutingWatchlist from './scouting/ScoutingWatchlist';

export default function Scouting() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, '') || '/scouting';
  let page = <ScoutingDashboard />;
  if (path.endsWith('/discover')) page = <ScoutingDiscover />;
  else if (path.endsWith('/shortlist')) page = <ScoutingShortlist />;
  else if (path.endsWith('/watchlist')) page = <ScoutingWatchlist />;
  else if (path.endsWith('/reports')) page = <ScoutingReports />;
  else if (path.endsWith('/compare')) page = <ScoutingCompare />;

  return <ScoutingLayout>{page}</ScoutingLayout>;
}
