// Club logos mapping - add more as needed
export const getClubLogo = (clubName) => {
  if (!clubName) return null;
  
  const clubLower = clubName.toLowerCase();
  
  // Use club initials as fallback
  const getInitials = (name) => {
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    return words.map(w => w[0]).join('').toUpperCase().substring(0, 3);
  };

  // Map of club names to their colors
  const clubColors = {
    // Premier League
    'manchester united': { primary: '#DA291C', secondary: '#FBE122' },
    'man united': { primary: '#DA291C', secondary: '#FBE122' },
    'liverpool': { primary: '#C8102E', secondary: '#00B2A9' },
    'chelsea': { primary: '#034694', secondary: '#DBA111' },
    'arsenal': { primary: '#EF0107', secondary: '#FFFFFF' },
    'manchester city': { primary: '#6CABDD', secondary: '#1C2C5B' },
    'man city': { primary: '#6CABDD', secondary: '#1C2C5B' },
    'tottenham': { primary: '#132257', secondary: '#FFFFFF' },
    'spurs': { primary: '#132257', secondary: '#FFFFFF' },
    
    // La Liga
    'real madrid': { primary: '#FEBE10', secondary: '#00529F' },
    'barcelona': { primary: '#A50044', secondary: '#004D98' },
    'atletico madrid': { primary: '#CE3524', secondary: '#1b458f' },
    'atletico': { primary: '#CE3524', secondary: '#1b458f' },
    
    // Serie A
    'juventus': { primary: '#000000', secondary: '#FFFFFF' },
    'milan': { primary: '#FB090B', secondary: '#000000' },
    'ac milan': { primary: '#FB090B', secondary: '#000000' },
    'inter': { primary: '#0068A8', secondary: '#000000' },
    'inter milan': { primary: '#0068A8', secondary: '#000000' },
    
    // Bundesliga
    'bayern munich': { primary: '#DC052D', secondary: '#0066B2' },
    'bayern': { primary: '#DC052D', secondary: '#0066B2' },
    'borussia dortmund': { primary: '#FDE100', secondary: '#000000' },
    'dortmund': { primary: '#FDE100', secondary: '#000000' },
    
    // Ligue 1
    'psg': { primary: '#004170', secondary: '#DA020E' },
    'paris saint-germain': { primary: '#004170', secondary: '#DA020E' },
    'marseille': { primary: '#2FAEE0', secondary: '#FFFFFF' },
    
    // Other notable clubs
    'ajax': { primary: '#D2122E', secondary: '#FFFFFF' },
    'benfica': { primary: '#FF0000', secondary: '#FFFFFF' },
    'porto': { primary: '#003DA5', secondary: '#FFFFFF' },
    
    // Default for unknown clubs
    'default': { primary: '#3B82F6', secondary: '#8B5CF6' },
  };

  const colors = clubColors[clubLower] || clubColors['default'];
  
  return {
    initials: getInitials(clubName),
    colors: colors,
  };
};

export const ClubBadge = ({ clubName, size = 'md' }) => {
  if (!clubName) return null;
  
  const logo = getClubLogo(clubName);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-20 h-20 text-lg',
  };
  
  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-lg border-2 border-white dark:border-gray-800`}
      style={{
        background: `linear-gradient(135deg, ${logo.colors.primary} 0%, ${logo.colors.secondary} 100%)`,
      }}
      title={clubName}
    >
      {logo.initials}
    </div>
  );
};
