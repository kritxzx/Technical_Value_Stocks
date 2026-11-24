# US Technical Quant Screener

A systematic US equity screener and interactive analysis terminal built with **FastAPI** and **React + TypeScript**. It identifies high-probability pullback entries inside established uptrends using log-linear regression channels, multi-confluence support clustering, ATR-based risk sizing, and a zero-lookahead walk-forward backtester.

**Live Demo:** [neon-quant-screener.onrender.com](https://neon-quant-screener.onrender.com/)

---

## Key Features

- **Log-Linear Regression Channel:** Fits OLS in logarithmic price space ($\ln(\text{Close})$) to maintain percentage-consistent $\pm 2\sigma$ bands and strictly positive projections.
- **Multi-Confluence Demand Zones:** Clusters overlapping support from macro swing lows (`S1`), moving averages (`EMA 20/50/200`), Volume Profile (`POC / HVN`), and channel bands to isolate institutional cost-basis levels.
- **Anti-Falling-Knife Filter:** Separates price entering a buy zone (`IN_ZONE_WAIT_CONFIRM`) from confirmed stabilization (`CONFIRMED_ENTRY`) via candlestick structure and MACD momentum turns.
- **Volatility-Scaled Forecast Cone:** Projects expected 1W–3M price paths by combining trend drift with realized return volatility ($\sigma_t$) and regression uncertainty.
- **Zero-Lookahead Walk-Forward Backtester:** Simulates 3–5 years of trades bar-by-bar using only data available up to day $t$, executing on next-day open with `0.1%` slippage per side.
- **Interactive Terminal UI:** Built with TradingView Lightweight Charts featuring pinch-to-zoom, live quote overlays, a `localStorage` watchlist, and real-time market scanning.

---

## Signal Scoring and Backtest Metrics

### Confluence Score Breakdown (0 – 100 pts)
Evaluates uptrends ($\beta > 0$) across five weighted factors while penalizing noisy trends ($R^2 < 0.45$) and breakdowns below $-2\sigma$:

| Component | Weight | What It Measures |
| :--- | :---: | :--- |
| **Trend Fit ($R^2$)** | `0 – 30 pts` | Trend cleanliness; penalized below `45%` to filter choppy markets |
| **Channel Pullback** | `0 – 25 pts` | Rewards pullbacks in the `10%–45%` channel zone; penalizes $-2\sigma$ breakdowns |
| **EV Upside** | `0 – 15 pts` | Remaining upside from current price back to the log-regression mean |
| **RSI & MACD** | `0 – 15 pts` | Healthy pullback RSI (`35–58`) and improving MACD histogram |
| **EMA Alignment** | `0 – 15 pts` | Institutional trend structure (`Price > EMA 20 > EMA 50 > EMA 200`) |

### Backtest Evaluation Metrics

| Metric | Formula / Basis | Role |
| :--- | :--- | :--- |
| **Profit Factor** | $\sum \text{Wins} / \sum \text{Losses}$ | Gross profitability relative to gross losses |
| **Expectancy** | Avg return % per trade | Net statistical edge after `0.1%` slippage per side |
| **Max Drawdown / Sharpe** | Peak-to-trough % / Risk-adjusted | Downside risk and consistency vs. Buy & Hold |

---

<details>
<summary><b> Quantitative Model & Pricing Methodology (Click to expand)</b></summary>

1. **Trend Channel Estimation:** Fits OLS on $\ln(P_t) = \alpha + \beta t$ over trailing $N$ trading days (default `90D`) to extract daily log drift $\beta$, goodness-of-fit $R^2$, and residual dispersion $\sigma_{\log}$. Fair-value EV target is $e^{\hat{y}_t}$ with bands at $e^{\hat{y}_t \pm 2\sigma_{\log}}$.
2. **Macro S/R & Volume Profile:** Detects swing highs/lows (`argrelextrema`, order `10`), clusters levels within $\pm 2\%$ of the cluster mean to prevent chaining drift, and builds a 120-day Volume-at-Price histogram to locate `POC` and `HVN`.
3. **Demand Zone & ATR Risk Sizing:**
   - **Buy Zone:** `entry_ref ± 0.40 × ATR`
   - **Stop-Loss:** `entry_low - 1.5 × ATR(14)`
   - **Take-Profit:** `TP1` at nearest realistic resistance / EV target; `TP2` at horizon forecast target.
4. **Walk-Forward Validation:** Recomputes causal indicators, trailing OLS, and confirmed swing lows ($k \le t - 10$) at every bar $t$. Enters on bar $t+1$ open and checks Stop-Loss before Take-Profit on intraday bars, plus a time exit at horizon.

</details>

---

## Project Structure

```text
.
├── backend/
│   ├── main.py                      # FastAPI REST API + SPA static server
│   ├── schemas.py                   # Pydantic response models
│   └── core/
│       ├── config.py                # Parameters, universe, and environment settings
│       ├── data_processing.py       # Concurrent yfinance fetcher, tz-normalization, TTL cache
│       ├── indicators.py            # EMA, RSI, MACD, ATR, Volume Profile (POC/HVN)
│       ├── mathematical_models.py   # Log-linear channel, S/R, forecast, confluence setup
│       ├── backtester.py            # Zero-lookahead walk-forward & portfolio backtester
│       └── discord_bot.py           # NaN-safe Discord webhook notifier
├── frontend/                        # React + TypeScript + Tailwind + Lightweight Charts
├── main.py                          # CLI market scanner -> outputs/signals.csv
├── outputs/signals.csv              # Latest ranked market scan
├── Dockerfile                       # Multi-stage Node + Python production build
├── render.yaml                      # Render Blueprint (Free tier + auto-deploy)
└── .github/workflows/main.yml       # Scheduled weekday US market-close scan
