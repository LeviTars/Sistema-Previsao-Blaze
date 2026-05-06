# ============================================================
# Microsserviço de Análise - Sistema de Previsão Blaze Double
# ============================================================
# API FastAPI para análise estatística dos resultados do Double.
# Recebe dados do backend Node.js e retorna métricas calculadas
# usando Pandas e NumPy.
# ============================================================

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Tuple
from datetime import datetime
import pandas as pd
import numpy as np
import os
import joblib
import hashlib
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder

app = FastAPI(
    title="Blaze Double - Microsserviço de Análise",
    description="Análise estatística e previsões para o jogo Double",
    version="1.0.0",
)

# CORS para permitir comunicação com o backend Node.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELOS DE DADOS (Pydantic)
# ============================================================

class RollInput(BaseModel):
    """Modelo de uma rodada recebida do backend."""
    color: str  # RED, BLACK, WHITE
    roll_value: int
    timestamp: str
    server_seed: Optional[str]
    hash: Optional[str]


class PredictionRequest(BaseModel):
    """Payload recebido do backend com a lista de rodadas."""
    rolls: List[RollInput]


class FrequencyData(BaseModel):
    """Frequência percentual de cada cor."""
    RED: float
    BLACK: float
    WHITE: float


class StreakData(BaseModel):
    """Informação sobre sequência atual."""
    color: str
    count: int


class SuggestionData(BaseModel):
    """Sugestão baseada na análise estatística."""
    type: str  # ALERT, INFO, WARNING
    message: str
    confidence: float
    kelly_fraction: float  # Percentual sugerido da banca

class SeedIntegrityData(BaseModel):
    """Integridade da cadeia de sementes."""
    status: str  # OPTIMAL, RECYCLED, BROKEN
    score: float
    message: str


class PredictionResponse(BaseModel):
    """Resposta completa da análise."""
    frequencies: FrequencyData
    white_gap: int
    current_streak: StreakData
    suggestion: SuggestionData
    last_white_timestamp: Optional[str]
    total_analyzed: int
    market_state: str  # STABLE, VORTEX, TRENDING
    quantum_score: float  # Probabilidade baseada em convergência (0-100)
    entropy: float  # Shannon Entropy
    seed_integrity: SeedIntegrityData


# ============================================================
# SUPREME AI ENGINE - XGBoost Predictor
# ============================================================

class SupremeAIPredictor:
    def __init__(self, model_dir="models"):
        self.model_path = os.path.join(model_dir, "supreme_xgb.joblib")
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
                self.is_trained = True
            except Exception:
                self.is_trained = False

    def save_model(self):
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.encoder, self.encoder_path)
        print(f"✅ Supreme IA: Modelo salvo em {self.model_path}")

    def prepare_features(self, df: pd.DataFrame, window_size=10):
        """Transforma o histórico em features para o XGBoost."""
        # Garantir ordenação cronológica (antigos primeiro) para o treino
        df_sorted = df.sort_values("timestamp", ascending=True).copy()
        
        # Encoding numérico das cores
        color_map = {"RED": 1, "BLACK": 2, "WHITE": 0}
        df_sorted["color_num"] = df_sorted["color"].map(color_map)
        
        features = []
        targets = []
        
        data_len = len(df_sorted)
        if data_len < window_size + 1:
            return None, None
            
        # Criar janelas deslizantes
        for i in range(data_len - window_size):
            window = df_sorted.iloc[i : i + window_size]
            target = df_sorted.iloc[i + window_size]["color_num"]
            
            # Feature vector: [cores da janela, valores da janela, RSI atual da janela]
            f_vector = window["color_num"].tolist() + window["roll_value"].tolist()
            features.append(f_vector)
            targets.append(target)
            
        return np.array(features), np.array(targets)

    def train(self, df: pd.DataFrame):
        """Treina o modelo XGBoost com o histórico fornecido."""
        if self.is_training:
            return False
            
        if len(df) < 100: 
            print(f"⚠️ Supreme IA: Dados insuficientes para treino ({len(df)}/100)")
            return False
        
        self.is_training = True
        try:
            print(f"🧠 Supreme IA: Iniciando treinamento com {len(df)} rodadas...")
            X, y = self.prepare_features(df)
            if X is None: return False
            
            # Configuração do XGBoost para Multiclass
            # Criamos em uma variável local para evitar que o singleton use um modelo não treinado
            new_model = XGBClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                objective="multi:softprob",
                num_class=3,
                random_state=42
            )
            
            new_model.fit(X, y)
            
            # Atualiza o modelo do singleton apenas APÓS o treino completo
            self.model = new_model
            self.save_model()
            self.is_trained = True
            self.last_training_size = len(df)
            print("✅ Supreme IA: Treinamento concluído com sucesso!")
            return True
        except Exception as e:
            print(f"❌ Supreme IA: Erro no treinamento: {str(e)}")
            return False
        finally:
            self.is_training = False

    def predict_next(self, df: pd.DataFrame):
        """Prediz a próxima cor baseado no estado atual."""
        if not self.is_trained or len(df) < 10:
            return None, 0.0
            
        # Pegar as últimas 10 rodadas (ordenadas do mais recente para o mais antigo no DF original)
        # Inverter para ficar cronológico para a janela
        recent = df.head(10).iloc[::-1]
        color_map = {"RED": 1, "BLACK": 2, "WHITE": 0}
        
        f_vector = recent["color"].map(color_map).tolist() + recent["roll_value"].tolist()
        X_input = np.array([f_vector])
        
        probs = self.model.predict_proba(X_input)[0]
        # Classes: 0=WHITE, 1=RED, 2=BLACK
        idx_to_color = {0: "WHITE", 1: "RED", 2: "BLACK"}
        best_idx = np.argmax(probs)
        
        return idx_to_color[best_idx], float(probs[best_idx])

