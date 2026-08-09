import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { users, staffProfiles, outlets } from '../db/schema.js';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';

const router = Router();

const loginSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', async (req, res) => {
  try {
    const { staffId, password } = loginSchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: (usersTable, { eq }) => eq(usersTable.staffId, staffId),
      with: {
        staffProfile: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        staffId: user.staffId,
        username: user.username,
        role: user.role,
        outletId: user.staffProfile?.outletId || '',
      },
      secret,
      { expiresIn: '7d' }
    );

    // Get outlet name separately
    let outletName = '';
    if (user.staffProfile?.outletId) {
      const outlet = await db.select().from(outlets).where(eq(outlets.id, user.staffProfile.outletId)).limit(1);
      outletName = outlet[0]?.name || '';
    }

    res.json({
      user: {
        id: user.id,
        staffId: user.staffId,
        username: user.username,
        name: user.staffProfile?.name || user.username,
        role: user.role,
        outletId: user.staffProfile?.outletId || '',
        outletName,
        email: user.staffProfile?.email,
        phone: user.staffProfile?.phone,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: (usersTable, { eq }) => eq(usersTable.id, req.user.id),
      with: {
        staffProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get outlet name separately
    let outletName = '';
    if (user.staffProfile?.outletId) {
      const outlet = await db.select().from(outlets).where(eq(outlets.id, user.staffProfile.outletId)).limit(1);
      outletName = outlet[0]?.name || '';
    }

    res.json({
      id: user.id,
      staffId: user.staffId,
      username: user.username,
      name: user.staffProfile?.name || user.username,
      role: user.role,
      outletId: user.staffProfile?.outletId || '',
      outletName,
      email: user.staffProfile?.email,
      phone: user.staffProfile?.phone,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

export default router;