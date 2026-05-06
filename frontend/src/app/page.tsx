"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import ColorStrip from "@/components/ColorStrip";
import StatsPanel from "@/components/StatsPanel";
import PredictionCard from "@/components/PredictionCard";
import {
  fetchHistory,
  fetchAnalysis,
  type Roll,
  type AnalysisData,
} from "@/lib/api";

const REFRESH_INTERVAL = 3000;

export default function DashboardPage() {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [totalRolls, setTotalRolls] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial && rolls.length === 0) {
        setIsLoading(true);
      }
      setError(null);
      const [historyRes, analysisRes] = await Promise.allSettled([
        fetchHistory(100),
        fetchAnalysis(),
      ]);

      if (historyRes.status === "fulfilled") {
        setRolls(historyRes.value.data);
        setTotalRolls(historyRes.value.total);
      }

      if (analysisRes.status === "fulfilled" && analysisRes.value.data) {
        setAnalysis(analysisRes.value.data);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Falha na conexão com o Motor Quântico.");
    } finally {
      setIsLoading(false);
    }
  }, [rolls.length]);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="min-h-screen relative selection:bg-[#f12c4c30]">
      <div className="mesh-bg" />
      
      <div className="relative z-10 p-4 md:p-8 max-w-[1600px] mx-auto">
        
        <Header
          totalRolls={totalRolls}
          isLoading={isLoading}
          lastUpdate={lastUpdate}
        />

        {error && (
          <div className="mb-8 glass-v2 border-[var(--color-blaze-red)]/30 overflow-hidden group">
            <div className="flex items-center gap-4 px-6 py-4 bg-[var(--color-blaze-red)]/10">
              <span className="text-xl animate-bounce">🚨</span>
              <div className="flex-1">
                 <h4 className="text-xs font-black text-[var(--color-blaze-red)] uppercase tracking-widest">Alerta do Sistema</h4>
                 <p className="text-sm font-medium text-white/80">{error}</p>
              </div>
              <button
                onClick={() => loadData(true)}
                className="text-xs font-black uppercase text-white hover:text-[var(--color-blaze-red)] transition-colors px-4 py-2 bg-white/5 rounded-lg border border-white/10"
              >
                Reconectar
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-8">
          
          <ColorStrip rolls={rolls} isLoading={isLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            <div className="lg:col-span-5 flex flex-col h-full">
              <StatsPanel analysis={analysis} isLoading={isLoading} />
            </div>

            <div className="lg:col-span-7 flex flex-col h-full">
              <PredictionCard
                suggestion={analysis?.suggestion || null}
                quantumScore={analysis?.quantum_score || 0}
                isLoading={isLoading}
              />
            </div>

          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
           <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-black text-[10px]">Q</div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
                Motor de Execução Quântica <span className="text-white">v5.0.42</span>
              </p>
           </div>
           
           <div className="flex items-center gap-8">
              <div className="flex flex-col items-end">
                 <span className="text-[8px] font-black uppercase text-slate-500 mb-1">Processamento</span>
                 <span className="text-[10px] font-bold text-white uppercase">FastAPI / NestJS Alta Carga</span>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[8px] font-black uppercase text-slate-500 mb-1">Arquitetura</span>
                 <span className="text-[10px] font-bold text-white uppercase">Híbrido Markov-Bayes</span>
              </div>
           </div>
        </footer>
      </div>
    </div>
  );
}
