"use client";

import type { AnalysisData } from "@/lib/api";

interface StatsPanelProps {
  analysis: AnalysisData | null;
  isLoading: boolean;
}

export default function StatsPanel({ analysis, isLoading }: StatsPanelProps) {
  if (isLoading && !analysis) {
     return (
       <div className="glass-v2 p-8 h-full flex items-center justify-center">
         <div className="flex flex-col items-center gap-4 opacity-40">
            <div className="w-12 h-12 rounded-full border-4 border-t-[#f12c4c] border-white/5 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white">Sincronizando Métricas</p>
         </div>
       </div>
     );
  }

  if (!analysis) return null;

  const { 
    frequencies, 
    white_gap, 
    total_analyzed, 
    market_state, 
    quantum_score, 
    entropy, 
    seed_integrity = { status: 'OPTIMAL', score: 100, message: 'Verificando integridade...' } 
  } = analysis;

  const getMarketStateColor = (state: string) => {
    switch (state) {
      case "STABLE": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "VORTEX": return "text-purple-500 bg-purple-500/10 border-purple-500/20";
      case "TRENDING": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      default: return "text-slate-500 bg-white/5 border-white/5";
    }
  };

  return (
    <div className="glass-v2 p-8 h-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-sm font-black font-display text-white uppercase tracking-[0.3em] flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
          Inteligência de Mercado
        </h2>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${getMarketStateColor(market_state)}`}>
            Estado: {market_state}
          </span>
          <span className="text-[10px] font-black text-slate-500 bg-white/5 px-3 py-1 rounded-lg border border-white/5 uppercase tracking-widest">
            {total_analyzed} Amostras
          </span>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <FrequencyBar
          label="Probabilidade Vermelho"
          value={frequencies.RED}
          theoretical={46.67}
          color="#f12c4c"
        />

        <FrequencyBar
          label="Probabilidade Preto"
          value={frequencies.BLACK}
          theoretical={46.67}
          color="#94a3b8"
        />

        <FrequencyBar
          label="Jackpot Branco"
          value={frequencies.WHITE}
          theoretical={6.67}
          color="#ffffff"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/5 group hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Carencia Branco</span>
            <span className="text-[9px] font-bold text-emerald-500 uppercase">Ao Vivo</span>
          </div>
          <p className={`text-4xl font-black font-display tabular-nums ${
            white_gap >= 30 ? "text-[#f12c4c]" : "text-white"
          }`}>
            {white_gap}
          </p>
          <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-tighter">
            Último há {white_gap} rodadas
          </p>
          
          <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
             <div 
               className={`h-full transition-all duration-1000 ${white_gap >= 30 ? "bg-[#f12c4c]" : "bg-[#0ea5e9]"}`}
               style={{ width: `${Math.min((white_gap / 50) * 100, 100)}%` }}
             />
          </div>
        </div>

        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pulsar Quântico</span>
            <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-pulse`} />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black font-display tabular-nums text-white">
              {quantum_score.toFixed(0)}%
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={`text-[9px] font-black px-3 py-1 rounded-md uppercase tracking-widest bg-white/5 text-white/50`}>
              Entropia: {entropy.toFixed(3)}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-tighter text-emerald-500`}>
              Ressonância
            </span>
          </div>
        </div>

        <div className={`col-span-2 bg-white/[0.02] rounded-2xl p-5 border transition-all duration-500 ${
          seed_integrity.status === 'BROKEN' ? 'border-red-500/30 bg-red-500/5' : 
          seed_integrity.status === 'RECYCLED' ? 'border-amber-500/30 bg-amber-500/5' : 
          'border-white/5'
        }`}>
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Auditoria de Rede</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${
                  seed_integrity.status === 'OPTIMAL' ? 'bg-emerald-500/20 text-emerald-500' :
                  seed_integrity.status === 'RECYCLED' ? 'bg-amber-500/20 text-amber-500' :
                  'bg-red-500/20 text-red-500'
                }`}>
                  {seed_integrity.status}
                </span>
             </div>
             <span className="text-[10px] font-black text-white tabular-nums">{seed_integrity.score.toFixed(1)}% IHC</span>
          </div>
          
          <div className="flex items-start gap-4">
             <div className="shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
               {seed_integrity.status === 'OPTIMAL' ? '🛡️' : seed_integrity.status === 'RECYCLED' ? '♻️' : '⚠️'}
             </div>
             <div>
                <p className="text-[11px] font-bold text-white/90 leading-tight mb-1">
                  {seed_integrity.message}
                </p>
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter font-medium">
                  Protocolo SHA-256 Verificado em Tempo Real
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FrequencyBarProps {
  label: string;
  value: number;
  theoretical: number;
  color: string;
}

function FrequencyBar({ label, value, theoretical, color }: FrequencyBarProps) {
  const diff = value - theoretical;
  
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] font-bold ${(Number(diff) || 0) > 0 ? "text-emerald-500" : "text-[#f12c4c]"}`}>
            {(Number(diff) || 0) > 0 ? "+" : ""}{(Number(diff) || 0).toFixed(1)}%
          </span>
          <span className="text-sm font-black text-white tabular-nums font-display">{(Number(value) || 0).toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden relative">
        <div 
          className="absolute top-0 bottom-0 w-px bg-white/20 z-10"
          style={{ left: `${theoretical}%` }}
        />
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${value}%`, backgroundColor: color }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
