import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from main import (
    calculate_shannon_entropy,
    determine_market_state,
    generate_suggestion,
)


def load_rolls(path: Path) -> pd.DataFrame:
    raw = json.loads(path.read_text(encoding="utf-8"))
    records = raw.get("data", raw.get("records", raw)) if isinstance(raw, dict) else raw
    df = pd.DataFrame(records)

    rename_map = {
        "roll": "roll_value",
        "created_at": "timestamp",
    }
    df = df.rename(columns=rename_map)

    if "color" not in df or "roll_value" not in df or "timestamp" not in df:
        raise ValueError("Arquivo precisa conter color, roll_value/roll e timestamp/created_at.")

    if pd.api.types.is_numeric_dtype(df["color"]):
        df["color"] = df["color"].map({0: "WHITE", 1: "RED", 2: "BLACK"})

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp", "color", "roll_value"])
    return df.sort_values("timestamp", ascending=True).reset_index(drop=True)


def run_backtest(df: pd.DataFrame, min_history: int = 100) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []

    for idx in range(min_history, len(df) - 1):
        history = df.iloc[:idx].sort_values("timestamp", ascending=False).reset_index(drop=True)
        target = df.iloc[idx]
        entropy = calculate_shannon_entropy(history)
        market_state = determine_market_state(history, entropy)
        suggestion, quantum, probabilities, decision, calibration, votes, reasons = generate_suggestion(
            history,
            current_white_gap(history),
            entropy,
            market_state,
            None,
            0.0,
        )
        predicted_color = color_from_decision(decision)
        outcome = "VOID"
        if predicted_color:
            outcome = "HIT" if predicted_color == target["color"] else "MISS"

        rows.append(
            {
                "idx": idx,
                "timestamp": str(target["timestamp"]),
                "target": target["color"],
                "decision": decision,
                "predicted_color": predicted_color,
                "outcome": outcome,
                "confidence": suggestion.confidence,
                "prob_red": probabilities.RED,
                "prob_black": probabilities.BLACK,
                "prob_white": probabilities.WHITE,
                "quantum_score": quantum,
                "calibrated": calibration.is_calibrated,
                "support": calibration.sample_support,
                "reason_codes": reasons,
            }
        )

    return summarize(rows)


def current_white_gap(history: pd.DataFrame) -> int:
    white_indices = history[history["color"] == "WHITE"].index.tolist()
    return int(white_indices[0]) if white_indices else len(history)


def color_from_decision(decision: str):
    if decision == "BET_RED":
        return "RED"
    if decision == "BET_BLACK":
        return "BLACK"
    if decision == "BET_WHITE":
        return "WHITE"
    return None


def summarize(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    settled = [row for row in rows if row["outcome"] in ["HIT", "MISS"]]
    hits = [row for row in settled if row["outcome"] == "HIT"]
    voids = [row for row in rows if row["outcome"] == "VOID"]

    baselines = {
        "always_red": baseline_rate(rows, "RED"),
        "always_black": baseline_rate(rows, "BLACK"),
        "theoretical_weighted": 46.67,
        "no_bet": 0.0,
    }

    return {
        "total_windows": len(rows),
        "settled_bets": len(settled),
        "voids": len(voids),
        "hits": len(hits),
        "misses": len(settled) - len(hits),
        "hit_rate": round((len(hits) / len(settled)) * 100, 2) if settled else 0.0,
        "coverage": round((len(settled) / len(rows)) * 100, 2) if rows else 0.0,
        "baselines": baselines,
        "by_decision": group_rate(rows, "decision"),
        "by_confidence_bucket": group_rate(rows, lambda row: confidence_bucket(row["confidence"])),
        "sample": rows[-20:],
    }


def baseline_rate(rows: List[Dict[str, Any]], color: str) -> float:
    if not rows:
        return 0.0
    hits = sum(1 for row in rows if row["target"] == color)
    return round((hits / len(rows)) * 100, 2)


def group_rate(rows: List[Dict[str, Any]], key):
    grouped: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        name = key(row) if callable(key) else row[key]
        grouped.setdefault(name, {"total": 0, "settled": 0, "hits": 0, "hit_rate": 0.0})
        grouped[name]["total"] += 1
        if row["outcome"] in ["HIT", "MISS"]:
            grouped[name]["settled"] += 1
        if row["outcome"] == "HIT":
            grouped[name]["hits"] += 1
    for value in grouped.values():
        value["hit_rate"] = round((value["hits"] / value["settled"]) * 100, 2) if value["settled"] else 0.0
    return grouped


def confidence_bucket(confidence: float) -> str:
    if confidence < 50:
        return "0-49"
    if confidence < 60:
        return "50-59"
    if confidence < 70:
        return "60-69"
    if confidence < 80:
        return "70-79"
    if confidence < 90:
        return "80-89"
    return "90-100"


def main():
    parser = argparse.ArgumentParser(description="Walk-forward backtest for the Double prediction engine.")
    parser.add_argument("file", type=Path, help="JSON file with historical rolls.")
    parser.add_argument("--min-history", type=int, default=100)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    result = run_backtest(load_rolls(args.file), min_history=args.min_history)
    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        args.output.write_text(output, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
