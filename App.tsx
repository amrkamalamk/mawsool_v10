
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UnifiedDataPoint, Alert, Region, GenesysCredentials, AgentPerformance, WrapUpData, BranchData, CallerData, InteractionData } from './types';
import { 
  GENESYS_ORG_DEFAULT, 
  GENESYS_REGION_DEFAULT, 
  MOS_THRESHOLD_DEFAULT, 
  POLLING_INTERVAL_MS,
  QUEUE_NAME_DEFAULT,
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_SECRET,
  DEFAULT_PROXY,
} from './constants';
import { fetchRealtimeMetrics, getQueueIdByName, clearToken, fetchRecentInteractions } from './services/genesysService';
import { analyzeMOSPerformance } from './services/geminiService';
import MOSChart from './components/MOSChart';
import AgentPerformanceTable from './components/AgentPerformanceTable';
import UnifiedDashboardChart from './components/UnifiedDashboardChart';
import WrapUpChart from './components/WrapUpChart';
import BranchChart from './components/BranchChart';
import TopCallersChart from './components/TopCallersChart';
import AHTChart from './components/AHTChart';
import AgentsChart from './components/AgentsChart';
import RecordingsView from './components/RecordingsView';

type TabType = 'interval' | 'daily';
type SubTabType = 'summary' | 'charts' | 'agents' | 'wrapup' | 'branches' | 'topcallers' | 'recordings' | 'aiforensics';

const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const sections = content.split('\n');
  return (
    <div className="space-y-4 text-sm leading-relaxed overflow-hidden text-slate-300">
      {sections.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h3 key={i} className="text-base font-black text-indigo-300 mt-6 mb-2 uppercase tracking-widest">{line.replace('## ', '')}</h3>;
        }
        if (line.startsWith('- ')) {
          const parts = line.replace('- ', '').split(/(\*\*.*?\*\*)/);
          return (
            <div key={i} className="flex gap-2 ml-1 text-slate-200">
              <span className="text-indigo-400">•</span>
              <span>
                {parts.map((p, pi) => p.startsWith('**') ? <strong key={pi} className="font-bold text-white">{p.slice(2, -2)}</strong> : p)}
              </span>
            </div>
          );
        }
        if (!line.trim()) return null;
        const boldParts = line.split(/(\*\*.*?\*\*)/);
        return (
          <p key={i}>
            {boldParts.map((p, pi) => p.startsWith('**') ? <strong key={pi} className="font-bold text-white">{p.slice(2, -2)}</strong> : p)}
          </p>
        );
      })}
    </div>
  );
};

