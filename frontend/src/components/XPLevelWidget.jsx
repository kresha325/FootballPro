import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { StarIcon } from '@heroicons/react/24/solid';

export default function XPLevelWidget() {
  const [data, setData] = useState({ points: 0, level: 1, progressToNextLevel: 0 });
  useEffect(() => {
    api.get('/gamification/user').then(res => {
      const user = res.data.user || res.data;
      setData({
        points: user.points,
        level: user.level,
        progressToNextLevel: user.progressToNextLevel || 0
      });
    });
  }, []);
  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg">
      <StarIcon className="h-6 w-6 text-yellow-300" />
      <div className="text-sm font-bold">Level {data.level}</div>
      <div className="w-32 bg-white/20 rounded-full h-2 mx-2">
        <div
          className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
          style={{ width: `${data.progressToNextLevel || 0}%` }}
        />
      </div>
      <div className="text-xs">{data.points} XP</div>
    </div>
  );
}
