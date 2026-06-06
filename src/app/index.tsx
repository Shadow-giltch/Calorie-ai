import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Colors, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getProfile,
  saveProfile,
  getDietPlan,
  saveDietPlan,
  getFoodLogs,
  addFoodLogEntry,
  deleteFoodLogEntry,
  isOnboarded,
  setOnboarded,
  resetAllData,
  UserProfile,
  DietPlan,
  FoodLogEntry,
} from '@/services/storage';
import { generateDietPlan, analyzeFood } from '@/services/api';

export default function HomeScreen() {
  const theme = useTheme();

  // Onboarding Step State
  // 1: Splash/Welcome, 2: Profile (Weight, Height, Age), 3: Target Weight, 4: Dashboard
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Profile Inputs
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');

  // Loaded Data States
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);

  // Log Food Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logMealType, setLogMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'>('Breakfast');
  const [logFoodDescription, setLogFoodDescription] = useState('');
  const [logQuantity, setLogQuantity] = useState('1 serving');
  const [logImageUri, setLogImageUri] = useState<string | undefined>(undefined);
  const [foodAnalysisLoading, setFoodAnalysisLoading] = useState(false);

  // Initialize
  useEffect(() => {
    const onboarded = isOnboarded();
    const savedProfile = getProfile();
    const savedDietPlan = getDietPlan();
    const savedLogs = getFoodLogs();

    if (onboarded && savedProfile && savedDietPlan) {
      setProfile(savedProfile);
      setDietPlan(savedDietPlan);
      setFoodLogs(savedLogs);
      setAge(savedProfile.age.toString());
      setWeight(savedProfile.weight.toString());
      setHeight(savedProfile.height.toString());
      setTargetWeight(savedProfile.targetWeight.toString());
      setStep(4);
    } else {
      setStep(1);
    }
  }, []);

  const currentWeightNum = parseFloat(weight);
  const currentHeightNum = parseFloat(height);
  const heightInMeters = currentHeightNum / 100;
  const calculatedBmi =
    currentWeightNum && heightInMeters
      ? currentWeightNum / (heightInMeters * heightInMeters)
      : 0;

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight', color: '#f59e0b' };
    if (bmi < 25) return { label: 'Normal Weight', color: '#10b981' };
    if (bmi < 30) return { label: 'Overweight', color: '#f97316' };
    return { label: 'Obese', color: '#ef4444' };
  };

  const bmiCategory = getBmiCategory(calculatedBmi);

  // Handlers
  const handleGetStarted = () => {
    setStep(2);
  };

  const handleSaveProfile = () => {
    const ageNum = parseInt(age);
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);

    if (!ageNum || !weightNum || !heightNum) {
      alert('Please fill in all profile fields correctly.');
      return;
    }

    const newProfile: UserProfile = {
      age: ageNum,
      weight: weightNum,
      height: heightNum,
      bmi: calculatedBmi,
      targetWeight: parseFloat(targetWeight) || weightNum,
    };

    setProfile(newProfile);
    setStep(3);
  };

  const handleGenerateDietPlan = async () => {
    const targetWeightNum = parseFloat(targetWeight);
    if (!targetWeightNum || !profile) {
      alert('Please enter a valid target weight.');
      return;
    }

    const updatedProfile = { ...profile, targetWeight: targetWeightNum };
    setProfile(updatedProfile);
    saveProfile(updatedProfile);

    setLoading(true);
    setStatusMessage('Grok AI is analyzing your BMI and preparing your custom nutrition plan...');

    try {
      const plan = await generateDietPlan(updatedProfile);
      setDietPlan(plan);
      saveDietPlan(plan);
      setOnboarded(true);
      setFoodLogs([]);
      setStep(4);
    } catch (error) {
      alert('Failed to generate diet plan. Please try again.');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  // Image Selection Helper
  const handleSelectImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const uri = URL.createObjectURL(file);
          setLogImageUri(uri);
        }
      };
      input.click();
    } else {
      // Mobile fallback mockup image
      setLogImageUri('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400');
    }
  };

  const handleAddMeal = async () => {
    if (!logFoodDescription && !logImageUri) {
      alert('Please enter a food description or upload a photo.');
      return;
    }

    setFoodAnalysisLoading(true);
    try {
      const analyzed = await analyzeFood(logImageUri, logQuantity, logFoodDescription);

      const newEntry = addFoodLogEntry({
        mealType: logMealType,
        ...analyzed,
      });

      setFoodLogs(getFoodLogs());
      setIsLogModalOpen(false);
      setLogFoodDescription('');
      setLogQuantity('1 serving');
      setLogImageUri(undefined);
    } catch (e) {
      alert('Error analyzing meal nutrition.');
    } finally {
      setFoodAnalysisLoading(false);
    }
  };

  const handleDeleteMeal = (id: string) => {
    deleteFoodLogEntry(id);
    setFoodLogs(getFoodLogs());
  };

  // Daily Math Calculations
  const dailyLogs = foodLogs.filter((log) => {
    const logDate = new Date(log.timestamp).toDateString();
    const todayDate = new Date().toDateString();
    return logDate === todayDate;
  });

  const totals = dailyLogs.reduce(
    (acc, log) => {
      acc.calories += log.calories;
      acc.protein += log.protein;
      acc.carbs += log.carbs;
      acc.fat += log.fat;
      acc.fiber += log.fiber;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const calorieTarget = dietPlan?.dailyCalorieTarget ?? 2000;
  const isOverCalorieLimit = totals.calories > calorieTarget;
  const excessCalories = isOverCalorieLimit ? totals.calories - calorieTarget : 0;

  // Exercise estimations to burn excess calories:
  // Running: ~8 kcal/min, Cycling: ~6 kcal/min, Cardio: ~5 kcal/min
  const exerciseSuggestions = {
    running: Math.round(excessCalories / 8),
    cycling: Math.round(excessCalories / 6),
    cardio: Math.round(excessCalories / 5),
  };

  // CSS/Style definitions
  const borderCol = theme.backgroundSelected;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* STEP 1: SPLASH SCREEN */}
          {step === 1 && (
            <View style={styles.splashContainer}>
              <View style={styles.logoRing}>
                <ThemedText style={styles.logoEmoji}>🌿</ThemedText>
              </View>
              <ThemedText type="title" style={styles.splashTitle}>
                Calorie.AI
              </ThemedText>
              <ThemedText type="subtitle" style={styles.splashSubtitle}>
                Smart Calorie & Nutrition Tracking powered by Grok AI
              </ThemedText>
              <ThemedText style={styles.splashDesc}>
                Set your goals, snapshot your food, get customized meal plans, and track your metrics effortlessly.
              </ThemedText>

              <Pressable style={styles.btnPrimary} onPress={handleGetStarted}>
                <ThemedText type="smallBold" style={styles.btnPrimaryText}>
                  Get Started
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* STEP 2: PROFILE INPUTS & BMI */}
          {step === 2 && (
            <View style={styles.formContainer}>
              <ThemedText type="subtitle" style={styles.formTitle}>
                Tell us about yourself
              </ThemedText>
              <ThemedText style={styles.formSubtitle}>
                We use these metrics to calculate your Body Mass Index (BMI) and tailor your daily caloric budget.
              </ThemedText>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Age (years)</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: borderCol, color: theme.text }]}
                  placeholder="e.g. 28"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Height (cm)</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: borderCol, color: theme.text }]}
                  placeholder="e.g. 175"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={height}
                  onChangeText={setHeight}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Weight (kg)</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: borderCol, color: theme.text }]}
                  placeholder="e.g. 72"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>

              {/* BMI Live Display */}
              {calculatedBmi > 0 && (
                <ThemedView type="backgroundElement" style={styles.bmiCard}>
                  <ThemedText type="smallBold" style={styles.bmiTitle}>
                    Your Current BMI: <ThemedText type="subtitle" style={{ color: bmiCategory.color }}>{calculatedBmi.toFixed(1)}</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" style={[styles.bmiBadge, { backgroundColor: bmiCategory.color + '22', color: bmiCategory.color }]}>
                    {bmiCategory.label}
                  </ThemedText>
                  <ThemedText type="small" style={styles.bmiText}>
                    A healthy BMI range is between 18.5 and 24.9.
                  </ThemedText>
                </ThemedView>
              )}

              <Pressable style={styles.btnPrimary} onPress={handleSaveProfile}>
                <ThemedText type="smallBold" style={styles.btnPrimaryText}>
                  Next
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* STEP 3: TARGET WEIGHT & DIET PLAN */}
          {step === 3 && (
            <View style={styles.formContainer}>
              <ThemedText type="subtitle" style={styles.formTitle}>
                What is your target weight?
              </ThemedText>
              <ThemedText style={styles.formSubtitle}>
                Your target weight helps Grok AI calculate your daily caloric deficit or surplus.
              </ThemedText>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Target Weight (kg)</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: borderCol, color: theme.text }]}
                  placeholder="e.g. 68"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                />
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4ade80" />
                  <ThemedText style={styles.loadingText}>{statusMessage}</ThemedText>
                </View>
              ) : (
                <Pressable style={styles.btnPrimary} onPress={handleGenerateDietPlan}>
                  <ThemedText type="smallBold" style={styles.btnPrimaryText}>
                    Generate AI Diet Plan
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {/* STEP 4: MAIN DASHBOARD */}
          {step === 4 && (
            <View style={styles.dashboardContainer}>
              {/* Daily Progress summary */}
              <ThemedView type="backgroundElement" style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <View>
                    <ThemedText type="small" themeColor="textSecondary">Daily Calorie Target</ThemedText>
                    <ThemedText type="subtitle" style={styles.calorieBudget}>
                      {totals.calories} <ThemedText type="small" themeColor="textSecondary">/ {calorieTarget} kcal</ThemedText>
                    </ThemedText>
                  </View>
                  <View style={styles.progressRingIndicator}>
                    <ThemedText type="smallBold" style={{ color: isOverCalorieLimit ? '#ef4444' : '#4ade80' }}>
                      {Math.round((totals.calories / calorieTarget) * 100)}%
                    </ThemedText>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, (totals.calories / calorieTarget) * 100)}%`,
                        backgroundColor: isOverCalorieLimit ? '#ef4444' : '#4ade80',
                      },
                    ]}
                  />
                </View>

                {/* Macros breakdown */}
                <View style={styles.macrosContainer}>
                  <View style={styles.macroCol}>
                    <ThemedText type="smallBold" style={styles.macroLabel}>Protein</ThemedText>
                    <ThemedText type="small" style={styles.macroValue}>
                      {totals.protein.toFixed(0)}g / {dietPlan?.macros.protein}g
                    </ThemedText>
                  </View>
                  <View style={styles.macroCol}>
                    <ThemedText type="smallBold" style={styles.macroLabel}>Carbs</ThemedText>
                    <ThemedText type="small" style={styles.macroValue}>
                      {totals.carbs.toFixed(0)}g / {dietPlan?.macros.carbs}g
                    </ThemedText>
                  </View>
                  <View style={styles.macroCol}>
                    <ThemedText type="smallBold" style={styles.macroLabel}>Fat</ThemedText>
                    <ThemedText type="small" style={styles.macroValue}>
                      {totals.fat.toFixed(0)}g / {dietPlan?.macros.fat}g
                    </ThemedText>
                  </View>
                  <View style={styles.macroCol}>
                    <ThemedText type="smallBold" style={styles.macroLabel}>Fiber</ThemedText>
                    <ThemedText type="small" style={styles.macroValue}>
                      {totals.fiber.toFixed(0)}g / {dietPlan?.macros.fiber}g
                    </ThemedText>
                  </View>
                </View>
              </ThemedView>

              {/* Excess Calorie Warning */}
              {isOverCalorieLimit && (
                <View style={styles.warningCard}>
                  <ThemedText type="smallBold" style={styles.warningTitle}>
                    ⚠️ Calorie limit exceeded by {excessCalories} kcal!
                  </ThemedText>
                  <ThemedText type="small" style={styles.warningText}>
                    Consider doing one of the following exercises today to burn off the extra calories:
                  </ThemedText>
                  <View style={styles.exerciseList}>
                    <View style={styles.exerciseItem}>
                      <ThemedText style={styles.exerciseIcon}>🏃</ThemedText>
                      <View>
                        <ThemedText type="smallBold">Running</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{exerciseSuggestions.running} mins needed</ThemedText>
                      </View>
                    </View>
                    <View style={styles.exerciseItem}>
                      <ThemedText style={styles.exerciseIcon}>🚴</ThemedText>
                      <View>
                        <ThemedText type="smallBold">Cycling</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{exerciseSuggestions.cycling} mins needed</ThemedText>
                      </View>
                    </View>
                    <View style={styles.exerciseItem}>
                      <ThemedText style={styles.exerciseIcon}>🏋️</ThemedText>
                      <View>
                        <ThemedText type="smallBold">HIIT / Cardio</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{exerciseSuggestions.cardio} mins needed</ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Log Meal Section */}
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Today's Log</ThemedText>
                <Pressable style={styles.btnSmall} onPress={() => setIsLogModalOpen(true)}>
                  <ThemedText type="smallBold" style={styles.btnSmallText}>+ Log Meal</ThemedText>
                </Pressable>
              </View>

              {/* Meal log list */}
              {dailyLogs.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.emptyLogsCard}>
                  <ThemedText style={styles.emptyLogsText}>No meals logged today yet.</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Log what you eat to keep track of your goals.</ThemedText>
                </ThemedView>
              ) : (
                <View style={styles.logsList}>
                  {dailyLogs.map((log) => (
                    <ThemedView key={log.id} type="backgroundElement" style={styles.logItemCard}>
                      <View style={styles.logItemHeader}>
                        {log.imageUri ? (
                          <Image source={{ uri: log.imageUri }} style={styles.logItemImage} />
                        ) : (
                          <View style={styles.logItemPlaceholderImage}>
                            <ThemedText style={{ fontSize: 24 }}>🍽️</ThemedText>
                          </View>
                        )}
                        <View style={styles.logItemDetails}>
                          <ThemedText type="small" style={styles.logItemMealType}>{log.mealType}</ThemedText>
                          <ThemedText type="smallBold" style={styles.logItemName}>{log.foodName}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={styles.logItemDesc}>
                            {log.quantity} • {log.calories} kcal
                          </ThemedText>
                          {log.analysisExplanation && (
                            <ThemedText type="small" style={styles.logItemExpl}>
                              💡 {log.analysisExplanation}
                            </ThemedText>
                          )}
                        </View>
                        <Pressable onPress={() => handleDeleteMeal(log.id)} style={styles.btnDelete}>
                          <ThemedText style={styles.btnDeleteText}>🗑️</ThemedText>
                        </Pressable>
                      </View>

                      {/* Small macro badges */}
                      <View style={styles.logItemMacros}>
                        <View style={styles.macroBadge}>
                          <ThemedText type="code">P: {log.protein}g</ThemedText>
                        </View>
                        <View style={styles.macroBadge}>
                          <ThemedText type="code">C: {log.carbs}g</ThemedText>
                        </View>
                        <View style={styles.macroBadge}>
                          <ThemedText type="code">F: {log.fat}g</ThemedText>
                        </View>
                        <View style={styles.macroBadge}>
                          <ThemedText type="code">Fi: {log.fiber}g</ThemedText>
                        </View>
                      </View>
                    </ThemedView>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* LOG MEAL DIALOG MODAL */}
      {isLogModalOpen && (
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Log Food Details</ThemedText>
              <Pressable onPress={() => setIsLogModalOpen(false)}>
                <ThemedText style={styles.closeIcon}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Meal Type</ThemedText>
                <View style={styles.mealTypeButtons}>
                  {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const).map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.mealTypeButton,
                        logMealType === type && styles.mealTypeButtonActive,
                        { borderColor: borderCol },
                      ]}
                      onPress={() => setLogMealType(type)}>
                      <ThemedText
                        type="smallBold"
                        style={[
                          styles.mealTypeButtonText,
                          logMealType === type && styles.mealTypeButtonTextActive,
                        ]}>
                        {type}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Food Name / Description</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: borderCol, color: theme.text }]}
                  placeholder="e.g. Avocado toast with 2 poached eggs"
                  placeholderTextColor={theme.textSecondary}
                  value={logFoodDescription}
                  onChangeText={setLogFoodDescription}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Serving / Quantity</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: borderCol, color: theme.text }]}
                  placeholder="e.g. 1 plate, 150g, 2 slices"
                  placeholderTextColor={theme.textSecondary}
                  value={logQuantity}
                  onChangeText={setLogQuantity}
                />
              </View>

              {/* Upload image section */}
              <View style={styles.formGroup}>
                <ThemedText type="smallBold" style={styles.label}>Food Photo (Optional)</ThemedText>
                {logImageUri ? (
                  <View style={styles.uploadedImageContainer}>
                    <Image source={{ uri: logImageUri }} style={styles.uploadedImage} />
                    <Pressable style={styles.btnRemoveImage} onPress={() => setLogImageUri(undefined)}>
                      <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Remove Photo</ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={[styles.imageUploadBox, { borderColor: borderCol }]} onPress={handleSelectImage}>
                    <ThemedText style={styles.imageUploadIcon}>📷</ThemedText>
                    <ThemedText type="smallBold" themeColor="textSecondary">Upload or Take Photo</ThemedText>
                  </Pressable>
                )}
              </View>

              {foodAnalysisLoading ? (
                <View style={styles.analysisLoading}>
                  <ActivityIndicator size="small" color="#4ade80" />
                  <ThemedText style={styles.analysisLoadingText}>Grok AI is analyzing calories & nutrients...</ThemedText>
                </View>
              ) : (
                <Pressable style={styles.btnPrimary} onPress={handleAddMeal}>
                  <ThemedText type="smallBold" style={styles.btnPrimaryText}>Add to Daily Log</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 180, // Large bottom padding so tab bar doesn't overlay content
  },
  /* Splash Step */
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.four,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4ade8022',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  logoEmoji: {
    fontSize: 50,
  },
  splashTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#4ade80',
    textAlign: 'center',
  },
  splashSubtitle: {
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
  },
  splashDesc: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: '#94a3b8',
    paddingHorizontal: Spacing.four,
  },
  /* Form Steps */
  formContainer: {
    width: '100%',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  formSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#94a3b8',
  },
  formGroup: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 14,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  /* BMI Card */
  bmiCard: {
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  bmiTitle: {
    fontSize: 16,
  },
  bmiBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bmiText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  /* Loading UI */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#94a3b8',
  },
  /* Button Styles */
  btnPrimary: {
    backgroundColor: '#4ade80',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginTop: Spacing.two,
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: 16,
  },
  btnSmall: {
    backgroundColor: '#4ade8022',
    borderWidth: 1,
    borderColor: '#4ade80',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },
  btnSmallText: {
    color: '#4ade80',
    fontSize: 13,
  },
  /* Dashboard UI */
  dashboardContainer: {
    width: '100%',
    gap: Spacing.five,
  },
  progressCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calorieBudget: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  progressRingIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
  },
  macroCol: {
    alignItems: 'center',
    flex: 1,
  },
  macroLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  /* Warning & Exercises */
  warningCard: {
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef444433',
    padding: Spacing.four,
    borderRadius: 16,
    gap: Spacing.two,
  },
  warningTitle: {
    color: '#f87171',
    fontSize: 16,
  },
  warningText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseList: {
    marginTop: Spacing.one,
    gap: Spacing.two,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    padding: Spacing.two,
    borderRadius: 10,
  },
  exerciseIcon: {
    fontSize: 22,
  },
  /* Meal Logs */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  emptyLogsCard: {
    padding: Spacing.five,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyLogsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logsList: {
    gap: Spacing.three,
  },
  logItemCard: {
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.two,
  },
  logItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  logItemImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  logItemPlaceholderImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logItemDetails: {
    flex: 1,
    gap: 2,
  },
  logItemMealType: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#4ade80',
    fontWeight: 'bold',
  },
  logItemName: {
    fontSize: 15,
  },
  logItemDesc: {
    fontSize: 13,
  },
  logItemExpl: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontStyle: 'italic',
  },
  logItemMacros: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.03)',
  },
  macroBadge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  btnDelete: {
    padding: Spacing.one,
  },
  btnDeleteText: {
    fontSize: 18,
  },
  /* Modals */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: Spacing.two,
  },
  closeIcon: {
    fontSize: 20,
    color: '#94a3b8',
  },
  modalScroll: {
    gap: Spacing.three,
    paddingTop: Spacing.one,
  },
  mealTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.one,
    rowGap: 8,
  },
  mealTypeButton: {
    flex: 1,
    minWidth: 80,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTypeButtonActive: {
    backgroundColor: '#4ade8022',
    borderColor: '#4ade80',
  },
  mealTypeButtonText: {
    fontSize: 12,
  },
  mealTypeButtonTextActive: {
    color: '#4ade80',
  },
  imageUploadBox: {
    height: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  imageUploadIcon: {
    fontSize: 28,
  },
  uploadedImageContainer: {
    position: 'relative',
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  btnRemoveImage: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    backgroundColor: '#ef4444cc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  analysisLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  analysisLoadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
