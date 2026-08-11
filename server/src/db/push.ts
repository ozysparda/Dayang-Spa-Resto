import dotenv from 'dotenv';
import { db } from './index.js';
import { sql } from 'drizzle-orm';

dotenv.config();

async function pushSchema() {
  console.log('Pushing schema to database...');

  try {
    // Create all tables from schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        staff_id VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('STAFF', 'ADMIN', 'DEVELOPER')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS outlets (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staff_profiles (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS treatments (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        duration INTEGER NOT NULL,
        price INTEGER NOT NULL,
        default_commission INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(255) PRIMARY KEY,
        booking_code VARCHAR(255) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        treatment_id VARCHAR(255) NOT NULL REFERENCES treatments(id),
        therapist_id VARCHAR(255) REFERENCES staff_profiles(id),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        booking_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        price INTEGER NOT NULL,
        commission INTEGER,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_TREATMENT', 'COMPLETED', 'CANCELLED')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staff_status (
        id VARCHAR(255) PRIMARY KEY,
        staff_id VARCHAR(255) NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL CHECK (status IN ('FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF')),
        current_treatment_id VARCHAR(255) REFERENCES bookings(id),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(255) PRIMARY KEY,
        staff_id VARCHAR(255) NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        clock_in TIMESTAMP,
        clock_out TIMESTAMP,
        break_start TIMESTAMP,
        break_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(255) PRIMARY KEY,
        sku VARCHAR(255) UNIQUE NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(50),
        cost INTEGER,
        selling_price INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_by VARCHAR(255) NOT NULL REFERENCES users(id),
        target_roles TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL CHECK (type IN ('DIRECT', 'GROUP')),
        name VARCHAR(255),
        created_by VARCHAR(255) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_id VARCHAR(255) NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id),
        user_name VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(255) NOT NULL,
        entity_id VARCHAR(255),
        details JSONB,
        outlet_id VARCHAR(255) REFERENCES outlets(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Treatment transactions (commissions). push.ts only does CREATE IF NOT EXISTS,
    // so we also ALTER missing columns for pre-existing (legacy) tables whose columns
    // drifted from schema.ts (e.g. room/notes added in a later session).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS treatment_transactions (
        id VARCHAR(255) PRIMARY KEY,
        booking_id VARCHAR(255),
        outlet_id VARCHAR(255) REFERENCES outlets(id),
        therapist_id VARCHAR(255) REFERENCES staff_profiles(id),
        treatment_id VARCHAR(255) REFERENCES treatments(id),
        customer_name VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        commission NUMERIC(10, 2) NOT NULL,
        room TEXT,
        notes TEXT,
        recorded_by VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Reconcile columns that may be absent on an older treatment_transactions table.
    // IF NOT EXISTS makes this idempotent across fresh and pre-existing databases.
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS booking_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS therapist_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS treatment_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS start_time TIMESTAMP`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS end_time TIMESTAMP`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS commission NUMERIC(10, 2)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS room TEXT`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS notes TEXT`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(255)`);
        await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()`);

    // =========================================================================
    // Tables defined in schema.ts but NEVER created by the original push.ts.
    // Their absence in production caused the runtime 500s logged on Vercel:
    //   relation "staff_status_history" does not exist      -> PATCH /api/staff/:id/status
    //   relation "announcement_reads" does not exist        -> GET  /api/announcements
    //   relation "push_subscriptions" does not exist       -> /api/push/* (notifications)
    //   (inventory_imports / inventory_import_rows / chat_participants were also
    //    missing and would 500 on first use).
    //
    // CREATE TABLE IF NOT EXISTS is idempotent: safe to re-run on databases that
    // already have these tables (e.g. after a previous partial push).
    // FK targets (users, outlets, staff_profiles, announcements, chat_conversations,
    // inventory) already exist in production, so these can be created in this order.
    // =========================================================================

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staff_status_history (
        id VARCHAR(255) PRIMARY KEY,
        staff_id VARCHAR(255) NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
        old_status VARCHAR(50) CHECK (old_status IN ('FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF')),
        new_status VARCHAR(50) NOT NULL CHECK (new_status IN ('FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF')),
        changed_by VARCHAR(255) NOT NULL REFERENCES users(id),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        expiration_time TIMESTAMP,
        user_agent TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        id VARCHAR(255) PRIMARY KEY,
        announcement_id VARCHAR(255) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_imports (
        id VARCHAR(255) PRIMARY KEY,
        file_name TEXT NOT NULL,
        imported_by VARCHAR(255) NOT NULL REFERENCES users(id),
        total_rows INTEGER NOT NULL,
        success_rows INTEGER NOT NULL,
        failed_rows INTEGER NOT NULL,
        errors JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_import_rows (
        id VARCHAR(255) PRIMARY KEY,
        import_id VARCHAR(255) NOT NULL REFERENCES inventory_imports(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        sku TEXT NOT NULL,
        product_name TEXT,
        quantity INTEGER,
        status VARCHAR(50) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')) DEFAULT 'SUCCESS',
        error_message TEXT,
        inventory_id VARCHAR(255) REFERENCES inventory(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id VARCHAR(255) PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log('Schema pushed successfully!');
  } catch (error) {
    console.error('Schema push failed:', error);
    process.exit(1);
  }
}

pushSchema()
  .then(() => {
    console.log('Push completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Push failed:', error);
    process.exit(1);
  });