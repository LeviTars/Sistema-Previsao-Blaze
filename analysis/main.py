from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple
import hashlib
import joblib
import os

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier


MODEL_VERSION = "analysis-v2-measured"
THEORETICAL_PROBS = {"RED": 7 / 15, "BLACK": 7 / 15, "WHITE": 1 / 15}

app = FastAPI(
    title="Blaze Double - Analysis Service",
    description="Statistical analysis and auditable predictions for Double.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RollInput(BaseModel):
    color: str
    roll_value: int
    timestamp: str
    server_seed: Optional[str] = None
    hash: Optional[str] = None


class PredictionRequest(BaseModel):
    rolls: List[RollInput]


class FrequencyData(BaseModel):
    RED: float
    BLACK: float
    WHITE: float


class ProbabilityData(BaseModel):
    RED: float
    BLACK: float
    WHITE: float


class StreakData(BaseModel):
    color: str
    count: int


class SuggestionData(BaseModel):
    type: str
    message: str
    confidence: float
    kelly_fraction: float


class CalibrationData(BaseModel):
    method: str
    probability_calibrated: float
    sample_support: int
    is_calibrated: bool


class ModelVoteData(BaseModel):
    model: str
    color: str
    probability: float
    support: int


class SeedIntegrityData(BaseModel):
    status: str
    score: float
    message: str


class PredictionResponse(BaseModel):
    model_version: str
    analysis_status: str
    frequencies: FrequencyData
    probabilities: ProbabilityData
    decision: str
    white_gap: int
    current_streak: StreakData
    suggestion: SuggestionData
    last_white_timestamp: Optional[str]
    total_analyzed: int
    market_state: str
    quantum_score: float
    entropy: float
    calibration: CalibrationData
    model_votes: List[ModelVoteData]
    reason_codes: List[str]
    seed_integrity: SeedIntegrityData


class SupremeAIPredictor:
    def __init__(self, model_dir: str = "models"):
        self.model_path = os.path.join(model_dir, "supreme_xgb.joblib")
        self.meta_path = os.path.join(model_dir, "supreme_xgb_meta.joblib")
        self.encoder_path = os.path.join(model_dir, "label_encoder.joblib")
        self.model = None
        self.encoder = LabelEncoder()
        self.is_trained = False
        self.is_training = False
        self.last_training_size = 0
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.encoder_path):
            try:
                self.model = joblib.load(self.model_path)
                self.encoder = joblib.load(self.encoder_path)
                if os.path.exists(self.meta_path):
                    meta = joblib.load(self.meta_path)
                    self.last_training_size = int(meta.get("last_training_size", 0))
                self.is_trained = True
            except Exception:
                self.is_trained = False

    def save_model(self, training_size: int):
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.encoder, self.encoder_path)
        joblib.dump(
            {"last_training_size": training_size, "model_version": MODEL_VERSION},
            self.meta_path,
        )

    def prepare_features(self, df: pd.DataFrame, window_size: int = 10):
        df_sorted = df.sort_values("timestamp", ascending=True).copy()
        color_map = {"WHITE": 0, "RED": 1, "BLACK": 2}
        df_sorted["color_num"] = df_sorted["color"].map(color_map)
        if df_sorted["color_num"].isna().any() or len(df_sorted) < window_size + 1:
            return None, None

        features = []
        targets = []
        for i in range(len(df_sorted) - window_size):
            window = df_sorted.iloc[i : i + window_size]
            target = df_sorted.iloc[i + window_size]["color_num"]
            features.append(window["color_num"].tolist() + window["roll_value"].tolist())
            targets.append(target)
        return np.array(features), np.array(targets)

    def train(self, df: pd.DataFrame):
        if self.is_training or len(df) < 200:
            return False

        self.is_training = True
        try:
            x, y = self.prepare_features(df)
            if x is None:
                return False
            self.model = XGBClassifier(
                n_estimators=120,
                max_depth=4,
                learning_rate=0.05,
                objective="multi:softprob",
                num_class=3,
                eval_metric="mlogloss",
                random_state=42,
            )
            self.model.fit(x, y)
            self.is_trained = True
            self.last_training_size = len(df)
            self.save_model(len(df))
            return True
        except Exception:
            return False
        finally:
            self.is_training = False

    def predict_next(self, df: pd.DataFrame) -> Tuple[Optional[str], float]:
        if not self.is_trained or len(df) < 10:
            return None, 0.0
        recent = df.head(10).iloc[::-1]
        color_map = {"WHITE": 0, "RED": 1, "BLACK": 2}
        x_input = np.array([recent["color"].map(color_map).tolist() + recent["roll_value"].tolist()])
        probs = self.model.predict_proba(x_input)[0]
        idx_to_color = {0: "WHITE", 1: "RED", 2: "BLACK"}
        best_idx = int(np.argmax(probs))
        return idx_to_color[best_idx], float(probs[best_idx])


