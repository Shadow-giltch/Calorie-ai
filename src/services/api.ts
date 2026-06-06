import { UserProfile, DietPlan, FoodLogEntry } from './storage';

const RAPIDAPI_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'grok-api.p.rapidapi.com';
const API_URL = `https://${RAPIDAPI_HOST}/v1/chat/completions`;

// Helper to convert Image URI to Base64 (Web compatible)
async function uriToBase64(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip the data:image/*;base64, prefix if it exists
        const base64 = base64String.split(',')[1] || base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Sends a chat completion prompt to Grok on RapidAPI.
 */
async function callGrok(systemPrompt: string, userPrompt: string, imageBase64?: string): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  // Build standard messages array
  const messages: any[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: userPrompt,
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: userPrompt,
    });
  }

  const body = {
    model: 'grok-beta', // Fallback to grok-2 or grok-beta
    messages,
    temperature: 0.2,
    max_tokens: 1500,
  };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 12000); // 12 second timeout

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content || '';
  } catch (error) {
    clearTimeout(id);
    console.warn('Grok API call failed, using high-quality local fallback calculations:', error);
    throw error;
  }
}

/**
 * Generates a diet plan using Grok, falling back to Mifflin-St Jeor calculations locally.
 */
export async function generateDietPlan(profile: UserProfile): Promise<DietPlan> {
  const systemPrompt = `You are a professional dietitian and fitness AI assistant. Your goal is to create highly effective, customized nutrition plans in JSON format.
You must return ONLY a valid JSON object. Do not include markdown code block formatting (like \`\`\`json) or any extra conversational text outside the JSON.
The JSON must have the following structure:
{
  "dailyCalorieTarget": 2000,
  "macros": {
    "protein": 140,
    "carbs": 220,
    "fat": 65,
    "fiber": 30
  },
  "dietPlanText": "# Personalized Diet Plan\\n\\nDetailed breakdown of meals, portions, and advice."
}`;

  const userPrompt = `Create a customized diet plan for the following user:
- Age: ${profile.age} years old
- Height: ${profile.height} cm
- Weight: ${profile.weight} kg
- BMI: ${profile.bmi.toFixed(1)}
- Target Weight: ${profile.targetWeight} kg
Provide a realistic calorie target and macronutrient distribution (in grams). In 'dietPlanText', write a beautiful Markdown formatted document outlining meals for Breakfast, Lunch, Dinner, and Snacks. Ensure the suggestions are delicious, healthy, and help reach the target weight.`;

  try {
    const result = await callGrok(systemPrompt, userPrompt);
    // Parse the JSON out of the response
    const cleanJsonText = result.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJsonText);

    if (parsed.dailyCalorieTarget && parsed.macros && parsed.dietPlanText) {
      return {
        dailyCalorieTarget: Number(parsed.dailyCalorieTarget),
        dietPlanText: parsed.dietPlanText,
        macros: {
          protein: Number(parsed.macros.protein || 120),
          carbs: Number(parsed.macros.carbs || 200),
          fat: Number(parsed.macros.fat || 60),
          fiber: Number(parsed.macros.fiber || 25),
        },
      };
    }
    throw new Error('Invalid JSON structure returned from AI');
  } catch (e) {
    console.log('Using local fallback for Diet Plan Generation');
    return getLocalDietPlanFallback(profile);
  }
}

/**
 * Analyzes meal log (supporting image + description) using Grok, falling back to local food scanner.
 */
export async function analyzeFood(
  imageUri: string | undefined,
  quantity: string,
  foodDescription: string
): Promise<Omit<FoodLogEntry, 'id' | 'timestamp' | 'mealType'>> {
  if (!foodDescription && !imageUri) {
    throw new Error('Either a food description or an image is required.');
  }

  const systemPrompt = `You are an expert food nutrition calculator. Analyze the meal name/description and portion size provided by the user.
Estimate the nutrition values as accurately as possible. Return ONLY a valid JSON object. Do not wrap it in markdown code blocks or add text.
The JSON must have the following structure:
{
  "foodName": "Avocado Toast with Egg",
  "calories": 350,
  "protein": 14,
  "carbs": 28,
  "fat": 18,
  "fiber": 6,
  "vitamins": "Vitamin A, B-12, D, E",
  "analysisExplanation": "A balanced meal with healthy fats from avocado and protein from the egg."
}`;

  const userPrompt = `Analyze this meal:
- Food/Description: ${foodDescription || 'Visual analysis of attached photo'}
- Portion/Quantity: ${quantity || '1 serving'}
Provide nutrition breakdown for this serving size.`;

  try {
    let base64Image: string | undefined;
    if (imageUri && Platform.OS === 'web') {
      try {
        base64Image = await uriToBase64(imageUri);
      } catch (err) {
        console.warn('Failed to parse image to base64, falling back to text description only', err);
      }
    }

    const result = await callGrok(systemPrompt, userPrompt, base64Image);
    const cleanJsonText = result.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJsonText);

    if (parsed.calories !== undefined) {
      return {
        foodName: parsed.foodName || foodDescription || 'Logged Meal',
        calories: Number(parsed.calories),
        protein: Number(parsed.protein || 0),
        carbs: Number(parsed.carbs || 0),
        fat: Number(parsed.fat || 0),
        fiber: Number(parsed.fiber || 0),
        vitamins: parsed.vitamins || 'Vitamins C, D',
        imageUri,
        analysisExplanation: parsed.analysisExplanation || 'Nutrients calculated by AI.',
      };
    }
    throw new Error('Invalid JSON structure returned from Food AI');
  } catch (e) {
    console.log('Using local fallback for Food Analysis');
    return getLocalFoodAnalysisFallback(foodDescription, quantity, imageUri);
  }
}

