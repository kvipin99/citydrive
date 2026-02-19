export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Completed' | 'On Hold';
  registrationDate: string;
  avatarUrl: string;
  address?: string;
  guardianName?: string;
  aadharNo?: string;
  courses: string[];
  amount: number;
  discount: number;
  onlineAppNo?: string;
  learnersDate?: string;
  testDate?: string;
  remarks?: string;
};

export type Instructor = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  avatarUrl: string;
};

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  status: 'Available' | 'In Use' | 'Maintenance';
  nextService: string;
  imageUrl: string;
};

export type ScheduledClass = {
  id: string;
  studentName: string;
  instructorName: string;
  startTime: string;
  endTime: string;
  status: 'Scheduled' | 'Completed' | 'Canceled';
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  status: 'Paid' | 'Pending' | 'Overdue';
};

export const COURSE_PRICES: Record<string, number> = {
  "Basic Car (4-Wheeler)": 5000,
  "Advanced Car (4-Wheeler)": 8000,
  "Two-Wheeler (Bike)": 2500,
  "Heavy Vehicle": 12000,
  "Refresher Course": 3000
};

export const students: Student[] = [
  { 
    id: 'S001', 
    name: 'Liam Johnson', 
    email: 'liam.j@example.com', 
    phone: '555-0101', 
    status: 'Active', 
    registrationDate: '2023-01-15', 
    avatarUrl: 'https://picsum.photos/seed/S001/40/40',
    address: '123 Main St, Cityville',
    guardianName: 'Robert Johnson',
    aadharNo: '1234-5678-9012',
    courses: ['Basic Car (4-Wheeler)'],
    amount: 5000,
    discount: 500,
    onlineAppNo: 'APP-1001',
    learnersDate: '2023-01-20',
    testDate: '2023-03-15',
    remarks: 'Quick learner, needs more reverse parking practice.'
  },
  { 
    id: 'S002', 
    name: 'Olivia Smith', 
    email: 'olivia.s@example.com', 
    phone: '555-0102', 
    status: 'Active', 
    registrationDate: '2023-02-20', 
    avatarUrl: 'https://picsum.photos/seed/S002/40/40',
    address: '456 Oak Rd, Townsville',
    guardianName: 'Sarah Smith',
    aadharNo: '9876-5432-1098',
    courses: ['Two-Wheeler (Bike)', 'Basic Car (4-Wheeler)'],
    amount: 7500,
    discount: 0,
    onlineAppNo: 'APP-1002',
    learnersDate: '2023-02-25',
    testDate: '2023-04-10',
    remarks: 'Already knows bike, focused on car now.'
  },
];

export const instructors: Instructor[] = [
  { id: 'I01', name: 'Olivia Smith', email: 'olivia.s@citydriving.in', phone: '555-0201', vehicle: 'Toyota Corolla', status: 'Active', avatarUrl: 'https://picsum.photos/seed/I01/40/40' },
  { id: 'I02', name: 'Ethan Wilson', email: 'ethan.w@citydriving.in', phone: '555-0202', vehicle: 'Honda Civic', status: 'Active', avatarUrl: 'https://picsum.photos/seed/I02/40/40' },
  { id: 'I03', name: 'Noah Brown', email: 'noah.b@citydriving.in', phone: '555-0203', vehicle: 'Ford Focus', status: 'On Leave', avatarUrl: 'https://picsum.photos/seed/I03/40/40' },
];

export const vehicles: Vehicle[] = [
  { id: 'V01', make: 'Toyota', model: 'Corolla', year: 2022, licensePlate: 'DRV-123', status: 'Available', nextService: '2024-08-15', imageUrl: 'https://picsum.photos/seed/V01/80/50' },
  { id: 'V02', make: 'Honda', model: 'Civic', year: 2023, licensePlate: 'DRV-456', status: 'In Use', nextService: '2024-09-01', imageUrl: 'https://picsum.photos/seed/V02/80/50' },
  { id: 'V03', make: 'Ford', model: 'Focus', year: 2021, licensePlate: 'DRV-789', status: 'Maintenance', nextService: '2024-07-20', imageUrl: 'https://picsum.photos/seed/V03/80/50' },
];

export const schedule: ScheduledClass[] = [
  { id: 'C001', studentName: 'Liam Johnson', instructorName: 'Olivia Smith', startTime: '2024-07-29T09:00:00', endTime: '2024-07-29T10:00:00', status: 'Scheduled' },
  { id: 'C002', studentName: 'Emma Brown', instructorName: 'Ethan Wilson', startTime: '2024-07-29T10:00:00', endTime: '2024-07-29T11:00:00', status: 'Scheduled' },
  { id: 'C003', studentName: 'James Jones', instructorName: 'Olivia Smith', startTime: '2024-07-29T11:00:00', endTime: '2024-07-29T12:00:00', status: 'Scheduled' },
  { id: 'C004', studentName: 'Ava Garcia', instructorName: 'Ethan Wilson', startTime: '2024-07-30T14:00:00', endTime: '2024-07-30T15:00:00', status: 'Scheduled' },
  { id: 'C005', studentName: 'Mia Rodriguez', instructorName: 'Noah Brown', startTime: '2024-07-28T09:00:00', endTime: '2024-07-28T10:00:00', status: 'Completed' },
];

export const transactions: Transaction[] = [
    { id: 'T001', date: '2024-07-25', description: 'Payment from Liam Johnson', amount: 350, type: 'Income', status: 'Paid' },
    { id: 'T002', date: '2024-07-24', description: 'Fuel for Toyota Corolla', amount: 55, type: 'Expense', status: 'Paid' },
    { id: 'T003', date: '2024-07-22', description: 'Payment from Olivia Smith', amount: 350, type: 'Income', status: 'Pending' },
    { id: 'T004', date: '2024-07-21', description: 'Vehicle Maintenance - Honda Civic', amount: 250, type: 'Expense', status: 'Paid' },
    { id: 'T005', date: '2024-07-20', description: 'Instructor Salary - July', amount: 4000, type: 'Expense', status: 'Paid' },
];