const KPIBox = ({ label, value, icon, color, bg = "bg-white dark:bg-slate-900" }: { label: string, value: string | number, icon: string, color: string, bg?: string }) => (
  <div className={`${bg} p-4 md:p-5 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center transition-transform hover:scale-[1.02]`}>
    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 ${bg.includes('white') ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white/20'}`}>
      <i className={`fa-solid ${icon} ${color} text-xs md:text-sm`}></i>
    </div>
    <p className="text-[6px] md:text-[7px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 tracking-widest">{label}</p>
    <p className={`text-xs md:text-sm font-black tracking-tight truncate w-full ${color}`}>{value}</p>
  </div>
);

const App: React.FC = () => {
  const [creds, setCreds] = useState<GenesysCredentials | null>(null);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [actualRegion, setActualRegion] = useState<string | null>(null);
  const [unifiedHistory, setUnifiedHistory] = useState<UnifiedDataPoint[]>([]);
  const [agentStats, setAgentStats] = useState<AgentPerformance[]>([]);
  const [wrapUpData, setWrapUpData] = useState<WrapUpData[]>([]);
  const [branchData, setBranchData] = useState<BranchData[]>([]);
  const [topCallers, setTopCallers] = useState<CallerData[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<InteractionData[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('interval');
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('summary');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    clientId: DEFAULT_CLIENT_ID, clientSecret: DEFAULT_CLIENT_SECRET, orgName: GENESYS_ORG_DEFAULT,
    region: GENESYS_REGION_DEFAULT, queueName: QUEUE_NAME_DEFAULT, proxyUrl: DEFAULT_PROXY, threshold: MOS_THRESHOLD_DEFAULT,
  });

  useEffect(() => {
    const updateSW = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.getRegistrations()
          .then(registrations => {
            registrations.forEach(reg => {
              if (reg.active) reg.update().catch(() => {});
            });
          })
          .catch(err => console.debug('SW Update deferred:', err));
      }
    };

    if (document.readyState === 'complete') {
      updateSW();
    } else {
      window.addEventListener('load', updateSW);
      return () => window.removeEventListener('load', updateSW);
    }
  }, []);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.body.style.backgroundColor = isDarkMode ? '#020617' : '#f8fafc';
  }, [isDarkMode]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeSubTab]);

  const fetchData = useCallback(async () => {
    if (!creds || !activeQueueId || !actualRegion) return;
    setIsFetching(true);
    try {
      const [metrics, recs] = await Promise.all([
        fetchRealtimeMetrics(creds, activeQueueId, actualRegion, selectedDate, activeTab === 'daily' ? dateTo : selectedDate),
        fetchRecentInteractions(creds, activeQueueId, actualRegion)
      ]);
      
      setUnifiedHistory(metrics.history || []);
      setAgentStats(metrics.agents || []);
      setWrapUpData(metrics.wrapUpData || []);
      setBranchData(metrics.branchData || []);
      setTopCallers(metrics.topCallers || []);
      setRecentInteractions(recs || []);
      setError(null);
    } catch (err: any) { setError(err.message); } finally { setIsFetching(false); }
  }, [creds, activeQueueId, actualRegion, selectedDate, dateTo, activeTab]);

  useEffect(() => {
    if (!creds || !activeQueueId) return;
    fetchData();
    const interval = setInterval(fetchData, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [creds, activeQueueId, fetchData]);

  const dailyAggregatedHistory = useMemo(() => {
    if (activeTab === 'interval') return unifiedHistory.map(h => ({ ...h, timestamp: h.timestamp.split(' ')[1] }));
    const days: Record<string, any> = {};
    unifiedHistory.forEach(h => {
      const date = h.timestamp.split(' ')[0];
      if (!days[date]) days[date] = { offered: 0, answered: 0, abandoned: 0, mosSum: 0, mosCount: 0, ahtSum: 0, ahtCount: 0, slMet: 0, agentsMax: 0 };
      const d = days[date];
      d.offered += h.offered; d.answered += h.answered; d.abandoned += h.abandoned; d.agentsMax = Math.max(d.agentsMax, h.agentsCount);
      if (h.mos !== null) { d.mosSum += (h.mos * h.offered); d.mosCount += h.offered; }
      if (h.aht !== null) { d.ahtSum += (h.aht * h.answered); d.ahtCount += h.answered; }
      if (h.slPercent !== null) d.slMet += (h.slPercent * h.offered / 100);
    });
    return Object.keys(days).sort().map(date => ({
      timestamp: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      offered: days[date].offered, answered: days[date].answered, abandoned: days[date].abandoned,
      mos: days[date].mosCount > 0 ? days[date].mosSum / days[date].mosCount : null,
      aht: days[date].ahtCount > 0 ? days[date].ahtSum / days[date].ahtCount : null,
      slPercent: days[date].offered > 0 ? (days[date].slMet / days[date].offered) * 100 : null,
      agentsCount: days[date].agentsMax, conversationsCount: days[date].offered
    }));
  }, [unifiedHistory, activeTab]);

  const metrics = useMemo(() => {
    const totalOffered = dailyAggregatedHistory.reduce((acc, d) => acc + d.offered, 0);
    const totalAnswered = dailyAggregatedHistory.reduce((acc, d) => acc + d.answered, 0);
    const totalAbandoned = dailyAggregatedHistory.reduce((acc, d) => acc + d.abandoned, 0);
    const totalAgents = agentStats.length;
    const totalSlMet = dailyAggregatedHistory.reduce((acc, d) => acc + (d.slPercent !== null ? (d.slPercent * d.offered / 100) : 0), 0);
    const avgSL = totalOffered > 0 ? (totalSlMet / totalOffered) * 100 : 0;
    const mosOffered = dailyAggregatedHistory.reduce((acc, d) => acc + (d.mos !== null ? d.offered : 0), 0);
    const mosWeight = dailyAggregatedHistory.reduce((acc, d) => acc + (d.mos !== null ? d.mos * d.offered : 0), 0);
    const avgMOS = mosOffered > 0 ? (mosWeight / mosOffered) : 0;
    const totalHT = dailyAggregatedHistory.reduce((acc, d) => acc + (d.aht !== null ? (d.aht * d.answered) : 0), 0);
    const avgAHT = totalAnswered > 0 ? (totalHT / totalAnswered) : 0;
    const avgCalls = totalAgents > 0 ? totalAnswered / totalAgents : 0;

    const intervals = dailyAggregatedHistory.map(h => ({
      mos: h.mos || 0,
      sl: h.slPercent || 0,
      offered: h.offered,
      answered: h.answered,
      abandoned: h.abandoned,
      agents: h.agentsCount,
      aht: h.aht || 0,
      avgCalls: h.agentsCount > 0 ? h.answered / h.agentsCount : 0
    }));

    const max = {
      mos: Math.max(...intervals.map(i => i.mos)),
      sl: Math.max(...intervals.map(i => i.sl)),
      offered: Math.max(...intervals.map(i => i.offered)),
      answered: Math.max(...intervals.map(i => i.answered)),
      abandoned: Math.max(...intervals.map(i => i.abandoned)),
      agents: Math.max(...intervals.map(i => i.agents)),
      aht: Math.max(...intervals.map(i => i.aht)),
      avgCalls: Math.max(...intervals.map(i => i.avgCalls))
    };

    const min = {
      mos: Math.min(...intervals.filter(i => i.mos > 0).map(i => i.mos)),
      sl: Math.min(...intervals.filter(i => i.sl > 0).map(i => i.sl)),
      offered: Math.min(...intervals.map(i => i.offered)),
      answered: Math.min(...intervals.map(i => i.answered)),
      abandoned: Math.min(...intervals.map(i => i.abandoned)),
      agents: Math.min(...intervals.map(i => i.agents)),
      aht: Math.min(...intervals.filter(i => i.aht > 0).map(i => i.aht)),
      avgCalls: Math.min(...intervals.filter(i => i.avgCalls > 0).map(i => i.avgCalls))
    };

    return { 
      summary: { mos: avgMOS, sl: avgSL, offered: totalOffered, answered: totalAnswered, abandoned: totalAbandoned, agents: totalAgents, aht: avgAHT, avgCalls: avgCalls },
      max, 
      min: { ...min, mos: isFinite(min.mos) ? min.mos : 0, sl: isFinite(min.sl) ? min.sl : 0, aht: isFinite(min.aht) ? min.aht : 0, avgCalls: isFinite(min.avgCalls) ? min.avgCalls : 0 }
    };
  }, [dailyAggregatedHistory, agentStats]);

  const handleExportPDF = async () => {
    if (!pdfTemplateRef.current) return;
    const element = pdfTemplateRef.current;
    const opt = {
      margin: 10,
      filename: `Mawsool_Report_${selectedDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    // @ts-ignore
    window.html2pdf().from(element).set(opt).save();
  };

  const handleRunAnalysis = useCallback(async () => {
    if (!dailyAggregatedHistory.length) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const mosData = dailyAggregatedHistory.filter(d => d.mos != null).map(d => ({ timestamp: d.timestamp, mos: d.mos!, conversationsCount: d.offered }));
      const result = await analyzeMOSPerformance(mosData);
      setAnalysis(result);
    } catch (err: any) { setError(err.message === "RE-AUTH_REQUIRED" ? "Gemini API Key missing." : err.message); } finally { setIsAnalyzing(false); }
  }, [dailyAggregatedHistory]);

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true); setError(null);
    try {
      const gCreds: GenesysCredentials = { ...formData, clientId: formData.clientId.trim(), clientSecret: formData.clientSecret.trim(), orgName: formData.orgName.trim() };
      clearToken();
      const { queueId, actualRegion: foundRegion } = await getQueueIdByName(gCreds, formData.queueName.trim());
      setCreds(gCreds); setActiveQueueId(queueId); setActualRegion(foundRegion); setIsConfigOpen(false);
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  };

  const getRAGColor = (type: 'mos' | 'sl' | 'abandoned', value: number, offered?: number) => {
    if (type === 'mos') {
      return value < 4.3 ? 'text-red-500' : value < 4.8 ? 'text-amber-500' : 'text-emerald-500';
    }
    if (type === 'sl') {
      return value < 80 ? 'text-red-500' : value < 90 ? 'text-amber-500' : 'text-emerald-500';
    }
    if (type === 'abandoned') {
      const percent = offered && offered > 0 ? (value / offered) * 100 : 0;
      return percent > 10 ? 'text-red-500' : percent > 5 ? 'text-amber-500' : 'text-emerald-500';
    }
    return 'text-slate-900 dark:text-white';
  }

  const renderMetricRow = (label: string, data: any, rowType: 'summary' | 'max' | 'min') => {
    const bgMap = { summary: "bg-white dark:bg-slate-900", max: "bg-indigo-50/40 dark:bg-indigo-900/10", min: "bg-slate-50 dark:bg-slate-800/40" };
    const isSummary = rowType === 'summary';
    const isMax = rowType === 'max';
    const prefix = isSummary ? 'Total' : (isMax ? 'MAX' : 'MIN');
    const avgPrefix = isSummary ? 'Avg.' : (isMax ? 'MAX' : 'MIN');
    const blackColor = "text-slate-900 dark:text-white";

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
        <KPIBox label={`${avgPrefix} MOS`} value={data.mos.toFixed(2)} icon="fa-microphone-lines" color={getRAGColor('mos', data.mos)} bg={bgMap[rowType]} />
        <KPIBox label={`${avgPrefix} SL%`} value={`${data.sl.toFixed(1)}%`} icon="fa-bolt" color={getRAGColor('sl', data.sl)} bg={bgMap[rowType]} />
        <KPIBox label={`${prefix} Offered`} value={data.offered} icon="fa-phone-volume" color={blackColor} bg={bgMap[rowType]} />
        <KPIBox label={`${prefix} Answered`} value={data.answered} icon="fa-headset" color={blackColor} bg={bgMap[rowType]} />
        <KPIBox label={`${prefix} Abandoned`} value={data.abandoned} icon="fa-phone-slash" color={getRAGColor('abandoned', data.abandoned, data.offered)} bg={bgMap[rowType]} />
        <KPIBox label={`${prefix} Agents`} value={data.agents} icon="fa-users" color={blackColor} bg={bgMap[rowType]} />
        <KPIBox label={isSummary ? "AHT" : `${prefix} AHT`} value={`${data.aht.toFixed(0)}s`} icon="fa-clock" color={blackColor} bg={bgMap[rowType]} />
        <KPIBox label={`${avgPrefix} Calls/Agent`} value={data.avgCalls.toFixed(1)} icon="fa-calculator" color={blackColor} bg={bgMap[rowType]} />
      </div>
    );
  };

  const topCaller = topCallers[0] || null;

  const folderColors: Record<SubTabType, string> = {
    summary: '#facc15',
    charts: '#f97316',
    agents: '#ec4899',
    wrapup: '#8b5cf6',
    branches: '#3b82f6',
    topcallers: '#14b8a6',
    recordings: '#84cc16',
    aiforensics: '#6366f1'
  };

  const subTabLabels: Record<SubTabType, string> = {
    summary: 'Summary',
    charts: 'Charts',
    agents: 'Agents',
    wrapup: 'Call Reasons',
    branches: 'Branches',
    topcallers: 'Top Callers',
    recordings: 'Recordings',
    aiforensics: 'AI Analyst'
  };

  return (
    <div className={`min-h-screen relative flex flex-col ${isDarkMode ? 'dark' : ''} overflow-x-hidden selection:bg-indigo-500/30 touch-manipulation`}>
      {isFetching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl md:rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Syncing Telemetry</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 h-auto min-h-[5rem] md:min-h-[7rem] py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden w-full md:w-auto">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg overflow-hidden border border-slate-100">
            <img 
              src="/mawsool.png" 
              alt="Mawsool" 
              className="w-full h-full object-contain" 
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x200/0a192f/ffffff?text=M'; }}
            />
          </div>
          <div className="flex flex-col text-slate-900 dark:text-white truncate">
            <h1 className="text-lg md:text-2xl font-black leading-none truncate uppercase tracking-tight">Mawsool</h1>
            <div className="flex flex-col text-[6px] md:text-[8px] font-black text-indigo-500 dark:text-indigo-400 tracking-wider mt-0.5 md:mt-1 space-y-0 md:space-y-0.5">
              <span className="truncate">Genesys Cloud CX2 (UAE)</span>
              <span className="truncate">Super Chicken Queue</span>
              <span className="truncate">Baghdad (09:00 - 03:00 +1d)</span>
            </div>
          </div>
        </div>

        {!isConfigOpen && (
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 md:gap-4 w-full md:w-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
              {(['interval', 'daily'] as TabType[]).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`px-3 md:px-4 py-1.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500'}`}>{t}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[8px] md:text-[10px] font-bold dark:text-white outline-none w-24 md:w-32" />
              {activeTab === 'daily' && (
                <><span className="text-slate-400 text-[10px]">-</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[8px] md:text-[10px] font-bold dark:text-white outline-none w-24 md:w-32" /></>
              )}
            </div>
            <div className="flex items-center gap-2">
              {deferredPrompt && !isStandalone && (
                <button onClick={handleInstallClick} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-emerald-500 text-white shadow-lg active:scale-95 flex items-center justify-center"><i className="fa-solid fa-download text-xs"></i></button>
              )}
              <button onClick={handleExportPDF} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"><i className="fa-solid fa-file-pdf text-xs md:text-base"></i></button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-xs md:text-base`}></i></button>
              <button onClick={() => setIsConfigOpen(true)} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><i className="fa-solid fa-sliders text-xs md:text-base"></i></button>
            </div>
          </div>
        )}
      </header>

      {!isConfigOpen && (
        <div className="sticky top-20 md:top-28 z-30 bg-slate-50 dark:bg-[#020617] px-2 md:px-6 pt-4 md:pt-10 transition-colors">
          <div className="flex items-end max-w-[1500px] mx-auto overflow-x-auto no-scrollbar scroll-smooth">
            {(['summary', 'charts', 'agents', 'wrapup', 'branches', 'topcallers', 'recordings', 'aiforensics'] as SubTabType[]).map((st, index) => {
              const isActive = activeSubTab === st;
              const color = folderColors[st];
              const isLightTab = ['summary', 'charts', 'topcallers', 'recordings'].includes(st);
              return (
                <button key={st} onClick={() => setActiveSubTab(st)} style={{ backgroundColor: color, zIndex: isActive ? 50 : 10 + index, marginLeft: index === 0 ? 0 : (window.innerWidth < 768 ? '-0.5rem' : '-1.2rem'), clipPath: 'polygon(0% 100%, 0% 0%, 85% 0%, 100% 100%)' }}
                  className={`flex-shrink-0 px-4 md:px-8 py-3 md:py-4 text-[7px] md:text-[10px] font-black tracking-wider transition-all duration-300 relative ${isActive ? 'translate-y-0 opacity-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.3)]' : 'translate-y-1 opacity-70 hover:translate-y-0 shadow-sm'}`}>
                  <span className={`transition-colors font-black ${isActive ? (isLightTab ? 'text-slate-900 scale-105' : 'text-white scale-105') : (isLightTab ? 'text-slate-800/60' : 'text-white/60')}`}>{subTabLabels[st]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="flex-grow max-w-[1500px] w-full mx-auto p-2 md:p-4 overflow-visible">
        {isConfigOpen ? (
          <div className="max-w-xl mx-auto py-10 px-2 min-h-[80vh] flex items-center">
            <div className="w-full bg-[#0a192f] p-8 md:p-14 rounded-3xl md:rounded-[4rem] shadow-2xl relative overflow-hidden border border-blue-500/10">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
               <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl"></div>
               <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl"></div>

               <div className="relative z-10 flex flex-col items-center mb-10 animate-in fade-in slide-in-from-top-4 duration-1000">
                 <div className="w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-2xl md:rounded-[2.5rem] p-0.5 shadow-2xl mb-8 flex items-center justify-center border border-white/10 overflow-hidden">
                   <img src="/mawsool.png" alt="Mawsool Logo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x200/0a192f/ffffff?text=M'; }} />
                 </div>
                 <h2 className="text-2xl md:text-4xl font-black text-center text-white tracking-tighter uppercase">Mawsool</h2>
                 <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Intelligence Terminal</p>
               </div>

               <div className="space-y-6 relative z-10">
                 <button onClick={handleConnect} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-4 group">
                   <div className="w-10 h-10 bg-white/10 rounded-xl p-1 transition-transform group-hover:scale-110 overflow-hidden">
                     <img src="/mawsool.png" alt="Icon" className="w-full h-full object-cover brightness-0 invert" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                   </div>
                   <span className="text-lg tracking-tight">Connect to Mawsool</span>
                 </button>

                 <div className="flex flex-col items-center">
                   <button onClick={() => setIsDetailsExpanded(!isDetailsExpanded)} className="text-blue-400/40 hover:text-blue-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors py-2">Connection Details <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isDetailsExpanded ? 'rotate-180' : ''}`}></i></button>
                   <div className={`w-full overflow-hidden transition-all duration-500 ease-in-out ${isDetailsExpanded ? 'max-h-[500px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                     <form onSubmit={handleConnect} className="space-y-4 p-6 bg-white/5 rounded-3xl border border-white/5">
                        <div className="space-y-3">
                          <input type="text" placeholder="Client ID" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-white/20" />
                          <input type="password" placeholder="Client Secret" value={formData.clientSecret} onChange={e => setFormData({...formData, clientSecret: e.target.value})} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-white/20" />
                          <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Queue Name" value={formData.queueName} onChange={e => setFormData({...formData, queueName: e.target.value})} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-white/20" />
                            <input type="number" step="0.1" value={formData.threshold} onChange={e => setFormData({...formData, threshold: parseFloat(e.target.value)})} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-white/20" />
                          </div>
                        </div>
                     </form>
                   </div>
                 </div>
                 {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-center text-xs font-bold animate-shake">{error}</div>}
               </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[2rem] md:rounded-[3rem] p-0 shadow-2xl overflow-visible">
            <div ref={scrollContainerRef} className="bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[3rem] p-4 md:p-10 min-h-[500px] max-h-[85vh] md:max-h-none overflow-y-auto custom-scrollbar scroll-smooth pb-32">
              <div className="space-y-8 md:space-y-12 animate-in fade-in zoom-in-95 duration-500">
                {activeSubTab === 'summary' && <div className="space-y-6 md:space-y-10">{renderMetricRow('Summary', metrics.summary, 'summary')}{renderMetricRow('MAX', metrics.max, 'max')}{renderMetricRow('MIN', metrics.min, 'min')}</div>}
                {activeSubTab === 'charts' && (
                  <div className="grid grid-cols-1 gap-6 md:gap-10">
                     <div className="bg-slate-50 dark:bg-slate-800/40 p-4 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800"><h3 className="text-[9px] font-black uppercase mb-4 text-slate-500 dark:text-slate-400 tracking-widest">Quality Trend (MOS)</h3><MOSChart data={dailyAggregatedHistory} threshold={formData.threshold} /></div>
                     <div className="bg-slate-50 dark:bg-slate-800/40 p-4 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800"><h3 className="text-[9px] font-black uppercase mb-4 text-slate-500 dark:text-slate-400 tracking-widest">Traffic & SL%</h3><div className="h-[280px] md:h-[400px]"><UnifiedDashboardChart data={dailyAggregatedHistory} /></div></div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 md:p-8 rounded-[2rem]"><h3 className="text-[9px] font-black uppercase mb-4 text-slate-500 dark:text-slate-400 tracking-widest">AHT Trend</h3><AHTChart data={dailyAggregatedHistory} /></div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 md:p-8 rounded-[2rem]"><h3 className="text-[9px] font-black uppercase mb-4 text-slate-500 dark:text-slate-400 tracking-widest">Active Agents</h3><AgentsChart data={dailyAggregatedHistory} /></div>
                     </div>
                  </div>
                )}
                {activeSubTab === 'agents' && <div className="bg-white dark:bg-slate-900"><h3 className="text-lg md:text-xl font-black mb-6 uppercase tracking-tight text-slate-900 dark:text-white px-2">Agent Performance Grid</h3><AgentPerformanceTable agents={agentStats} /></div>}
                {activeSubTab === 'wrapup' && <div className="bg-white dark:bg-slate-900 min-h-[500px]"><h3 className="text-lg md:text-xl font-black mb-6 uppercase tracking-tight text-slate-900 dark:text-white px-2">Wrap-Up Code Analysis</h3><div className="h-[500px] md:h-[700px] w-full min-w-[300px]"><WrapUpChart data={wrapUpData} /></div></div>}
                {activeSubTab === 'branches' && <div className="bg-white dark:bg-slate-900 min-h-[500px]"><h3 className="text-lg md:text-xl font-black mb-6 uppercase tracking-tight text-slate-900 dark:text-white px-2 text-center md:text-left">Branch Traffic Distribution</h3><div className="h-[500px] md:h-[700px] w-full min-w-[300px]"><BranchChart data={branchData} /></div></div>}
                {activeSubTab === 'topcallers' && (
                  <div className="space-y-8">
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/20 flex flex-col sm:flex-row items-center justify-between max-w-md mx-auto gap-6">
                        <div className="text-center sm:text-left flex-1 min-w-0"><p className="text-[8px] font-black uppercase text-amber-600 mb-1">Top Volume Caller</p><p className="text-2xl font-black tracking-tighter text-amber-900 dark:text-white truncate">{topCaller?.number || 'N/A'}</p><p className="text-[10px] font-black text-amber-700 dark:text-amber-400 mt-2">{topCaller?.count || 0} Total Interactions</p></div>
                        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-800 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400"><i className="fa-solid fa-mobile-retro text-2xl"></i></div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 md:p-8 rounded-[2rem]"><h3 className="text-[9px] font-black uppercase mb-4 text-slate-500 dark:text-slate-400 tracking-widest">Top 10 Callers</h3><div className="h-[400px] w-full"><TopCallersChart data={topCallers} /></div></div>
                  </div>
                )}
                {activeSubTab === 'recordings' && creds && actualRegion && (
                  <div className="space-y-8 min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                       <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Interaction Surveillance</h3>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><i className="fa-solid fa-clock-rotate-left"></i> Real-time Feed active</p>
                    </div>
                    <RecordingsView interactions={recentInteractions} creds={creds} actualRegion={actualRegion} />
                  </div>
                )}
                {activeSubTab === 'aiforensics' && (
                  <div className="space-y-8 min-h-[400px]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                       <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">AI Analyst Labs</h3>
                       <button onClick={handleRunAnalysis} disabled={isAnalyzing || dailyAggregatedHistory.length === 0} className="px-6 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2">{isAnalyzing ? <><i className="fa-solid fa-spinner animate-spin"></i> Analyzing...</> : <><i className="fa-solid fa-brain"></i> Run Forensics Lab</>}</button>
                    </div>
                    {!analysis && !isAnalyzing && <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30"><i className="fa-solid fa-robot text-6xl text-indigo-600"></i><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Awaiting Telemetry Feed</p></div>}
                    {isAnalyzing && <div className="space-y-6"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative"><div className="absolute inset-0 bg-indigo-600 animate-progress origin-left"></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-50 dark:bg-slate-800/40 rounded-2xl animate-pulse"></div>)}</div></div>}
                    {analysis && <div className="bg-[#1e1b4b] p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-indigo-500/30 animate-in slide-in-from-bottom-10 duration-700"><SimpleMarkdown content={analysis} /></div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
