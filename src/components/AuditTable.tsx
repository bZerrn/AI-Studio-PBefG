import { useState, useMemo, Fragment } from 'react';
import { type Case, type MasterRecord, type ActionOption } from '../types';
import { analyzeAndPropose, parseFuzzyDate } from '../lib/pbefgEngine';
import { extractDriverTimesheets, DriverTimesheet } from '../lib/arbzgEngine';
import { Settings2, Play, AlertTriangle, CheckCircle2, ChevronDown, Filter, FileText, TableProperties, MapPin, Trash2 } from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { useGeocodedAddress } from '../hooks/useGeocodedAddress';

function AddressDisplay({ coords }: { coords: string }) {
  const { address, isLoading } = useGeocodedAddress(coords);
  if (!coords) return <span>--</span>;
  if (isLoading) return <span className="opacity-50 animate-pulse">Lade Adresse...</span>;
  return (
    <div className="flex flex-col">
       <span className="text-text-main">{address}</span>
       <span className="text-[9px] text-text-dim font-mono">{coords}</span>
    </div>
  );
}

export default function AuditTable({ 
  currentCase, 
  onUpdateMultipleRecords 
}: { 
  currentCase: Case, 
  onUpdateMultipleRecords: (r: MasterRecord[]) => void 
}) {
  const [activeTab, setActiveTab] = useState<'audit' | 'timesheet'>('audit');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [showOnlyModified, setShowOnlyModified] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  
  // Settings for ArbZG calculation
  const [minijobDrivers, setMinijobDrivers] = useState<Record<string, boolean>>({});
  const [manualHours, setManualHours] = useState<Record<string, number>>({});

  const [editForm, setEditForm] = useState<{
    dispatchTime: string;
    startTime: string;
    arrivalTime: string;
    hqLocationAtDispatch: string;
  } | null>(null);

  const drivers = useMemo(() => {
    const list = Array.from(new Set(currentCase.records.map(r => `${r.driverFirstName} ${r.driverLastName}`.trim())));
    return list.filter(d => d.length > 0);
  }, [currentCase.records]);

  const handleRunAuditor = () => {
    const newRecords = analyzeAndPropose([...currentCase.records], currentCase);
    onUpdateMultipleRecords(newRecords);
    if (selectedRecordId) {
      const rec = newRecords.find(r => r.id === selectedRecordId);
      if (rec) updateEditForm(rec);
    }
  };

  const updateEditForm = (rec: MasterRecord) => {
    setEditForm({
        dispatchTime: rec.dispatchTime,
        startTime: rec.startTime,
        arrivalTime: rec.arrivalTime,
        hqLocationAtDispatch: rec.hqLocationAtDispatch
    });
  };

  const handleSelectRecord = (rec: MasterRecord) => {
     setSelectedRecordId(rec.id);
     updateEditForm(rec);
  };

  const handleApplyOption = (rec: MasterRecord, opt: ActionOption) => {
     const updated = {
       ...rec,
       ...opt.changes,
       actionOptions: [],
       isModified: true,
       proposedFix: rec.proposedFix ? `${rec.proposedFix} | Option: ${opt.title}` : `Aktion: ${opt.title}`
     };
     onUpdateMultipleRecords([updated]);
     if (opt.changes.isDeleted) {
       setSelectedRecordId(null);
     } else {
       updateEditForm(updated);
     }
  };

  const handleDeleteTrip = (rec: MasterRecord) => {
     const updated = { ...rec, isDeleted: true };
     onUpdateMultipleRecords([updated]);
     setSelectedRecordId(null);
  };

  const handleSaveManualEdit = () => {
     if (!selectedRecordId || !editForm) return;
     
     const originalRecord = currentCase.records.find(r => r.id === selectedRecordId);
     if (!originalRecord) return;

     // Check if times actually changed
     const timesChanged = 
       originalRecord.dispatchTime !== editForm.dispatchTime ||
       originalRecord.startTime !== editForm.startTime ||
       originalRecord.arrivalTime !== editForm.arrivalTime ||
       originalRecord.hqLocationAtDispatch !== editForm.hqLocationAtDispatch;

     if (!timesChanged) {
        // Nothing changed, no need to update
        return;
     }

     const updated = {
       ...originalRecord,
       ...editForm,
       isModified: true,
       // Append manual correction flag if not already there
       proposedFix: originalRecord.proposedFix 
         ? (originalRecord.proposedFix.includes('Manuell korrigiert') ? originalRecord.proposedFix : originalRecord.proposedFix + ' | Manuell korrigiert') 
         : 'Manuell korrigiert'
     };
     
     onUpdateMultipleRecords([updated]);
  };

  const groupedShifts = useMemo(() => {
    let recs = [...currentCase.records].filter(r => !r.isDeleted);
    if (selectedDriver !== 'all') {
      recs = recs.filter(r => `${r.driverFirstName} ${r.driverLastName}`.trim() === selectedDriver);
    }
    if (showOnlyModified) {
       recs = recs.filter(r => r.isModified || r.proposedFix);
    }

    // Group by driver first
    const byDriver: Record<string, MasterRecord[]> = {};
    recs.forEach(r => {
       const dName = `${r.driverFirstName} ${r.driverLastName}`.trim();
       if(!byDriver[dName]) byDriver[dName] = [];
       byDriver[dName].push(r);
    });

    const shifts: { driverName: string, id: string, records: MasterRecord[], startTime: Date | null, endTime: Date | null }[] = [];

    Object.keys(byDriver).forEach(dName => {
       const dRecs = byDriver[dName].sort((a,b) => {
         const da = parseFuzzyDate(a.dispatchTime || a.orderTime);
         const db = parseFuzzyDate(b.dispatchTime || b.orderTime);
         return (da?.getTime() || 0) - (db?.getTime() || 0);
       });

       let currentShift: MasterRecord[] = [];
       let lastDate: Date | null = null;

       dRecs.forEach(rec => {
          const recStart = parseFuzzyDate(rec.dispatchTime || rec.orderTime);
          if (!lastDate) {
            currentShift.push(rec);
          } else if (recStart) {
             const gap = differenceInMinutes(recStart, lastDate);
             if (gap > 240) { // 4 hours gap = new shift
                // Save old shift
                shifts.push({
                   driverName: dName,
                   id: `${dName}-${currentShift[0].id}`,
                   records: [...currentShift],
                   startTime: parseFuzzyDate(currentShift[0].dispatchTime || currentShift[0].orderTime),
                   endTime: parseFuzzyDate(currentShift[currentShift.length-1].arrivalTime || currentShift[currentShift.length-1].startTime)
                });
                currentShift = [rec];
             } else {
                currentShift.push(rec);
             }
          } else {
             currentShift.push(rec); // fallback
          }
          lastDate = parseFuzzyDate(rec.arrivalTime) || parseFuzzyDate(rec.startTime) || recStart || lastDate;
       });

       if (currentShift.length > 0) {
          shifts.push({
             driverName: dName,
             id: `${dName}-${currentShift[0].id}`,
             records: [...currentShift],
             startTime: parseFuzzyDate(currentShift[0].dispatchTime || currentShift[0].orderTime),
             endTime: parseFuzzyDate(currentShift[currentShift.length-1].arrivalTime || currentShift[currentShift.length-1].startTime)
          });
       }
    });

    // Sort shifts globally by start time
    return shifts.sort((a,b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));
  }, [currentCase.records, selectedDriver, showOnlyModified]);

  // Extract timesheets data (auto-calculates via arbzgEngine)
  const timesheetData = useMemo(() => {
     return extractDriverTimesheets(currentCase.records, minijobDrivers, manualHours);
  }, [currentCase.records, minijobDrivers, manualHours]);

  return (
    <div className="flex flex-col h-full m-4">
      
      {/* Module Tabs */}
      <div className="flex border-b border-white/10 mb-4 shrink-0">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center px-6 py-3 font-medium text-sm transition tracking-wide ${activeTab === 'audit' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-text-dim hover:text-white'}`}
        >
          <TableProperties className="w-4 h-4 mr-2" />
          PBefG Compliance-Prüfung
        </button>
        <button
          onClick={() => setActiveTab('timesheet')}
          className={`flex items-center px-6 py-3 font-medium text-sm transition tracking-wide ${activeTab === 'timesheet' ? 'text-warning border-b-2 border-warning bg-warning/5' : 'text-text-dim hover:text-white'}`}
        >
          <FileText className="w-4 h-4 mr-2" />
          ArbZG Stundenzettel
        </button>
      </div>

      <div className="flex h-full bg-surface border border-white/5 rounded-none overflow-hidden">
        
        {activeTab === 'audit' ? (
        <>
        <div className="flex flex-col flex-1 border-r border-white/5">
          {/* Toolbar */}
          <div className="bg-surface-bright border-b border-white/5 p-4 shrink-0 flex items-center justify-between">
            <div className="flex space-x-4 items-center">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-text-dim" />
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="bg-surface border border-white/10 text-text-main px-3 py-1.5 focus:border-accent font-mono text-xs rounded-none min-w-[200px]"
                >
                  <option value="all">Alle Fahrer</option>
                  {drivers.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              
              <label className="flex items-center space-x-2 text-[0.75rem] uppercase tracking-widest text-text-dim cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showOnlyModified}
                  onChange={(e) => setShowOnlyModified(e.target.checked)}
                  className="rounded border-white/10 text-accent focus:ring-accent"
                />
                <span>Nur problematische / korrigierte Zeilen (Audit)</span>
              </label>
            </div>

            <div>
              <button 
                onClick={handleRunAuditor}
                className="flex items-center px-4 py-2 bg-accent text-bg-app font-bold rounded-none text-sm hover:bg-white transition"
              >
                <Play className="w-4 h-4 mr-2" />
                PBefG KI-Prüfung ausführen
              </button>
            </div>
          </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[0.7rem] text-text-dim uppercase tracking-widest bg-surface-bright border-b border-white/5 sticky top-0 z-10 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
              <tr>
                <th className="px-4 py-3 font-normal">Fahrer</th>
                <th className="px-4 py-3 font-normal">Adresse (Von → Nach)</th>
                <th className="px-4 py-3 font-normal">Zeiten (Bestl. → Überm. → Start → Ende)</th>
                <th className="px-4 py-3 font-normal">HQ / Standort</th>
                <th className="px-4 py-3 font-normal w-[25%]">Vorschlag / Warnung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {groupedShifts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-dim uppercase tracking-widest text-[0.75rem]">
                    Keine Datensätze gefunden.
                  </td>
                </tr>
              )}
              {groupedShifts.map((shift) => (
                <Fragment key={shift.id}>
                  <tr className="bg-surface-bright/50">
                    <td colSpan={5} className="px-4 py-2 border-y border-white/5">
                      <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-widest text-text-main">
                        <div className="flex items-center space-x-4">
                          <span className="font-bold text-accent">{shift.driverName}</span>
                          <span className="text-text-dim">
                            Schicht: {shift.startTime ? format(shift.startTime, 'dd.MM.yyyy HH:mm') : 'Unbekannt'} - {shift.endTime ? format(shift.endTime, 'HH:mm') : 'Unbekannt'}
                          </span>
                        </div>
                        <span className="text-text-dim font-mono">{shift.records.length} Fahrten</span>
                      </div>
                    </td>
                  </tr>
                  {shift.records.map((rec) => {
                    const driverName = `${rec.driverFirstName} ${rec.driverLastName}`.trim();
                    const isDanger = rec.isModified && rec.proposedFix;
                    const isSelected = rec.id === selectedRecordId;
                    return (
                      <tr 
                        key={rec.id} 
                        onClick={() => handleSelectRecord(rec)}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                          isSelected ? 'bg-white/5 border-l-2 border-l-accent' : ''
                        } ${rec.isModified && !isSelected ? 'bg-danger/5' : ''}`}
                      >
                        <td className="px-4 py-3 min-w-[120px]">
                          <div className="flex flex-col">
                            <span className="font-medium text-text-main">{driverName}</span>
                            <span className="text-text-dim text-xs font-mono mt-0.5">{rec.licensePlate}</span>
                            {rec.isStorno && (
                              <span className="text-[10px] uppercase font-bold text-danger mt-1 inline-block bg-danger/10 border border-danger/20 px-1.5 py-0.5 rounded-none w-fit tracking-wider">Storno</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-text-dim max-w-[200px]">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-start">
                              <span className="text-text-main font-semibold mr-1 w-8">Von:</span>
                              <span className="truncate overflow-hidden" title={rec.pickupAddress}>{rec.pickupAddress || '--'}</span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-text-main font-semibold mr-1 w-8">Nach:</span>
                              <span className="truncate overflow-hidden" title={rec.dropoffAddress}>{rec.dropoffAddress || '--'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-mono text-[10.5px] text-text-dim whitespace-nowrap min-w-[180px]">
                          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 items-center">
                            <span className="text-text-main/50">Bestl:</span> <span>{formatSafeRender(rec.orderTime) || '--'}</span>
                            <span className="text-text-main/50">Überm:</span> <span>{formatSafeRender(rec.dispatchTime)}</span>
                            <span className="text-text-accent/90">Start:</span> 
                            <div className="flex items-center">
                              <span className="text-text-main">{formatSafeRender(rec.startTime)}</span>
                              {rec.isModified && rec.proposedFix?.includes('korrigiert') && (
                                <span className="ml-1.5 flex h-1.5 w-1.5 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger"></span>
                                </span>
                              )}
                            </div>
                            <span className="text-text-accent/90">Ende:</span> <span className="text-text-main">{formatSafeRender(rec.arrivalTime)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-text-dim truncate max-w-[120px]" title={rec.hqLocationAtDispatch}>
                          {rec.hqLocationAtDispatch ? <AddressDisplay coords={rec.hqLocationAtDispatch} /> : '--'}
                          {rec.isModified && rec.proposedFix?.includes('HQ-Standort') && (
                            <div className="text-success text-[10px] uppercase font-bold mt-1.5 flex items-center bg-success/10 border border-success/20 w-fit px-1.5 py-0.5 rounded-none tracking-wider">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Neu gesetzt
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isDanger ? (
                            <div className="text-danger text-[0.7rem] leading-[1.4] border-l-2 border-danger pl-2">
                              {rec.proposedFix}
                            </div>
                          ) : (
                            <span className="text-success text-[0.7rem] uppercase tracking-widest font-bold flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Ok
                            </span>
                          )}
                          {rec.needsReturnDutyCheck && (
                            <div className="text-accent text-[0.7rem] leading-[1.4] border-l-2 border-accent pl-2 mt-2">
                              {rec.proposedReturnFix}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        
      {/* Inspector Panel */}
      <div className="w-[300px] bg-surface-bright shrink-0 flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-serif text-accent flex items-center">
              <Settings2 className="w-4 h-4 mr-2" />
              Audit-Inspektor
            </h3>
          </div>
        
        <div className="flex-1 overflow-auto p-4">
          {selectedRecordId && editForm ? (
            <div className="space-y-4">
               <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-text-dim mb-1">Ausgewählte Fahrt</p>
                  <p className="text-text-main text-sm font-mono">{currentCase.records.find(r=>r.id===selectedRecordId)?.id}</p>
               </div>
               
               {currentCase.records.find(r=>r.id===selectedRecordId)?.proposedFix && (
                 <div className="bg-danger/5 border-l-2 border-danger p-3 mb-4">
                   <h4 className="text-[0.7rem] text-danger font-bold uppercase tracking-widest mb-1">Warnung / Vorschlag</h4>
                   <p className="text-[0.7rem] text-text-dim leading-relaxed">
                     {currentCase.records.find(r=>r.id===selectedRecordId)?.proposedFix}
                   </p>
                 </div>
               )}

               {(() => {
                 const currentRec = currentCase.records.find(r => r.id === selectedRecordId);
                 if (!currentRec) return null;

                 return (
                   <>
                     <div className="bg-bg-app border border-white/5 p-3 font-mono text-xs text-text-main space-y-2">
                        <div className="text-[0.65rem] uppercase font-sans tracking-widest text-text-dim mb-2 pb-2 border-b border-white/5 font-bold">Vorher / Nachher</div>
                        <div className="grid grid-cols-[80px_1fr] gap-x-2">
                           <span className="text-text-dim">Start:</span>
                           <span>{currentRec.originalData['Ankunftszeitpunkt'] || currentRec.originalData['Startzeit der Fahrt'] || '--'} <span className="text-accent ml-1">→ {currentRec.startTime}</span></span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-x-2">
                           <span className="text-text-dim">Ende:</span>
                           <span>{currentRec.originalData['Abschlusszeitpunkt'] || currentRec.originalData['Ankunftszeit der Fahrt'] || '--'} <span className="text-accent ml-1">→ {currentRec.arrivalTime}</span></span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr] gap-x-2 items-start">
                           <span className="text-text-dim">Standort:</span>
                           <span className="flex flex-col space-y-1">
                              <span>
                                 {currentRec.originalData['Standort des Fahrzeugs bei Auftragsuebermittlung'] || currentRec.originalData['Fahrzeugstandort bei Bestellzuweisung'] || '--'}
                              </span>
                              <span className="text-accent">→ {currentRec.hqLocationAtDispatch}</span>
                           </span>
                        </div>
                        
                        <div className="flex pt-2 mt-2 border-t border-white/5">
                            <span className="text-text-dim w-[80px]">Adresse:</span>
                            <div className="flex-1">
                               <AddressDisplay coords={currentRec.hqLocationAtDispatch} />
                            </div>
                        </div>
                     </div>

                     {/* AKTIONEN / OPTIONEN */}
                     {currentRec.actionOptions && currentRec.actionOptions.length > 0 && (
                       <div className="pt-2">
                          <h4 className="text-[0.65rem] uppercase tracking-widest text-text-dim mb-2 font-bold">Lösungsoptionen</h4>
                          <div className="space-y-2">
                            {currentRec.actionOptions.map(opt => (
                               <button 
                                 key={opt.id}
                                 onClick={() => handleApplyOption(currentRec, opt)}
                                 className={`w-full text-left p-2 border transition-colors ${
                                    opt.isDestructive 
                                      ? 'border-danger/30 hover:bg-danger/10 hover:border-danger bg-bg-app'
                                      : 'border-accent/30 hover:bg-accent/10 hover:border-accent bg-bg-app'
                                 }`}
                               >
                                 <div className={`text-xs font-bold ${opt.isDestructive ? 'text-danger' : 'text-accent'}`}>{opt.title}</div>
                                 <div className="text-[10px] text-text-dim mt-0.5 leading-tight">{opt.description}</div>
                               </button>
                            ))}
                          </div>
                       </div>
                     )}

                     {/* MANUELLES LÖSCHEN */}
                     <div className="pt-4 border-t border-white/5">
                        <button
                          onClick={() => handleDeleteTrip(currentRec)}
                          className="flex items-center justify-center w-full p-2 border border-danger text-danger text-xs hover:bg-danger hover:text-bg-app transition-colors font-bold uppercase tracking-widest"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Fahrt manuell löschen
                        </button>
                     </div>
                   </>
                 );
               })()}

            </div>
          ) : (
            <p className="text-[0.7rem] text-text-dim/50 text-center uppercase tracking-widest mt-12">
              Kein Eintrag ausgewählt
            </p>
          )}
        </div>
      </div>
      </>
      ) : (
      /* TIMESHEET TAB CONTENT */
      <div className="flex flex-col flex-1 overflow-auto bg-surface p-6">
         <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif italic text-xl text-warning">ArbZG Stundenzettel & Schicht-Protokoll</h2>
            <div className="text-sm text-text-dim max-w-sm text-right">
              Hier werden die Schichten aller Fahrer gemäß ArbZG-Vorgaben (Pausenabzug, Tageshöchstgrenze) rekonstruiert. 
              <br/>Lücke von {'>'}120 Min = Neue Schicht.
            </div>
         </div>

         {timesheetData.map(ts => (
            <div key={ts.driverName} className="mb-8 border border-white/10 bg-surface-bright/20 p-4">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                 <div>
                   <h3 className="text-lg font-bold text-text-main flex items-center">
                     {ts.driverName}
                     {ts.isMinijob && <span className="ml-3 text-[10px] uppercase bg-warning/20 text-warning px-2 py-0.5 rounded-full border border-warning/30">Minijob</span>}
                   </h3>
                   <div className="flex space-x-6 mt-2 text-xs font-mono text-text-dim">
                     <span>Total Netto: <strong className={ts.totalNetMinutes > ts.monthlyLimitMinutes ? 'text-danger' : 'text-success'}>{(ts.totalNetMinutes/60).toFixed(1)}h</strong> / {(ts.monthlyLimitMinutes/60).toFixed(1)}h</span>
                     <span>Anzahl Schichten: {ts.shifts.length}</span>
                   </div>
                 </div>

                 <div className="flex items-center space-x-4 bg-surface p-3 border border-white/5">
                   <label className="flex items-center space-x-2 text-xs text-text-main cursor-pointer tracking-wide">
                     <input 
                       type="checkbox" 
                       checked={ts.isMinijob}
                       onChange={e => setMinijobDrivers(prev => ({...prev, [ts.driverName]: e.target.checked}))}
                       className="rounded text-warning focus:ring-warning border-white/20 bg-surface-bright"
                     />
                     <span>Minijob-Regel</span>
                   </label>
                   <div className="flex items-center space-x-2">
                     <label className="text-xs text-text-dim tracking-wide">Std. Monat:</label>
                     <input 
                       type="number"
                       value={manualHours[ts.driverName] || (ts.isMinijob ? 42 : 160)}
                       onChange={e => setManualHours(prev => ({...prev, [ts.driverName]: parseFloat(e.target.value) || 0}))}
                       className="w-16 bg-bg-app border border-white/10 text-text-main px-2 py-1 text-xs font-mono focus:border-warning outline-none text-right"
                     />
                   </div>
                 </div>
              </div>

              {ts.warnings.length > 0 && (
                <div className="mb-4 bg-danger/5 border-l-2 border-danger p-3 space-y-1">
                   {ts.warnings.map((w, idx) => (
                     <div key={idx} className="text-xs text-danger tracking-wide flex items-start">
                       <AlertTriangle className="w-3.5 h-3.5 mr-2 shrink-0 mt-0.5" /> {w}
                     </div>
                   ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                   <thead className="text-[10px] text-text-dim uppercase tracking-widest border-b border-white/5">
                     <tr>
                       <th className="px-3 py-2 font-normal">Datum</th>
                       <th className="px-3 py-2 font-normal">Schicht</th>
                       <th className="px-3 py-2 font-normal">Gesamt (Brutto)</th>
                       <th className="px-3 py-2 font-normal text-warning">Pause (Abzug)</th>
                       <th className="px-3 py-2 font-normal text-success">Netto-Arbeitszeit</th>
                       <th className="px-3 py-2 font-normal">Auffälligkeiten</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5 font-mono">
                     {ts.shifts.map((s, idx) => (
                       <tr key={`${s.startTime?.getTime()}-${idx}`} className="hover:bg-white/5 transition-colors">
                         <td className="px-3 py-2">{s.startTime ? format(s.startTime, 'dd.MM.yyyy') : '--'}</td>
                         <td className="px-3 py-2 font-bold text-text-main">
                           {s.startTime ? formatSafeRender(s.startTime.toISOString()).split('T')[1] : '--'}
                           <span className="text-text-dim mx-1 font-normal">bis</span>
                           {s.endTime ? formatSafeRender(s.endTime.toISOString()).split('T')[1] : '--'}
                         </td>
                         <td className="px-3 py-2">{Math.floor(s.grossDurationMinutes/60)}h {s.grossDurationMinutes%60}m</td>
                         <td className="px-3 py-2 text-warning/80">-{s.breakValidationMinutes} Min {s.breakValidationMinutes === 0 ? '(keine)' : ''}</td>
                         <td className="px-3 py-2 text-success/90 font-bold">{Math.floor(s.netDurationMinutes/60)}h {s.netDurationMinutes%60}m</td>
                         <td className="px-3 py-2 text-[10px] uppercase text-danger">
                           {s.warnings.map(w => <div key={w}>{w}</div>)}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            </div>
         ))}
      </div>
      )}
    </div>
  </div>
  );
}

function formatSafeRender(str: string) {
  if (!str) return '--';
  // Strip fractional seconds if they exist from older imports or format errors (.000)
  return str.replace(/\.\d{1,4}(Z)?$/i, '');
}
