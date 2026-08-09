import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { attendance, staffProfiles, activityLogs } from '../db/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/attendance - Get attendance records
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const isAdmin = ['ADMIN', 'DEVELOPER'].includes(req.user.role);
    const { startDate, endDate, staffId } = req.query;

    let records: any[] = [];
    
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      
      if (staffId && isAdmin) {
        records = await db.select({
          id: attendance.id,
          staffId: attendance.staffId,
          staffName: staffProfiles.name,
          date: attendance.date,
          clockIn: attendance.clockIn,
          clockOut: attendance.clockOut,
          breakStart: attendance.breakStart,
          breakEnd: attendance.breakEnd,
          status: attendance.status,
          notes: attendance.notes,
          createdAt: attendance.createdAt,
        })
          .from(attendance)
          .leftJoin(staffProfiles, eq(attendance.staffId, staffProfiles.id))
          .where(and(
            eq(attendance.outletId, userOutletId),
            eq(attendance.staffId, staffId as string),
            gte(attendance.date, start),
            lte(attendance.date, end)
          ))
          .orderBy(desc(attendance.date));
      } else if (!isAdmin) {
        // Staff can only see their own attendance
        const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);
        
        if (staffProfile.length > 0) {
          records = await db.select({
            id: attendance.id,
            staffId: attendance.staffId,
            staffName: staffProfiles.name,
            date: attendance.date,
            clockIn: attendance.clockIn,
            clockOut: attendance.clockOut,
            breakStart: attendance.breakStart,
            breakEnd: attendance.breakEnd,
            status: attendance.status,
            notes: attendance.notes,
            createdAt: attendance.createdAt,
          })
            .from(attendance)
            .leftJoin(staffProfiles, eq(attendance.staffId, staffProfiles.id))
            .where(and(
              eq(attendance.outletId, userOutletId),
              eq(attendance.staffId, staffProfile[0].id),
              gte(attendance.date, start),
              lte(attendance.date, end)
            ))
            .orderBy(desc(attendance.date));
        } else {
          records = [];
        }
      } else {
        records = await db.select({
          id: attendance.id,
          staffId: attendance.staffId,
          staffName: staffProfiles.name,
          date: attendance.date,
          clockIn: attendance.clockIn,
          clockOut: attendance.clockOut,
          breakStart: attendance.breakStart,
          breakEnd: attendance.breakEnd,
          status: attendance.status,
          notes: attendance.notes,
          createdAt: attendance.createdAt,
        })
          .from(attendance)
          .leftJoin(staffProfiles, eq(attendance.staffId, staffProfiles.id))
          .where(and(
            eq(attendance.outletId, userOutletId),
            gte(attendance.date, start),
            lte(attendance.date, end)
          ))
          .orderBy(desc(attendance.date));
      }
    } else if (staffId && isAdmin) {
      records = await db.select({
        id: attendance.id,
        staffId: attendance.staffId,
        staffName: staffProfiles.name,
        date: attendance.date,
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        breakStart: attendance.breakStart,
        breakEnd: attendance.breakEnd,
        status: attendance.status,
        notes: attendance.notes,
        createdAt: attendance.createdAt,
      })
        .from(attendance)
        .leftJoin(staffProfiles, eq(attendance.staffId, staffProfiles.id))
        .where(and(
          eq(attendance.outletId, userOutletId),
          eq(attendance.staffId, staffId as string)
        ))
        .orderBy(desc(attendance.date));
    } else if (!isAdmin) {
      // Staff can only see their own attendance
      const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);
      
      if (staffProfile.length > 0) {
        records = await db.select({
          id: attendance.id,
          staffId: attendance.staffId,
          staffName: staffProfiles.name,
          date: attendance.date,
          clockIn: attendance.clockIn,
          clockOut: attendance.clockOut,
          breakStart: attendance.breakStart,
          breakEnd: attendance.breakEnd,
          status: attendance.status,
          notes: attendance.notes,
          createdAt: attendance.createdAt,
        })
          .from(attendance)
          .leftJoin(staffProfiles, eq(attendance.staffId, staffProfiles.id))
          .where(and(
            eq(attendance.outletId, userOutletId),
            eq(attendance.staffId, staffProfile[0].id)
          ))
          .orderBy(desc(attendance.date));
      } else {
        records = [];
      }
    } else {
      records = await db.select({
        id: attendance.id,
        staffId: attendance.staffId,
        staffName: staffProfiles.name,
        date: attendance.date,
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        breakStart: attendance.breakStart,
        breakEnd: attendance.breakEnd,
        status: attendance.status,
        notes: attendance.notes,
        createdAt: attendance.createdAt,
      })
        .from(attendance)
        .leftJoin(staffProfiles, eq(attendance.staffId, staffProfiles.id))
        .where(eq(attendance.outletId, userOutletId))
        .orderBy(desc(attendance.date));
    }

    res.json(records);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

