import { useState } from "react";

const DAILY_CALORIE_GOAL = 1400;

const MEAL_SLOTS = [
  { name: "Breakfast", icon: "🌅" },
  { name: "Lunch", icon: "☀️" },
  { name: "Dinner", icon: "🌙" },
  { name: "Snacks", icon: "🍎" },
];

const QUOTES = [
  { text: "You don't have to be perfect. You just have to keep going.", author: "— Progress over perfection" },
  { text: "Every meal you log, every walk you take — it all counts. Even the small days.", author: "— Small steps add up" },
  { text: "Your body is doing something hard. Be as kind to yourself as you would be to a friend.", author: "— Self-compassion matters" },
  { text: "Ten pounds isn't just weight. It's energy, confidence, and feeling like yourself again.", author: "— Your why matters" },
  { text: "You've already done hard things. This is just another one you'll look back on and be proud of.", author: "— You've got this" },
  { text: "One bad meal doesn't ruin your progress, just like one good meal doesn't build it. Keep showing up.", author: "— Consistency wins" },
  { text: "The hardest part isn't the workout or the meal plan. It's deciding every day that you're worth it. You are.", author: "— You are worth it" },
  { text: "Slow progress is still progress. A year from now you'll wish you had started today — but you already did.", author: "— Trust the process" },
  { text: "Your future self is cheering you on right now. She knows what this moment cost you, and she's grateful.", author: "— For future you" },
  { text: "You're not just losing weight. You're building the version of yourself you've always believed you could be.", author: "— Building, not just losing" },
  { text: "Hard days are proof you're doing something that matters. Easy things don't change your life.", author: "— Hard is good" },
  { text: "Rest when you need to. Adjust when you need to. Just don't quit.", author: "— Flexibility is strength" },
];

const TIPS = [
  "Protein at every meal helps preserve muscle during weight loss 💪",
  "Aim for 7-9 hours of sleep — poor sleep raises cortisol and increases cravings",
  "Strength training 2-3x/week boosts metabolism for up to 48 hours after",
  "Staying hydrated can reduce false hunger signals by up to 30%",
  "Perimenopause tip: reduce alcohol — it disrupts sleep and raises estrogen",
  "Walking after meals lowers blood sugar spikes and aids digestion",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dateKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function loadMeals(key) {
  try {
    const saved = localStorage.getItem(`meals-${key}`);
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return MEAL_SLOTS.map(m => ({ ...m, cal: 0, breakdown: null, description: "" }));
}

function saveMeals(key, meals) {
  try { localStorage.setItem(`meals-${key}`, JSON.stringify(meals)); } catch(e) {}
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const offset = -(6 - i);
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const key = d.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[d.getDay()];
    const meals = loadMeals(key);
    const total = meals.reduce((sum, m) => sum + (m.cal || 0), 0);
    return { key, dayName, total, isToday: offset === 0 };
  });
}