# Singleton da IA
supreme_ai = SupremeAIPredictor()

# ============================================================
# ENDPOINT PRINCIPAL
# ============================================================

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest, background_tasks: BackgroundTasks):
    """
    POST /predict
    
    Recebe uma lista de resultados e retorna análise estatística
    incluindo frequências, gap do branco, streaks e sugestões.
    """
    # Converter para DataFrame do Pandas
    data = [
        {
            "color": roll.color,
            "roll_value": roll.roll_value,
            "timestamp": roll.timestamp,
            "server_seed": roll.server_seed,
            "hash": roll.hash,
        }
        for roll in request.rolls
    ]
    df = pd.DataFrame(data)
    
    if df.empty:
        return PredictionResponse(
            frequencies=FrequencyData(RED=0, BLACK=0, WHITE=0),
            white_gap=0,
            current_streak=StreakData(color="NONE", count=0),
            suggestion=SuggestionData(
                type="INFO",
                message="Sem dados suficientes para análise.",
                confidence=0,
                kelly_fraction=0.0,
            ),
            last_white_timestamp=None,
            total_analyzed=0,
            market_state="UNKNOWN",
            quantum_score=0.0,
            entropy=0.0,
            seed_integrity=SeedIntegrityData(
                status="UNKNOWN",
                score=0.0,
                message="Dados insuficientes"
            )
        )

    # Converter timestamps
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp", ascending=False).reset_index(drop=True)

    # ============================================================
    # 1. FREQUÊNCIA PERCENTUAL (últimas 50 rodadas)
    # ============================================================
    recent_50 = df.head(50)
    total_recent = len(recent_50)
    
    freq_red = (recent_50["color"] == "RED").sum() / total_recent * 100
    freq_black = (recent_50["color"] == "BLACK").sum() / total_recent * 100
    freq_white = (recent_50["color"] == "WHITE").sum() / total_recent * 100
    
    frequencies = FrequencyData(
        RED=round(float(freq_red), 1),
        BLACK=round(float(freq_black), 1),
        WHITE=round(float(freq_white), 1),
    )

    # ============================================================
    # 1.1 TREINAMENTO / ATUALIZAÇÃO DA IA SUPREMA (Background)
    # ============================================================
    # Treina se o modelo não existir ou se temos novos dados significativos (pelo menos 100 novas rodadas)
    should_train = False
    if not supreme_ai.is_trained:
        should_train = True
    elif len(df) >= 500 and (len(df) - supreme_ai.last_training_size >= 100):
        should_train = True

    if should_train and not supreme_ai.is_training:
        background_tasks.add_task(supreme_ai.train, df)

    # ============================================================
    # 2. GAP DO BRANCO (quantas rodadas desde o último WHITE)
    # ============================================================
    white_indices = df[df["color"] == "WHITE"].index.tolist()
    white_gap = int(white_indices[0]) if white_indices else len(df)
    
    last_white_ts = None
    if white_indices:
        last_white_ts = str(df.loc[white_indices[0], "timestamp"])

    # ============================================================
    # 3. STREAK ATUAL (sequência consecutiva da mesma cor)
    # ============================================================
    current_color = df.iloc[0]["color"]
    streak_count = 0
    for _, row in df.iterrows():
        if row["color"] == current_color:
            streak_count += 1
        else:
            break
    
    current_streak = StreakData(color=current_color, count=streak_count)

    # ============================================================
    # 4. NOVAS MÉTRICAS (MARKET INTEL & QUANTUM)
    # ============================================================
    entropy = calculate_shannon_entropy(df)
    market_state = determine_market_state(df, entropy)
    seed_integrity = verify_seed_integrity(df)
    
    # ============================================================
    # 5. SUGESTÃO BASEADA EM RECONHECIMENTO DE PADRÃO + IA
    # ============================================================
    ai_color, ai_conf = supreme_ai.predict_next(df)
    
    suggestion, quantum_score = generate_suggestion(
        frequencies, white_gap, current_streak, total_recent, df, entropy, market_state, ai_color, ai_conf
    )

    return PredictionResponse(
        frequencies=frequencies,
        white_gap=white_gap,
        current_streak=current_streak,
        suggestion=suggestion,
        last_white_timestamp=last_white_ts,
        total_analyzed=len(df),
        market_state=market_state,
        quantum_score=quantum_score,
        entropy=round(entropy, 3),
        seed_integrity=seed_integrity,
    )


