"use client";

import { useState, useEffect } from "react";

interface HeaderProps {
  totalRolls: number;
  isLoading: boolean;
  lastUpdate: Date | null;
}

export default function Header({
  totalRolls,
  isLoading,
  lastUpdate,
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-v2 mb-8 px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-var(--color-border-highlight) to-transparent opacity-50" />
      
      <div className="flex items-center gap-5">
        <div className="relative group">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f12c4c] to-[#7c3aed] flex items-center justify-center text-3xl font-bold shadow-[0_0_20px_rgba(241,44,76,0.3)] transition-transform group-hover:scale-110">
            📡
          </div>
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-bg-deep)] ${
            isLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
          } transition-colors shadow-lg`} />
        </div>
        
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold font-display tracking-tight text-white flex items-center gap-2">
            QUANTUM <span className="text-[#f12c4c]">DOUBLES</span>
            <span className="text-[10px] py-1 px-2 rounded-md bg-[#ffffff10] text-slate-400 font-sans tracking-widest uppercase">PRO v5.0</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 tracking-[0.2em] uppercase">
            Motor de Análise Profunda • <span className="text-emerald-500/80">AO VIVO</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-10">
        <div className="hidden lg:flex flex-col items-end">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tempo de Atividade</span>
          <span className="text-lg font-bold font-display text-[#0ea5e9] tabular-nums tracking-wider">{currentTime || "--:--:--"}</span>
        </div>

        <div className="h-10 w-px bg-white/5 hidden md:block" />

        <div className="flex gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Base de Dados</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-display text-white tabular-nums">{totalRolls.toLocaleString()}</span>
              <span className="text-[9px] text-slate-600 font-bold uppercase">rds</span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sincronização</span>
            <span className="text-xl font-bold font-display text-white tabular-nums">
              {lastUpdate ? lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-white/5">
          <div className={`w-3 h-3 rounded-full ${isLoading ? "bg-amber-500" : "bg-emerald-500"} shadow-[0_0_15px_currentColor] animate-pulse`} />
          <span className={`text-xs font-black uppercase tracking-widest ${isLoading ? "text-amber-500" : "text-emerald-500"}`}>
            {isLoading ? "Sincronizando..." : "Pronto"}
          </span>
        </div>
      </div>
    </header>
  );
}
