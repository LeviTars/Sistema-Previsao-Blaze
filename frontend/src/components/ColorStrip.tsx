"use client";

import type { Roll } from "@/lib/api";

interface ColorStripProps {
  rolls: Roll[];
  isLoading: boolean;
}

const colorConfig = {
  RED: {
    bg: "bg-[#f12c4c]",
    glow: "shadow-[0_0_15px_rgba(241,44,76,0.3)]",
    text: "text-white",
  },
  BLACK: {
    bg: "bg-[#1e1e2d]",
    glow: "shadow-[0_0_15px_rgba(0,0,0,0.5)]",
    text: "text-slate-400",
    border: "border border-white/5",
  },
  WHITE: {
    bg: "bg-white",
    glow: "shadow-[0_0_20px_rgba(255,255,255,0.4)]",
    text: "text-slate-900",
  },
};

export default function ColorStrip({ rolls, isLoading }: ColorStripProps) {
  if (isLoading && rolls.length === 0) {
    return (
      <div className="glass-v2 p-6 mb-8">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="w-12 h-12 shrink-0 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-v2 p-6 mb-8 group overflow-hidden relative">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-black font-display text-white uppercase tracking-[0.3em] flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Esteira de Resultados
        </h2>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Histórico</span>
           <span className="text-xs font-bold text-white tabular-nums bg-white/5 px-2 py-0.5 rounded-md">{rolls.length}</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[var(--color-bg-card)] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[var(--color-bg-card)] to-transparent z-10 pointer-events-none" />

        <div className="flex gap-2.5 overflow-x-auto pb-4 pt-2 -mx-2 px-2 scrollbar-none scroll-smooth">
          {rolls.map((roll, index) => {
            const config = colorConfig[roll.color];
            const isLatest = index === 0;
            
            return (
              <div
                key={roll.id || index}
                className={`relative shrink-0 transition-transform duration-500 ${isLatest ? "scale-110 mx-2" : "scale-100 opacity-80 hover:opacity-100"}`}
              >
                {isLatest && (
                  <div className="absolute -inset-2 bg-gradient-to-b from-[#f12c4c30] to-transparent blur-xl rounded-full animate-pulse" />
                )}
                
                <div
                  className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    text-sm font-black font-display cursor-default
                    transition-all duration-300
                    ${config.bg}
                    ${config.glow}
                    ${config.text}
                    ${"border" in config ? config.border : ""}
                    ${isLatest ? "ring-2 ring-white/20" : ""}
                  `}
                >
                  {roll.roll_value}
                </div>

                {isLatest && (
                   <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-[#f12c4c] uppercase tracking-tighter bg-[var(--color-bg-deep)] px-1 rounded-sm border border-[#f12c4c40]">
                     Novo
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#f12c4c]" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Vermelho</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Preto</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Branco</span>
        </div>
      </div>
    </div>
  );
}
