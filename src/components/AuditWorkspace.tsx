import { useState, useEffect } from 'react';
import localforage from 'localforage';
import { type Case, type MasterRecord } from '../types';
import { ArrowLeft, UploadCloud, Save, Download, RefreshCw } from 'lucide-react';
import DataUploader from './DataUploader';
import AuditTable from './AuditTable';
import * as xlsx from 'xlsx';

export default function AuditWorkspace({ caseId, onBack }: { caseId: string, onBack: () => void }) {
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    const c = await localforage.getItem<Case>(caseId);
    if (c) setCurrentCase(c);
  };

  const handleDataLoaded = async (records: MasterRecord[], formatInfo: { format: 'uber'|'new', headers: string[] }) => {
    if (!currentCase) return;
    const updated = { 
      ...currentCase, 
      records, 
      originalFormat: formatInfo.format, 
      originalHeaders: formatInfo.headers,
      updatedAt: Date.now() 
    };
    setCurrentCase(updated);
    await localforage.setItem(caseId, updated);
  };

  const handleUpdateRecord = async (updatedRecord: MasterRecord) => {
    if (!currentCase) return;
    const updatedRecords = currentCase.records.map(r => r.id === updatedRecord.id ? updatedRecord : r);
    const updated = { ...currentCase, records: updatedRecords, updatedAt: Date.now() };
    setCurrentCase(updated);
    await localforage.setItem(caseId, updated);
  };

  const handleUpdateMultipleRecords = async (updatedRecords: MasterRecord[]) => {
    if (!currentCase) return;
    const recordsMap = new Map(updatedRecords.map(r => [r.id, r]));
    const newRecords = currentCase.records.map(r => recordsMap.has(r.id) ? recordsMap.get(r.id)! : r);
    
    // Sort array just in case
    const updated = { ...currentCase, records: newRecords, updatedAt: Date.now() };
    setCurrentCase(updated);
    await localforage.setItem(caseId, updated);
  };

  const handleExport = () => {
    if (!currentCase || currentCase.records.length === 0) return;
    
    const isUber = currentCase.originalFormat === 'uber';
    
    // Reconstruction based on original headers
    const exportData = currentCase.records.map(r => {
      // Create a fresh object based on original data
      const out: any = { ...r.originalData };
      
      // Override with master data where applicable
      if (isUber) {
        out['Startzeit der Fahrt'] = r.startTime;
        out['Ankunftszeit der Fahrt'] = r.arrivalTime;
        out['Zeitpunkt der Bestellübermittlung'] = r.dispatchTime;
        out['Fahrzeugstandort bei Bestellzuweisung'] = r.hqLocationAtDispatch;
      } else {
        out['Uhrzeit des Fahrtbeginns'] = r.startTime;
        out['Uhrzeit des Fahrtendes'] = r.arrivalTime;
        out['Uhrzeit der Auftragsuebermittlung'] = r.dispatchTime;
        out['Standort des Fahrzeugs bei Auftragsuebermittlung'] = r.hqLocationAtDispatch;
      }
      
      // Ensure specific column order if known, otherwise we just trust XLSX to maintain keys 
      // from the first row and we use originalData structure.
      return out;
    });

    // Create workbook
    const ws = xlsx.utils.json_to_sheet(exportData);
    
    // Create audit log sheet
    const auditData = currentCase.records.filter(r => r.isModified).map(r => ({
      Fahrer: `${r.driverFirstName} ${r.driverLastName}`,
      Kennzeichen: r.licensePlate,
      Bestellzeit: r.dispatchTime,
      Geändert: r.proposedFix
    }));
    
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Fahrten_korrigiert");
    
    if (auditData.length > 0) {
      const wsAudit = xlsx.utils.json_to_sheet(auditData);
      xlsx.utils.book_append_sheet(wb, wsAudit, "Audit_Log_Intern");
    }

    // Attempt to prompt download
    const filename = `Compliance_Export_${currentCase.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    xlsx.writeFile(wb, filename);
  };

  if (!currentCase) return <div className="p-8">Lade Fall...</div>;

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-bg-app">
      {/* Top Toolbar */}
      <div className="bg-surface border-b border-white/5 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 text-text-dim hover:text-white hover:bg-surface-bright transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-serif italic text-accent text-lg tracking-wide">{currentCase.name}</h2>
            <div className="text-[0.65rem] uppercase tracking-widest text-text-dim flex space-x-3 mt-1">
              <span>HQ: <span className="font-mono">{currentCase.hqLat}, {currentCase.hqLng}</span></span>
              {currentCase.controlTime && <span className="text-warning">Kontrolle: <span className="font-mono">{new Date(currentCase.controlTime).toLocaleString()}</span></span>}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           {isSaving && <span className="text-[0.7rem] uppercase tracking-widest text-text-dim flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Speichere...</span>}
           {currentCase.records.length > 0 && (
             <button onClick={handleExport} className="flex items-center px-4 py-2 bg-surface-bright text-accent border border-white/10 hover:border-accent/40 transition text-xs uppercase tracking-widest">
               <Download className="w-4 h-4 mr-2" />
               Exportieren (.xlsx)
             </button>
           )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {currentCase.records.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <DataUploader onDataLoaded={handleDataLoaded} currentCase={currentCase} />
          </div>
        ) : (
          <AuditTable currentCase={currentCase} onUpdateMultipleRecords={handleUpdateMultipleRecords} />
        )}
      </div>
    </div>
  );
}
