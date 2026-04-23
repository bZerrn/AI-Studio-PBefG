import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { UploadCloud, FileType, AlertCircle } from 'lucide-react';
import { type MasterRecord, type Case } from '../types';
import { format as dateFnsFormat } from 'date-fns';

export default function DataUploader({ 
  onDataLoaded, 
  currentCase 
}: { 
  onDataLoaded: (records: MasterRecord[], formatInfo: { format: 'uber'|'new', headers: string[] }) => void,
  currentCase: Case
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      if (file.name.endsWith('.csv')) {
        await processCSV(file);
      } else if (file.name.endsWith('.xlsx')) {
        await processExcel(file);
      } else {
        setError("Bitte nur CSV oder XLSX Dateien hochladen.");
      }
    } catch (err: any) {
      setError(err.message || "Fehler beim Verarbeiten der Datei.");
    } finally {
      setIsLoading(false);
    }
  };

  const processCSV = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const { records, format, headers } = mapToMaster(results.data, results.meta.fields || []);
            onDataLoaded(records, { format, headers });
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });
  };

  const processExcel = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = xlsx.read(data, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Convert to JSON with headers
    const json = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
    if (json.length === 0) throw new Error("Leere Excel-Datei.");
    
    // Get headers
    const headers = Object.keys(json[0] as object);
    const { records, format } = mapToMaster(json, headers);
    onDataLoaded(records, { format, headers });
  };

  const handleLoadDemo = () => {
    setIsLoading(true);
    setTimeout(() => {
      const demoData = [
        {
          "Vorname des Fahrers": "Max",
          "Nachname des Fahrers": "Mustermann",
          "Kennzeichen": "K-UX 4022",
          "Zeitpunkt der Fahrtbestellung": "2026-01-13 14:00:00",
          "Ankunftszeit der Fahrt": "2026-01-13 14:20:00",
          "Abholadresse": "Neumarkt 1, Köln",
          "Zieladresse": "Flughafen CGN",
          "Fahrtdistanz": "14.5",
          "Fahrtstatus": "completed",
          "Zeitpunkt der Bestellübermittlung": "2026-01-13 14:02:00",
          "Startzeit der Fahrt": "2026-01-13 14:05:00",
          "Fahrzeugstandort bei Bestellzuweisung": "50.9385 6.9440",
          "Fahrpreis (Änderungen aufgrund von Anpassungen nach der Fahrt vorbehalten)": "35.50",
          "Produkttyp": "UberX",
          "Gesamtfahrpreis für den Fahrgast": "35.50",
          "Zahlungsart": "Card"
        },
        {
           "Vorname des Fahrers": "Max",
           "Nachname des Fahrers": "Mustermann",
           "Kennzeichen": "K-UX 4022",
           "Zeitpunkt der Fahrtbestellung": "2026-01-13 15:45:00",
           "Ankunftszeit der Fahrt": "2026-01-13 16:10:00",
           "Abholadresse": "Bonn Hbf",
           "Zieladresse": "Kennedyallee, Bonn",
           "Fahrtdistanz": "4.2",
           "Fahrtstatus": "completed",
           "Zeitpunkt der Bestellübermittlung": "2026-01-13 15:46:00",
           "Startzeit der Fahrt": "2026-01-13 15:50:00",
           "Fahrzeugstandort bei Bestellzuweisung": "50.7320 7.0970", // Verstoß: Nicht HQ!
           "Fahrpreis (Änderungen aufgrund von Anpassungen nach der Fahrt vorbehalten)": "12.00",
           "Produkttyp": "UberX",
           "Gesamtfahrpreis für den Fahrgast": "12.00",
           "Zahlungsart": "Cash"
        },
        {
           "Vorname des Fahrers": "Max",
           "Nachname des Fahrers": "Mustermann",
           "Kennzeichen": "K-UX 4022",
           "Zeitpunkt der Fahrtbestellung": "2026-01-13 16:05:00",
           "Ankunftszeit der Fahrt": "2026-01-13 16:30:00",
           "Abholadresse": "Kennedyallee, Bonn",
           "Zieladresse": "Köln Hbf",
           "Fahrtdistanz": "28.5",
           "Fahrtstatus": "completed",
           "Zeitpunkt der Bestellübermittlung": "2026-01-13 16:08:00", // Vor Ankunft der vorherigen Fahrt! -> Anschluss
           "Startzeit der Fahrt": "2026-01-13 16:09:00", // Überschneidung! Muss korrigiert werden!
           "Fahrzeugstandort bei Bestellzuweisung": "50.7100 7.1350",
           "Fahrpreis (Änderungen aufgrund von Anpassungen nach der Fahrt vorbehalten)": "55.00",
           "Produkttyp": "UberX",
           "Gesamtfahrpreis für den Fahrgast": "55.00",
           "Zahlungsart": "Card"
        }
      ];
      const headers = Object.keys(demoData[0]);
      const { records, format } = mapToMaster(demoData, headers);
      onDataLoaded(records, { format, headers });
      setIsLoading(false);
    }, 500);
  };

  const mapToMaster = (data: any[], headers: string[]): { records: MasterRecord[], format: 'uber'|'new', headers: string[] } => {
    const isUber = headers.includes('Fahrzeugstandort bei Bestellzuweisung');
    const isNew = headers.includes('Standort des Fahrzeugs bei Auftragsuebermittlung');

    if (!isUber && !isNew) {
      throw new Error("Dateiformat nicht erkannt. Es wird das Uber-Format oder das neue Fahrtenbuch-Format benötigt.");
    }

    const format = isUber ? 'uber' : 'new';
    
    // helper to format dates from excel to string if needed
    const safeString = (val: any) => {
      if (val instanceof Date) {
        return dateFnsFormat(val, 'yyyy-MM-dd HH:mm:ss');
      }
      let str = val ? String(val).trim() : '';
      // Strip trailing milliseconds (.SSS) to strictly maintain 6-digit times (HH:mm:ss) 
      if (str.match(/\.\d{1,3}$/)) {
        str = str.replace(/\.\d{1,3}$/, '');
      }
      return str;
    };

    const records: MasterRecord[] = data.map((row, idx) => {
      if (isUber) {
        return {
          id: `rec_${idx}`,
          driverFirstName: safeString(row['Vorname des Fahrers']),
          driverLastName: safeString(row['Nachname des Fahrers']),
          licensePlate: safeString(row['Kennzeichen']),
          orderTime: safeString(row['Zeitpunkt der Fahrtbestellung']),
          arrivalTime: safeString(row['Ankunftszeit der Fahrt']),
          pickupAddress: safeString(row['Abholadresse']),
          dropoffAddress: safeString(row['Zieladresse']),
          distance: safeString(row['Fahrtdistanz']),
          status: safeString(row['Fahrtstatus']),
          dispatchTime: safeString(row['Zeitpunkt der Bestellübermittlung']),
          startTime: safeString(row['Startzeit der Fahrt']),
          hqLocationAtDispatch: safeString(row['Fahrzeugstandort bei Bestellzuweisung']),
          price: safeString(row['Fahrpreis (Änderungen aufgrund von Anpassungen nach der Fahrt vorbehalten)']),
          productType: safeString(row['Produkttyp']),
          totalPrice: safeString(row['Gesamtfahrpreis für den Fahrgast']),
          paymentType: safeString(row['Zahlungsart']),
          isModified: false,
          isStorno: ['rider_cancelled', 'unfulfilled', 'storno'].some(s => safeString(row['Fahrtstatus']).toLowerCase().includes(s)),
          originalData: row
        };
      } else {
        // New format mapping (Adjustments according to "2026-03-01_2026-04-01_Fahrtenbuch_....xlsx")
        // "Datum/Uhrzeit Auftragseingang", "Uhrzeit der Auftragsuebermittlung", "Datum der Fahrt"
        // "Standort des Fahrzeugs bei Auftragsuebermittlung", "Uhrzeit des Fahrtbeginns", "Uhrzeit des Fahrtendes"
        return {
          id: `rec_${idx}`,
          driverFirstName: safeString(row['Fahrername'])?.split(' ')[0] || '',
          driverLastName: safeString(row['Fahrername'])?.split(' ').slice(1).join(' ') || '',
          licensePlate: safeString(row['Kennzeichen']),
          orderTime: safeString(row['Datum/Uhrzeit Auftragseingang']),
          arrivalTime: safeString(row['Uhrzeit des Fahrtendes']),
          pickupAddress: safeString(row['Abholort']),
          dropoffAddress: safeString(row['Zielort']),
          distance: safeString(row['Kilometer']),
          status: safeString(row['Fahrtstatus']),
          dispatchTime: safeString(row['Uhrzeit der Auftragsuebermittlung']),
          startTime: safeString(row['Uhrzeit des Fahrtbeginns']),
          hqLocationAtDispatch: safeString(row['Standort des Fahrzeugs bei Auftragsuebermittlung']),
          price: safeString(row['Fahrpreis']),
          productType: safeString(row['Fahrzeugtyp']),
          paymentType: safeString(row['payment_type']),
          totalPrice: safeString(row['Fahrpreis']), // proxy if missing
          isModified: false,
          isStorno: ['cancelled', 'storno', 'abgebrochen'].some(s => safeString(row['Fahrtstatus']).toLowerCase().includes(s)),
          originalData: row
        };
      }
    });

    return { records, format, headers };
  };

  return (
    <div className="w-full max-w-2xl">
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`bg-surface border border-white/5 hover:border-white/20 p-12 text-center rounded-none transition-all ${
          isDragOver ? 'border-accent bg-surface-bright' : ''
        }`}
      >
        <div className="w-16 h-16 text-accent flex items-center justify-center mx-auto mb-4">
          <FileType className="w-10 h-10" />
        </div>
        <h3 className="text-text-main font-serif text-xl mb-2">Fahrtenbuch hochladen</h3>
        <p className="text-text-dim text-sm mb-6 max-w-md mx-auto">
          Ziehen Sie eine CSV oder Excel-Datei (.xlsx) hierher oder klicken Sie auf Durchsuchen.
          Das System erkennt das Uber-Format und das neue Fahrtbuch-Format automatisch.
        </p>
        
        <input 
          type="file" 
          id="file-upload" 
          accept=".csv, .xlsx" 
          className="hidden" 
          onChange={handleFileSelect}
        />
        <label 
          htmlFor="file-upload" 
          className="inline-flex items-center px-6 py-3 bg-surface-bright text-accent border border-white/10 hover:border-accent/40 rounded-none text-sm cursor-pointer transition"
        >
          {isLoading ? (
            <span className="flex items-center">Lädt...</span>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 mr-2" />
              Datei auswählen
            </>
          )}
        </label>
        
        {error && (
          <div className="mt-6 p-4 bg-danger/10 text-danger border border-danger/20 rounded-none flex items-start text-sm text-left">
            <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
      {/* Context hints based on case */}
      <div className="mt-8 bg-surface border border-white/5 text-text-dim p-5 rounded-none text-sm shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-serif text-text-main">Automatisierte Erkennung:</h4>
          <button 
            type="button" 
            onClick={handleLoadDemo}
            className="text-[0.65rem] uppercase tracking-widest text-accent hover:text-white transition"
          >
            Demo-Datensatz laden
          </button>
        </div>
        <ul className="space-y-2 list-disc pl-4 opacity-80">
          <li>Fahrer & Schicht-Blöcke (zeitlich gruppiert)</li>
          <li>Format-Mapping (Originalspalten bleiben für Export erhalten)</li>
          <li>PBefG-Verstöße (Rückkehrpflicht, Leerzeiten, Überschneidungen)</li>
        </ul>
      </div>
    </div>
  );
}
