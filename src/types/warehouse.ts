export interface Warehouse {
  id: string;
  name: string;
  code: string;
  branchId: string;
  branchName?: string;
  address: string;
  state: string;
  city: string;
  pinCode: string;
  manager: string;
  contactNumber: string;
  email: string;
  status: 'Active' | 'Inactive';
  storageCapacity?: string;
  temperatureControlled?: boolean;
  createdAt: string;
  updatedAt: string;
}