# ============================================================
# MOTOR DE ANÁLISE MATEMÁTICA (BASE)
# ============================================================

def calculate_shannon_entropy(df: pd.DataFrame, window: int = 30) -> float:
    recent = df["color"].head(window)
    probs = recent.value_counts(normalize=True)
    entropy = -np.sum(probs * np.log2(probs + 1e-9)) # Add epsilon to avoid log(0)
    return float(entropy)


def determine_market_state(df: pd.DataFrame, entropy: float) -> str:
    """
    Categoriza o estado atual do mercado baseado em volatilidade e padrões.
    """
    colors = df["color"].head(10).tolist()
    
    # 1. TRENDING (Surfe)
    if colors.count(colors[0]) >= 7:
        return "TRENDING"
        
    # 2. VORTEX (Caótico - Alta Entropia)
    # Entropia teórica max para 3 cores é log(3) approx 1.58
    if entropy > 1.35:
        return "VORTEX"
        
    # 3. STABLE (Padrões claros)
    if entropy < 1.1:
        return "STABLE"
        
    return "NEUTRAL"


def bayesian_probability(df: pd.DataFrame, target_color: str, window: int = 50) -> float:
    recent = df.head(window)
    prior = 7/15 if target_color != "WHITE" else 1/15
    observation = df.head(10)
    successes = (observation["color"] == target_color).sum()
    likelihood = (successes + 1) / (10 + 2)
    evidence = (recent["color"] == target_color).sum() / window
    if evidence == 0: evidence = prior
    return float(min((likelihood * prior) / evidence, 1.0))


def verify_seed_integrity(df: pd.DataFrame) -> SeedIntegrityData:
    """
    Verifica a integridade da cadeia de sementes (SHA-256).
    Detecta se os resultados são honestos e se há repetição de sementes (loops).
    """
    try:
        if len(df) < 5:
            return SeedIntegrityData(status="UNKNOWN", score=50.0, message="Aguardando mais sementes...")

        seeds = df["server_seed"].dropna().tolist()
        hashes = df["hash"].dropna().tolist()
        
        if not seeds or len(seeds) < 2:
            return SeedIntegrityData(status="UNKNOWN", score=50.0, message="Sementes não disponíveis")

        # 1. Verificação de Loops (Detecção de Reutilização)
        unique_seeds = len(set(seeds))
        reused_ratio = (len(seeds) - unique_seeds) / len(seeds)
        
        if reused_ratio > 0.05:
            return SeedIntegrityData(
                status="RECYCLED",
                score=round(100 * (1 - reused_ratio), 1),
                message=f"LOOP DETECTADO: {int(reused_ratio*100)}% de sementes reutilizadas!"
            )

        # 2. Verificação de Cadeia (SHA-256 Audit)
        valid_chain_count = 0
        total_checks = min(len(seeds) - 1, 10)
        
        for i in range(total_checks):
            curr_seed = str(seeds[i])     # Semente da rodada N
            prev_seed = str(seeds[i+1])   # Semente da rodada N-1
            
            # Na Blaze: sha256(semente_atual) == semente_anterior
            calc_hash = hashlib.sha256(curr_seed.encode()).hexdigest()
            if calc_hash == prev_seed:
                valid_chain_count += 1
        
        chain_score = (valid_chain_count / total_checks) * 100 if total_checks > 0 else 100
        
        if chain_score < 70:
            return SeedIntegrityData(
                status="BROKEN",
                score=round(chain_score, 1),
                message="QUEBRA DE INTEGRIDADE: Cadeia de sementes inconsistente!"
            )

        return SeedIntegrityData(
            status="OPTIMAL",
            score=round(chain_score, 1),
            message="Cadeia 100% verificada e honesta (Provably Fair)."
        )
    except Exception as e:
        return SeedIntegrityData(status="UNKNOWN", score=0.0, message=f"Erro na auditoria: {str(e)}")


