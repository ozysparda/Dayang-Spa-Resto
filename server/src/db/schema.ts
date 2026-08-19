import { pgTable, text, timestamp, boolean, integer, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Outlets (must be defined first as other tables reference it)
export const outlets = pgTable('outlets', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  address: text('address'),
  phone: text('phone'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Users table (for authentication)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().unique(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
    role: text('role', { enum: ['STAFF', 'ADMIN', 'DEVELOPER', 'CASHIER'] }).notNull().default('STAFF'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  staffIdIdx: index('users_staff_id_idx').on(table.staffId),
  usernameIdx: index('users_username_idx').on(table.username),
}));

// Staff profiles
export const staffProfiles = pgTable('staff_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  gender: text('gender', { enum: ['Male', 'Female', 'Other', 'Unspecified'] }).notNull().default('Unspecified'),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('staff_profiles_user_id_idx').on(table.userId),
  outletIdIdx: index('staff_profiles_outlet_id_idx').on(table.outletId),
}));

// Staff status
export const staffStatus = pgTable('staff_status', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => staffProfiles.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF'] }).notNull().default('OFF'),
  currentTreatmentId: text('current_treatment_id').references(() => bookings.id),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  staffIdIdx: index('staff_status_staff_id_idx').on(table.staffId),
  outletIdIdx: index('staff_status_outlet_id_idx').on(table.outletId),
}));

// Staff status history
export const staffStatusHistory = pgTable('staff_status_history', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => staffProfiles.id, { onDelete: 'cascade' }),
  oldStatus: text('old_status', { enum: ['FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF'] }),
  newStatus: text('new_status', { enum: ['FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF'] }).notNull(),
  changedBy: text('changed_by').notNull().references(() => users.id),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => ({
  staffIdIdx: index('staff_status_history_staff_id_idx').on(table.staffId),
  timestampIdx: index('staff_status_history_timestamp_idx').on(table.timestamp),
}));

// Attendance
export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => staffProfiles.id, { onDelete: 'cascade' }),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  date: timestamp('date').notNull(),
  clockIn: timestamp('clock_in'),
  clockOut: timestamp('clock_out'),
  breakStart: timestamp('break_start'),
  breakEnd: timestamp('break_end'),
  status: text('status', { enum: ['PRESENT', 'LATE', 'ABSENT', 'LEAVE'] }).notNull().default('PRESENT'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  staffIdDateIdx: index('attendance_staff_id_date_idx').on(table.staffId, table.date),
}));

// Treatments (master data)
export const treatments = pgTable('treatments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  duration: integer('duration').notNull(), // in minutes
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  defaultCommission: numeric('default_commission', { precision: 10, scale: 2 }),
  // Commission expressed as a percentage of price (e.g. 20 = 20%).
  // Commission amount is computed as price * commissionPercent / 100.
  commissionPercent: integer('commission_percent').notNull().default(20),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Bookings
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  date: timestamp('date').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  duration: integer('duration').notNull(), // in minutes
  treatmentId: text('treatment_id').notNull().references(() => treatments.id),
  therapistId: text('therapist_id').notNull().references(() => staffProfiles.id),
  room: text('room'),
  // Operations: number of guests on a single booking
  guests: integer('guests').notNull().default(1),
  // Operations: preferred therapist gender for matching
  preferredGender: text('preferred_gender', { enum: ['Male', 'Female', 'Any'] }).notNull().default('Any'),
  // Operations: actual start time when treatment begins
  actualStartTime: timestamp('actual_start_time'),
  // Operations: bed / station assignment
  bed: text('bed'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  commission: numeric('commission', { precision: 10, scale: 2 }),
    status: text('status', { enum: ['PENDING', 'CONFIRMED', 'IN_TREATMENT', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] }).notNull().default('PENDING'),
  notes: text('notes'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  outletIdIdx: index('bookings_outlet_id_idx').on(table.outletId),
  therapistIdIdx: index('bookings_therapist_id_idx').on(table.therapistId),
  dateIdx: index('bookings_date_idx').on(table.date),
  statusIdx: index('bookings_status_idx').on(table.status),
  therapistTimeIdx: index('bookings_therapist_time_idx').on(table.therapistId, table.startTime, table.endTime),
}));

