# Dayang Spa Resto - Internal Management System

A comprehensive internal management system for Dayang Spa Resto, built with React, TypeScript, Express, and PostgreSQL.

## Features

### Role-Based Access Control
- **STAFF**: View dashboard, manage availability, receive notifications, access chat
- **ADMIN**: Full booking management, staff management, attendance, inventory, announcements
- **DEVELOPER**: All ADMIN features plus user management, outlet management, system settings

### Core Features
- 📊 **Dashboard**: Real-time stats, staff status, upcoming bookings, activity feed
- 📅 **Booking Management**: Create, edit, cancel bookings with conflict prevention
- 👥 **Staff Management**: Manage staff profiles, status, and availability
- ⏰ **Attendance**: Clock in/out, break management
- 💆 **Treatment Management**: Define treatments with pricing and commissions
- 📦 **Inventory**: Track inventory with CSV import support
- 💬 **Chat**: Internal messaging system
- 📢 **Announcements**: Create and manage announcements
- 🔔 **Notifications**: Real-time notifications for staff
- 📈 **Activity Logs**: Track all system activities

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Axios for API calls
- Lucide React for icons

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database
- Drizzle ORM
- JWT authentication
- bcrypt for password hashing

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

## Environment Variables

### Server (.env)
```env
DATABASE_URL=postgres://username:password@host:5432/database
JWT_SECRET=your-jwt-secret-key
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3001/api
```

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd dayang-spa-resto
```

### 2. Install dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Set up the database
```bash
# From the root directory, run migrations
cd server
npm run migrate

# Seed the database with initial data
npm run seed
```

### 4. Start the development server
```bash
# From the root directory
npm run dev
```

This will start:
- Backend server at http://localhost:3001
- Frontend dev server at http://localhost:5173

## Default Login Credentials

After seeding the database, you can log in with:

- **Developer**: username: `developer`, password: `developer123`
- **Admin**: username: `admin`, password: `admin123`
- **Staff**: username: `rizal`, password: `staff123`

## Project Structure

```
dayang-spa-resto/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── stores/        # State management
│   │   └── App.tsx        # Main app component
│   └── package.json
├── server/                 # Backend Express server
│   ├── src/
│   │   ├── db/            # Database configuration and schema
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/        # API routes
│   │   └── index.ts       # Server entry point
│   └── package.json
├── shared/                 # Shared types and utilities
├── package.json           # Root package.json (monorepo)
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get single booking
- `POST /api/bookings` - Create booking
- `PATCH /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/available-therapists` - Get available therapists

### Staff
- `GET /api/staff` - Get all staff
- `GET /api/staff/:id` - Get single staff
- `POST /api/staff` - Create staff
- `PATCH /api/staff/:id` - Update staff
- `PATCH /api/staff/:id/status` - Update staff status
- `DELETE /api/staff/:id` - Deactivate staff

### Treatments
- `GET /api/treatments` - Get all treatments
- `GET /api/treatments/:id` - Get single treatment
- `POST /api/treatments` - Create treatment
- `PATCH /api/treatments/:id` - Update treatment
- `DELETE /api/treatments/:id` - Deactivate treatment

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `POST /api/attendance/break-start` - Start break
- `POST /api/attendance/break-end` - End break

### Inventory
- `GET /api/inventory` - Get inventory items
- `POST /api/inventory` - Create inventory item
- `PATCH /api/inventory/:id` - Update inventory item
- `POST /api/inventory/import` - Import CSV
- `GET /api/inventory/imports` - Get import history

### Chat
- `GET /api/chat/conversations` - Get conversations
- `GET /api/chat/conversations/:id/messages` - Get messages
- `POST /api/chat/conversations/:id/messages` - Send message
- `POST /api/chat/conversations` - Create conversation

### Announcements
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement
- `PATCH /api/announcements/:id` - Update announcement
- `DELETE /api/announcements/:id` - Delete announcement
- `POST /api/announcements/:id/read` - Mark as read

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/staff-status` - Get staff status
- `GET /api/dashboard/next-bookings` - Get upcoming bookings
- `GET /api/dashboard/activity` - Get recent activity

## Database Schema

### Main Tables
- `users` - User accounts
- `staff_profiles` - Staff information
- `outlets` - Spa outlets/locations
- `bookings` - Treatment bookings
- `treatments` - Treatment master data
- `staff_status` - Current staff status
- `attendance` - Attendance records
- `inventory` - Inventory items
- `notifications` - User notifications
- `announcements` - System announcements
- `chat_conversations` - Chat conversations
- `chat_messages` - Chat messages
- `activity_logs` - System activity logs

## Deployment

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Import your GitHub repository in Vercel
   - Configure environment variables:
     - `DATABASE_URL` - Your PostgreSQL connection string
     - `JWT_SECRET` - A secure random string for JWT signing
     - `CLIENT_URL` - Your Vercel frontend URL
   - Vercel will automatically detect the configuration and deploy

3. **Database Setup**
   - Use a PostgreSQL provider like Supabase, Neon, or Vercel Postgres
   - Run migrations: `npm run migrate`
   - Seed database: `npm run seed`

### Environment Variables for Production

#### Server
```env
DATABASE_URL=postgres://user:pass@host:5432/db
JWT_SECRET=your-production-secret-key
NODE_ENV=production
CLIENT_URL=https://your-app.vercel.app
```

#### Client
```env
VITE_API_URL=https://your-api.vercel.app/api
```

## Build Commands

```bash
# Install all dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Run tests (if configured)
npm test
```

## Scripts

### Root
- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm run typecheck` - Run TypeScript type checking

### Server
- `npm run dev` - Start server in development mode
- `npm run build` - Build server
- `npm run start` - Start server in production mode
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database
- `npm run db:push` - Push schema changes to database

### Client
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

Proprietary - All rights reserved

## Support

For support, email support@dayangspa.com or create an issue in the repository.