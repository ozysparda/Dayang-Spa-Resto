import { db } from '../db/index.js';
import { users, staffProfiles, outlets, treatments, staffStatus, activityLogs } from '../db/schema.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('Seeding database...');

  // Create outlet
  const outletId = 'outlet-1';
  await db.insert(outlets).values({
    id: outletId,
    name: 'Dayang 1',
    address: 'Main Street',
    phone: '021-12345678',
  });

  // Create developer user
  const developerId = 'user-1';
  const developerPassword = await bcrypt.hash('developer123', 10);
  await db.insert(users).values({
    id: developerId,
    staffId: 'DEV001',
    username: 'developer',
    password: developerPassword,
    role: 'DEVELOPER',
  });

  // Create developer staff profile
  const devStaffId = 'staff-1';
  await db.insert(staffProfiles).values({
    id: devStaffId,
    userId: developerId,
    name: 'System Developer',
    email: 'dev@dayangspa.com',
    phone: '081234567890',
    outletId,
  });

  // Create developer staff status
  await db.insert(staffStatus).values({
    id: uuidv4(),
    staffId: devStaffId,
    status: 'FREE',
    outletId,
  });

  // Create admin user
  const adminId = 'user-2';
  const adminPassword = await bcrypt.hash('admin123', 10);
  await db.insert(users).values({
    id: adminId,
    staffId: 'ADM001',
    username: 'admin',
    password: adminPassword,
    role: 'ADMIN',
  });

  // Create admin staff profile
  const adminStaffId = 'staff-2';
  await db.insert(staffProfiles).values({
    id: adminStaffId,
    userId: adminId,
    name: 'Admin User',
    email: 'admin@dayangspa.com',
    phone: '081234567891',
    outletId,
  });

  // Create admin staff status
  await db.insert(staffStatus).values({
    id: uuidv4(),
    staffId: adminStaffId,
    status: 'FREE',
    outletId,
  });

  // Create sample staff
  const staffId = 'user-3';
  const staffPassword = await bcrypt.hash('staff123', 10);
  await db.insert(users).values({
    id: staffId,
    staffId: 'STF001',
    username: 'rizal',
    password: staffPassword,
    role: 'STAFF',
  });

  const staffProfileId = 'staff-3';
  await db.insert(staffProfiles).values({
    id: staffProfileId,
    userId: staffId,
    name: 'Rizal',
    email: 'rizal@dayangspa.com',
    phone: '081234567892',
    outletId,
  });

  // Create staff status
  await db.insert(staffStatus).values({
    id: uuidv4(),
    staffId: staffProfileId,
    status: 'FREE',
    outletId,
  });

  // Create sample treatments
  await db.insert(treatments).values({
    id: 'treatment-1',
    name: 'FM',
    description: 'Full Body Massage',
    duration: 60,
    price: 100000,
    defaultCommission: 50000,
  } as any);

  await db.insert(treatments).values({
    id: 'treatment-2',
    name: 'FM Cream',
    description: 'Full Body Massage with Cream',
    duration: 90,
    price: 150000,
    defaultCommission: 75000,
  } as any);

  await db.insert(treatments).values({
    id: 'treatment-3',
    name: 'Traditional Massage',
    description: 'Traditional Indonesian Massage',
    duration: 60,
    price: 120000,
    defaultCommission: 60000,
  } as any);

  // Create activity log for seeding
  await db.insert(activityLogs).values({
    id: uuidv4(),
    userId: developerId,
    userName: 'System Developer',
    action: 'SYSTEM_INITIALIZED',
    entityType: 'SYSTEM',
    entityId: outletId,
    details: {
      message: 'Database seeded with initial data',
    },
    outletId,
  });

  console.log('Database seeded successfully!');
  console.log('\nLogin credentials:');
  console.log('Developer: developer / developer123');
  console.log('Admin: admin / admin123');
  console.log('Staff: rizal / staff123');
}

seed()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });