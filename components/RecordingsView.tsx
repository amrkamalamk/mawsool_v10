
import React, { useState, useEffect } from 'react';
import { InteractionData, GenesysCredentials } from '../types';
import { fetchRecordingMediaUrl } from '../services/genesysService';

interface Props {
  interactions: InteractionData[];
  creds: GenesysCredentials;
  actualRegion: string;
}

const RecordingsView: React.FC<Props> = ({ interactions, creds, actualRegion }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectInteraction = async (id: string) => {
    setSelectedId(id);
    setAudioUrl(null);
    setLoadingAudio(true);
    setError(null);
    try {
      const url = await fetchRecordingMediaUrl(creds, id, actualRegion);
      if (url) {
        setAudioUrl(url);
      } else {
        setError("Recording media not available for this interaction.");
      }
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") {
        setError("User is not authorized to play this recording.");
      } else {
        setError("Failed to load recording playback URL.");
      }
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Recent Interactions (Last 5m)</p>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">{interactions.length} Calls</span>
        </div>
        
        {interactions.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] p-20 text-center flex flex-col items-center gap-4 opacity-40 border border-dashed border-slate-300 dark:border-slate-700">
            <i className="fa-solid fa-microphone-slash text-4xl"></i>
            <p className="text-xs font-black uppercase tracking-widest">No recordings found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {interactions.map((call) => (
              <button
                key={call.id}
                onClick={() => handleSelectInteraction(call.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                  selectedId === call.id 
                  ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 text-white' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedId === call.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    <i className={`fa-solid ${call.direction === 'inbound' ? 'fa-arrow-down-long text-emerald-500' : 'fa-arrow-up-long text-blue-500'} text-xs`}></i>
                  </div>
                  <div>
                    <p className={`text-xs font-black tracking-tight ${selectedId === call.id ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {call.direction === 'inbound' ? 'Inbound' : 'Outbound'} • {call.ani || 'Unknown'}
                    </p>
                    <p className={`text-[10px] font-bold ${selectedId === call.id ? 'text-white/70' : 'text-slate-500'}`}>
                      {call.startTime}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-black ${selectedId === call.id ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {formatDuration(call.durationMs)}
                  </p>
                  <i className={`fa-solid fa-play text-[8px] mt-1 transition-transform group-hover:scale-125 ${selectedId === call.id ? 'text-white' : 'text-indigo-500'}`}></i>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-full lg:w-[400px]">
        <div className={`sticky top-0 bg-slate-50 dark:bg-slate-800/40 p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 transition-all ${selectedId ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none grayscale translate-y-4'}`}>
          <h3 className="text-[10px] font-black uppercase mb-6 text-slate-500 tracking-widest">Recording Player</h3>
          
          {selectedId ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                  <i className="fa-solid fa-compact-disc animate-spin-slow"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase text-slate-400">Selected Conversation</p>
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">{selectedId}</p>
                </div>
              </div>

              {loadingAudio && (
                <div className="py-10 text-center space-y-3">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[9px] font-black uppercase text-indigo-600 animate-pulse">Requesting Media Feed</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/20 text-center space-y-2">
                  <i className="fa-solid fa-lock text-red-500 text-xl"></i>
                  <p className="text-[10px] font-black uppercase text-red-600 leading-tight">{error}</p>
                </div>
              )}

              {audioUrl && !loadingAudio && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <audio key={audioUrl} controls className="w-full outline-none">
                    <source src={audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black uppercase text-slate-500 mb-2">Telephony Metadata</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                        <p className="text-[7px] font-bold text-slate-400">Status</p>
                        <p className="font-black text-emerald-500 uppercase">Authenticated</p>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                        <p className="text-[7px] font-bold text-slate-400">Codec</p>
                        <p className="font-black text-indigo-500 uppercase">MP3 Stream</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4 opacity-40">
              <i className="fa-solid fa-headphones text-4xl"></i>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Select interaction to play</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingsView;