supreme_ai = SupremeAIPredictor()


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest, background_tasks: BackgroundTasks):
    df = pd.DataFrame([roll.model_dump() for roll in request.rolls])

    if df.empty:
        return empty_response()

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])
    df = df.sort_values("timestamp", ascending=False).reset_index(drop=True)

    if df.empty:
        return empty_response()

    recent_50 = df.head(50)
    frequencies = FrequencyData(
        RED=round(float((recent_50["color"] == "RED").mean() * 100), 1),
        BLACK=round(float((recent_50["color"] == "BLACK").mean() * 100), 1),
        WHITE=round(float((recent_50["color"] == "WHITE").mean() * 100), 1),
    )

    if (not supreme_ai.is_trained or len(df) - supreme_ai.last_training_size >= 100) and not supreme_ai.is_training:
        background_tasks.add_task(supreme_ai.train, df)

    white_indices = df[df["color"] == "WHITE"].index.tolist()
    white_gap = int(white_indices[0]) if white_indices else len(df)
    last_white_ts = str(df.loc[white_indices[0], "timestamp"]) if white_indices else None

    current_streak = calculate_current_streak(df)
    entropy = calculate_shannon_entropy(df)
    market_state = determine_market_state(df, entropy)
    seed_integrity = verify_seed_integrity(df)
    ai_color, ai_conf = supreme_ai.predict_next(df)

    (
        suggestion,
        quantum_score,
        probabilities,
        decision,
        calibration,
        model_votes,
        reason_codes,
    ) = generate_suggestion(df, white_gap, entropy, market_state, ai_color, ai_conf)

    return PredictionResponse(
        model_version=MODEL_VERSION,
        analysis_status="OK",
        frequencies=frequencies,
        probabilities=probabilities,
        decision=decision,
        white_gap=white_gap,
        current_streak=current_streak,
        suggestion=suggestion,
        last_white_timestamp=last_white_ts,
        total_analyzed=len(df),
        market_state=market_state,
        quantum_score=round(quantum_score, 1),
        entropy=round(entropy, 3),
        calibration=calibration,
        model_votes=model_votes,
        reason_codes=reason_codes,
        seed_integrity=seed_integrity,
    )


def empty_response() -> PredictionResponse:
    return PredictionResponse(
        model_version=MODEL_VERSION,
        analysis_status="DEGRADED",
        frequencies=FrequencyData(RED=0, BLACK=0, WHITE=0),
        probabilities=ProbabilityData(RED=46.67, BLACK=46.67, WHITE=6.67),
        decision="NO_BET",
        white_gap=0,
        current_streak=StreakData(color="NONE", count=0),
        suggestion=SuggestionData(
            type="INFO",
            message="Sem dados suficientes para analise.",
            confidence=0.0,
            kelly_fraction=0.0,
        ),
        last_white_timestamp=None,
        total_analyzed=0,
        market_state="UNKNOWN",
        quantum_score=0.0,
        entropy=0.0,
        calibration=CalibrationData(
            method="none",
            probability_calibrated=0.0,
            sample_support=0,
            is_calibrated=False,
        ),
        model_votes=[],
        reason_codes=["EMPTY_DATASET"],
        seed_integrity=SeedIntegrityData(
            status="UNKNOWN",
            score=0.0,
            message="Dados insuficientes.",
        ),
    )


def calculate_current_streak(df: pd.DataFrame) -> StreakData:
    current_color = str(df.iloc[0]["color"])
    count = 0
    for _, row in df.iterrows():
        if row["color"] != current_color:
            break
        count += 1
    return StreakData(color=current_color, count=count)


def calculate_shannon_entropy(df: pd.DataFrame, window: int = 30) -> float:
    recent = df["color"].head(window)
    probs = recent.value_counts(normalize=True)
    return float(-np.sum(probs * np.log2(probs + 1e-9)))