// POST /api/attendance/clock-in - Clock in
router.post('/clock-in', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    
    // Get staff profile
    const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);

    if (!staffProfile.length) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already clocked in today
    const existingAttendance = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.staffId, staffProfile[0].id),
        gte(attendance.date, today)
      ))
      .limit(1);

    if (existingAttendance.length > 0 && existingAttendance[0].clockIn) {
      return res.status(400).json({ message: 'Already clocked in today' });
    }

    let attendanceRecord;
    if (existingAttendance.length > 0) {
      // Update existing record
      attendanceRecord = await db.update(attendance)
        .set({ clockIn: new Date() })
        .where(eq(attendance.id, existingAttendance[0].id))
        .returning();
    } else {
      // Create new record
      attendanceRecord = await db.insert(attendance).values({
        id: uuidv4(),
        staffId: staffProfile[0].id,
        outletId: userOutletId,
        date: new Date(),
        clockIn: new Date(),
        status: 'PRESENT',
      }).returning();
    }

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'CLOCK_IN',
      entityType: 'ATTENDANCE',
      entityId: attendanceRecord[0].id,
      details: {
        staffName: staffProfile[0].name,
      },
      outletId: userOutletId,
    });

    res.json(attendanceRecord[0]);
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ message: 'Failed to clock in' });
  }
});

// POST /api/attendance/clock-out - Clock out
router.post('/clock-out', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    
    // Get staff profile
    const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);

    if (!staffProfile.length) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's attendance
    const existingAttendance = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.staffId, staffProfile[0].id),
        gte(attendance.date, today)
      ))
      .limit(1);

    if (!existingAttendance.length || !existingAttendance[0].clockIn) {
      return res.status(400).json({ message: 'Must clock in first' });
    }

    if (existingAttendance[0].clockOut) {
      return res.status(400).json({ message: 'Already clocked out' });
    }

    // Update with clock out time
    const updatedAttendance = await db.update(attendance)
      .set({ clockOut: new Date() })
      .where(eq(attendance.id, existingAttendance[0].id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'CLOCK_OUT',
      entityType: 'ATTENDANCE',
      entityId: updatedAttendance[0].id,
      details: {
        staffName: staffProfile[0].name,
      },
      outletId: userOutletId,
    });

    res.json(updatedAttendance[0]);
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ message: 'Failed to clock out' });
  }
});

// POST /api/attendance/break-start - Start break
router.post('/break-start', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    
    // Get staff profile
    const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);

    if (!staffProfile.length) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's attendance
    const existingAttendance = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.staffId, staffProfile[0].id),
        gte(attendance.date, today)
      ))
      .limit(1);

    if (!existingAttendance.length || !existingAttendance[0].clockIn) {
      return res.status(400).json({ message: 'Must clock in first' });
    }

    if (existingAttendance[0].breakStart && !existingAttendance[0].breakEnd) {
      return res.status(400).json({ message: 'Already on break' });
    }

    // Update with break start time
    const updatedAttendance = await db.update(attendance)
      .set({ breakStart: new Date() })
      .where(eq(attendance.id, existingAttendance[0].id))
      .returning();

    res.json(updatedAttendance[0]);
  } catch (error) {
    console.error('Break start error:', error);
    res.status(500).json({ message: 'Failed to start break' });
  }
});

// POST /api/attendance/break-end - End break
router.post('/break-end', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    
    // Get staff profile
    const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);

    if (!staffProfile.length) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's attendance
    const existingAttendance = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.staffId, staffProfile[0].id),
        gte(attendance.date, today)
      ))
      .limit(1);

    if (!existingAttendance.length || !existingAttendance[0].breakStart) {
      return res.status(400).json({ message: 'Must start break first' });
    }

    if (existingAttendance[0].breakEnd) {
      return res.status(400).json({ message: 'Break already ended' });
    }

    // Update with break end time
    const updatedAttendance = await db.update(attendance)
      .set({ breakEnd: new Date() })
      .where(eq(attendance.id, existingAttendance[0].id))
      .returning();

    res.json(updatedAttendance[0]);
  } catch (error) {
    console.error('Break end error:', error);
    res.status(500).json({ message: 'Failed to end break' });
  }
});

export default router;