import React from 'react';

const CoachProfile = ({ profile, stats, isOwner }) => {
  const coachData = profile.stats || {};

  const getAffiliationLabel = (affiliation) => {
    const labels = {
      'club': 'Club Trainer',
      'independent': 'Independent',
      'personal_trainer': 'Personal Trainer'
    };
    return labels[affiliation] || affiliation;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'general_trainer': 'General Trainer',
      'assistant_trainer': 'Assistant Trainer',
      'fitness_trainer': 'Fitness/Conditional Trainer',
      'goalkeeper_trainer': 'Goalkeeper Trainer',
      'technical_trainer': 'Technical Trainer',
      'tactical_trainer': 'Tactical Trainer',
      'psychological_trainer': 'Psychological Trainer',
      'youth_trainer': 'Youth Trainer',
      'rehabilitation_trainer': 'Rehabilitation Trainer'
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      {/* Coach Type & Category */}
      {(profile.coachAffiliation || profile.coachCategory) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Coach Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.coachAffiliation && (
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Affiliation</div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {profile.coachAffiliation === 'club' && '🏟️ '}
                  {profile.coachAffiliation === 'independent' && '⚡ '}
                  {profile.coachAffiliation === 'personal_trainer' && '👤 '}
                  {getAffiliationLabel(profile.coachAffiliation)}
                </div>
              </div>
            )}
            {profile.coachCategory && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Specialization</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  📋 {getCategoryLabel(profile.coachCategory)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coaching Experience */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Coaching Experience</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{coachData.yearsExperience || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Years Experience</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{coachData.teamsCoached || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Teams Coached</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{coachData.trophies || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Trophies</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{coachData.winRate || 0}%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Win Rate</div>
          </div>
        </div>
      </div>

      {/* Coaching Philosophy */}
      {profile.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📋</span> Coaching Philosophy
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Certifications & Licenses */}
      {coachData.certifications && coachData.certifications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎓</span> Certifications & Licenses
          </h3>
          <div className="space-y-3">
            {coachData.certifications.map((cert, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white">
                  ✓
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{cert.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{cert.institution} • {cert.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Career History */}
      {profile.careerHistory && profile.careerHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏆</span> Coaching Career
          </h3>
          <div className="space-y-4">
            {profile.careerHistory.map((position, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {position.club?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{position.club}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{position.role} • {position.period}</p>
                  {position.achievements && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{position.achievements}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specializations */}
      {coachData.specializations && coachData.specializations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚽</span> Specializations
          </h3>
          <div className="flex flex-wrap gap-2">
            {coachData.specializations.map((spec, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachProfile;
