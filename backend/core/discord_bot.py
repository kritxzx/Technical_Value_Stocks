"""
Thin Discord notifier using incoming webhooks.
NaN-safe formatting and respects config.REQUEST_TIMEOUT.
"""
from __future__ import annotations

import logging
import math

import requests

from backend.core.config import DISCORD_WEBHOOK_URL, REQUEST_TIMEOUT, STRUCTURE_LABELS

logger = logging.getLogger(__name__)


def _is_valid_num(val) -> bool:
    if val is None:
        return False
    try:
        return math.isfinite(float(val))
    except (TypeError, ValueError):
        return False


def _post(payload: dict, webhook_url: str | None = None) -> bool:
    url = webhook_url or DISCORD_WEBHOOK_URL
    if not url:
        logger.info("No Discord webhook configured - skipping notification.")
        return False
    try:
        resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Discord webhook failed: %s", exc)
        return False


def _signal_embed(ticker: str, model: dict) -> dict:
    label, color_hex = STRUCTURE_LABELS.get(model["structure"], ("UNKNOWN", "#94a3b8"))
    color_int = int(color_hex.lstrip("#"), 16)
    fields = [
        {"name": "ราคาปัจจุบัน", "value": f"${float(model['current_price']):.2f}", "inline": True},
        {"name": "R² (Log)", "value": f"{float(model['r_squared']) * 100:.1f}%", "inline": True},
        {
            "name": "EV Target",
            "value": f"${float(model['ev_target']):.2f} ({float(model['upside_pct']):+.1f}%)",
            "inline": True,
        },
        {"name": "โครงสร้าง", "value": label, "inline": False},
    ]

    if _is_valid_num(model.get("rsi14")):
        fields.append({"name": "RSI (14)", "value": f"{float(model['rsi14']):.1f}", "inline": True})

    if _is_valid_num(model.get("forecast_target")):
        days = model.get("forecast_days", "?")
        fields.append(
            {"name": f"เป้าหมาย ({days}d)", "value": f"${float(model['forecast_target']):.2f}", "inline": True}
        )

    if (
        _is_valid_num(model.get("entry_low"))
        and _is_valid_num(model.get("entry_high"))
        and _is_valid_num(model.get("stop_loss"))
    ):
        fields.append(
            {
                "name": "โซนเข้าซื้อ / Stop (ATR)",
                "value": (
                    f"${float(model['entry_low']):.2f}–${float(model['entry_high']):.2f} "
                    f"/ ${float(model['stop_loss']):.2f}"
                ),
                "inline": True,
            }
        )

    if _is_valid_num(model.get("risk_reward")):
        fields.append({"name": "Risk:Reward", "value": f"1:{float(model['risk_reward']):.2f}", "inline": True})

    return {
        "title": f"{ticker} — Signal Score {float(model['score']):.1f}/100",
        "color": color_int,
        "fields": fields,
    }


def send_signal_alert(ticker: str, model: dict, webhook_url: str | None = None) -> bool:
    """Push a single-ticker signal card to Discord."""
    payload = {"embeds": [_signal_embed(ticker, model)]}
    return _post(payload, webhook_url)


def send_daily_summary(
    results: list[tuple[str, dict]],
    webhook_url: str | None = None,
    top_n: int = 10,
) -> bool:
    """Push the top N scanned tickers as one message with up to 10 embeds."""
    if not results:
        return False
    embeds = [_signal_embed(tkr, model) for tkr, model in results[:top_n]]
    payload = {
        "content": (
            f"📊 **US Quant Screener** — {len(results)} setups found, "
            f"showing top {min(top_n, len(results))}"
        ),
        "embeds": embeds[:10],
    }
    return _post(payload, webhook_url)