async function calcCaloriesAI(description) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a nutrition expert. When given a meal description, return ONLY a JSON object (no markdown, no backticks) with this shape:
{
  "items": [{ "name": "item name", "amount": "quantity", "calories": number }],
  "total": number,
  "protein": number,
  "carbs": number,
  "fat": number
}
Be precise and realistic with calorie estimates.`,
      messages: [{ role: "user", content: `Calculate calories for: ${description}` }]
    })
  });
  const data = await response.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export default function WellnessTracker() {
  const todayKey = dateKey(0);
  const today = DAY_NAMES[new Date().getDay()];

  const [activeTab, setActiveTab] = useState("today");
  const [meals, setMealsState] = useState(() => loadMeals(todayKey));
  const [mealInputs, setMealInputs] = useState(["", "", "", ""]);
  const [mealLoading, setMealLoading] = useState([false, false, false, false]);
  const [editing, setEditing] = useState([false, false, false, false]);
  const [tip] = useState(TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [weekData, setWeekData] = useState(getLast7Days);

  function setMeals(updated) {
    setMealsState(updated);
    saveMeals(todayKey, updated);
    setWeekData(getLast7Days());
  }

  const totalCals = meals.reduce((sum, m) => sum + (m.cal || 0), 0);
  const remaining = DAILY_CALORIE_GOAL - totalCals;
  const pct = Math.min((totalCals / DAILY_CALORIE_GOAL) * 100, 100);
  const barColor = pct < 70 ? "#16a34a" : pct < 90 ? "#ca8a04" : "#dc2626";

  async function logMeal(i) {
    const desc = mealInputs[i].trim();
    if (!desc) return;
    const loading = [...mealLoading]; loading[i] = true; setMealLoading(loading);
    try {
      const result = await calcCaloriesAI(desc);
      const updated = [...meals];
      updated[i] = { ...updated[i], cal: result.total, breakdown: result, description: desc };
      setMeals(updated);
      const inp = [...mealInputs]; inp[i] = ""; setMealInputs(inp);
      const ed = [...editing]; ed[i] = false; setEditing(ed);
    } catch(e) { alert("Couldn't calculate calories. Please try again."); }
    const loading2 = [...mealLoading]; loading2[i] = false; setMealLoading(loading2);
  }

  function editMeal(i) {
    const inp = [...mealInputs]; inp[i] = meals[i].description; setMealInputs(inp);
    const ed = [...editing]; ed[i] = true; setEditing(ed);
  }

  function clearMeal(i) {
    const updated = [...meals];
    updated[i] = { ...updated[i], cal: 0, breakdown: null, description: "" };
    setMeals(updated);
    const inp = [...mealInputs]; inp[i] = ""; setMealInputs(inp);
    const ed = [...editing]; ed[i] = false; setEditing(ed);
  }

  const weekTotal = weekData.reduce((sum, d) => sum + d.total, 0);
  const daysLogged = weekData.filter(d => d.total > 0).length;
  const avgCals = daysLogged > 0 ? Math.round(weekTotal / daysLogged) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f2", color: "#1a1a1a", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", padding: "0 0 60px 0" }}>

      {/* Header */}
      <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid #d6d3ce" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#4a4a4a", textTransform: "uppercase", marginBottom: 4 }}>Your Wellness Journey</div>
        <div style={{ fontSize: 26, fontWeight: "bold", color: "#1a1a1a" }}>Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"} 👋</div>
        <div style={{ fontSize: 13, color: "#4a4a4a", marginTop: 4 }}>{today} · Goal: {DAILY_CALORIE_GOAL} cal/day</div>
      </div>

      {/* Quote */}
      <div style={{ margin: "16px 20px 0", background: "#1a1a1a", borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#a3a3a3", textTransform: "uppercase", marginBottom: 10 }}>Today's Reminder</div>
        <div style={{ fontSize: 16, color: "#ffffff", lineHeight: 1.7, fontStyle: "italic", marginBottom: 10 }}>"{quote.text}"</div>
        <div style={{ fontSize: 12, color: "#a3a3a3" }}>{quote.author}</div>
      </div>

      {/* Tip */}
      <div style={{ margin: "16px 20px", background: "#fff7ed", border: "1px solid #fed7aa", borderLeft: "3px solid #c2410c", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#1a1a1a", lineHeight: 1.6 }}>
        <span style={{ color: "#c2410c", fontWeight: "bold", fontSize: 11, letterSpacing: 1, display: "block", marginBottom: 4 }}>DAILY TIP</span>
        {tip}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", margin: "0 20px 20px", background: "#e5e2dd", borderRadius: 12, padding: 4 }}>
        {["today", "week"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
            background: activeTab === tab ? "#ffffff" : "transparent",
            color: "#1a1a1a", fontSize: 13,
            fontWeight: activeTab === tab ? "600" : "400",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            transition: "all 0.2s",
          }}>
            {tab === "today" ? "Today" : "This Week"}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 20px" }}>

        {/* TODAY TAB */}
        {activeTab === "today" && (
          <div>
            {/* Calorie ring */}
            <div style={{ background: "#ffffff", border: "1px solid #e5e2dd", borderRadius: 16, padding: "20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ position: "relative", width: 80, height: 80 }}>
                <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e2dd" strokeWidth="8" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke={barColor} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: "#1a1a1a" }}>{totalCals}</div>
                  <div style={{ fontSize: 10, color: "#4a4a4a" }}>eaten</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#4a4a4a", marginBottom: 8 }}>Daily Calorie Budget</div>
                <div style={{ fontSize: 24, fontWeight: "bold", color: remaining >= 0 ? "#166534" : "#9a3412" }}>
                  {remaining >= 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
                </div>
                <div style={{ fontSize: 12, color: "#4a4a4a", marginTop: 2 }}>of {DAILY_CALORIE_GOAL} cal goal</div>
              </div>
            </div>

            {/* Meal logger */}
            <div style={{ background: "#ffffff", border: "1px solid #e5e2dd", borderRadius: 16, padding: "20px" }}>
              <div style={{ fontSize: 13, color: "#4a4a4a", marginBottom: 16 }}>Describe what you ate — AI will calculate the calories</div>
              {meals.map((meal, i) => {
                const isLogged = meal.breakdown && !editing[i];
                return (
                  <div key={i} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < meals.length - 1 ? "1px solid #e5e2dd" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{meal.icon}</span>
                        <span style={{ fontSize: 15, fontWeight: "bold", color: "#1a1a1a" }}>{meal.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: "500", color: meal.cal > 0 ? "#166534" : "#4a4a4a" }}>
                          {meal.cal > 0 ? `${meal.cal} cal` : "—"}
                        </span>
                        {isLogged && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => editMeal(i)} style={{ background: "#f0ede8", border: "1px solid #d6d3ce", borderRadius: 8, padding: "4px 10px", color: "#1a1a1a", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>Edit</button>
                            <button onClick={() => clearMeal(i)} style={{ background: "#fff1ee", border: "1px solid #fecdbb", borderRadius: 8, padding: "4px 10px", color: "#9a3412", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>Clear</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {isLogged ? (
                      <div style={{ background: "#f7f5f2", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 13, color: "#4a4a4a", marginBottom: 8, fontStyle: "italic" }}>"{meal.description}"</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          {[{ label: "cal", val: meal.breakdown.total }, { label: "protein", val: `${meal.breakdown.protein}g` }, { label: "carbs", val: `${meal.breakdown.carbs}g` }, { label: "fat", val: `${meal.breakdown.fat}g` }].map(s => (
                            <div key={s.label} style={{ flex: 1, textAlign: "center", background: "#ffffff", border: "1px solid #e5e2dd", borderRadius: 8, padding: "6px 4px" }}>
                              <div style={{ fontSize: 13, fontWeight: "bold", color: "#1a1a1a" }}>{s.val}</div>
                              <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 2 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {meal.breakdown.items.map((item, j) => (
                            <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#1a1a1a" }}>
                              <span>{item.name} <span style={{ color: "#4a4a4a" }}>{item.amount}</span></span>
                              <span style={{ color: "#4a4a4a" }}>{item.calories} cal</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="e.g. Two scrambled eggs and toast..."
                            value={mealInputs[i]}
                            onChange={e => { const inp = [...mealInputs]; inp[i] = e.target.value; setMealInputs(inp); }}
                            onKeyDown={e => e.key === "Enter" && !mealLoading[i] && logMeal(i)}
                            style={{ flex: 1, background: "#f7f5f2", border: "1px solid #c8c4be", borderRadius: 10, padding: "9px 14px", color: "#1a1a1a", fontSize: 14, fontFamily: "'Inter', sans-serif" }}
                          />
                          <button onClick={() => logMeal(i)} disabled={mealLoading[i]} style={{
                            background: mealLoading[i] ? "#e5e2dd" : "#1a1a1a", border: "none", borderRadius: 10,
                            padding: "9px 14px", color: mealLoading[i] ? "#4a4a4a" : "#ffffff",
                            cursor: mealLoading[i] ? "default" : "pointer", fontSize: 13,
                            fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", minWidth: 70,
                          }}>
                            {mealLoading[i] ? "..." : editing[i] ? "Update" : "Calculate"}
                          </button>
                        </div>
                        {editing[i] && (
                          <button onClick={() => { const ed = [...editing]; ed[i] = false; setEditing(ed); }} style={{ marginTop: 6, background: "none", border: "none", color: "#4a4a4a", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif", padding: 0, textDecoration: "underline" }}>← cancel</button>
                        )}
                        {mealLoading[i] && <div style={{ marginTop: 8, fontSize: 12, color: "#4a4a4a" }}>✨ Analyzing your meal...</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div style={{ background: "#ffffff", border: "1px solid #e5e2dd", borderRadius: 16, padding: "20px", marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4a4a4a", marginBottom: 10 }}>
                <span>Total consumed</span>
                <span style={{ color: "#1a1a1a", fontWeight: "500" }}>{totalCals} / {DAILY_CALORIE_GOAL} cal</span>
              </div>
              <div style={{ background: "#e5e2dd", borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 8, background: barColor, width: `${pct}%`, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ marginTop: 12, textAlign: "center", fontSize: 15, fontWeight: "bold", color: remaining >= 0 ? "#166534" : "#9a3412" }}>
                {remaining >= 0 ? `${remaining} calories remaining today` : `${Math.abs(remaining)} calories over budget`}
              </div>
            </div>
          </div>
        )}

        {/* WEEK TAB */}
        {activeTab === "week" && (
          <div>
            {/* Week summary */}
            <div style={{ background: "#ffffff", border: "1px solid #e5e2dd", borderRadius: 16, padding: "20px", marginBottom: 16, display: "flex", gap: 12 }}>
              <div style={{ flex: 1, textAlign: "center", background: "#f7f5f2", borderRadius: 12, padding: "14px 8px" }}>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a1a" }}>{daysLogged}</div>
                <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 4 }}>days logged</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", background: "#f7f5f2", borderRadius: 12, padding: "14px 8px" }}>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#1a1a1a" }}>{avgCals}</div>
                <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 4 }}>avg cal/day</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", background: "#f7f5f2", borderRadius: 12, padding: "14px 8px" }}>
                <div style={{ fontSize: 22, fontWeight: "bold", color: avgCals <= DAILY_CALORIE_GOAL ? "#166534" : "#9a3412" }}>
                  {avgCals <= DAILY_CALORIE_GOAL ? "✓" : "↑"}
                </div>
                <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 4 }}>vs goal</div>
              </div>
            </div>

            {/* Daily bars */}
            <div style={{ background: "#ffffff", border: "1px solid #e5e2dd", borderRadius: 16, padding: "20px" }}>
              <div style={{ fontSize: 13, color: "#4a4a4a", marginBottom: 16 }}>Last 7 days</div>
              {weekData.map((day, i) => {
                const dayPct = Math.min((day.total / DAILY_CALORIE_GOAL) * 100, 100);
                const dayColor = day.total === 0 ? "#e5e2dd" : day.total <= DAILY_CALORIE_GOAL ? "#16a34a" : "#dc2626";
                return (
                  <div key={i} style={{ marginBottom: i < weekData.length - 1 ? 16 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: day.isToday ? "700" : "400", color: "#1a1a1a", minWidth: 90 }}>
                          {day.dayName} {day.isToday ? "· Today" : ""}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: "500", color: day.total === 0 ? "#4a4a4a" : day.total <= DAILY_CALORIE_GOAL ? "#166534" : "#9a3412" }}>
                        {day.total === 0 ? "—" : `${day.total} cal`}
                      </span>
                    </div>
                    <div style={{ background: "#e5e2dd", borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 6, background: dayColor, width: `${dayPct}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e2dd", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4a4a4a" }}>
                <span>🟢 At or under goal</span>
                <span>🔴 Over goal</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