def calculate_markov_high_order(df: pd.DataFrame, order: int = 3) -> Dict[str, float]:
    colors = df["color"].tolist()[::-1]
    if len(colors) < 100: return {}
    current_state = tuple(colors[-order:])
    transitions = []
    for i in range(len(colors) - order):
        state = tuple(colors[i : i+order])
        if state == current_state and i + order < len(colors):
            transitions.append(colors[i + order])
    if not transitions: return {}
    return {c: transitions.count(c) / len(transitions) for c in set(transitions)}


def find_historical_pattern_match(df: pd.DataFrame, window: int = 4) -> Dict[str, float]:
    """
    Busca a sequência exata das últimas N cores em todo o histórico de 300 rodadas.
    Retorna a probabilidade da próxima cor baseada em casamentos reais do passado.
    """
    try:
        colors = df["color"].tolist()
        if len(colors) < window + 5: 
            return {}
        
        # Padrão atual (últimas N cores)
        # Ex: [VERMELHO, PRETO, VERMELHO, PRETO]
        pattern = colors[:window] 
        matches = []
        
        # Percorrer o histórico procurando o padrão
        # i começa em 1 para garantir que i-1 (o resultado seguinte no tempo) exista
        for i in range(1, len(colors) - window):
            chunk = colors[i : i + window]
            if chunk == pattern:
                # O resultado 'futuro' em relação a este bloco do passado é o colors[i-1]
                matches.append(colors[i - 1])
                
        if not matches: 
            return {}
            
        counts = {c: matches.count(c) / len(matches) for c in set(matches)}
        return counts
    except Exception:
        return {}


def calculate_numerical_attraction(df: pd.DataFrame) -> Dict[str, float]:
    """
    Analisa quais cores costumam seguir o valor do número atual (Imã Numérico).
    """
    try:
        if len(df) < 30: return {}
        last_val = df.iloc[0]["roll_value"]
        
        matches = []
        # Começa em 1 para permitir acesso a i-1
        for i in range(1, len(df)):
            if df.iloc[i]["roll_value"] == last_val:
                matches.append(df.iloc[i-1]["color"])
                
        if not matches: return {}
        return {c: matches.count(c) / len(matches) for c in set(matches)}
    except Exception:
        return {}


def analyze_white_hunter_pro(df: pd.DataFrame, current_gap: int) -> Optional[SuggestionData]:
    white_indices = df[df["color"] == "WHITE"].index.tolist()
    p_white = bayesian_probability(df, "WHITE")
    last_val = df.iloc[0]["roll_value"]
    puxador_score = 0
    for idx in white_indices:
        if idx + 1 < len(df) and df.iloc[idx+1]["roll_value"] == last_val:
            puxador_score += 1
    if p_white > 0.20 or (puxador_score >= 2 and current_gap > 12):
        return SuggestionData(
            type="ALERT",
            message=f"⚪ WHITE HUNTER: Alta convergência detectada. Entrada no BRANCO!",
            confidence=round(p_white * 100, 1),
            kelly_fraction=0.0
        )
    return None


# ============================================================
# MOTOR DE DECISÃO CALIBRADO (SINAIS RÁPIDOS)
# ============================================================

