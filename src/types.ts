export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
}

export interface LevelUpState {
  totalXp: number;
  totalEdits: number;
  totalSaves: number;
  totalTypedCharacters: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay?: string;
  languagesUsed: string[];
  unlockedAchievementIds: string[];
  lastUnlockedAchievementId?: string;
}

export type AchievementMetricType =
  | 'activeDays'
  | 'currentStreak'
  | 'languagesUsed'
  | 'level'
  | 'longestStreak'
  | 'totalEdits'
  | 'totalSaves'
  | 'totalTypedCharacters'
  | 'totalXp';

export interface AchievementThresholdTrackingDefinition {
  mode: 'threshold';
  metric: AchievementMetricType;
  target: number;
  unit: string;
  precision?: number;
}

export interface AchievementRatioTrackingDefinition {
  mode: 'ratio';
  numerator: AchievementMetricType;
  denominator: AchievementMetricType;
  target: number;
  unit: string;
  multiplier?: number;
  precision?: number;
  minDenominator?: number;
}

export type AchievementTrackingConditionDefinition =
  | AchievementThresholdTrackingDefinition
  | AchievementRatioTrackingDefinition;

export interface AchievementAllOfTrackingDefinition {
  mode: 'allOf';
  conditions: AchievementTrackingConditionDefinition[];
  label?: string;
}

export type AchievementTrackingDefinition =
  | AchievementTrackingConditionDefinition
  | AchievementAllOfTrackingDefinition;

export interface AchievementGroupDefinition {
  id: string;
  title: string;
  tierIndex: number;
  tierCount: number;
  tierLabel?: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  group: AchievementGroupDefinition;
  tracking: AchievementTrackingDefinition;
}

export interface AchievementProgress extends AchievementDefinition {
  unlocked: boolean;
  progressPercent: number;
  progressText: string;
}

export interface LevelUpSnapshot {
  state: LevelUpState;
  progress: LevelProgress;
  achievements: AchievementProgress[];
  unlockedAchievements: AchievementProgress[];
  lockedAchievements: AchievementProgress[];
}

export interface ActivityResult {
  xpGained: number;
  previousLevel: number;
  currentLevel: number;
  newlyUnlockedAchievements: AchievementDefinition[];
  snapshot: LevelUpSnapshot;
}