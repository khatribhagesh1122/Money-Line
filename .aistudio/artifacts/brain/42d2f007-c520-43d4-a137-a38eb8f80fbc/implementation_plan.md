# Multi-Timeframe Trend Formula Update (M, W, D, 1H Two-Candle Lookback Rule)

This update aligns the **Monthly (`M`), Weekly (`W`), Daily (`D`), and 1-Hour (`1H`) Trend** calculations across the Intraday Screener and Stock Intelligence Modal with your exact two-candle lookback specification (`T-1 Close` vs `T-2 Open` and `Current Price` vs `T-1 Close`).

## User Review & Critical Decisions

> [!IMPORTANT]
> Both conditions below must pass in the same direction for a timeframe to be marked **`BULL (UP)`** or **`BEAR (DOWN)`**. If one condition passes and the other does not, the timeframe is strictly marked **`NEUT (NEUTRAL)`**.

- **Confirmed Decision 1 — Exact Two-Condition Formula**:
  - Let **Current Candle ($T_0$)** = current active timeframe (e.g., Nov month, current week, today's session, current 1-hour block), where active price = **$\text{CMP}$**.
  - Let **Previous Completed Candle ($T_{-1}$)** = the immediately preceding completed candle (e.g., Oct month, last completed week, yesterday's completed daily bar, last completed 1-hour block), with close price **$\text{Close}_{T-1}$**.
  - Let **Previous-1 Completed Candle ($T_{-2}$)** = the completed candle before $T_{-1}$ (e.g., Sep month, two weeks ago, two trading days ago, two 1-hour blocks ago), with open price **$\text{Open}_{T-2}$**.
  - **BULL (`UP`)**:
    $$\left(\text{Close}_{T-1} > \text{Open}_{T-2}\right) \quad \text{AND} \quad \left(\text{CMP} > \text{Close}_{T-1}\right)$$
    *Example (Monthly in Nov)*: Sep Open ($\text{Open}_{T-2}$) = `700`, Oct Close ($\text{Close}_{T-1}$) = `800` (`800 > 700` ✓), and Current Nov Price ($\text{CMP}$) `> 800` ✓ $\implies$ **Monthly Trend = `UP`**.
  - **BEAR (`DOWN`)**:
    $$\left(\text{Close}_{T-1} < \text{Open}_{T-2}\right) \quad \text{AND} \quad \left(\text{CMP} < \text{Close}_{T-1}\right)$$
    *Example (Monthly in Nov)*: Sep Open ($\text{Open}_{T-2}$) = `700`, Oct Close ($\text{Close}_{T-1}$) = `600` (`600 < 700` ✓), and Current Nov Price ($\text{CMP}$) `< 600` ✓ $\implies$ **Monthly Trend = `DOWN`**.
  - **NEUT (`NEUTRAL`)**:
    - Any case where Condition 1 ($\text{Close}_{T-1}$ vs $\text{Open}_{T-2}$) and Condition 2 ($\text{CMP}$ vs $\text{Close}_{T-1}$) do not both agree.
- **Confirmed Decision 2 — Scope Across All 4 HTF Timeframes**:
  - This exact same two-candle lookback rule (`T-1 Close vs T-2 Open` + `CMP vs T-1 Close`) applies uniformly to **Monthly (`M`)**, **Weekly (`W`)**, **Daily (`D`)**, and **1-Hour (`1H`)** trends.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces the previous single-candle comparison (`T-1 Close > T-1 Open & T-1 Close > T-2 Close`) with your two-candle structural momentum rule (`T-1 Close > T-2 Open` AND `CMP > T-1 Close` for Bullish; `T-1 Close < T-2 Open` AND `CMP < T-1 Close` for Bearish) across all 4 higher timeframes.
- **Target Audience / Workflow**: Intraday & swing traders using the **16-Column Intraday Screener**, **Bullish/Bearish Setups**, and **Stock Detail Modal (7-Parameter Alignment)** to verify multi-timeframe trend alignment and `BUY`/`SELL` execution signals.
- **Key Value**: Ensures a timeframe is only marked `UP` (or `DOWN`) when **both** the two-period historical expansion ($\text{Close}_{T-1}$ relative to $\text{Open}_{T-2}$) **and** live price continuation ($\text{CMP}$ breaking above/below $\text{Close}_{T-1}$) confirm simultaneously.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **16-Column Intraday Screener & Setup Cards**: Columns `2. M Trend`, `3. W Trend`, `4. D Trend`, and `5. 1H Trend` immediately reflect `BULL`, `BEAR`, or `NEUT` using the new formula.
  2. **Hover Tooltips on Trend Badges**: Hovering over any `M`, `W`, `D`, or `1H` badge displays the exact values used in the calculation:
     - `Prev Candle (T-1) Close: ₹...`
     - `Prev-1 Candle (T-2) Open: ₹...`
     - `Current Price (CMP): ₹...`
     - Exact formula check status (`T-1 Close > T-2 Open` and `CMP > T-1 Close`).
  3. **Stock Modal (Tab 2: 7-Param Alignment)**: The 4 HTF parameter cards (`1. Daily Trend`, `2. Weekly Trend`, `3. Monthly Trend`, `4. Hourly Trend`) display the exact `T-1 Close`, `T-2 Open`, and `CMP` comparison so you can cross-verify every number at a glance.
- **Visual Identity & Theme**:
  - Retains the existing dark slate financial terminal aesthetic (`#080D16` canvas, `#0D1422` elevated cards, `#00C995` emerald for `BULL`, `#FF526B` rose for `BEAR`, `#8B9BB4` muted slate for `NEUT`) and strict `font-mono tabular-nums` alignment across all 16 columns.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Dynamic Live CMP Evaluation in Frontend Screener Engine**:
  - *Chosen Approach*: Pass both $\text{Close}_{T-1}$ (`monthlyClose`, `weeklyClose`, `dailyClose`, `hourlyClose`) and $\text{Open}_{T-2}$ (`prevMonthOpen`, `prevWeekOpen`, `prevDay2Open`, `prevHourly2Open`) from the candle engine to the frontend, and evaluate `(Close_T1 > Open_T2) && (CMP > Close_T1)` dynamically inside `evaluateIntradayScreener(stock)`.
  - *Why*: Because Condition 2 depends on `CMP > Close_T1` (or `CMP < Close_T1`), evaluating it dynamically in `evaluateIntradayScreener` guarantees that if `CMP` crosses above or below `Close_T1` at the next 15-minute screener snapshot (or inside the Stock Modal), the trend status (`UP` / `DOWN` / `NEUTRAL`), `Power` score (`0/7`–`7/7`), and `Execute` signal (`BUY` / `SELL` / `NO TRADE`) stay 100% synchronized.
- **Decision 2 — Preserving Unchanged Parameters (Cols 6–14, 15m Init, 45m Big, Execute Gate)**:
  - *Chosen Approach*: Keep `6. M Close`, `7. W Close`, `8. D Close` showing $\text{Close}_{T-1}$, keep `9. D Support` / `10. D Resist`, `12. 15m Init`, `13. 45m Big`, `14. Stop Loss`, and the `16. Execute` alignment gate intact.
  - *Why*: Only the 4 trend rules (`M`, `W`, `D`, `1H`) were requested to change; all downstream `Power` (`0/7`–`7/7`) and `Execute` (`BUY`/`SELL`) calculations automatically inherit the updated `M`, `W`, `D`, and `1H` trend outcomes.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     Historical & Intraday Candle Engine                    │
│  • Monthly Grouping (YYYY-MM):                                             │
│      T-1 (Last Completed Month)  ──► monthlyClose (Close_T1)               │
│      T-2 (Prev-1 Completed Month)──► prevMonthOpen (Open_T2)               │
│  • Weekly Grouping (ISO Week):                                             │
│      T-1 (Last Completed Week)   ──► weeklyClose (Close_T1)                │
│      T-2 (Prev-1 Completed Week) ──► prevWeekOpen (Open_T2)                │
│  • Daily Completed Bars:                                                   │
│      T-1 (Yesterday Completed)   ──► dailyClose (Close_T1)                 │
│      T-2 (2 Days Ago Completed)  ──► prevDay2Open (Open_T2)                │
│  • 1-Hour Completed NSE Blocks (4x15m):                                    │
│      T-1 (Last Completed 1H)     ──► hourlyClose (Close_T1)                │
│      T-2 (Prev-1 Completed 1H)   ──► prevHourly2Open (Open_T2)             │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               Unified Screener Evaluator (evaluateIntradayScreener)        │
│  For each timeframe TF in { Monthly, Weekly, Daily, Hourly }:              │
│    • isCond1Up   = Close_T1 > Open_T2                                      │
│    • isCond2Up   = CMP      > Close_T1                                     │
│    • isCond1Down = Close_T1 < Open_T2                                      │
│    • isCond2Down = CMP      < Close_T1                                     │
│    • Trend = (isCond1Up && isCond2Up)     ? 'UP'                           │
│            : (isCond1Down && isCond2Down) ? 'DOWN'                         │
│            : 'NEUTRAL'                                                     │
└───────────────────┬────────────────────────────────────┬───────────────────┘
                    │                                    │
                    ▼                                    ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│   16-Column Screener & Setup Cards   │  │   Stock Intelligence Modal       │
│  • Cols 2-5: M, W, D, 1H Badges      │  │  • 7-Param Alignment Cards       │
│  • Col 15: Power Score (0/7 to 7/7)  │  │  • Shows exact T-1 Close,        │
│  • Col 16: Execute (BUY/SELL/NO TRD) │  │    T-2 Open & CMP check values   │
└──────────────────────────────────────┘  └──────────────────────────────────┘
```

### Data Model Additions on `Stock`
- `prevMonthOpen?: number` ($\text{Open}_{T-2}$ for Monthly: Open of the `Previous - 1` completed month, e.g., Sep Open when in Nov).
- `prevWeekOpen?: number` ($\text{Open}_{T-2}$ for Weekly: Open of the `Previous - 1` completed week).
- `prevDay2Open?: number` ($\text{Open}_{T-2}$ for Daily: Open of the `Previous - 1` completed trading day).
- `prevHourly2Open?: number` ($\text{Open}_{T-2}$ for Hourly: Open of the `Previous - 1` completed 1-hour candle block).
