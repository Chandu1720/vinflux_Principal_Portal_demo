export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  state: string;
  city: string;
  pinCode: string;
  manager: string;
  contactNumber: string;
  email: string;
  status: 'Active' | 'Inactive';
  activeWarehousesCount?: number;
  createdAt: string;
  updatedAt: string;
}
