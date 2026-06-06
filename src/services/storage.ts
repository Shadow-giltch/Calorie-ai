import { Platform } from 'react-native';

export interface UserProfile {
  weight: number;      // kg
  height: number;      // cm
  age: number;         // years
  bmi: number;
  targetWeight: number; // kg
}

export interface DietPlan {
  dailyCalorieTarget: number;
  dietPlanText: string; // Markdown text of the diet plan
  macros: {
    protein: number; // grams
    carbs: number;   // grams
    fat: number;     // grams
    fiber: number;   // grams
  };
}

export interface FoodLogEntry {
  id: string;
  timestamp: number;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
  foodName: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitamins: string;
  imageUri?: string;
  analysisExplanation?: string;
}

// In-memory fallback for environments without localStorage (like native mobile simulation)
const memoryStore: Record<string, string> = {};

const storage = {
  getItem(key: string): string | null {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStore[key] || null;
    } catch (e) {
      console.warn('Error reading from storage', e);
      return memoryStore[key] || null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStore[key] = value;
      }
    } catch (e) {
      console.warn('Error writing to storage', e);
      memoryStore[key] = value;
    }
  },

  removeItem(key: string): void {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      } else {
        delete memoryStore[key];
      }
    } catch (e) {
      console.warn('Error removing from storage', e);
      delete memoryStore[key];
    }
  },

  clear(): void {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      } else {
        Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
      }
    } catch (e) {
      console.warn('Error clearing storage', e);
      Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
    }
  }
};

const KEYS = {
  PROFILE: 'calorie_ai_profile',
  DIET_PLAN: 'calorie_ai_diet_plan',
  FOOD_LOGS: 'calorie_ai_food_logs',
  IS_ONBOARDED: 'calorie_ai_onboarded',
};

export function getProfile(): UserProfile | null {
  const data = storage.getItem(KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
}

export function saveProfile(profile: UserProfile): void {
  storage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export function getDietPlan(): DietPlan | null {
  const data = storage.getItem(KEYS.DIET_PLAN);
  return data ? JSON.parse(data) : null;
}

export function saveDietPlan(dietPlan: DietPlan): void {
  storage.setItem(KEYS.DIET_PLAN, JSON.stringify(dietPlan));
}

export function getFoodLogs(): FoodLogEntry[] {
  const data = storage.getItem(KEYS.FOOD_LOGS);
  return data ? JSON.parse(data) : [];
}

export function saveFoodLogs(logs: FoodLogEntry[]): void {
  storage.setItem(KEYS.FOOD_LOGS, JSON.stringify(logs));
}

export function addFoodLogEntry(entry: Omit<FoodLogEntry, 'id' | 'timestamp'>): FoodLogEntry {
  const logs = getFoodLogs();
  const newEntry: FoodLogEntry = {
    ...entry,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
  };
  logs.push(newEntry);
  saveFoodLogs(logs);
  return newEntry;
}

export function deleteFoodLogEntry(id: string): void {
  const logs = getFoodLogs();
  const filtered = logs.filter((log) => log.id !== id);
  saveFoodLogs(filtered);
}

export function isOnboarded(): boolean {
  return storage.getItem(KEYS.IS_ONBOARDED) === 'true';
}

export function setOnboarded(value: boolean): void {
  storage.setItem(KEYS.IS_ONBOARDED, value ? 'true' : 'false');
}

export function resetAllData(): void {
  storage.removeItem(KEYS.PROFILE);
  storage.removeItem(KEYS.DIET_PLAN);
  storage.removeItem(KEYS.FOOD_LOGS);
  storage.setItem(KEYS.IS_ONBOARDED, 'false');
}
