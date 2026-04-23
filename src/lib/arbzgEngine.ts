import { differenceInMinutes, parseISO, isAfter, isBefore } from 'date-fns';
import { MasterRecord } from '../types';
import { parseFuzzyDate } from './pbefgEngine';

export interface ShiftInfo {
  id: string;
  driverName: string;
  records: MasterRecord[];
  startTime: Date | null;
  endTime: Date | null;
  grossDurationMinutes: number;
  breakValidationMinutes: number;
  netDurationMinutes: number;
  warnings: string[];
}

export interface DriverTimesheet {
  driverName: string;
  shifts: ShiftInfo[];
  totalNetMinutes: number;
  monthlyLimitMinutes: number;
  isMinijob: boolean;
  warnings: string[];
}

export function extractDriverTimesheets(records: MasterRecord[], minijobDrivers: Record<string, boolean>, manualHours: Record<string, number>): DriverTimesheet[] {
  const byDriver: Record<string, MasterRecord[]> = {};
  
  // 1. Group records by driver (exclude deleted)
  records.filter(r => !r.isDeleted).forEach(r => {
    const dName = `${r.driverFirstName} ${r.driverLastName}`.trim();
    if (!byDriver[dName]) byDriver[dName] = [];
    byDriver[dName].push(r);
  });

  const timesheets: DriverTimesheet[] = [];

  Object.keys(byDriver).forEach(dName => {
    // Sort chronologically
    const dRecs = byDriver[dName].sort((a,b) => {
      const da = parseFuzzyDate(a.startTime || a.dispatchTime || a.orderTime);
      const db = parseFuzzyDate(b.startTime || b.dispatchTime || b.orderTime);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

    const shifts: ShiftInfo[] = [];
    let currentShiftBlock: MasterRecord[] = [];
    let lastDate: Date | null = null;
    
    // 2. Identify Shifts (>120min gap = new shift)
    dRecs.forEach(rec => {
       const recStart = parseFuzzyDate(rec.dispatchTime || rec.orderTime || rec.startTime);
       if (!lastDate) {
         currentShiftBlock.push(rec);
       } else if (recStart) {
         const gap = differenceInMinutes(recStart, lastDate);
         if (gap > 120) {
            // Save completed shift block
            shifts.push(calculateShiftInfo(dName, currentShiftBlock));
            currentShiftBlock = [rec];
         } else {
            currentShiftBlock.push(rec);
         }
       } else {
         currentShiftBlock.push(rec);
       }
       lastDate = parseFuzzyDate(rec.arrivalTime) || parseFuzzyDate(rec.startTime) || recStart || lastDate;
    });

    if (currentShiftBlock.length > 0) {
      shifts.push(calculateShiftInfo(dName, currentShiftBlock));
    }

    // 3. Aggregate Driver Info
    let totalNetMinutes = 0;
    const tsWarnings: string[] = [];
    
    shifts.forEach(s => {
      totalNetMinutes += s.netDurationMinutes;
      if (s.netDurationMinutes > 10 * 60) {
        tsWarnings.push(`Schicht am ${s.startTime?.toLocaleDateString()} überschreitet 10h max`);
      } else if (s.netDurationMinutes < 7 * 60 || s.netDurationMinutes > 9 * 60) {
        // Optional warning for deviation from 7-9h ideal
        // We might not flag it strictly as error, but just info. For now, skip to reduce noise 
        // or add it as a light warning.
      }
    });

    const isMinijob = minijobDrivers[dName] || false;
    // Standard limit: Volltzeit ~ 160h. Minijob = 42h.
    let monthlyLimitMinutes = isMinijob ? 42 * 60 : 160 * 60;
    if (manualHours[dName]) {
      monthlyLimitMinutes = manualHours[dName] * 60;
    }

    if (totalNetMinutes > monthlyLimitMinutes) {
      tsWarnings.push(`Monatliches Stundenlimit überschritten! (${Math.round(totalNetMinutes/60)}h > ${Math.round(monthlyLimitMinutes/60)}h)`);
    }

    timesheets.push({
      driverName: dName,
      shifts,
      totalNetMinutes,
      monthlyLimitMinutes,
      isMinijob,
      warnings: tsWarnings
    });
  });

  return timesheets;
}

function calculateShiftInfo(driverName: string, records: MasterRecord[]): ShiftInfo {
  const startTime = parseFuzzyDate(records[0].dispatchTime || records[0].orderTime || records[0].startTime);
  const endTime = parseFuzzyDate(records[records.length - 1].arrivalTime || records[records.length - 1].startTime);
  
  let grossDurationMinutes = 0;
  if (startTime && endTime) {
    grossDurationMinutes = Math.max(0, differenceInMinutes(endTime, startTime));
  }
  
  // ArbZG Rule:
  // > 9h (540m) = 45 min
  // > 6h (360m) = 30 min
  let breakValidationMinutes = 0;
  if (grossDurationMinutes > 540) {
    breakValidationMinutes = 45;
  } else if (grossDurationMinutes > 360) {
    breakValidationMinutes = 30;
  }
  
  const netDurationMinutes = Math.max(0, grossDurationMinutes - breakValidationMinutes);
  const warnings: string[] = [];
  
  if (netDurationMinutes > 10 * 60) {
    warnings.push('Tageshöchstarbeitszeit (>10h) überschritten!');
  }

  return {
    id: `${driverName}-${records[0].id}`,
    driverName,
    records,
    startTime,
    endTime,
    grossDurationMinutes,
    breakValidationMinutes,
    netDurationMinutes,
    warnings
  };
}