/**
 * ----------------------------------------------------
 * LOCAL NUTRITIONAL RULES FALLBACKS (Mifflin-St Jeor)
 * ----------------------------------------------------
 */

function getLocalDietPlanFallback(profile: UserProfile): DietPlan {
  // Mifflin-St Jeor BMR calculation
  // Assume male for slightly higher BMR fallback, or standard mix
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  // Light active multiplier
  const maintenanceCalories = Math.round(bmr * 1.375);

  let dailyCalorieTarget = maintenanceCalories;
  let modeText = 'Maintain Weight';

  if (profile.targetWeight < profile.weight) {
    // Caloric deficit for weight loss
    dailyCalorieTarget = Math.max(1200, maintenanceCalories - 500);
    modeText = 'Weight Loss';
  } else if (profile.targetWeight > profile.weight) {
    // Caloric surplus for weight gain
    dailyCalorieTarget = maintenanceCalories + 300;
    modeText = 'Weight Gain';
  }

  // Calculate macros:
  // Protein: 1.8g per kg of target weight
  const protein = Math.round(profile.targetWeight * 1.8);
  // Fat: 25% of total calories (9 kcal/g)
  const fat = Math.round((dailyCalorieTarget * 0.25) / 9);
  // Fiber: 14g per 1000 kcal
  const fiber = Math.round((dailyCalorieTarget / 1000) * 14);
  // Carbs: Remaining calories (4 kcal/g)
  const carbs = Math.round((dailyCalorieTarget - (protein * 4 + fat * 9)) / 4);

  const dietPlanText = `# AI Diet Plan (${modeText})

Based on your profile, we have calculated a daily calorie target of **${dailyCalorieTarget} kcal** to help you transition from **${profile.weight} kg** to your target of **${profile.targetWeight} kg**.

## Daily Nutrients Target
*   **Calories:** ${dailyCalorieTarget} kcal
*   **Protein:** ${protein}g (builds and maintains muscle)
*   **Carbohydrates:** ${carbs}g (fuels daily activity and energy)
*   **Fats:** ${fat}g (supports hormone health and vitamin absorption)
*   **Fiber:** ${fiber}g (essential for gut health and digestion)

---

## Suggested Meal Schedule

### 🍳 Breakfast (Approx. 25% of calories: ${Math.round(dailyCalorieTarget * 0.25)} kcal)
*   **Option A:** 3 scrambled egg whites, 1 whole egg, 2 slices of whole-wheat toast, and half an avocado.
*   **Option B:** Oatmeal (60g dry) cooked with water/skimmed milk, topped with 1 scoop of whey protein and 50g of blueberries.
*   *Hydration:* 1 large glass of water, green tea, or black coffee (no sugar).

### 🥗 Lunch (Approx. 35% of calories: ${Math.round(dailyCalorieTarget * 0.35)} kcal)
*   **Option A:** Grilled chicken breast (150g), 1 cup of cooked brown rice, and 200g of steamed broccoli/mixed greens with 1 tsp olive oil.
*   **Option B:** Quinoa salad with baked salmon (120g), cherry tomatoes, cucumber, spinach, and a light lemon-tahini dressing.

### 🍎 Snack (Approx. 15% of calories: ${Math.round(dailyCalorieTarget * 0.15)} kcal)
*   **Option A:** 150g of low-fat Greek yogurt with 15g of almonds or walnuts.
*   **Option B:** 1 medium apple sliced with 1 tbsp of natural peanut butter.

### 🍲 Dinner (Approx. 25% of calories: ${Math.round(dailyCalorieTarget * 0.25)} kcal)
*   **Option A:** Lean ground turkey stir-fry (130g) with bell peppers, onions, and zucchini, served over cauliflower rice.
*   **Option B:** Baked white fish (cod/tilapia - 150g) with roasted sweet potato (100g) and a side of green beans.

---

## AI Tips for Success
1.  **Hydration:** Drink at least 3 liters of water throughout the day.
2.  **Consistency:** Log your meals 3 times a day to maintain absolute calorie tracking accuracy.
3.  **Exercise:** Combine this plan with 3-4 days of resistance training and light cardio.`;

  return {
    dailyCalorieTarget,
    dietPlanText,
    macros: { protein, carbs, fat, fiber },
  };
}