// Treatment transactions
export const treatmentTransactions = pgTable('treatment_transactions', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  therapistId: text('therapist_id').notNull().references(() => staffProfiles.id),
  treatmentId: text('treatment_id').notNull().references(() => treatments.id),
  customerName: text('customer_name').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  commission: numeric('commission', { precision: 10, scale: 2 }).notNull(),
    room: text('room'),
  notes: text('notes'),
  idempotencyKey: text('idempotency_key').unique(),
  recordedBy: text('recorded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  outletIdIdx: index('treatment_transactions_outlet_id_idx').on(table.outletId),
  therapistIdIdx: index('treatment_transactions_therapist_id_idx').on(table.therapistId),
  createdAtIdx: index('treatment_transactions_created_at_idx').on(table.createdAt),
}));

// Commissions
export const commissions = pgTable('commissions', {
  id: text('id').primaryKey(),
  treatmentTransactionId: text('treatment_transaction_id').notNull().references(() => treatmentTransactions.id, { onDelete: 'cascade' }),
  therapistId: text('therapist_id').notNull().references(() => staffProfiles.id),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  customerId: text('customer_id'),
  treatmentName: text('treatment_name').notNull(),
  treatmentPrice: numeric('treatment_price', { precision: 10, scale: 2 }).notNull(),
  commissionPercent: integer('commission_percent').notNull().default(20),
  commissionAmount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] }).notNull().default('PENDING'),
  paidAt: timestamp('paid_at'),
  approvedBy: text('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  txIdIdx: index('commissions_tx_id_idx').on(table.treatmentTransactionId),
  therapistIdIdx: index('commissions_therapist_id_idx').on(table.therapistId),
  outletIdIdx: index('commissions_outlet_id_idx').on(table.outletId),
  statusIdx: index('commissions_status_idx').on(table.status),
}));

// Notifications
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type', { enum: ['TREATMENT_ASSIGNED', 'BOOKING_CREATED', 'ANNOUNCEMENT', 'SYSTEM'] }).notNull(),
  relatedId: text('related_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
}));

// Browser push subscriptions (Web Push / VAPID). One row per device/browser
// tab so a single Staff user can be notified on every active client.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  expirationTime: timestamp('expiration_time'),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('push_subscriptions_user_id_idx').on(table.userId),
}));

// Announcements
export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  targetOutletId: text('target_outlet_id').references(() => outlets.id),
  targetRole: text('target_role', { enum: ['STAFF', 'ADMIN', 'DEVELOPER'] }),
  createdBy: text('created_by').notNull().references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Announcement reads (track who read what)
export const announcementReads = pgTable('announcement_reads', {
  id: text('id').primaryKey(),
  announcementId: text('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at').notNull().defaultNow(),
}, (table) => ({
  announcementUserIdIdx: index('announcement_reads_announcement_user_idx').on(table.announcementId, table.userId),
}));

// Inventory
export const inventory = pgTable('inventory', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  productName: text('product_name').notNull(),
  category: text('category'),
  quantity: integer('quantity').notNull().default(0),
  unit: text('unit'),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  sellingPrice: numeric('selling_price', { precision: 10, scale: 2 }),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  // Multi-unit / raw material (BAHAN BAKU) support
  minimumStock: numeric('minimum_stock', { precision: 14, scale: 3 }),
  purchaseUnit: text('purchase_unit'),
  usageUnit: text('usage_unit'),
    conversion: numeric('conversion', { precision: 14, scale: 6 }).notNull().default('1'),
  purchasePrice: numeric('purchase_price', { precision: 14, scale: 2 }),
  costPerUsageUnit: numeric('cost_per_usage_unit', { precision: 14, scale: 4 }),
  supplier: text('supplier'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  skuIdx: index('inventory_sku_idx').on(table.sku),
  outletIdIdx: index('inventory_outlet_id_idx').on(table.outletId),
}));

// Suppliers (raw-material vendors)
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Stock movement ledger — every stock change writes one immutable row so the
// inventory balance is always reproducible from history.
export const inventoryMovements = pgTable('inventory_movements', {
  id: text('id').primaryKey(),
  inventoryId: text('inventory_id').notNull().references(() => inventory.id, { onDelete: 'cascade' }),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  type: text('type', {
    enum: ['IN', 'OUT', 'ADJUSTMENT', 'RECIPE_CONSUMPTION', 'OPENING', 'OPNAME', 'REVERSAL'],
  }).notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  unit: text('unit'),
  beforeStock: numeric('before_stock', { precision: 14, scale: 3 }).notNull(),
  afterStock: numeric('after_stock', { precision: 14, scale: 3 }).notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  reason: text('reason'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  inventoryIdIdx: index('inventory_movements_inventory_id_idx').on(table.inventoryId),
  outletIdIdx: index('inventory_movements_outlet_id_idx').on(table.outletId),
  createdAtIdx: index('inventory_movements_created_at_idx').on(table.createdAt),
  typeIdx: index('inventory_movements_type_idx').on(table.type),
}));

