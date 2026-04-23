import React, { useState } from 'react';
import { type Case } from '../types';
import { X, MapPin } from 'lucide-react';

export default function CaseSetupModal({ 
  onClose, 
  onCreate 
}: { 
  onClose: () => void;
  onCreate: (c: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'records'>) => void;
}) {
  const [name, setName] = useState('');
  const [hqAddress, setHqAddress] = useState('');
  const [hqLat, setHqLat] = useState('');
  const [hqLng, setHqLng] = useState('');
  const [controlTime, setControlTime] = useState('');
  const [controlLocation, setControlLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hqLat || !hqLng) return;
    
    onCreate({
      name,
      hqAddress,
      hqLat: parseFloat(hqLat),
      hqLng: parseFloat(hqLng),
      controlTime,
      controlLocation
    });
  };

  return (
    <div className="fixed inset-0 bg-bg-app/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-white/5 max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-serif italic text-accent">Neuen Audit-Fall anlegen</h2>
          <button onClick={onClose} className="text-text-dim hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[0.7rem] uppercase tracking-widest text-text-dim mb-2">Unternehmensname *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Test GmbH"
              className="w-full px-3 py-2 bg-surface-bright border border-white/10 text-text-main text-sm focus:border-accent focus:outline-none placeholder:text-text-dim/50"
            />
          </div>
          
          <div>
            <label className="block text-[0.7rem] uppercase tracking-widest text-text-dim mb-2">Betriebssitz (HQ Adresse)</label>
            <input
              type="text"
              value={hqAddress}
              onChange={(e) => setHqAddress(e.target.value)}
              placeholder="Straße, PLZ Ort"
              className="w-full px-3 py-2 bg-surface-bright border border-white/10 text-text-main text-sm focus:border-accent focus:outline-none placeholder:text-text-dim/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.7rem] uppercase tracking-widest text-text-dim mb-2">HQ Latitude *</label>
              <input
                required
                type="number"
                step="any"
                value={hqLat}
                onChange={(e) => setHqLat(e.target.value)}
                placeholder="z.B. 50.9375"
                className="w-full px-3 py-2 bg-surface-bright border border-white/10 text-text-main font-mono text-sm focus:border-accent focus:outline-none placeholder:text-text-dim/50"
              />
            </div>
            <div>
              <label className="block text-[0.7rem] uppercase tracking-widest text-text-dim mb-2">HQ Longitude *</label>
              <input
                required
                type="number"
                step="any"
                value={hqLng}
                onChange={(e) => setHqLng(e.target.value)}
                placeholder="z.B. 6.9603"
                className="w-full px-3 py-2 bg-surface-bright border border-white/10 text-text-main font-mono text-sm focus:border-accent focus:outline-none placeholder:text-text-dim/50"
              />
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/5">
            <h4 className="text-[0.75rem] uppercase tracking-widest text-accent mb-3 flex items-center">
              <MapPin className="w-3 h-3 mr-2" /> Behördliche Kontrolle (Optional)
            </h4>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-[0.65rem] uppercase tracking-widest text-text-dim mb-2">Kontroll-Zeitpunkt</label>
                <input
                  type="datetime-local"
                  value={controlTime}
                  onChange={(e) => setControlTime(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-bright border border-white/10 text-text-main text-sm focus:border-accent focus:outline-none"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-[0.65rem] uppercase tracking-widest text-text-dim mb-2">Kontroll-Ort</label>
                <input
                  type="text"
                  value={controlLocation}
                  onChange={(e) => setControlLocation(e.target.value)}
                  placeholder="z.B. Leverkusen"
                  className="w-full px-3 py-2 bg-surface-bright border border-white/10 text-text-main text-sm focus:border-accent focus:outline-none placeholder:text-text-dim/50"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-dim hover:text-white transition text-sm"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-bg-app font-bold text-sm hover:bg-white transition"
            >
              Fall erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
