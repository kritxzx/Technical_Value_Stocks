"""
Central configuration for the US Quant Screener.
All tunable parameters, file paths, and environment settings live here.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


# ----------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

SIGNALS_PATH = OUTPUT_DIR / "signals.csv"
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"

# ----------------------------------------------------------------------
# Environment / Secrets
# ----------------------------------------------------------------------
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

# ----------------------------------------------------------------------
# Data settings
# ----------------------------------------------------------------------
CHART_PERIOD = "2y"
CHART_INTERVAL = "1d"
REQUEST_TIMEOUT = 15
HISTORY_CACHE_TTL = 300      # 5 minutes
QUOTE_CACHE_TTL = 20         # 20 seconds
SCREENER_CACHE_TTL = 120     # 2 minutes

# ----------------------------------------------------------------------
# Model settings
# ----------------------------------------------------------------------
REGRESSION_WINDOW = 90       # default trading days used to fit log-linear channel
ALLOWED_WINDOWS = [60, 90, 120, 180]
CHANNEL_STD_MULT = 2.0       # +/- sigma multiplier in log-space
SR_ORDER = 10                # bar spacing used to detect swing highs/lows
SR_TOLERANCE_PCT = 0.02      # cluster S/R levels within +-2% of cluster mean
SR_LOOKBACK_DAYS = 504       # ~2y of daily bars used for macro S/R
ATR_PERIOD = 14
RSI_PERIOD = 14
VOLUME_MA_PERIOD = 20

# ----------------------------------------------------------------------
# Screener settings
# ----------------------------------------------------------------------
MIN_SIGNAL_SCORE = 55.0
TOP_N_ALERTS = 10

# ----------------------------------------------------------------------
# Forecast settings
# ----------------------------------------------------------------------
DEFAULT_FORECAST_HORIZON = 20
FORECAST_CONFIDENCE = 0.90   # 90% volatility-scaled interval
FORECAST_HORIZONS = {
    5: "1 สัปดาห์",
    10: "2 สัปดาห์",
    20: "1 เดือน",
    60: "3 เดือน",
}

DEFAULT_WATCHLIST = ["NVDA", "AAPL", "MSFT", "TSLA", "PLTR", "LLY"]

DEFAULT_UNIVERSE = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "ORCL", "CRM",
    # Semis / hardware
    "AMD", "QCOM", "TXN", "MU", "INTC", "ASML", "LRCX", "AMAT", "KLAC",
    # Financials
    "JPM", "BAC", "GS", "MS", "V", "MA", "AXP", "SCHW",
    # Healthcare
    "LLY", "UNH", "JNJ", "PFE", "MRK", "ABBV", "TMO",
    # Consumer
    "COST", "WMT", "HD", "NKE", "SBUX", "MCD", "PG", "KO", "PEP",
    # Industrials / energy
    "CAT", "BA", "GE", "XOM", "CVX", "LIN",
    # Growth / momentum names often screened
    "OKLO", "VST", "SAP", "PLTR", "SMCI", "CRWD", "NET", "SNOW", "SHOP",
]

STRUCTURE_LABELS = {
    "ABOVE_CHANNEL_EXTENDED": ("เหนือกรอบ (Overbought)", "#ff6b35"),
    "ABOVE_S1_HOLDING": ("ยืนเหนือแนวรับ (Holding Support)", "#00f5d4"),
    "AT_R1_RESISTANCE": ("ทดสอบแนวต้าน (At Resistance)", "#facc15"),
    "BELOW_S1_BREAKDOWN": ("หลุดแนวรับ (Breakdown)", "#ff2e97"),
    "BELOW_CHANNEL_EXTENDED": ("ต่ำกว่ากรอบ (Oversold)", "#38bdf8"),
    "NEUTRAL": ("ปกติ (Neutral)", "#94a3b8"),
}

ENTRY_STATUS_LABELS = {
    "CONFIRMED_ENTRY": ("ยืนยันจุดเข้าซื้อ (Confirmed Entry)", "#00f5d4"),
    "IN_ZONE_WAIT_CONFIRM": ("แตะโซนซื้อแล้ว — รอแท่งเทียนยืนยัน", "#38bdf8"),
    "IN_ZONE": ("ราคาอยู่ในโซนเข้าซื้อแล้ว", "#00f5d4"),
    "WAIT_FOR_PULLBACK": ("ยังไม่ถึงโซน — รอราคาย่อตัวก่อน", "#facc15"),
    "BELOW_ZONE_RISK": ("ราคาหลุดต่ำกว่าโซนที่ประเมินไว้แล้ว", "#ff2e97"),
    "DOWNTREND_NO_SETUP": ("เทรนด์เป็นขาลง — ไม่มีจุดเข้าซื้อ", "#64748b"),
}