def determine_market_state(df: pd.DataFrame, entropy: float) -> str:
    colors = df["color"].head(10).tolist()
    if len(colors) >= 10 and colors.count(colors[0]) >= 7:
        return "TRENDING"
    if entropy > 1.35:
        return "VORTEX"
    if entropy < 1.1:
        return "STABLE"
    return "NEUTRAL"


def bayesian_probability(df: pd.DataFrame, target_color: str, window: int = 50) -> float:
    recent = df.head(window)
    n_recent = max(len(recent), 1)
    prior = THEORETICAL_PROBS[target_color]
    prior_strength = 15
    successes = int((recent["color"] == target_color).sum())
    posterior = (successes + prior * prior_strength) / (n_recent + prior_strength)
    return float(min(max(posterior, 0.0), 1.0))


def verify_seed_integrity(df: pd.DataFrame) -> SeedIntegrityData:
    try:
        seeds = df["server_seed"].dropna().tolist() if "server_seed" in df else []
        if len(seeds) < 2:
            return SeedIntegrityData(status="UNKNOWN", score=50.0, message="Sementes nao disponiveis.")

        reused_ratio = (len(seeds) - len(set(seeds))) / len(seeds)
        if reused_ratio > 0.05:
            return SeedIntegrityData(
                status="RECYCLED",
                score=round(100 * (1 - reused_ratio), 1),
                message=f"{int(reused_ratio * 100)}% de sementes reutilizadas.",
            )

        checks = min(len(seeds) - 1, 10)
        valid = 0
        for i in range(checks):
            if hashlib.sha256(str(seeds[i]).encode()).hexdigest() == str(seeds[i + 1]):
                valid += 1
        score = (valid / checks) * 100 if checks else 100
        status = "OPTIMAL" if score >= 70 else "BROKEN"
        message = "Cadeia de sementes consistente." if status == "OPTIMAL" else "Cadeia de sementes inconsistente."
        return SeedIntegrityData(status=status, score=round(score, 1), message=message)
    except Exception as exc:
        return SeedIntegrityData(status="UNKNOWN", score=0.0, message=f"Erro na auditoria: {exc}")


def calculate_markov_high_order(df: pd.DataFrame, order: int = 3) -> Dict[str, float]:
    colors = df["color"].tolist()[::-1]
    if len(colors) < 100:
        return {}
    current_state = tuple(colors[-order:])
    transitions = []
    for i in range(len(colors) - order):
        if tuple(colors[i : i + order]) == current_state:
            transitions.append(colors[i + order])
    if not transitions:
        return {}
    result = {color: transitions.count(color) / len(transitions) for color in set(transitions)}
    result["_support"] = float(len(transitions))
    return result


def find_historical_pattern_match(df: pd.DataFrame, window: int = 4) -> Dict[str, float]:
    colors = df["color"].tolist()
    if len(colors) < window + 5:
        return {}
    pattern = colors[:window]
    matches = []
    for i in range(1, len(colors) - window):
        if colors[i : i + window] == pattern:
            matches.append(colors[i - 1])
    if not matches:
        return {}
    result = {color: matches.count(color) / len(matches) for color in set(matches)}
    result["_support"] = float(len(matches))
    return result


def calculate_numerical_attraction(df: pd.DataFrame) -> Dict[str, float]:
    if len(df) < 30:
        return {}
    last_value = df.iloc[0]["roll_value"]
    matches = []
    for i in range(1, len(df)):
        if df.iloc[i]["roll_value"] == last_value:
            matches.append(df.iloc[i - 1]["color"])
    if not matches:
        return {}
    result = {color: matches.count(color) / len(matches) for color in set(matches)}
    result["_support"] = float(len(matches))
    return result


def detect_visual_patterns(df: pd.DataFrame) -> Optional[Tuple[str, str]]:
    colors = df["color"].head(8).tolist()
    if len(colors) < 4 or "WHITE" in colors[:4]:
        return None
    if colors[0] == colors[1] and colors[2] == colors[3] and colors[0] != colors[2]:
        return colors[0], "DUPLAS"
    if colors[0] != colors[1] and colors[1] != colors[2] and colors[2] != colors[3]:
        return ("RED" if colors[0] == "BLACK" else "BLACK"), "XADREZ"
    if colors[0] == colors[3] and colors[1] == colors[2] and colors[0] != colors[1]:
        return colors[0], "INTERCALAGEM"
    if colors[0] == colors[1] == colors[2]:
        return colors[0], "SURFE"
    if len(colors) >= 6 and colors[0:3] == colors[3:6][::-1]:
        return ("RED" if colors[0] == "BLACK" else "BLACK"), "ESPELHAMENTO"
    return None


