import { type MasterRecord, type Case } from '../types';
import { parse, addMinutes, format, isBefore, isAfter, differenceInMinutes, parseISO } from 'date-fns';

// Helper: Parse date formats commonly found
export function parseFuzzyDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try ISO parsing first
  const iso = parseISO(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  
  // Format like: "2026-03-01 10:15:30"
  let parsed = parse(dateStr.trim(), 'yyyy-MM-dd HH:mm:ss', new Date());
  if (!isNaN(parsed.getTime())) return parsed;
  
  // 13.01.2026 20:50
  parsed = parse(dateStr.trim(), 'dd.MM.yyyy HH:mm', new Date());
  if (!isNaN(parsed.getTime())) return parsed;
  parsed = parse(dateStr.trim(), 'dd.MM.yyyy HH:mm:ss', new Date());
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

export function formatSafeDate(d: Date | null): string {
  if (!d) return '';
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

export function randomizeHQCoordinate(lat: number, lng: number): string {
  // ~30-150m scatter
  const r = 30 + Math.random() * 120; // 30-150 meters
  const angle = Math.random() * 2 * Math.PI;
  const latOffset = (r / 111320) * Math.cos(angle);
  const lngOffset = (r / (111320 * Math.cos(lat * (Math.PI / 180)))) * Math.sin(angle);
  const newLat = (lat + latOffset).toFixed(6);
  const newLng = (lng + lngOffset).toFixed(6);
  return `${newLat} ${newLng}`;
}

export function analyzeAndPropose(
  records: MasterRecord[],
  caseInfo: Case
): MasterRecord[] {
  // Group by driver and license plate
  const drivers: Record<string, MasterRecord[]> = {};
  
  records.forEach(r => {
    const key = `${r.driverFirstName} ${r.driverLastName} - ${r.licensePlate}`;
    if (!drivers[key]) drivers[key] = [];
    drivers[key].push(r);
  });

  const updatedRecords: MasterRecord[] = [];

  Object.values(drivers).forEach(driverRecords => {
    // Filter out deleted records so they don't affect overlap checks or flow
    const activeRecords = driverRecords.filter(r => !r.isDeleted);

    // Sort chronologically by order time or dispatch time
    const sorted = activeRecords.sort((a, b) => {
      const dbA = parseFuzzyDate(a.dispatchTime || a.orderTime);
      const dbB = parseFuzzyDate(b.dispatchTime || b.orderTime);
      return (dbA?.getTime() || 0) - (dbB?.getTime() || 0);
    });

    let lastArrivalTime: Date | null = null;
    let lastDropoffAddress: string | null = null;

    sorted.forEach((rec, idx) => {
      let proposed = { ...rec };
      let actionOptions: any[] = [];
      
      const dispatchTime = parseFuzzyDate(rec.dispatchTime);
      const startTime = parseFuzzyDate(rec.startTime);

      // Edge Case 3: Stornos behalten, aber evtl als Lücke werten. Wir überspringen sie in der overlap logic.
      if (rec.isStorno) {
         updatedRecords.push(proposed);
         return;
      }

      // 0. Consistency check: arrivalTime must not be before startTime
      let currentStartTime = parseFuzzyDate(proposed.startTime);
      let currentArrivalTime = parseFuzzyDate(proposed.arrivalTime);
      
      if (currentStartTime && currentArrivalTime && isBefore(currentArrivalTime, currentStartTime)) {
        // Fix the inconsistency: set arrival time to 15 minutes after start time
        currentArrivalTime = addMinutes(currentStartTime, 15);
        const fixedArrivalTime = formatSafeDate(currentArrivalTime);
        proposed.arrivalTime = fixedArrivalTime;
        proposed.isModified = true;
        const fixMsg = 'Ankunftszeit korrigiert (lag vor Startzeit)';
        proposed.proposedFix = proposed.proposedFix ? proposed.proposedFix + ' | ' + fixMsg : fixMsg;
        
        actionOptions.push({
          id: 'fix_consistency',
          title: 'Zeit anpassen',
          description: fixMsg,
          changes: { arrivalTime: fixedArrivalTime }
        });
        actionOptions.push({
          id: 'del_consistency',
          title: 'Fahrt komplett löschen',
          description: 'Löscht die fehlerhafte Fahrt, da sie physikalisch unmöglich ist.',
          isDestructive: true,
          changes: { isDeleted: true }
        });
      }

      // 1. HQ-Zuweisung prüfen
      // Wenn es die erste Fahrt der Schicht ist ODER nach einer langen Lücke (>30 Min), 
      // soll der "Fahrzeugstandort bei Bestellzuweisung" auf HQ manipuliert werden.
      let needsHQPing = false;
      if (idx === 0) {
        needsHQPing = true;
      } else if (lastArrivalTime && dispatchTime) {
        const gap = differenceInMinutes(dispatchTime, lastArrivalTime);
        if (gap > 45) {
          needsHQPing = true;
        }
      }

      // 2. Überschneidungs-Verbot (Overlap)
      // Startzeit der Fahrt B darf niemals vor der Ankunftszeit der Fahrt A liegen.
      if (lastArrivalTime && currentStartTime && isBefore(currentStartTime, lastArrivalTime)) {
        // We have overlap! Need cascaded update suggestion
        // Start time should be slightly after last arrival
        const newStartTime = addMinutes(lastArrivalTime, 1 + Math.floor(Math.random() * 3));
        
        let originalDuration = 15;
        if (currentArrivalTime) {
          const duration = differenceInMinutes(currentArrivalTime, currentStartTime);
          if (duration > 0) {
            originalDuration = duration;
          }
        }
        
        const newArrivalTime = addMinutes(newStartTime, originalDuration);
        
        const fixedStartTime = formatSafeDate(newStartTime);
        const fixedArrivalTime = formatSafeDate(newArrivalTime);
        proposed.startTime = fixedStartTime;
        proposed.arrivalTime = fixedArrivalTime;
        proposed.isModified = true;
        proposed.proposedFix = (proposed.proposedFix ? proposed.proposedFix + ' | ' : '') + 'Überschneidung korrigiert (Startzeit nach vorheriger Ankunft verschoben)';
        
        actionOptions.push({
          id: 'fix_overlap',
          title: 'Zeiten überschreiben',
          description: 'Fahrt Start auf Zeitpunkt nach vorheriger Ankunft verlegen.',
          changes: { startTime: fixedStartTime, arrivalTime: fixedArrivalTime }
        });
        actionOptions.push({
          id: 'del_overlap',
          title: 'Fahrt komplett löschen',
          description: 'Diese in Konflikt stehende Fahrt (z.B. Duplikat) entfernen.',
          isDestructive: true,
          changes: { isDeleted: true }
        });

        // Update context for next iteration
        lastArrivalTime = newArrivalTime;
      } else {
        lastArrivalTime = parseFuzzyDate(proposed.arrivalTime) || parseFuzzyDate(proposed.startTime);
      }

      // Check HQ ping location
      if (needsHQPing) {
        const newHq = randomizeHQCoordinate(caseInfo.hqLat, caseInfo.hqLng);
        // Only modify if it doesn't already look like an HQ coordinate
        // (A deeper check could calculate distance to HQ and if > 150m, overwrite)
        proposed.hqLocationAtDispatch = newHq;
        proposed.isModified = true;
        proposed.proposedFix = (proposed.proposedFix ? proposed.proposedFix + ' | ' : '') + 'HQ-Standort für Bereitstellung zugewiesen';
        
        actionOptions.push({
           id: 'fix_hq',
           title: 'Auf HQ zwingen',
           description: 'Setzt den Standort auf den Haupt-Betriebssitz.',
           changes: { hqLocationAtDispatch: newHq }
        });
      }

      // 3. Rückkehrpflicht (Return Duty) check - PBefG §49 (4)
      let isEndOfShift = false;
      if (idx === sorted.length - 1) {
        isEndOfShift = true;
      } else {
        const nextRec = sorted[idx + 1];
        const nextDispatchTime = parseFuzzyDate(nextRec.dispatchTime || nextRec.orderTime);
        const currentArrival = lastArrivalTime || parseFuzzyDate(rec.arrivalTime);
        if (nextDispatchTime && currentArrival) {
          const gapToNext = differenceInMinutes(nextDispatchTime, currentArrival);
          if (gapToNext > 240) { // 4 hours defines a new shift block
            isEndOfShift = true;
          }
        }
      }

      if (isEndOfShift && proposed.dropoffAddress) {
        // Basic heuristic: check if dropoff matches HQ city
        const hqCity = caseInfo.hqAddress.split(/[\s,]+/)[0].toLowerCase(); // e.g. "Köln"
        const dropoff = proposed.dropoffAddress.toLowerCase();
        
        if (!dropoff.includes(hqCity) && !dropoff.includes('hq') && !dropoff.includes('betriebssitz')) {
          proposed.needsReturnDutyCheck = true;
          proposed.proposedReturnFix = 'Rückführung (Leerfahrt) zum Betriebssitz (PBefG §49) dokumentieren';
          proposed.isModified = true;
          proposed.proposedFix = (proposed.proposedFix ? proposed.proposedFix + ' | ' : '') + 'Rückkehrpflicht prüfen';
          
          actionOptions.push({
            id: 'ignore_return',
            title: 'Hinweis ignorieren',
            description: 'Fehlende Rückkehr für diesen Datensatz akzeptieren.',
            changes: { needsReturnDutyCheck: false, proposedReturnFix: undefined }
          });
        }
      }

      // Attach options to proposed
      if (actionOptions.length > 0) {
        proposed.actionOptions = actionOptions;
      }

      lastDropoffAddress = rec.dropoffAddress;
      updatedRecords.push(proposed);
    });
  });

  return updatedRecords; // Unsorted array, we can sort it globally later if needed
}
