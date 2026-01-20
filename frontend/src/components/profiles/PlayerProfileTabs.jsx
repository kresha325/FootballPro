import React, { useState } from 'react';

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'matchHistory', label: 'Match History' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'media', label: 'Media' },
];

const PlayerProfileTabs = ({ children }) => {
  const [activeTab, setActiveTab] = useState('about');

  return (
    <div className="mt-4">
      <div className="flex gap-2 border-b mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium rounded-t transition-all ${activeTab === tab.id ? 'bg-green-100 text-green-700 border-t-2 border-green-600' : 'bg-gray-100 text-gray-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {children[activeTab]}
      </div>
    </div>
  );
};

export default PlayerProfileTabs;
