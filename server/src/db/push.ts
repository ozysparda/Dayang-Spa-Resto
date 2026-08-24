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
        role VARCHAR(50) NOT NULL CHECK (role IN ('STAFF', 'ADMIN', 'DEVELOPER', 'CASHIER')),
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
        gender VARCHAR(50) NOT NULL DEFAULT 'Unspecified'
          CHECK (gender IN ('Male', 'Female', 'Other', 'Unspecified')),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Safe, idempotent migration for the gender column added in later phases.
    await db.execute(sql`
      ALTER TABLE staff_profiles
      ADD COLUMN IF NOT EXISTS gender VARCHAR(50) NOT NULL DEFAULT 'Unspecified'
      CHECK (gender IN ('Male', 'Female', 'Other', 'Unspecified'))
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS treatments (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        duration INTEGER NOT NULL,
        price INTEGER NOT NULL,
        default_commission INTEGER NOT NULL,
        commission_percent INTEGER NOT NULL DEFAULT 20,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(255) PRIMARY KEY,
        booking_id VARCHAR(255) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        date TIMESTAMP NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration INTEGER NOT NULL,
        treatment_id VARCHAR(255) NOT NULL REFERENCES treatments(id),
        therapist_id VARCHAR(255) REFERENCES staff_profiles(id),
        room TEXT,
        guests INTEGER NOT NULL DEFAULT 1,
        preferred_gender VARCHAR(50) NOT NULL DEFAULT 'Any' CHECK (preferred_gender IN ('Male', 'Female', 'Any')),
        actual_start_time TIMESTAMP,
        bed TEXT,
        price NUMERIC(14,2) NOT NULL,
        commission NUMERIC(14,2),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_TREATMENT', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
        notes TEXT,
        created_by VARCHAR(255) NOT NULL REFERENCES users(id),
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
        minimum_stock NUMERIC(14,3),
        purchase_unit VARCHAR(50),
        usage_unit VARCHAR(50),
        conversion NUMERIC(14,6) DEFAULT 1,
        purchase_price NUMERIC(14,2),
        cost_per_usage_unit NUMERIC(14,4),
        supplier VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        last_updated TIMESTAMP DEFAULT NOW(),
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
    // Additional columns present in schema.ts that older databases may be missing
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS duration INTEGER`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP DEFAULT NOW()`);
    await db.execute(sql`ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

    // Commissions — one record per treatment transaction (created in treatments.ts).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS commissions (
        id VARCHAR(255) PRIMARY KEY,
        treatment_transaction_id VARCHAR(255) NOT NULL REFERENCES treatment_transactions(id) ON DELETE CASCADE,
        therapist_id VARCHAR(255) REFERENCES staff_profiles(id),
        outlet_id VARCHAR(255) REFERENCES outlets(id),
        customer_id VARCHAR(255),
        treatment_name VARCHAR(255) NOT NULL,
        treatment_price NUMERIC(10, 2) NOT NULL,
        commission_percent INTEGER NOT NULL DEFAULT 20,
        commission_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REJECTED')),
        paid_at TIMESTAMP,
        approved_by VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes for the commission list/filter queries.
    await db.execute(sql`CREATE INDEX IF NOT EXISTS commissions_tx_id_idx ON commissions(treatment_transaction_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS commissions_therapist_id_idx ON commissions(therapist_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS commissions_outlet_id_idx ON commissions(outlet_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS commissions_status_idx ON commissions(status)`);

    // Reconcile bookings table columns that may be missing
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration INTEGER`);
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room TEXT`);
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS outlet_id VARCHAR(255)`);

    // Reconcile announcements table columns
    await db.execute(sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_outlet_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'NORMAL'`);
    await db.execute(sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);

    // Reconcile chat_messages table columns
    await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false`);

    // Reconcile staff_status table columns
    await db.execute(sql`ALTER TABLE staff_status ADD COLUMN IF NOT EXISTS in_charge_since TIMESTAMP`);

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

    // Suppliers (raw-material vendors)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Stock movement ledger
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id VARCHAR(255) PRIMARY KEY,
        inventory_id VARCHAR(255) NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        type VARCHAR(50) NOT NULL CHECK (type IN ('IN','OUT','ADJUSTMENT','RECIPE_CONSUMPTION','OPENING','OPNAME','REVERSAL')),
        quantity NUMERIC(14,3) NOT NULL,
        unit VARCHAR(50),
        before_stock NUMERIC(14,3) NOT NULL,
        after_stock NUMERIC(14,3) NOT NULL,
        reference_type VARCHAR(50),
        reference_id VARCHAR(255),
        reason TEXT,
        notes TEXT,
        created_by VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Recipes (master templates)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recipes (
        id VARCHAR(255) PRIMARY KEY,
        code VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Recipe ingredient lines
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recipe_items (
        id VARCHAR(255) PRIMARY KEY,
        recipe_id VARCHAR(255) NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        inventory_id VARCHAR(255) NOT NULL REFERENCES inventory(id),
        quantity NUMERIC(14,3) NOT NULL,
        unit VARCHAR(50)
      )
    `);

    // Link treatments to recipes
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS treatment_recipes (
        id VARCHAR(255) PRIMARY KEY,
        treatment_id VARCHAR(255) NOT NULL UNIQUE REFERENCES treatments(id) ON DELETE CASCADE,
        recipe_id VARCHAR(255) NOT NULL REFERENCES recipes(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Stock opname (physical count) header
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stock_opnames (
        id VARCHAR(255) PRIMARY KEY,
        opname_date TIMESTAMP DEFAULT NOW(),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIRMED')),
        notes TEXT,
        created_by VARCHAR(255) NOT NULL REFERENCES users(id),
        confirmed_by VARCHAR(255) REFERENCES users(id),
        confirmed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Stock opname item lines
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stock_opname_items (
        id VARCHAR(255) PRIMARY KEY,
        opname_id VARCHAR(255) NOT NULL REFERENCES stock_opnames(id) ON DELETE CASCADE,
        inventory_id VARCHAR(255) NOT NULL REFERENCES inventory(id),
        system_stock NUMERIC(14,3) NOT NULL,
        physical_stock NUMERIC(14,3) NOT NULL,
        difference NUMERIC(14,3) NOT NULL,
        unit VARCHAR(50)
      )
    `);

    // Bills / receipts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bills (
        id VARCHAR(255) PRIMARY KEY,
        receipt_number VARCHAR(255) NOT NULL UNIQUE,
        booking_id VARCHAR(255) REFERENCES bookings(id),
        outlet_id VARCHAR(255) NOT NULL REFERENCES outlets(id),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        treatment_name VARCHAR(255) NOT NULL,
        treatment_price NUMERIC(14,2) NOT NULL,
        add_ons JSONB,
        discount NUMERIC(14,2) DEFAULT 0,
        tax NUMERIC(14,2) DEFAULT 0,
        service_charge NUMERIC(14,2) DEFAULT 0,
        grand_total NUMERIC(14,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH','QRIS','CARD','TRANSFER','OTHER')),
        payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PAID','REFUNDED')),
        paid_at TIMESTAMP,
        cashier_id VARCHAR(255) NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Schema pushed successfully!');
  } catch (error) {
    console.error('Schema push failed:', error);
    process.exit(1);
  }
}

// Safe, additive migrations for EXISTING databases (idempotent, non-destructive).
async function runSafeAdditiveMigrations() {
  // ---- Staff profiles columns ----
  // Ensure the gender column exists on pre-existing databases that were
  // created before the column was added to schema.ts. Without this, any
  // Drizzle query that selects staffProfile (e.g. login with
  // `with: { staffProfile: true }`) raises:
  //   PostgresError: column "users_staffProfile.gender" does not exist
  await db.execute(sql`
    ALTER TABLE staff_profiles
    ADD COLUMN IF NOT EXISTS gender VARCHAR(50) NOT NULL DEFAULT 'Unspecified'
    CHECK (gender IN ('Male', 'Female', 'Other', 'Unspecified'))
  `);

  // ---- Inventory multi-unit / raw-material columns (Bahan Baku) ----
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC(14,3)`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50)`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS usage_unit VARCHAR(50)`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS conversion NUMERIC(14,6) DEFAULT 1`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(14,2)`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cost_per_usage_unit NUMERIC(14,4)`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier VARCHAR(255)`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS notes TEXT`);
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()`);

  // ---- Bookings operations columns ----
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50)`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room TEXT`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guests INTEGER NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_gender VARCHAR(50) DEFAULT 'Any'`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bed TEXT`);
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)`);

  // Add commission_percent to treatments if missing (backward compatible).
  await db.execute(sql`
    ALTER TABLE treatments ADD COLUMN IF NOT EXISTS commission_percent INTEGER NOT NULL DEFAULT 20
  `);

  // Allow NO_SHOW / PENDING_PAYMENT status on bookings. Existing DBs created
  // the status CHECK without them, so we recreate the constraint to include
  // them. Dropping a CHECK constraint is non-destructive (no data loss).
  await db.execute(sql`
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check
  `);
  await db.execute(sql`
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_TREATMENT', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED', 'NO_SHOW'))
  `);
  // Allow the CASHIER role on existing databases (recreate the role CHECK).
  await db.execute(sql`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
  `);
  await db.execute(sql`
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('STAFF', 'ADMIN', 'DEVELOPER', 'CASHIER'))
  `);
        // Allow NO_SHOW status (existing migration logic above).
    console.log('Safe additive migrations applied.');

    // Treatment input idempotency: a client-generated key prevents duplicate
    // transactions when the cashier double-clicks, the network stalls, or the
    // page refreshes mid-submit. Nullable so existing walk-in rows are unaffected.
    await db.execute(sql`
      ALTER TABLE treatment_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS treatment_transactions_idempotency_key_unique
        ON treatment_transactions(idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);
    console.log('Idempotency key column applied.');
  }

// Only auto-run and exit when executed directly via `npm run db:push`.
// When imported (e.g., by api/index.ts for auto-migration), the caller
// is responsible for invoking the functions and handling errors.
const isDirectRun = process.argv[1]?.endsWith('push.ts');

if (isDirectRun) {
  pushSchema()
    .then(async () => {
      await runSafeAdditiveMigrations();
      console.log('Push completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Push failed:', error);
      process.exit(1);
    });
}

export { pushSchema, runSafeAdditiveMigrations };