// Master Recipe — a reusable template of raw materials + quantities.
export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Recipe ingredient lines.
export const recipeItems = pgTable('recipe_items', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  inventoryId: text('inventory_id').notNull().references(() => inventory.id),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  unit: text('unit'),
}, (table) => ({
  recipeIdIdx: index('recipe_items_recipe_id_idx').on(table.recipeId),
  inventoryIdIdx: index('recipe_items_inventory_id_idx').on(table.inventoryId),
}));

// Inventory imports
export const inventoryImports = pgTable('inventory_imports', {
  id: text('id').primaryKey(),
  fileName: text('file_name').notNull(),
  importedBy: text('imported_by').notNull().references(() => users.id),
  totalRows: integer('total_rows').notNull(),
  successRows: integer('success_rows').notNull(),
  failedRows: integer('failed_rows').notNull(),
  errors: jsonb('errors'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Inventory import rows (for tracking individual row results)
export const inventoryImportRows = pgTable('inventory_import_rows', {
  id: text('id').primaryKey(),
  importId: text('import_id').notNull().references(() => inventoryImports.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  sku: text('sku'),
  productName: text('product_name'),
  quantity: integer('quantity'),
  status: text('status', { enum: ['SUCCESS', 'FAILED', 'SKIPPED'] }).notNull(),
  errorMessage: text('error_message'),
  inventoryId: text('inventory_id').references(() => inventory.id),
}, (table) => ({
    importIdIdx: index('inventory_import_rows_import_id_idx').on(table.importId),
}));

// Link treatments to recipes (a treatment may optionally have one recipe).
export const treatmentRecipes = pgTable('treatment_recipes', {
  id: text('id').primaryKey(),
  treatmentId: text('treatment_id').notNull().references(() => treatments.id, { onDelete: 'cascade' }).unique(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  treatmentIdIdx: index('treatment_recipes_treatment_id_idx').on(table.treatmentId),
  recipeIdIdx: index('treatment_recipes_recipe_id_idx').on(table.recipeId),
}));

// Stock opname (physical stock count) header.
export const stockOpnames = pgTable('stock_opnames', {
  id: text('id').primaryKey(),
  opnameDate: timestamp('opname_date').notNull().defaultNow(),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  status: text('status', { enum: ['DRAFT', 'CONFIRMED'] }).notNull().default('DRAFT'),
  notes: text('notes'),
  createdBy: text('created_by').notNull().references(() => users.id),
  confirmedBy: text('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Stock opname item lines (system stock vs physical count).
export const stockOpnameItems = pgTable('stock_opname_items', {
  id: text('id').primaryKey(),
  opnameId: text('opname_id').notNull().references(() => stockOpnames.id, { onDelete: 'cascade' }),
  inventoryId: text('inventory_id').notNull().references(() => inventory.id),
  systemStock: numeric('system_stock', { precision: 14, scale: 3 }).notNull(),
  physicalStock: numeric('physical_stock', { precision: 14, scale: 3 }).notNull(),
  difference: numeric('difference', { precision: 14, scale: 3 }).notNull(),
  unit: text('unit'),
}, (table) => ({
  opnameIdIdx: index('stock_opname_items_opname_id_idx').on(table.opnameId),
  inventoryIdIdx: index('stock_opname_items_inventory_id_idx').on(table.inventoryId),
}));

// Bills / receipts (cashier payment record).
export const bills = pgTable('bills', {
  id: text('id').primaryKey(),
  receiptNumber: text('receipt_number').notNull().unique(),
  bookingId: text('booking_id').references(() => bookings.id),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  treatmentName: text('treatment_name').notNull(),
  treatmentPrice: numeric('treatment_price', { precision: 14, scale: 2 }).notNull(),
  addOns: jsonb('add_ons'),
  discount: numeric('discount', { precision: 14, scale: 2 }).notNull().default('0'),
  tax: numeric('tax', { precision: 14, scale: 2 }).notNull().default('0'),
  serviceCharge: numeric('service_charge', { precision: 14, scale: 2 }).notNull().default('0'),
  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).notNull(),
  paymentMethod: text('payment_method', { enum: ['CASH', 'QRIS', 'CARD', 'TRANSFER', 'OTHER'] }).notNull().default('CASH'),
  paymentStatus: text('payment_status', { enum: ['UNPAID', 'PAID', 'REFUNDED'] }).notNull().default('UNPAID'),
  paidAt: timestamp('paid_at'),
  cashierId: text('cashier_id').notNull().references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  bookingIdIdx: index('bills_booking_id_idx').on(table.bookingId),
  outletIdIdx: index('bills_outlet_id_idx').on(table.outletId),
  createdAtIdx: index('bills_created_at_idx').on(table.createdAt),
}));

// Activity logs
export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details'),
  outletId: text('outlet_id').references(() => outlets.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('activity_logs_user_id_idx').on(table.userId),
  entityTypeIdx: index('activity_logs_entity_type_idx').on(table.entityType),
  createdAtIdx: index('activity_logs_created_at_idx').on(table.createdAt),
}));

// Chat conversations
export const chatConversations = pgTable('chat_conversations', {
  id: text('id').primaryKey(),
  name: text('name'),
  isGroup: boolean('is_group').notNull().default(false),
  outletId: text('outlet_id').references(() => outlets.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Chat participants
export const chatParticipants = pgTable('chat_participants', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => ({
  conversationIdUserIdIdx: index('chat_participants_conv_user_idx').on(table.conversationId, table.userId),
}));

// Chat messages
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  conversationIdIdx: index('chat_messages_conversation_id_idx').on(table.conversationId),
  createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  staffProfile: one(staffProfiles, {
    fields: [users.id],
    references: [staffProfiles.userId],
  }),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
  announcements: many(announcements),
  activityLogs: many(activityLogs),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [staffProfiles.userId],
    references: [users.id],
  }),
  outlet: one(outlets, {
    fields: [staffProfiles.outletId],
    references: [outlets.id],
  }),
  status: one(staffStatus),
  statusHistory: many(staffStatusHistory),
  bookings: many(bookings, { relationName: 'therapist' }),
  transactions: many(treatmentTransactions),
  attendance: many(attendance),
}));

export const outletsRelations = relations(outlets, ({ many }) => ({
  staff: many(staffProfiles),
  bookings: many(bookings),
  transactions: many(treatmentTransactions),
  inventory: many(inventory),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  outlet: one(outlets, {
    fields: [bookings.outletId],
    references: [outlets.id],
  }),
  treatment: one(treatments, {
    fields: [bookings.treatmentId],
    references: [treatments.id],
  }),
  therapist: one(staffProfiles, {
    fields: [bookings.therapistId],
    references: [staffProfiles.id],
    relationName: 'therapist',
  }),
  createdByUser: one(users, {
    fields: [bookings.createdBy],
    references: [users.id],
  }),
}));

export const treatmentTransactionsRelations = relations(treatmentTransactions, ({ one }) => ({
  outlet: one(outlets, {
    fields: [treatmentTransactions.outletId],
    references: [outlets.id],
  }),
  therapist: one(staffProfiles, {
    fields: [treatmentTransactions.therapistId],
    references: [staffProfiles.id],
  }),
  treatment: one(treatments, {
    fields: [treatmentTransactions.treatmentId],
    references: [treatments.id],
  }),
    recordedByUser: one(users, {
    fields: [treatmentTransactions.recordedBy],
    references: [users.id],
  }),
  commission: one(commissions, {
    fields: [treatmentTransactions.id],
    references: [commissions.treatmentTransactionId],
  }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  treatmentTransaction: one(treatmentTransactions, {
    fields: [commissions.treatmentTransactionId],
    references: [treatmentTransactions.id],
  }),
  therapist: one(staffProfiles, {
    fields: [commissions.therapistId],
    references: [staffProfiles.id],
  }),
  outlet: one(outlets, {
    fields: [commissions.outletId],
    references: [outlets.id],
  }),
  approvedByUser: one(users, {
    fields: [commissions.approvedBy],
    references: [users.id],
  }),
}));

export const chatConversationsRelations = relations(chatConversations, ({ many }) => ({
  participants: many(chatParticipants),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type StaffProfile = typeof staffProfiles.$inferSelect;
export type NewStaffProfile = typeof staffProfiles.$inferInsert;
export type Outlet = typeof outlets.$inferSelect;
export type NewOutlet = typeof outlets.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Treatment = typeof treatments.$inferSelect;
export type NewTreatment = typeof treatments.$inferInsert;
export type TreatmentTransaction = typeof treatmentTransactions.$inferSelect;
export type NewTreatmentTransaction = typeof treatmentTransactions.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;