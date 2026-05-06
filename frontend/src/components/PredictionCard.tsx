"use client";

import type { Suggestion } from "@/lib/api";

interface PredictionCardProps {
  suggestion: Suggestion | null;
  quantumScore: number;
  isLoading: boolean;
}

const typeConfig = {
  ALERT: {
    icon: "⚡",
    title: "Sinal Quântico",
    accent: "text-[#f12c4c]",
    border: "border-[#f12c4c20]",
    bg: "bg-[#f12c4c05]",
    glow: "shadow-[0_0_30px_rgba(241,44,76,0.15)]",
    bar: "bg-[#f12c4c]",
  },
  WARNING: {
    icon: "📡",
    title: "Escaneamento de Padrão",
    accent: "text-[#f59e0b]",
    border: "border-[#f59e0b20]",
    bg: "bg-[#f59e0b05]",
    glow: "",
    bar: "bg-[#f59e0b]",
  },
  INFO: {
    icon: "🔍",
    title: "Informação Analítica",
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
  isLoading,
}: PredictionCardProps) {
  if (isLoading && !suggestion) {
    return (
      <div className="glass-v2 p-8 h-full flex flex-col justify-center">
        <div className="flex flex-col items-center gap-4 py-10 opacity-40">
           <div className="w-16 h-16 rounded-full border-4 border-t-emerald-500 border-white/5 animate-spin" />
           <p className="text-xs font-black uppercase tracking-[0.4em]">Decodificando Algoritmos</p>
        </div>
      </div>
    );
  }
  if (!suggestion) return null;

  const config = typeConfig[suggestion.type];
  const confidencePercent = Math.max(suggestion.confidence, 0).toFixed(1);
  const kellyPercent = suggestion.kelly_fraction || 0;

  return (
    <div className={`glass-v2 p-8 h-full relative overflow-hidden transition-all duration-500 ${config.glow}`}>
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-0 left-0 right-0 h-px bg-white animate-[scan_4s_linear_infinite]" />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${config.bg} ${config.border} ${config.accent}`}>
            {config.icon}
          </div>
          <div>
            <h2 className={`text-lg font-black font-display uppercase tracking-widest ${config.accent}`}>
              {config.title}
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Execução em Tempo Real</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resonância</span>
           <p className={`text-sm font-black font-display ${quantumScore >= 75 ? "text-emerald-500 animate-pulse" : "text-white"}`}>
             {quantumScore.toFixed(0)}% SINC
           </p>
        </div>
      </div>

      <div className={`relative rounded-2xl p-6 border ${config.border} bg-black/20 mb-8`}>
        <div className="absolute top-2 left-4 text-[8px] font-black text-slate-700 uppercase tracking-[0.5em]">Saída_do_Sistema</div>
        <p className="text-lg font-bold text-white leading-relaxed pt-4">
          <span className={`${config.accent} mr-2`}>&gt;_</span>
          {suggestion.message}
        </p>
      </div>

      <div className="flex items-end justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nível de Confiança</span>
            <span className={`text-lg font-black font-display ${config.accent}`}>{confidencePercent}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${config.bar}`}
              style={{ width: `${suggestion.confidence}%` }}
            />
          </div>
        </div>

        <div className="shrink-0 w-32 h-14 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
           <div className={`absolute inset-0 opacity-10 ${config.bg} translate-y-full group-hover:translate-y-0 transition-transform duration-500`} />
           <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Entrada Sugerida</span>
           <span className={`text-sm font-black font-display text-white`}>
             {kellyPercent}% <span className="text-[10px] text-slate-500 italic">banca</span>
           </span>
           <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500/50 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-4">
         <div className="text-[9px] text-slate-600 font-medium max-w-[80%] text-center uppercase tracking-tighter">
           Resultados passados não garantem lucros futuros. Gerencie sua banca com responsabilidade.
         </div>
      </div>
    </div>
  );
}
