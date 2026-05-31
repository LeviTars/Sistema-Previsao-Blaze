"use client";

import type { AnalysisData, PredictionStats, Suggestion } from "@/lib/api";

interface PredictionCardProps {
  suggestion: Suggestion | null;
  quantumScore: number;
  analysis: AnalysisData | null;
  predictionStats: PredictionStats | null;
  isLoading: boolean;
}

const typeConfig = {
  ALERT: {
    title: "Sinal Validado",
    accent: "text-[#f12c4c]",
    border: "border-[#f12c4c20]",
    bg: "bg-[#f12c4c05]",
    glow: "shadow-[0_0_30px_rgba(241,44,76,0.15)]",
    bar: "bg-[#f12c4c]",
  },
  WARNING: {
    title: "Sinal em Observacao",
    accent: "text-[#f59e0b]",
    border: "border-[#f59e0b20]",
    bg: "bg-[#f59e0b05]",
    glow: "",
    bar: "bg-[#f59e0b]",
  },
  INFO: {
    title: "Sem Entrada",
    accent: "text-[#0ea5e9]",
    border: "border-[#0ea5e920]",
    bg: "bg-[#0ea5e905]",
    glow: "",
    bar: "bg-[#0ea5e9]",
  },
};

export default function PredictionCard({
  suggestion,
  quantumScore,
  analysis,
  predictionStats,
  isLoading,
}: PredictionCardProps) {
  if (isLoading && !suggestion) {
    return (
      <div className="glass-v2 p-8 h-full flex flex-col justify-center">
        <div className="flex flex-col items-center gap-4 py-10 opacity-40">
          <div className="w-16 h-16 rounded-full border-4 border-t-emerald-500 border-white/5 animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.4em]">Processando modelos</p>
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  const config = typeConfig[suggestion.type];
  const confidencePercent = Math.max(suggestion.confidence, 0).toFixed(1);
  const kellyPercent = suggestion.kelly_fraction || 0;
  const decision = analysis?.decision || "NO_BET";
  const calibration = analysis?.calibration;
  const votes = analysis?.model_votes?.slice(0, 6) || [];
  const probabilities = analysis?.probabilities;

  return (
    <div className={`glass-v2 p-8 h-full relative overflow-hidden transition-all duration-500 ${config.glow}`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className={`text-lg font-black font-display uppercase tracking-widest ${config.accent}`}>
            {config.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Decisao: {decision}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Convergencia</span>
          <p className={`text-sm font-black font-display ${quantumScore >= 75 ? "text-emerald-500 animate-pulse" : "text-white"}`}>
            {quantumScore.toFixed(0)}% sinc
          </p>
        </div>
      </div>

      <div className={`relative rounded-2xl p-6 border ${config.border} bg-black/20 mb-8`}>
        <div className="absolute top-2 left-4 text-[8px] font-black text-slate-700 uppercase tracking-[0.5em]">
          saida_do_sistema
        </div>
        <p className="text-lg font-bold text-white leading-relaxed pt-4">
          <span className={`${config.accent} mr-2`}>&gt;_</span>
          {suggestion.message}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score Interno</span>
            <span className={`text-lg font-black font-display ${config.accent}`}>{confidencePercent}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${config.bar}`}
              style={{ width: `${Math.min(suggestion.confidence, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center min-h-16">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Entrada Sugerida</span>
          <span className="text-sm font-black font-display text-white">
            {kellyPercent}% <span className="text-[10px] text-slate-500 italic">banca</span>
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricBox
          label="Acerto Real"
          value={`${(predictionStats?.hit_rate || 0).toFixed(1)}%`}
          detail={`${predictionStats?.settled || 0} conferidas`}
        />
        <MetricBox
          label="Ultimas 100"
          value={`${(predictionStats?.last_100_hit_rate || 0).toFixed(1)}%`}
          detail={`${predictionStats?.pending || 0} pendentes`}
        />
        <MetricBox
          label="Calibragem"
          value={calibration?.is_calibrated ? "Ativa" : "Pendente"}
          detail={`${(calibration?.probability_calibrated || 0).toFixed(1)}% / n=${calibration?.sample_support || 0}`}
        />
      </div>

      {probabilities && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <MetricBox label="Red" value={`${probabilities.RED.toFixed(1)}%`} detail="probabilidade" />
          <MetricBox label="Black" value={`${probabilities.BLACK.toFixed(1)}%`} detail="probabilidade" />
          <MetricBox label="White" value={`${probabilities.WHITE.toFixed(1)}%`} detail="probabilidade" />
        </div>
      )}

      {votes.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fatores do Sinal</span>
            <span className="text-[9px] font-bold text-slate-600 uppercase">{analysis?.model_version}</span>
          </div>
          <div className="space-y-2">
            {votes.map((vote, index) => (
              <div key={`${vote.model}-${vote.color}-${index}`} className="grid grid-cols-4 gap-3 text-[10px]">
                <span className="font-bold text-white/70 uppercase truncate">{vote.model}</span>
                <span className="font-black text-white">{vote.color}</span>
                <span className="font-bold text-slate-500 tabular-nums">{vote.probability.toFixed(1)}%</span>
                <span className="font-bold text-slate-600 tabular-nums">n={vote.support}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center">
        <div className="text-[9px] text-slate-600 font-medium max-w-[80%] text-center uppercase tracking-tighter">
          Resultados passados nao garantem lucros futuros. Sinais sem calibragem ficam bloqueados como NO_BET.
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white/[0.025] rounded-xl border border-white/5 p-4 min-h-20">
      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <p className="mt-1 text-lg font-black font-display text-white tabular-nums">{value}</p>
      <p className="text-[9px] font-bold text-slate-600 uppercase">{detail}</p>
    </div>
  );
}
