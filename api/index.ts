import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDB } from '../server/src/db/index.js';
import authRoutes from '../server/src/routes/auth.js';
import userRoutes from '../server/src/routes/users.js';
import staffRoutes from '../server/src/routes/staff.js';
import bookingRoutes from '../server/src/routes/bookings.js';
import treatmentRoutes from '../server/src/routes/treatments.js';
import attendanceRoutes from '../server/src/routes/attendance.js';
import inventoryRoutes from '../server/src/routes/inventory.js';
import notificationRoutes from '../server/src/routes/notifications.js';
import announcementRoutes from '../server/src/routes/announcements.js';
import chatRoutes from '../server/src/routes/chat.js';
import outletRoutes from '../server/src/routes/outlets.js';
import dashboardRoutes from '../server/src/routes/dashboard.js';
import settingsRoutes from '../server/src/routes/settings.js';
import pushRoutes from '../server/src/routes/push.js';
import commissionRoutes from '../server/src/routes/commissions.js';
import settlementRoutes from '../server/src/routes/settlements.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/settlements', settlementRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Initialize database connection
connectDB().catch((error) => {
  console.error('Failed to connect to database:', error);
});

export default app;