// Gamification models for FootballPro frontend

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  criteria?: {
    type: string;
    value: number;
    badgeId?: number;
  };
  unlocked?: boolean;
  unlockedAt?: string | null;
  progress?: number;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earned?: boolean;
  earnedAt?: string | null;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  points: number;
  level: number;
  rank: number;
  profilePhoto?: string;
}

export interface GamificationStatus {
  level: number;
  points: number;
  postsCount: number;
  followersCount: number;
  likesCount: number;
  commentsCount: number;
}
