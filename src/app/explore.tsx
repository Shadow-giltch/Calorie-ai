import React, { useState, useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getProfile,
  getDietPlan,
  getFoodLogs,
  resetAllData,
  deleteFoodLogEntry,
  UserProfile,
  DietPlan,
  FoodLogEntry,
} from '@/services/storage';

export default function ExploreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);

  // Function to load storage data
  const loadData = () => {
    setProfile(getProfile());
    setDietPlan(getDietPlan());
    setFoodLogs(getFoodLogs());
  };

  // Poll storage on component mount or focus
  useEffect(() => {
    loadData();
    // Since we are in a tab view, set up an interval to refresh logs
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteLog = (id: string) => {
    deleteFoodLogEntry(id);
    loadData();
  };

  const performReset = () => {
    resetAllData();
    setProfile(null);
    setDietPlan(null);
    setFoodLogs([]);
    alert('Profile successfully reset. Return to the Home tab to get started again.');
  };

  const handleResetData = () => {
    const confirmMessage = 'Are you sure you want to reset all your profile data and calorie logs? This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        performReset();
      }
    } else {
      Alert.alert(
        'Reset Data',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: performReset },
        ]
      );
    }
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.four,
      paddingBottom: 180, // Large bottom padding so tab bar doesn't overlay content
    },
  });

  const borderCol = theme.backgroundSelected;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <View style={styles.container}>
        
        {/* Title */}
        <View style={styles.headerTitleContainer}>
          <ThemedText type="title" style={styles.pageTitle}>Diet Insights</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.pageSubtitle}>
            View your active nutrition strategy, track your weight logs, and manage profile settings.
          </ThemedText>
        </View>

        {!profile ? (
          <ThemedView type="backgroundElement" style={styles.noProfileCard}>
            <ThemedText style={{ fontSize: 40, marginBottom: Spacing.two }}>📊</ThemedText>
            <ThemedText type="smallBold" style={{ textAlign: 'center' }}>No Active Nutrition Profile</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
              Go to the Home tab and fill in your weight, height, and age to get started.
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.sectionsContainer}>
            {/* Weight Goal status */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" style={styles.cardTitle}>Goal Tracking</ThemedText>
              <View style={styles.goalStatsRow}>
                <View style={styles.statBox}>
                  <ThemedText type="small" themeColor="textSecondary">Current</ThemedText>
                  <ThemedText type="subtitle">{profile.weight} kg</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <ThemedText type="small" themeColor="textSecondary">Target</ThemedText>
                  <ThemedText type="subtitle" style={{ color: '#4ade80' }}>{profile.targetWeight} kg</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <ThemedText type="small" themeColor="textSecondary">Remaining</ThemedText>
                  <ThemedText type="subtitle" style={{ color: '#f59e0b' }}>
                    {Math.abs(profile.weight - profile.targetWeight).toFixed(1)} kg
                  </ThemedText>
                </View>
              </View>
            </ThemedView>

            {/* Diet Plan Card */}
            {dietPlan && (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold" style={styles.cardTitle}>Your Active AI Diet Plan</ThemedText>
                <View style={[styles.dietPlanContainer, { borderColor: borderCol }]}>
                  <ScrollView style={styles.dietPlanScroll} nestedScrollEnabled={true}>
                    <ThemedText style={styles.dietPlanTextRaw}>
                      {dietPlan.dietPlanText}
                    </ThemedText>
                  </ScrollView>
                </View>
              </ThemedView>
            )}

            {/* Complete Logs History */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" style={styles.cardTitle}>Complete Meal History</ThemedText>
              {foodLogs.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic', paddingVertical: Spacing.two }}>
                  No logged meals recorded.
                </ThemedText>
              ) : (
                <View style={styles.historyList}>
                  {foodLogs.map((log) => (
                    <View key={log.id} style={[styles.historyItem, { borderBottomColor: borderCol }]}>
                      <View style={styles.historyItemMain}>
                        <View style={styles.historyItemMeta}>
                          <ThemedText type="smallBold" style={styles.historyItemName}>{log.foodName}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {new Date(log.timestamp).toLocaleDateString()} • {log.mealType} ({log.quantity})
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={styles.historyItemCalories}>
                          {log.calories} kcal
                        </ThemedText>
                      </View>
                      <View style={styles.historyItemBottom}>
                        <ThemedText type="code" style={styles.historyItemMacrosText}>
                          P: {log.protein}g | C: {log.carbs}g | F: {log.fat}g
                        </ThemedText>
                        <Pressable onPress={() => handleDeleteLog(log.id)} style={styles.historyDeleteBtn}>
                          <ThemedText style={{ fontSize: 13 }}>🗑️</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ThemedView>

            {/* Settings section */}
            <ThemedView type="backgroundElement" style={[styles.card, { borderColor: '#ef444433', borderWidth: 1 }]}>
              <ThemedText type="smallBold" style={[styles.cardTitle, { color: '#f87171' }]}>Danger Zone</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
                Wipe all records including physical stats, target weights, generated diet plans, and food logs.
              </ThemedText>
              <Pressable style={styles.btnReset} onPress={handleResetData}>
                <ThemedText type="smallBold" style={styles.btnResetText}>Reset Profile & Clear Data</ThemedText>
              </Pressable>
            </ThemedView>

          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.five,
  },
  headerTitleContainer: {
    gap: Spacing.one,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
  },
  pageSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionsContainer: {
    gap: Spacing.four,
  },
  noProfileCard: {
    padding: Spacing.five,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 16,
  },
  goalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  statBox: {
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dietPlanContainer: {
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  dietPlanScroll: {
    maxHeight: 320,
    padding: Spacing.three,
  },
  dietPlanTextRaw: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Platform.select({ web: 'inherit', default: 'monospace' }),
    whiteSpace: 'pre-wrap',
  },
  historyList: {
    gap: Spacing.two,
  },
  historyItem: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  historyItemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemMeta: {
    gap: 2,
  },
  historyItemName: {
    fontSize: 15,
  },
  historyItemCalories: {
    fontSize: 15,
    color: '#4ade80',
  },
  historyItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemMacrosText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  historyDeleteBtn: {
    padding: 4,
  },
  btnReset: {
    backgroundColor: '#ef444422',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnResetText: {
    color: '#f87171',
    fontSize: 14,
  },
});
