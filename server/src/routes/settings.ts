import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { outlets, activityLogs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication and DEVELOPER role
router.use(authenticate, authorize('DEVELOPER'));

// GET /api/settings - Get system settings
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    
    const outlet = await db.select()
      .from(outlets)
      .where(eq(outlets.id, userOutletId))
      .limit(1);

    if (!outlet.length) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    res.json({
      outletName: outlet[0].name,
      outletAddress: outlet[0].address,
      outletPhone: outlet[0].phone,
      operatingHours: '09:00 - 22:00',
      currency: 'IDR',
      timezone: 'Asia/Jakarta',
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// PATCH /api/settings - Update system settings
router.patch('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { outletName, outletAddress, outletPhone, operatingHours, currency, timezone } = req.body;

    // Update outlet
    const updatedOutlet = await db.update(outlets)
      .set({
        name: outletName,
        address: outletAddress,
        phone: outletPhone,
        updatedAt: new Date(),
      })
      .where(eq(outlets.id, userOutletId))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'SETTINGS_UPDATED',
      entityType: 'SETTINGS',
      entityId: userOutletId,
      details: {
        outletName,
        operatingHours,
        currency,
        timezone,
      },
      outletId: userOutletId,
    });

    res.json({
      outletName: updatedOutlet[0].name,
      outletAddress: updatedOutlet[0].address,
      outletPhone: updatedOutlet[0].phone,
      operatingHours,
      currency,
      timezone,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

export default router;