# **App Name**: DriveFlow

## Core Features:

- User Authentication & Role-Based Access: Secure login with email/password for Admins, Instructors, and Accountants; ensures protected routes and role-specific dashboards with Firestore for role storage.
- Student & Instructor Management: Comprehensive tools to add, edit, delete (Admin-only), and view profiles for students and instructors, including student assignments, with data stored in Firestore.
- Vehicle & Class Scheduling: Manage vehicle fleet details (registration, insurance, service dates) and efficiently schedule driving classes, assigning students to instructors and tracking attendance in Firestore.
- Financial Accounting & Reporting: Track all payments, expenses, auto-calculate due amounts, and generate detailed financial reports (income, expenses, P&L) with PDF/CSV export capabilities from Firestore data.
- Admin Dashboard & Analytics: Centralized view for key metrics (total students, revenue, expenses, profit), upcoming classes, and interactive charts powered by Chart.js for data trend analysis.
- Cloud Backup & Restore System: An admin-only Cloud Function-driven system to manually trigger Firestore data backups to Google Drive in JSON format and facilitate data restoration from these backups using Google Drive API.
- AI-Driven Performance Insights Tool: A tool that processes operational and financial data from Firestore to generate natural language summaries of school performance, identifying key trends and suggesting actionable insights for administrators.

## Style Guidelines:

- Primary color: A vibrant yet professional blue-cyan (#22AAC3) to convey trust and efficiency for interactive elements and highlights.
- Background color: A very light, desaturated blue (#F4FAFC) derived from the primary hue, providing a clean and calming canvas for content.
- Accent color: A deep forest green (#118C52), analogous to the primary but distinct, used for positive actions, confirmations, or indicators of success.
- Body and headline font: 'Inter', a modern grotesque sans-serif, chosen for its neutral, objective, and highly readable characteristics, suitable for data-rich dashboards and detailed forms.
- Utilize modern, clean, line-style icons for navigation and actions, maintaining visual clarity across all sections of the application.
- Implement a modern admin panel layout featuring a clear sidebar navigation for intuitive access, fully mobile-responsive design, and a dark mode toggle for user preference.
- Incorporate subtle animations for feedback, such as toast notifications for system messages, loading skeletons for data fetching, and confirmation dialogs before critical actions.