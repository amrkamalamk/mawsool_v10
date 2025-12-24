import React from 'react';
import { AgentPerformance } from '../types';

interface Props {
  agents: AgentPerformance[];
}

const AgentPerformanceTable: React.FC<Props> = ({ agents }) => {
  const formatCoverage = (agent: AgentPerformance) => {
    if (!agent.firstActivity || !agent.lastActivity) return '0h 0m';
    const diff = agent.lastActivity.getTime() - agent.firstActivity.getTime();
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  const sortedAgents = [...agents].sort((a, b) => b.answered - a.answered);

  // Totals calculations
  const totalHandled = agents.reduce((acc, a) => acc + a.answered, 0);
  const totalDropped = agents.reduce((acc, a) => acc + a.missed, 0);
  const agentCount = agents.length;

  const calculateTotalCoverage = () => {
    let totalMs = 0;
    agents.forEach(agent => {
      if (agent.firstActivity && agent.lastActivity) {
        totalMs += agent.lastActivity.getTime() - agent.firstActivity.getTime();
      }
    });
    const h = Math.floor(totalMs / (1000 * 60 * 60));
    const m = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-separate border-spacing-y-2.5">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
            <th className="px-6 py-2">Identity</th>
            <th className="px-6 py-2 text-center">Coverage</th>
            <th className="px-6 py-2 text-center">Handled</th>
            <th className="px-6 py-2 text-center">Dropped</th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {sortedAgents.map((agent) => (
            <tr key={agent.userId} className="bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <td className="px-6 py-4 rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black uppercase">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{agent.name}</p>
                    <p className="text-[8px] text-slate-500 dark:text-slate-400 font-mono tracking-tight uppercase">{agent.userId.slice(0, 10)}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-300 border-y border-slate-100 dark:border-slate-800/60">
                {formatCoverage(agent)}
              </td>
              <td className="px-6 py-4 text-center border-y border-slate-100 dark:border-slate-800/60">
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-500">{agent.answered}</span>
              </td>
              <td className="px-6 py-4 rounded-r-2xl text-center border-y border-r border-slate-100 dark:border-slate-800/60">
                <span className={`text-sm font-black ${agent.missed > 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-600'}`}>
                  {agent.missed}
                </span>
              </td>
            </tr>
          ))}
          
          {agents.length > 0 && (
            <tr className="bg-slate-200/50 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all border-t-2 border-indigo-500/20">
              <td className="px-6 py-6 rounded-l-2xl border-y border-l border-indigo-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black uppercase">
                    <i className="fa-solid fa-users"></i>
                  </div>
                  <div>
                    <p className="font-black text-slate-900 dark:text-white uppercase tracking-wider">Total Agents</p>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">{agentCount} Active in Frame</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-6 text-center font-black text-slate-900 dark:text-white border-y border-indigo-500/20">
                {calculateTotalCoverage()}
              </td>
              <td className="px-6 py-6 text-center border-y border-indigo-500/20">
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-500">{totalHandled}</span>
              </td>
              <td className="px-6 py-6 rounded-r-2xl text-center border-y border-r border-indigo-500/20">
                <span className={`text-lg font-black ${totalDropped > 0 ? 'text-red-500' : 'text-slate-500 dark:text-slate-600'}`}>
                  {totalDropped}
                </span>
              </td>
            </tr>
          )}

          {agents.length === 0 && (
            <tr>
              <td colSpan={4} className="py-16 text-center opacity-30 font-black uppercase italic tracking-widest text-[10px] text-slate-900 dark:text-white">
                Scanning for agent telemetry...
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AgentPerformanceTable;