export interface Case {
  id: string;
  name: string;
  hqAddress: string;
  hqLat: number;
  hqLng: number;
  driverName?: string;
  licensePlate?: string;
  controlTime?: string;
  controlLocation?: string;
  createdAt: number;
  updatedAt: number;
  records: MasterRecord[];
  originalFormat?: 'uber' | 'new' | 'unknown';
  originalHeaders?: string[];
}

export interface ActionOption {
  id: string;
  title: string;
  description: string;
  changes: Partial<MasterRecord>;
  isDestructive?: boolean;
}

export interface MasterRecord {
  id: string;
  // Standardized fields
  driverFirstName: string;
  driverLastName: string;
  licensePlate: string;
  orderTime: string; // ISO DateTime
  arrivalTime: string; // ISO DateTime
  pickupAddress: string;
  dropoffAddress: string;
  distance: string;
  status: string;
  dispatchTime: string; // ISO DateTime
  startTime: string; // ISO DateTime
  hqLocationAtDispatch: string; // "Lat Lng" or similar
  price: string;
  productType: string;
  totalPrice?: string;
  paymentType?: string;
  
  // Custom / Audited flags
  isModified: boolean;
  isStorno: boolean;
  isDeleted?: boolean;
  proposedFix?: string;
  actionOptions?: ActionOption[];
  needsReturnDutyCheck?: boolean;
  proposedReturnFix?: string;
  originalData: any; // Keep origin JSON for export
}
