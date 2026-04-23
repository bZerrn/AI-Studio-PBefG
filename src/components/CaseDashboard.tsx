import { useState, useEffect } from 'react';
import localforage from 'localforage';
import { type Case } from '../types';
import { Plus, FolderOpen, Clock, Building2, MapPin } from 'lucide-react';
import CaseSetupModal from './CaseSetupModal';

export default function CaseDashboard({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const keys = await localforage.keys();
      const caseKeys = keys.filter(k => k.startsWith('case_'));
      const loadedCases: Case[] = [];
      for (const key of caseKeys) {
        const c = await localforage.getItem<Case>(key);
        if (c) loadedCases.push(c);
      }
      setCases(loadedCases.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {
      console.error("Failed to load cases", e);
    }
  };

  const handleCreateCase = async (newCase: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'records'>) => {
    const id = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullCase: Case = {
      ...newCase,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      records: [],
    };
    await localforage.setItem(id, fullCase);
    setIsSetupOpen(false);
    onOpenCase(id);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-serif text-text-main italic text-accent tracking-wide">Meine Audit-Fälle</h2>
          <p className="text-text-dim text-[0.75rem] uppercase tracking-widest mt-1">Lokal gespeicherte Projekte zur PBefG-Prüfung</p>
        </div>
        <button
          onClick={() => setIsSetupOpen(true)}
          className="flex items-center px-4 py-2 bg-surface-bright text-accent border border-white/5 hover:border-accent/30 transition text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neuer Fall
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cases.map((c) => (
          <div
            key={c.id}
            onClick={() => onOpenCase(c.id)}
            className="cursor-pointer bg-surface p-6 border border-white/5 hover:border-white/20 transition-colors group flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-accent">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="text-[0.75rem] text-text-dim flex items-center font-mono">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(c.updatedAt).toLocaleDateString()}
              </div>
            </div>
            
            <h3 className="font-serif text-lg text-text-main mb-1">{c.name}</h3>
            
            <div className="mt-4 space-y-2 text-[0.75rem] text-text-dim uppercase tracking-wider">
              <div className="flex items-start">
                <Building2 className="w-4 h-4 mr-2 mt-0.5 opacity-50" />
                <span className="truncate">{c.hqAddress || 'Keine HQ Adresse hinterlegt'}</span>
              </div>
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 opacity-50" />
                <span className="truncate font-mono">{c.hqLat}, {c.hqLng}</span>
              </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-sm">
              <span className="text-text-dim font-mono text-xs">{c.records.length} Einträge</span>
              <span className="text-accent font-medium group-hover:text-white transition-colors">Öffnen →</span>
            </div>
          </div>
        ))}
        {cases.length === 0 && (
          <div className="col-span-full py-16 text-center border border-white/5 border-dashed bg-surface">
            <FolderOpen className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-text-dim text-sm uppercase tracking-widest">Keine Fälle gefunden.</p>
            <p className="text-xs text-text-dim/50 mt-1">Erstellen Sie einen neuen Fall, um zu beginnen.</p>
          </div>
        )}
      </div>

      {isSetupOpen && (
        <CaseSetupModal
          onClose={() => setIsSetupOpen(false)}
          onCreate={handleCreateCase}
        />
      )}
    </div>
  );
}