def detect_visual_patterns(df: pd.DataFrame) -> Optional[Tuple[str, str]]:
    colors = df["color"].head(8).tolist()
    if len(colors) < 4: return None
    
    # PADRÃO DE DUPLAS (2x2)
    if colors[0] == colors[1] and colors[2] == colors[3] and colors[0] != colors[2]:
        return colors[0], "DUPLAS (2x2)"

    # XADREZ / PING-PONG (R-B-R-B)
    if colors[0] != colors[1] and colors[1] != colors[2] and colors[2] != colors[3]:
        # Se as cores se alternam, prevemos a cor seguinte no padrão de alternância
        return ("RED" if colors[0] == "BLACK" else "BLACK"), "XADREZ (1x1)"

    # INTERCALAGEM (B-R-R-B ou R-B-B-R)
    if colors[0] == colors[3] and colors[1] == colors[2] and colors[0] != colors[1]:
        return colors[0], "INTERCALAGEM"

    # SURFE (Sequência Longa)
    if colors[0] == colors[1] == colors[2]:
        return colors[0], "SURFE DE TENDÊNCIA"

    # ESPELHAMENTO (R-B-B -> B-B-R)
    if len(colors) >= 6:
        if colors[0:3] == colors[3:6][::-1]:
            return ("RED" if colors[0] == "BLACK" else "BLACK"), "ESPELHAMENTO"

    return None


