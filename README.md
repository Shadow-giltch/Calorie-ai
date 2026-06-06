# 🌿 Calorie.AI — Smart AI Calorie Tracker

Calorie.AI is a premium, fully responsive web application built on **Expo (v56.0.0) + React Native Web** that helps users set body composition goals, calculate their BMI, generate personalized nutrition plans, and track their daily calorie and macronutrient intake using **Grok AI**.

---

## ✨ Features

*   **⚡ Splash & Onboarding Flow:** Beautiful visual welcome screen with pulsing logo and animations guiding users step-by-step.
*   **📊 Live BMI Calculator:** Real-time calculation of Body Mass Index (BMI) using standard formulas:  
    $$BMI = \frac{Weight\ (kg)}{Height^2\ (m)}$$  
    Displays dynamic, color-coded health ranges (Underweight, Normal, Overweight, Obese).
*   **🤖 Custom AI Diet Plans:** Integrates with the **Grok AI** model via RapidAPI to construct personalized caloric targets and macronutrient distributions (Protein, Carbs, Fats, Fiber) inside structured daily menus (Breakfast, Lunch, Dinner, Snacks).
*   **📷 Visual Food Logging:** Add meal logs by portion size, text description, or **food image upload** (Web-camera capture or library picker). Grok parses the photo/description to calculate nutrition values automatically.
*   **🏃 Excess Calorie Warning & Exercise Suggestions:** Warns users if they exceed their daily budget and dynamically calculates required exercise durations (e.g. running, cycling, cardio) to burn off the excess calories.
*   **📂 Persistent Data Records:** Saves profile details, target weights, generated diet plans, and logs locally so data is maintained across sessions.
*   **🛡️ Secure Environment Config:** RapidAPI keys are kept strictly local in a git-ignored environment file (`.env`).
*   **⚙️ Insights & Settings:** Review detailed historical logging, read the generated diet plans in full markdown, and reset all stored profile data instantly.

---

## 🛠️ Technology Stack

1.  **Framework:** Expo SDK 56.0.0 (Expo Router for routing & navigation).
2.  **Platforms:** Cross-platform (iOS, Android, and fully responsive Web).
3.  **Language:** TypeScript.
4.  **Styling:** StyleSheet styling engine compiled to CSS at runtime.
5.  **State Management:** local React State with custom web-native persistence.

---

## 📂 Project Architecture

```
├── .env                  # Git-ignored local environment variable (key)
├── .env.example          # Template environment variable
├── .gitignore            # Git ignore list (configured to protect keys)
├── package.json          # Dependencies & npm scripts
├── src/
│   ├── app/
│   │   ├── _layout.tsx   # Root navigation layout
│   │   ├── index.tsx     # Home tab (Splash, Onboarding, and Main Dashboard)
│   │   └── explore.tsx   # Insights tab (Goal stats, Diet plan, History list)
│   ├── components/
│   │   ├── app-tabs.web.tsx  # Responsive web navigation bar header
│   │   └── themed-text.tsx   # Styled text wrapper components
│   └── services/
│       ├── api.ts        # RapidAPI Grok completions & Mifflin-St Jeor fallbacks
│       └── storage.ts    # localStorage wrapper for profile & logged meals
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js and npm installed on your machine.

### 2. Installation
Clone this repository and install the project dependencies:
```bash
npm install
```

### 3. Environment Setup
Copy the template configuration file:
```bash
cp .env.example .env
```
Open the `.env` file and insert your API key:
```ini
EXPO_PUBLIC_RAPIDAPI_KEY=your_rapidapi_grok_key_here
```

### 4. Running the Application

*   **Web Portal (recommended):**
    ```bash
    npm run web
    ```
    Opens the development site on `http://localhost:8081`.

*   **Mobile Simulator (Android):**
    ```bash
    npm run android
    ```

*   **Mobile Simulator (iOS):**
    ```bash
    npm run ios
    ```

---

## 🛡️ Robust Fail-Safe Design
In case your RapidAPI credentials expire or experience latency, Calorie.AI features a built-in **Local Nutrition Math Engine** that acts as a fail-safe:
*   **Diet Plan Fallback:** Calculates daily maintenance energy expenditures using the **Mifflin-St Jeor Equation**:
    *   $BMR = 10 \times Weight\ (kg) + 6.25 \times Height\ (cm) - 5 \times Age\ (y) + 5$
    *   Subtracts 500 kcal for deficit targets or adds 300 kcal for surplus targets.
*   **Food Analysis Fallback:** Scans logged description text for dietary keywords (such as chicken, oats, avocado, salad, burger, pizza, etc.) and scales calorie/macronutrient values using a local nutrition dictionary relative to portion quantity.
