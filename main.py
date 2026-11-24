"""
Offline scanner - run on a schedule (.github/workflows/main.yml) or from CLI:

    python main.py --min-score 55 --notify

Walks the configured ticker universe concurrently, fits the upgraded
Log-Linear Quant model + indicators for each name, writes ranked results to
outputs/signals.csv, and optionally pushes top setups to Discord.
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone

import pandas as pd

from backend.core import config, discord_bot
from backend.core.data_processing import get_universe_history
from backend.core.mathematical_models import add_forecast, build_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("main")


def run_scan(tickers: list[str], min_score: float) -> pd.DataFrame:
    logger.info("Fetching history for %d tickers...", len(tickers))
    history = get_universe_history(tickers)
    logger.info("Got data for %d/%d tickers", len(history), len(tickers))

    scanned_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = []
    for ticker, df in history.items():
        try:
            model = build_model(df, window=config.REGRESSION_WINDOW)
            model = add_forecast(
                model,
                horizon_days=config.DEFAULT_FORECAST_HORIZON,
                confidence=config.FORECAST_CONFIDENCE,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Model failed for %s: %s", ticker, exc)
            continue

        fc = model["forecast"]
        setup = model["entry_setup"]
        ind = model["indicators"]["latest"]

        rows.append(
            {
                "ticker": ticker,
                "price": round(model["current_price"], 2),
                "r_squared": round(model["r_squared"] * 100.0, 1),
                "ev_target": round(model["ev_target"], 2),
                "upside_pct": model["upside_pct"],
                "structure": model["structure"],
                "score": model["score"],
                "rsi14": ind.get("rsi14"),
                "atr_pct": ind.get("atr_pct"),
                "trend_alignment": ind.get("trend_alignment"),
                "s1": round(model["s1"], 2) if model["s1"] is not None else None,
                "r1": round(model["r1"], 2) if model["r1"] is not None else None,
                "forecast_days": fc["horizon_days"],
                "forecast_target": round(fc["target_price"], 2),
                "forecast_low": round(fc["target_low"], 2),
                "forecast_high": round(fc["target_high"], 2),
                "entry_low": setup["entry_low"],
                "entry_high": setup["entry_high"],
                "stop_loss": setup["stop_loss"],
                "risk_reward": setup["risk_reward"],
                "entry_status": setup["entry_status"],
                "scanned_at": scanned_at,
            }
        )

    result = pd.DataFrame(rows)
    if result.empty:
        logger.warning("No tickers produced a usable model - writing empty result.")
        return result

    result = result.sort_values("score", ascending=False).reset_index(drop=True)
    actionable = result[result["score"] >= min_score]
    logger.info(
        "%d/%d names cleared the %.0f score threshold",
        len(actionable),
        len(result),
        min_score,
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="US Quant Screener - offline scan")
    parser.add_argument("--tickers", nargs="*", default=config.DEFAULT_UNIVERSE)
    parser.add_argument("--min-score", type=float, default=config.MIN_SIGNAL_SCORE)
    parser.add_argument("--top-n", type=int, default=config.TOP_N_ALERTS)
    parser.add_argument("--notify", action="store_true", help="push results to Discord")
    args = parser.parse_args()

    result = run_scan(args.tickers, args.min_score)
    config.SIGNALS_PATH.parent.mkdir(exist_ok=True)
    result.to_csv(config.SIGNALS_PATH, index=False)
    logger.info("Wrote %s", config.SIGNALS_PATH)

    if args.notify and not result.empty:
        actionable = result[result["score"] >= args.min_score]
        formatted = [
            (
                row["ticker"],
                {
                    "current_price": row["price"],
                    "r_squared": row["r_squared"] / 100.0,
                    "ev_target": row["ev_target"],
                    "upside_pct": row["upside_pct"],
                    "structure": row["structure"],
                    "score": row["score"],
                    "rsi14": row.get("rsi14"),
                    "forecast_target": row["forecast_target"],
                    "forecast_days": row["forecast_days"],
                    "entry_low": row["entry_low"],
                    "entry_high": row["entry_high"],
                    "stop_loss": row["stop_loss"],
                    "risk_reward": row["risk_reward"],
                },
            )
            for _, row in actionable.iterrows()
        ]
        discord_bot.send_daily_summary(formatted, top_n=args.top_n)

    return 0


if __name__ == "__main__":
    sys.exit(main())
