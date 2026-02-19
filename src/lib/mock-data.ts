export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Completed' | 'On Hold';
  registrationDate: string;
  avatarUrl: string;
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

export const students: Student[] = [
  { id: 'S001', name: 'Liam Johnson', email: 'liam.j@example.com', phone: '555-0101', status: 'Active', registrationDate: '2023-01-15', avatarUrl: 'https://picsum.photos/seed/S001/40/40' },
  { id: 'S002', name: 'Olivia Smith', email: 'olivia.s@example.com', phone: '555-0102', status: 'Active', registrationDate: '2023-02-20', avatarUrl: 'https://picsum.photos/seed/S002/40/40' },
  { id: 'S003', name: 'Noah Williams', email: 'noah.w@example.com', phone: '555-0103', status: 'Completed', registrationDate: '2022-11-10', avatarUrl: 'https://picsum.photos/seed/S003/40/40' },
  { id: 'S004', name: 'Emma Brown', email: 'emma.b@example.com', phone: '555-0104', status: 'On Hold', registrationDate: '2023-03-05', avatarUrl: 'https://picsum.photos/seed/S004/40/40' },
  { id: 'S005', name: 'James Jones', email: 'james.j@example.com', phone: '555-0105', status: 'Active', registrationDate: '2023-04-12', avatarUrl: 'https://picsum.photos/seed/S005/40/40' },
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
