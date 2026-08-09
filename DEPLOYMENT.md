# Dayang Spa Resto - Deployment Guide

## Project Status: ✅ READY FOR DEPLOYMENT

### Build Status
- ✅ Client build: SUCCESS (dist/ folder created)
- ✅ Server build: SUCCESS (dist/ folder created)
- ✅ TypeScript checks: PASSING
- ✅ All features implemented

## Quick Start

### 1. Database Setup

You need a PostgreSQL database. Options:
- **Supabase** (Recommended): https://supabase.com
- **Neon**: https://neon.tech
- **Vercel Postgres**: https://vercel.com/postgres
- **Railway**: https://railway.app

### 2. Environment Variables

#### Server (.env)
```env
DATABASE_URL=postgres://username:password@host:5432/database_name
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=production
PORT=3001
```

#### Client (.env)
```env
VITE_API_URL=https://your-api-domain.com/api
```

### 3. Database Migration

```bash
# From server directory
cd server
npm run migrate
npm run seed
```

### 4. Deploy to Vercel

#### Option A: Deploy as Monorepo (Recommended)

1. Push to GitHub:
```bash
git add .
git commit -m "Initial production deployment"
git push origin main
```

2. In Vercel:
   - Import repository
   - Vercel will auto-detect `vercel.json`
   - Add environment variables:
     - `DATABASE_URL`
     - `JWT_SECRET`
     - `NODE_ENV=production`
   - Deploy

#### Option B: Deploy Separately

**Backend (Server):**
1. Deploy `server/` to Vercel as a separate project
2. Set environment variables
3. Note the API URL

**Frontend (Client):**
1. Deploy `client/` to Vercel as a separate project
2. Set `VITE_API_URL` to your backend URL
3. Deploy

### 5. Post-Deployment

1. Run database migrations on production database
2. Seed initial data (optional, for testing)
3. Test login with default credentials:
   - Developer: `developer` / `developer123`
   - Admin: `admin` / `admin123`
   - Staff: `rizal` / `staff123`

## Default Credentials (After Seeding)

| Role | Username | Password |
|------|----------|----------|
| Developer | developer | developer123 |
| Admin | admin | admin123 |
| Staff | rizal | staff123 |

## Project Structure

```
dayang-spa-resto/
├── client/                 # React frontend
│   ├── dist/              # Built static files
│   └── src/
│       ├── pages/         # All page components
│       ├── components/    # Reusable components
│       ├── services/      # API service
│       └── stores/        # State management
├── server/                # Express backend
│   ├── dist/              # Compiled server
│   └── src/
│       ├── db/           # Database schema & migrations
│       ├── middleware/    # Auth middleware
│       └── routes/        # API routes
├── vercel.json           # Vercel configuration
└── README.md            # Full documentation
```

## Features Implemented

### Authentication & Authorization
- ✅ JWT-based authentication
- ✅ Role-based access control (STAFF, ADMIN, DEVELOPER)
- ✅ Password hashing with bcrypt
- ✅ Protected API routes

### Core Features
- ✅ Dashboard with real-time statistics
- ✅ Booking management with conflict prevention
- ✅ Staff management & status tracking
- ✅ Treatment management
- ✅ Attendance system (clock in/out, breaks)
- ✅ Inventory management with CSV import
- ✅ Internal chat system
- ✅ Announcements system
- ✅ Notifications
- ✅ Activity logs
- ✅ System settings

### Database
- ✅ 15+ tables with proper relationships
- ✅ Indexes for performance
- ✅ Foreign key constraints
- ✅ Seed data for testing

## API Endpoints

### Public
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Protected (Requires Authentication)
- `GET /api/auth/me` - Get current user
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/staff-status` - Staff status
- `GET /api/dashboard/next-bookings` - Upcoming bookings
- `GET /api/dashboard/activity` - Activity feed
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create booking
- `PATCH /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/available-therapists` - Get available therapists
- `GET /api/staff` - Get all staff
- `POST /api/staff` - Create staff
- `PATCH /api/staff/:id/status` - Update staff status
- `GET /api/treatments` - Get treatments
- `POST /api/treatments` - Create treatment
- `GET /api/attendance` - Get attendance
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `GET /api/inventory` - Get inventory
- `POST /api/inventory/import` - Import CSV
- `GET /api/chat/conversations` - Get conversations
- `POST /api/chat/conversations` - Create conversation
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement

## Troubleshooting

### Build Errors

**Client build fails with "Cannot find module 'vite'":**
```bash
cd client
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Server build fails with missing modules:**
```bash
cd server
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Issues

1. Verify DATABASE_URL is correct
2. Check database is running
3. Ensure database user has proper permissions
4. Run migrations: `npm run migrate`

### Vercel Deployment Issues

1. Ensure `vercel.json` is in root directory
2. Check all environment variables are set
3. Verify build commands in package.json
4. Check Vercel logs for specific errors

## Production Checklist

- [ ] Database created and accessible
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Database seeded (optional)
- [ ] Client build successful
- [ ] Server build successful
- [ ] Deployed to Vercel
- [ ] Login tested with all roles
- [ ] Features tested:
  - [ ] Booking creation
  - [ ] Staff status updates
  - [ ] Attendance clock in/out
  - [ ] Inventory import
  - [ ] Chat functionality
  - [ ] Announcements

## Support

For issues or questions:
1. Check README.md for detailed documentation
2. Review API endpoint documentation
3. Check database schema in `server/src/db/schema.ts`

## License

Proprietary - All rights reserved