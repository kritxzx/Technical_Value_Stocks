# NEON QUANT — US Stock Screener & Terminal (v2)

Modern responsive full-stack web application (**FastAPI** + **React / TypeScript / Tailwind CSS** + **TradingView Lightweight Charts**) + offline market scanner for spotting US stock pullback entries inside uptrends.

## Architecture

```
Predict_Stocks-main/
├── backend/
│   ├── main.py                      # FastAPI REST API + SPA static server
│   ├── schemas.py                   # Pydantic response models
│   └── core/
│       ├── config.py                # Centralized settings & ticker universe
│       ├── data_processing.py       # Concurrent yfinance fetcher, tz-normalization, TTL cache
│       ├── indicators.py            # EMA (20/50/200), RSI (14), MACD, ATR (14), Volume Ratio
│       ├── mathematical_models.py   # Log-Linear Channel, High/Low S/R, Volatility Forecast, Confluence Score
│       └── discord_bot.py           # NaN-safe Discord webhook notifier
├── frontend/                        # React + Vite + Tailwind + TradingView Lightweight Charts (Dark + Neon Pink)
├── main.py                          # CLI offline scanner -> outputs/signals.csv + optional Discord alert
├── outputs/
│   └── signals.csv                  # Latest market scan results
└── .github/workflows/main.yml       # Scheduled weekday US market-close scan
```

## Quick Start

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Build Frontend & Run Single Server (Recommended)
```bash
cd frontend
npm install
npm run build
cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Open **http://localhost:8000** on Desktop or Mobile (no login required).

### 3. Development Mode (Hot Reload)
Run Backend and Frontend in two terminals:
```bash
# Terminal 1: FastAPI backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2: Vite frontend (proxies /api -> :8000)
cd frontend
npm run dev
```
Open **http://localhost:5173**.

### 4. Run Offline Scanner (CLI)
```bash
python main.py                     # scans DEFAULT_UNIVERSE -> outputs/signals.csv
python main.py --min-score 60 --notify
```

## Deploy on Render (Free Tier + GitHub Auto-Deploy)

This repository includes a multi-stage `Dockerfile` (builds React + runs FastAPI in one lightweight container) and `render.yaml` Blueprint.

1. Push the contents of this folder to your GitHub repository.
2. Go to [render.com](https://render.com) → **New +** → **Blueprint** (or **Web Service** → select **Docker**).
3. Connect your GitHub repository and click **Apply / Deploy**.
4. Every `git push` to `main` will automatically rebuild and redeploy your site.

## Quant Engine v2 Highlights

- **Log-Linear Regression Channel**: Fits OLS on $\ln(\text{Close})$ for scale-invariant percentage bands and strictly positive projections.
- **High/Low Macro S/R**: Detects swing highs/lows from candlestick wicks (`High`/`Low`), clusters without chaining drift, and tracks touch counts (`S1/S2`, `R1/R2`).
- **Volatility-Scaled Forecast**: Combines log-trend drift with $\sqrt{t}$ realized volatility for realistic confidence cones.
- **ATR (14) Entry & Stop-Loss**: Anchors Buy Zone on macro support / lower band and places stop-loss at $1.5\times \text{ATR}$ below zone.
- **Confluence Signal Score (0–100)**: Combines $R^2$ cleanliness (30), pullback position with falling-knife penalty (25), EV upside (15), RSI/MACD momentum (15), and EMA 20/50/200 trend alignment (15).

> ⚠️ For research & educational purposes only — not financial advice.