def calculate_z_score(df: pd.DataFrame, color: str, window: int = 50) -> float:
    recent = df.head(window)
    n = len(recent)
    if n < 20:
        return 0.0
    p = THEORETICAL_PROBS[color]
    expected = n * p
    std = np.sqrt(n * p * (1 - p))
    count = int((recent["color"] == color).sum())
    return float((count - expected) / std) if std > 0 else 0.0


def calculate_rsi(df: pd.DataFrame, color: str, window: int = 14) -> float:
    if len(df) < window + 1:
        return 50.0
    series = (df["color"] == color).astype(int).iloc[::-1].diff().dropna()
    gain = series.mask(series < 0, 0).rolling(window).mean().iloc[-1]
    loss = -series.mask(series > 0, 0).rolling(window).mean().iloc[-1]
    if pd.isna(gain) or pd.isna(loss):
        return 50.0
    if loss == 0:
        return 100.0 if gain > 0 else 50.0
    return float(100 - (100 / (1 + (gain / loss))))


def normalize_probabilities(scores: Dict[str, float], white_probability: float) -> ProbabilityData:
    safe_scores = {
        "RED": max(float(scores.get("RED", 0.0)), 0.0),
        "BLACK": max(float(scores.get("BLACK", 0.0)), 0.0),
        "WHITE": max(float(white_probability), 0.0),
    }
    total = sum(safe_scores.values())
    if total <= 0:
        return ProbabilityData(RED=46.67, BLACK=46.67, WHITE=6.67)
    return ProbabilityData(
        RED=round((safe_scores["RED"] / total) * 100, 2),
        BLACK=round((safe_scores["BLACK"] / total) * 100, 2),
        WHITE=round((safe_scores["WHITE"] / total) * 100, 2),
    )


def build_calibration(probability: float, support: int, calibrated: bool = False) -> CalibrationData:
    safe_probability = min(max(probability, 0.0), 0.99)
    if not calibrated:
        safe_probability = min(safe_probability, 0.55)
    return CalibrationData(
        method="walk_forward_required" if not calibrated else "empirical",
        probability_calibrated=round(safe_probability * 100, 2),
        sample_support=int(support),
        is_calibrated=calibrated,
    )


def decision_for_color(color: Optional[str], probability: float, calibrated: bool, market_state: str) -> str:
    if not color or color not in ["RED", "BLACK", "WHITE"]:
        return "NO_BET"
    if not calibrated:
        return "NO_BET"
    if market_state == "VORTEX" and probability < 0.70:
        return "NO_BET"
    if color == "WHITE":
        return "BET_WHITE" if probability > 0.12 else "NO_BET"
    return f"BET_{color}" if probability > 0.53 else "NO_BET"


