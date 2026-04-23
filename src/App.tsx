/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Disclaimer from './components/Disclaimer';
import CaseDashboard from './components/CaseDashboard';
import AuditWorkspace from './components/AuditWorkspace';
import localforage from 'localforage';
import { ShieldAlert, CarTaxiFront } from 'lucide-react';

export default function App() {
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState<boolean | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  useEffect(() => {
    const accepted = localStorage.getItem('pbefg_disclaimer_accepted');
    setHasAcceptedDisclaimer(accepted === 'true');
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('pbefg_disclaimer_accepted', 'true');
    setHasAcceptedDisclaimer(true);
  };

  if (hasAcceptedDisclaimer === null) {
    return <div className="flex items-center justify-center min-h-screen bg-bg-app text-text-dim">Lade...</div>;
  }

  if (!hasAcceptedDisclaimer) {
    return <Disclaimer onAccept={handleAcceptDisclaimer} />;
  }

  return (
    <div className="min-h-screen bg-bg-app flex flex-col font-sans text-text-main">
      <header className="bg-surface border-b border-white/5 p-4 flex items-center shrink-0">
        <CarTaxiFront className="w-6 h-6 mr-3 text-accent" />
        <h1 className="text-xl font-serif italic text-accent tracking-wider">PBefG Compliance Auditor</h1>
        <div className="ml-auto flex items-center text-[0.75rem] uppercase tracking-widest text-text-dim space-x-2">
          <ShieldAlert className="w-4 h-4" />
          <span>Local Consultant Edition</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-auto">
        {activeCaseId ? (
          <AuditWorkspace caseId={activeCaseId} onBack={() => setActiveCaseId(null)} />
        ) : (
          <CaseDashboard onOpenCase={setActiveCaseId} />
        )}
      </main>
    </div>
  );
}
