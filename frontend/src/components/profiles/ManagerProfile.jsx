import React from 'react';

const ManagerProfile = ({ profile, stats, isOwner }) => {
  const managerData = profile.stats || {};

  return (
    <div className="space-y-6">
      {/* Management Experience */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Management Experience</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{managerData.yearsExperience || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Years Experience</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{managerData.playersManaged || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Players Managed</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{managerData.dealsNegotiated || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Deals Negotiated</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{managerData.totalValue || '0M'}€</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Deal Value</div>
          </div>
        </div>
      </div>

      {/* About Manager */}
      {profile.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>💼</span> Management Philosophy
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Current Clients */}
      {managerData.currentClients && managerData.currentClients.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>⭐</span> Current Clients
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {managerData.currentClients.map((client, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {client.name?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{client.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{client.position} • {client.club}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Market Value: {client.marketValue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notable Transfers */}
      {managerData.notableDeals && managerData.notableDeals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>💰</span> Notable Transfers & Deals
          </h3>
          <div className="space-y-3">
            {managerData.notableDeals.map((deal, index) => (
              <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{deal.player}</h4>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{deal.value}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {deal.fromClub} → {deal.toClub}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{deal.year}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specializations */}
      {managerData.specializations && managerData.specializations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎯</span> Specializations
          </h3>
          <div className="flex flex-wrap gap-2">
            {managerData.specializations.map((spec, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Services Offered */}
      {managerData.services && managerData.services.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📋</span> Services Offered
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {managerData.services.map((service, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl">✓</div>
                <span className="text-gray-700 dark:text-gray-300">{service}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Licenses & Certifications */}
      {managerData.licenses && managerData.licenses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎓</span> Licenses & Certifications
          </h3>
          <div className="space-y-3">
            {managerData.licenses.map((license, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white">
                  ✓
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{license.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{license.organization}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Information */}
      {profile.contact && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span>📞</span> Contact Information
          </h3>
          <div className="space-y-3">
            {profile.contact.phone && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.phone}</span>
              </div>
            )}
            {profile.contact.email && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <span className="text-gray-700 dark:text-gray-300">{profile.contact.email}</span>
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
      )}
    </div>
  );
};

export default ManagerProfile;
