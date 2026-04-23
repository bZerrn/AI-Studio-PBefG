import { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

export default function Disclaimer({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 bg-bg-app flex items-center justify-center p-4">
      <div className="bg-surface border border-white/5 max-w-xl w-full p-8">
        <div className="flex items-center space-x-4 mb-6 text-accent">
          <Shield className="w-10 h-10" />
          <h2 className="text-2xl font-serif italic text-accent tracking-wide">Datenschutz & Compliance Scanner</h2>
        </div>

        <div className="bg-[#1a1608] border border-[#3d300b] text-[#b89c4d] p-4 text-[0.7rem] leading-relaxed mb-6">
          <div className="flex items-start mb-2 font-semibold">
            <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
            <p>Pflicht-Disclaimer (Consultant Edition)</p>
          </div>
          <p className="mb-2">
            Diese Anwendung verarbeitet personenbezogene Daten (Standorte, Fahrer, Kennzeichen).
            Die finale Verantwortung für die datenschutzkonforme Verarbeitung liegt beim Unternehmer.
          </p>
          <p className="mb-2">
            Die Software dient ausschließlich der Unterstützung bei der rechtssicheren Rekonstruktion von
            Fahrtenbüchern und der Prüfung auf Compliance gemäß § 49 Abs. 4 PBefG (Rückkehrpflicht).
          </p>
          <p className="mb-2 font-bold">Alle Daten werden nach dem Export aus dem Programm entfernt und nicht dauerhaft gespeichert.</p>
        </div>

        <label className="flex items-start space-x-3 cursor-pointer p-4 bg-surface-bright border border-white/5 hover:border-white/10 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 rounded border-white/10 bg-surface accent-accent"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span className="text-[0.8rem] text-text-dim">
            Ich habe den Hinweis gelesen und bestätige, dass ich zur Verarbeitung der hochgeladenen Fahrtenbuch-Daten berechtigt bin.
          </span>
        </label>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onAccept}
            disabled={!checked}
            className={`px-6 py-2.5 font-bold text-sm transition-all ${
              checked 
                ? 'bg-accent text-bg-app hover:bg-white' 
                : 'bg-surface-bright text-text-dim cursor-not-allowed border border-white/5'
            }`}
          >
            Zustimmen & Fortfahren
          </button>
        </div>
      </div>
    </div>
  );
}