// Local food database for keyword scanning
interface FoodDbEntry {
  calories: number; // per 100g or unit
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitamins: string;
}

const FOOD_DATABASE: Record<string, FoodDbEntry> = {
  chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, vitamins: 'Vitamin B-6, Niacin' },
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, vitamins: 'Vitamin B-1, Iron' },
  egg: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, vitamins: 'Vitamin D, B-12, Riboflavin' },
  salad: { calories: 45, protein: 1.5, carbs: 6, fat: 2, fiber: 2.5, vitamins: 'Vitamin A, C, K, Folate' },
  apple: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, vitamins: 'Vitamin C, Potassium' },
  banana: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, vitamins: 'Vitamin B-6, Vitamin C' },
  milk: { calories: 42, protein: 3.4, carbs: 5, fat: 1, fiber: 0, vitamins: 'Vitamin D, Calcium, B-12' },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, vitamins: 'Thiamin, Folate, Iron' },
  avocado: { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, vitamins: 'Vitamin E, K, C, B-6' },
  burger: { calories: 295, protein: 17, carbs: 24, fat: 14, fiber: 1.5, vitamins: 'Vitamin B-12, Zinc, Iron' },
  pizza: { calories: 266, protein: 11, carbs: 33, fat: 10, fiber: 2.3, vitamins: 'Calcium, Vitamin A' },
  oats: { calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6, vitamins: 'Manganese, Phosphorus, Vitamin B-1' },
  fish: { calories: 120, protein: 20, carbs: 0, fat: 4, fiber: 0, vitamins: 'Vitamin D, B-12, Selenium' },
  salmon: { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, vitamins: 'Vitamin D, B-6, B-12, Omega-3' },
  protein: { calories: 120, protein: 24, carbs: 3, fat: 1.5, fiber: 1, vitamins: 'Calcium, Amino Acids' },
  yogurt: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, vitamins: 'Calcium, Vitamin B-12' },
  almonds: { calories: 579, protein: 21, carbs: 22, fat: 49, fiber: 12.5, vitamins: 'Vitamin E, Magnesium' },
  shake: { calories: 250, protein: 25, carbs: 15, fat: 4, fiber: 2, vitamins: 'Vitamin A, C, D, E, Calcium' },
};

function getLocalFoodAnalysisFallback(
  description: string,
  quantity: string,
  imageUri?: string
): Omit<FoodLogEntry, 'id' | 'timestamp' | 'mealType'> {
  const normalizedDesc = (description || '').toLowerCase();
  
  // Try to parse quantity to scale values (default 1.0)
  let scale = 1.0;
  const numMatch = quantity.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (quantity.includes('gram') || quantity.includes('g')) {
      scale = val / 100; // Database is per 100g
    } else {
      scale = val; // Treat servings or items as multiplier
    }
  }

  // Scan for keywords in description
  let matchedKey = 'salad'; // Default fallback
  let foodName = description || 'Healthy Meal';

  for (const key of Object.keys(FOOD_DATABASE)) {
    if (normalizedDesc.includes(key)) {
      matchedKey = key;
      // Capitalize first letter
      foodName = key.charAt(0).toUpperCase() + key.slice(1);
      break;
    }
  }

  const dbInfo = FOOD_DATABASE[matchedKey];
  const calories = Math.round(dbInfo.calories * scale);
  const protein = Math.round(dbInfo.protein * scale * 10) / 10;
  const carbs = Math.round(dbInfo.carbs * scale * 10) / 10;
  const fat = Math.round(dbInfo.fat * scale * 10) / 10;
  const fiber = Math.round(dbInfo.fiber * scale * 10) / 10;

  return {
    foodName: `${quantity} ${foodName}`,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    vitamins: dbInfo.vitamins,
    imageUri,
    analysisExplanation: `Nutritional values estimated locally based on portion size (${quantity}) of ${foodName}.`,
  };
}
