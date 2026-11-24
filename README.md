# US Technical Quant Screener

A systematic US equity screener and interactive analysis terminal built with **FastAPI** and **React + TypeScript**. The platform identifies high-probability pullback entries inside established uptrends using log-linear regression channels, multi-confluence support detection, ATR-based risk sizing, and a zero-lookahead walk-forward backtester.

## Key Features
- **Log-Linear Regression Channel:** Fits OLS in logarithmic price space ($\ln(\text{Close})$) rather than raw price to maintain percentage-consistent $\pm 2\sigma$ bands and strictly positive projections.
- **Multi-Confluence Demand Zone:** Clusters overlapping support levels from macro swing lows (`S1`), dynamic moving averages (`EMA 20/50/200`), Volume Profile (`POC` / `HVN`), and channel bands to isolate institutional cost-basis zones.
- **Anti-Falling-Knife Confirmation:** Separates price touching a buy zone (`IN_ZONE_WAIT_CONFIRM`) from confirmed stabilization (`CONFIRMED_ENTRY`) using candlestick structure and MACD momentum turns.
- **Volatility-Scaled Forecast Cone:** Projects expected price paths over 1W–3M horizons by combining trend drift with realized return volatility ($\sigma\sqrt{t}$) and regression estimation uncertainty.
- **Walk-Forward Backtesting (Zero Lookahead):** Simulates historical trades bar-by-bar over 3–5 years using only information available up to day $t$, executing on next-day open with 0.1% slippage per side.
- **Responsive Terminal UI:** Built with TradingView Lightweight Charts for desktop and mobile (pinch-to-zoom, live quote overlay, localStorage watchlist, and real-time market scanner).

## Quantitative Model and Pricing Methodology
1. **Trend Channel Estimation:** Fit OLS on $\ln(P_t) = \alpha + \beta t$ over the trailing $N$ trading days (default `90D`), producing the daily log drift $\beta$, goodness-of-fit $R^2$, and residual dispersion $\sigma_{\log}$. The fair-value **EV Target** today is $e^{\hat{y}_t}$, with bands at $e^{\hat{y}_t \pm 2\sigma_{\log}}$.
2. **Macro S/R & Volume Profile:** Detect swing highs from `High` and swing lows from `Low` (`argrelextrema`, order 10), cluster levels within $\pm 2\%$ of the cluster mean to prevent chaining drift, and build a 120-day Volume-at-Price histogram to locate the Point of Control (`POC`) and High-Volume Nodes (`HVN`).
3. **Demand Zone & ATR Risk Sizing:** Weight and cluster nearby support candidates (`S1`, `EMA 20/50/200`, `HVN`, `-1σ/-2σ`) to form the Buy Zone (`entry_ref ± 0.40 × ATR`). Set **Stop-Loss** at `entry_low - 1.5 × ATR(14)`, **TP1** at the nearest realistic resistance/EV target, and **TP2** at the horizon forecast target.
4. **Confluence Scoring (0–100):** Score uptrends ($\beta > 0$) across five factors while penalizing noisy trends ($R^2 < 0.45$) and breakdowns below $-2\sigma$.
5. **Walk-Forward Validation:** At each historical bar $t$, recompute causal indicators, trailing OLS, and confirmed swing lows ($k \le t - 10$). Enter on bar $t+1$ open when the setup triggers; evaluate exits conservatively (`Stop-Loss` checked before `Take-Profit` on intraday bars, plus time exit at horizon).

## Signal Score and Backtest Metrics

| Component / Metric | Weight / Formula | Role |
| :--- | :--- | :--- |
| **Trend Fit ($R^2$)** | `0 – 30 pts` | Measures trend cleanliness; penalized below 45% to filter noisy chop |
| **Channel Pullback** | `0 – 25 pts` | Rewards pullbacks in the 10%–45% channel zone; penalizes $-2\sigma$ breakdowns |
| **EV Upside** | `0 – 15 pts` | Remaining upside from current price back to the log-regression mean |
| **RSI & MACD** | `0 – 15 pts` | Rewards healthy pullback RSI (35–58) and improving MACD histogram |
| **EMA Alignment** | `0 – 15 pts` | Institutional trend structure (`Price`, `EMA 20`, `EMA 50`, `EMA 200`) |
| **Profit Factor** | $\sum \text{Wins} / |\sum \text{Losses}|$ | Strategy efficiency across walk-forward trades (target $\ge 1.50$) |
| **Expectancy** | Avg return % per trade | Net statistical edge per trade after 0.1% slippage per side |
| **Max Drawdown / Sharpe** | Peak-to-trough % / Risk-adj. | Downside risk and consistency compared against Buy & Hold |

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
```

## Usage and Deployment

### Local Run (Single Server)
```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000` in your browser.

### Offline Market Scanner (CLI)
```bash
python main.py                        # Scan universe -> outputs/signals.csv
python main.py --min-score 60 --notify # Push top setups to Discord webhook
```

### Deploy on Render Free Tier
1. Push this repository to GitHub.
2. On [https://neon-quant-screener.onrender.com/], select **New + → Blueprint** and connect your repository.
3. Render automatically builds via `Dockerfile` and `render.yaml` with auto-deploy on every push to `main`.

> #!!! **Disclaimer:** This project is a quantitative technical-analysis tool built for research and educational purposes only. Historical backtest performance does not guarantee future results and is not financial advice.