def generate_suggestion(
    df: pd.DataFrame,
    white_gap: int,
    entropy: float,
    market_state: str,
    ai_color: Optional[str],
    ai_conf: float,
) -> Tuple[SuggestionData, float, ProbabilityData, str, CalibrationData, List[ModelVoteData], List[str]]:
    if len(df) < 15:
        return (
            SuggestionData(type="INFO", message="Coletando dados iniciais.", confidence=0.0, kelly_fraction=0.0),
            0.0,
            ProbabilityData(RED=46.67, BLACK=46.67, WHITE=6.67),
            "NO_BET",
            build_calibration(0.0, len(df)),
            [],
            ["INSUFFICIENT_SAMPLE"],
        )

    markov_3 = calculate_markov_high_order(df, order=3)
    memory_match = find_historical_pattern_match(df, window=4)
    numerical_attraction = calculate_numerical_attraction(df)
    visual_pattern = detect_visual_patterns(df)
    p_red_bayes = bayesian_probability(df, "RED")
    p_black_bayes = bayesian_probability(df, "BLACK")
    p_white_bayes = bayesian_probability(df, "WHITE")

    scores = {"RED": 0.0, "BLACK": 0.0}
    for color in ["RED", "BLACK"]:
        z = calculate_z_score(df, color)
        rsi = calculate_rsi(df, color)
        scores[color] = (
            markov_3.get(color, 0.0) * 0.15
            + (p_red_bayes if color == "RED" else p_black_bayes) * 0.2
            + memory_match.get(color, 0.0) * 0.25
            + numerical_attraction.get(color, 0.0) * 0.2
            + (0.1 if z < -1.5 else 0.0)
            + (0.1 if rsi < 35 else 0.0)
        )
        if visual_pattern and visual_pattern[0] == color:
            scores[color] += 0.25

    if entropy > 1.4:
        scores = {color: score * 0.8 for color, score in scores.items()}

    if ai_color in ["RED", "BLACK"]:
        scores[ai_color] += ai_conf * 0.4

    markov_support = int(markov_3.get("_support", 0))
    memory_support = int(memory_match.get("_support", 0))
    numerical_support = int(numerical_attraction.get("_support", 0))
    support = max(markov_support, memory_support, numerical_support, len(df) if ai_color else 0)

    model_votes: List[ModelVoteData] = []
    for color in ["RED", "BLACK"]:
        model_votes.append(ModelVoteData(model="bayes", color=color, probability=round((p_red_bayes if color == "RED" else p_black_bayes) * 100, 2), support=min(len(df), 50)))
        if markov_3.get(color, 0) > 0:
            model_votes.append(ModelVoteData(model="markov_3", color=color, probability=round(markov_3[color] * 100, 2), support=markov_support))
        if memory_match.get(color, 0) > 0:
            model_votes.append(ModelVoteData(model="historical_memory", color=color, probability=round(memory_match[color] * 100, 2), support=memory_support))
        if numerical_attraction.get(color, 0) > 0:
            model_votes.append(ModelVoteData(model="numerical_attraction", color=color, probability=round(numerical_attraction[color] * 100, 2), support=numerical_support))
    model_votes.append(ModelVoteData(model="bayes", color="WHITE", probability=round(p_white_bayes * 100, 2), support=min(len(df), 50)))
    if visual_pattern:
        model_votes.append(ModelVoteData(model="visual_pattern", color=visual_pattern[0], probability=60.0, support=1))
    if ai_color:
        model_votes.append(ModelVoteData(model="xgboost", color=ai_color, probability=round(ai_conf * 100, 2), support=len(df)))

    best_color = max(scores, key=scores.get)
    final_score = float(scores[best_color])
    probabilities = normalize_probabilities(scores, p_white_bayes)
    calibration = build_calibration(final_score, support, calibrated=False)
    decision = decision_for_color(best_color, calibration.probability_calibrated / 100, calibration.is_calibrated, market_state)

    convergence = 0
    if markov_3.get(best_color, 0) > 0.5:
        convergence += 1
    if (p_red_bayes if best_color == "RED" else p_black_bayes) > 0.5:
        convergence += 1
    if memory_match.get(best_color, 0) > 0.5:
        convergence += 1
    if visual_pattern and visual_pattern[0] == best_color:
        convergence += 1
    if ai_color == best_color and ai_conf > 0.6:
        convergence += 1
    quantum_score = (convergence / 5) * 100

    reason_codes = ["UNCALIBRATED_PROBABILITY"]
    if support < 20:
        reason_codes.append("LOW_PATTERN_SUPPORT")
    if market_state == "VORTEX":
        reason_codes.append("HIGH_ENTROPY_MARKET")

    if final_score >= 0.50 and decision != "NO_BET":
        kelly = round(max(min(((2 * final_score) - 1) * 0.1 * 100, 2.0), 0.0), 2)
        return (
            SuggestionData(type="ALERT", message=f"ENTRADA: {best_color}.", confidence=round(final_score * 100, 1), kelly_fraction=kelly),
            quantum_score,
            probabilities,
            decision,
            calibration,
            model_votes,
            reason_codes,
        )

    message = f"{best_color} em observacao, mas sem entrada ate calibrar em backtest."
    if market_state == "VORTEX":
        message = "Sem entrada: mercado instavel e probabilidade sem calibragem."
    return (
        SuggestionData(type="INFO", message=message, confidence=round(max(final_score, 0.0) * 100, 1), kelly_fraction=0.0),
        quantum_score,
        probabilities,
        "NO_BET",
        calibration,
        model_votes,
        reason_codes + ["NO_BET_UNTIL_CALIBRATED"],
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "analysis-microservice", "model_version": MODEL_VERSION}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
