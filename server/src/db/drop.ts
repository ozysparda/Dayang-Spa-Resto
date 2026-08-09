import dotenv from 'dotenv';
import { db } from './index.js';
import { sql } from 'drizzle-orm';

dotenv.config();

async function dropAll() {
  console.log('Dropping all tables...');
  
  try {
    await db.execute(sql`DROP TABLE IF EXISTS activity_logs CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS chat_messages CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS chat_conversations CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS announcements CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS notifications CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS inventory CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS attendance CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS bookings CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS treatments CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS staff_status CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS staff_profiles CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS outlets CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);
    
    console.log('All tables dropped successfully');
    process.exit(0);
  } catch (error) {
    console.error('Drop failed:', error);
    process.exit(1);
  }
}

dropAll();