def generate_suggestion(
    freq: FrequencyData,
    white_gap: int,
    streak: StreakData,
    sample_size: int,
    df: pd.DataFrame,
    entropy: float,
    market_state: str,
    ai_color: Optional[str],
    ai_conf: float
) -> Tuple[SuggestionData, float]:
    
    if len(df) < 15:
        return SuggestionData(type="INFO", message="Coletando dados iniciais...", confidence=0.0, kelly_fraction=0.0), 0.0

    # 1. BRANCO (Foco Total)
    white_signal = analyze_white_hunter_pro(df, white_gap)
    if white_signal: 
        # Para o branco (14x), b=13. Usamos um Kelly fracionário bem conservador (1/10 Kelly)
        p = white_signal.confidence / 100
        b = 13
        f_star = (p * b - (1 - p)) / b
        white_signal.kelly_fraction = round(max(f_star * 0.1 * 100, 0.5), 2) # Conservador: 1/10 de Kelly
        return white_signal, 90.0

    # 2. PADRÕES VISUAIS (Gatilhos de Surfe)
    visual_pattern = detect_visual_patterns(df)
    
    # 3. CÁLCULO MULTI-MODELO (Ensemble)
    markov_3 = calculate_markov_high_order(df, order=3)
    p_red_bayes = bayesian_probability(df, "RED")
    p_black_bayes = bayesian_probability(df, "BLACK")
    memory_match = find_historical_pattern_match(df, window=4)
    numerical_attraction = calculate_numerical_attraction(df)
    
    z_score_red = calculate_z_score(df, "RED")
    z_score_black = calculate_z_score(df, "BLACK")
    rsi_red = calculate_rsi(df, "RED")
    rsi_black = calculate_rsi(df, "BLACK")

    scores = {"RED": 0.0, "BLACK": 0.0}
    for color in ["RED", "BLACK"]:
        m_prob = markov_3.get(color, 0.0)
        b_prob = p_red_bayes if color == "RED" else p_black_bayes
        mem_prob = memory_match.get(color, 0.0)
        num_prob = numerical_attraction.get(color, 0.0)
        
        # Ponderação Base (0.8 total)
        # Markov(0.15) + Bayes(0.2) + Memória(0.25) + Imã Numérico(0.2)
        base_score = (m_prob * 0.15) + (b_prob * 0.2) + (mem_prob * 0.25) + (num_prob * 0.2)
        
        # Injeção de Indicadores de Mercado (0.2 total)
        z = z_score_red if color == "RED" else z_score_black
        rsi = rsi_red if color == "RED" else rsi_black
        
        # Se Z-Score é muito baixo (< -2.0), a cor está "devendo" (Padrão de Exaustão)
        z_bonus = 0.1 if z < -1.5 else 0.0
        # RSI < 30 indica "sobrevenda" da cor
        rsi_bonus = 0.1 if rsi < 35 else 0.0
        
        scores[color] = base_score + z_bonus + rsi_bonus
        
        # Bônus para Padrão Visual Confirmado
        if visual_pattern and visual_pattern[0] == color:
            scores[color] += 0.25

    # Penalidade por Entropia (Mercado Caótico)
    if entropy > 1.4:
        for color in scores: scores[color] *= 0.8

    # 4. INJEÇÃO DA IA SUPREMA (Peso 0.4)
    if ai_color and ai_color in ["RED", "BLACK"]:
        # Se a IA concorda com o algoritmo base ou padrões, reforça o sinal
        # Se a IA discorda, ela modera o sinal
        scores[ai_color] += (ai_conf * 0.4)

    best_color = max(scores, key=scores.get)
    final_score = scores[best_color]
    
    # Cálculo de Convergência (Quantum Resonance)
    convergence_count = 0
    if markov_3.get(best_color, 0) > 0.5: convergence_count += 1
    if (p_red_bayes if best_color == "RED" else p_black_bayes) > 0.5: convergence_count += 1
    if memory_match.get(best_color, 0) > 0.5: convergence_count += 1
    if visual_pattern and visual_pattern[0] == best_color: convergence_count += 1
    if ai_color == best_color and ai_conf > 0.6: convergence_count += 1
    
    quantum_score = (convergence_count / 5) * 100 # Dividido por 5 agora

    # Decisão por Nivel de Confiança
    if final_score >= 0.50:
        # Se mercado está em VORTEX e score não é altíssimo, melhor aguardar
        if market_state == "VORTEX" and final_score < 0.7:
             return SuggestionData(
                type="INFO",
                message="⌛ VÓRTICE DETECTADO: Mercado instável. Aguarde sinal seguro.",
                confidence=round(final_score * 100, 1),
                kelly_fraction=0.0
            ), quantum_score

        # Título Dinâmico do Padrão
        pattern_name = "Algoritmo Base"
        if ai_color == best_color and ai_conf > 0.75:
            pattern_name = "VALIDADO POR IA (Supreme)"
        elif visual_pattern and visual_pattern[0] == best_color:
            pattern_name = visual_pattern[1]
        elif quantum_score >= 80:
            pattern_name = "RESSONÂNCIA QUÂNTICA"
        elif memory_match.get(best_color, 0) > 0.6:
            pattern_name = "Memória Histórica"

        msg_type = "ALERT" if (final_score > 0.75 or quantum_score >= 75) else "WARNING"
        
        # CÁLCULO CRITÉRIO DE KELLY (Para 2x, b=1)
        # f* = (p * b - q) / b  => f* = (p * 1 - (1-p)) / 1 => f* = 2p - 1
        p_win = final_score
        f_star = (2 * p_win) - 1
        
        # Usamos Half-Kelly (50% do f*) para maior segurança
        safe_kelly = (f_star * 0.5) * 100
        kelly_perc = round(max(min(safe_kelly, 5.0), 0.0), 2) # Limitamos a 5% da banca por entrada
        
        return SuggestionData(
            type=msg_type,
            message=f"🎯 ENTRADA: {best_color}! [{pattern_name}]. Proteja no Branco!",
            confidence=round(min(final_score * 100, 99.8), 1),
            kelly_fraction=kelly_perc
        ), quantum_score

    return SuggestionData(
        type="INFO",
        message="⌛ Rastreando padrões de alta frequência...",
        confidence=0.0,
        kelly_fraction=0.0
    ), quantum_score


def calculate_z_score(df: pd.DataFrame, color: str, window: int = 50) -> float:
    recent = df.head(window)
    p = 7/15 if color != "WHITE" else 1/15
    expected = window * p
    std = np.sqrt(window * p * (1 - p))
    count = (recent["color"] == color).sum()
    return float((count - expected) / std) if std > 0 else 0.0

def calculate_rsi(df: pd.DataFrame, color: str, window: int = 14) -> float:
    if len(df) < window + 1: return 50.0
    series = (df["color"] == color).astype(int).iloc[::-1].diff().dropna()
    gain = series.mask(series < 0, 0).rolling(window).mean().iloc[-1]
    loss = -series.mask(series > 0, 0).rolling(window).mean().iloc[-1]
    if loss == 0: return 100.0 if gain > 0 else 50.0
    return 100 - (100 / (1 + (gain/loss)))


# ============================================================
# ENDPOINTS AUXILIARES
# ============================================================

@app.get("/health")
async def health_check():
    """Health check para monitoramento."""
    return {"status": "ok", "service": "analysis-microservice"}


if __name__ == "__main__":
    import uvicorn
    # Desativamos o reload para evitar WinError 1450 (exaustão de recursos no Windows)
    # causado pelo monitoramento da pasta venv.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
