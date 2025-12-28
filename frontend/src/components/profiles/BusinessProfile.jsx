import React from 'react';

const BusinessProfile = ({ profile, stats, isOwner }) => {
  const businessData = profile.stats || {};

  return (
    <div className="space-y-6">
      {/* Business Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Business Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Name</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{profile.club || profile.firstName + ' ' + profile.lastName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Industry</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{businessData.industry || 'Sports & Recreation'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Founded</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{businessData.founded || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Size</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{businessData.companySize || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Business Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">💰</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{businessData.revenue || 'N/A'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Annual Revenue</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">👥</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{businessData.employees || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Employees</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">🤝</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{businessData.partnerships || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Partnerships</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">🌍</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{businessData.countries || 1}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Countries</div>
          </div>
        </div>
      </div>

      {/* About Business */}
      {profile.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>ℹ️</span> About Us
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Services / Products */}
      {businessData.services && businessData.services.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📦</span> Services & Products
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {businessData.services.map((service, index) => (
              <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{service.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sponsorships */}
      {businessData.sponsorships && businessData.sponsorships.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🤝</span> Sponsorships & Partnerships
          </h3>
          <div className="space-y-3">
            {businessData.sponsorships.map((sponsor, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {sponsor.name?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{sponsor.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{sponsor.type} • {sponsor.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <span>📞</span> Contact & Location
        </h3>
        <div className="space-y-3">
          {profile.contact?.phone && (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <span className="text-gray-700 dark:text-gray-300">{profile.contact.phone}</span>
            </div>
          )}
          {profile.contact?.email && (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📧</span>
              <span className="text-gray-700 dark:text-gray-300">{profile.contact.email}</span>
            </div>
          )}
          {businessData.website && (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <a href={businessData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                {businessData.website}
              </a>
            </div>
          )}
          {profile.city && (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📍</span>
              <span className="text-gray-700 dark:text-gray-300">
                {profile.city}{profile.country && `, ${profile.country}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Certifications & Awards */}
      {businessData.awards && businessData.awards.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🏆</span> Awards & Recognition
          </h3>
          <div className="flex flex-wrap gap-2">
            {businessData.awards.map((award, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-sm font-medium"
              >
                🏅 {award}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessProfile;
