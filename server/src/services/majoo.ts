/**
 * Majoo integration abstraction.
 *
 * The core inventory service MUST NOT depend directly on Majoo's HTTP API.
 * Instead it talks to a `MajooAdapterInterface`. This lets us:
 *   - ship with a working MOCK adapter until real Majoo credentials/API docs
 *     are available (never inventing real Majoo endpoints),
 *   - swap in a real HTTP adapter later behind the same interface,
 *   - unit-test the integration service with a fake adapter.
 *
 * Architecture:
 *   Majoo (external POS)
 *     ↓
 *   MajooAdapter (implements MajooAdapterInterface)
 *     ↓
 *   MajooIntegrationService (business logic: sync + reconcile)
 *     ↓
 *   Inventory service / database
 */

export interface MajooProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  stockQty: number;
}

export interface MajooSaleItem {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  price: number;
}

export interface MajooSale {
  id: string;
  number: string;
  date: string;
  items: MajooSaleItem[];
}

export interface MajooAdapterInterface {
  syncProducts(): Promise<{ synced: number }>;
  syncSales(): Promise<{ synced: number }>;
  syncInventory(): Promise<{ synced: number }>;
  getProducts(): Promise<MajooProduct[]>;
  getSales(): Promise<MajooSale[]>;
}

/** Mock adapter — returns deterministic sample data, never calls a real API. */
export class MockMajooAdapter implements MajooAdapterInterface {
  async syncProducts(): Promise<{ synced: number }> {
    return { synced: 0 };
  }
  async syncSales(): Promise<{ synced: number }> {
    return { synced: 0 };
  }
  async syncInventory(): Promise<{ synced: number }> {
    return { synced: 0 };
  }
  async getProducts(): Promise<MajooProduct[]> {
    return [];
  }
  async getSales(): Promise<MajooSale[]> {
    return [];
  }
}

/** Real HTTP adapter placeholder. The Majoo public API / auth is not available
 * in this environment, so this throws until credentials + documented endpoints
 * are provided. Do NOT invent endpoint paths. Credentials are injected from
 * the factory (never hard-coded). */
export class MajooAdapter implements MajooAdapterInterface {
  constructor(
    private baseUrl = process.env.MAJOO_BASE_URL || '',
    private token = process.env.MAJOO_TOKEN || '',
  ) {}

  private assertConfigured() {
    if (!this.baseUrl || !this.token) {
      throw new Error('MajooAdapter is not configured (MAJOO_BASE_URL / MAJOO_TOKEN missing)');
    }
  }

  async syncProducts(): Promise<{ synced: number }> {
    this.assertConfigured();
    // TODO: implement once Majoo API docs + credentials are provided.
    throw new Error('MajooAdapter.syncProducts not implemented yet (awaiting Majoo API docs)');
  }
  async syncSales(): Promise<{ synced: number }> {
    this.assertConfigured();
    throw new Error('MajooAdapter.syncSales not implemented yet (awaiting Majoo API docs)');
  }
  async syncInventory(): Promise<{ synced: number }> {
    this.assertConfigured();
    throw new Error('MajooAdapter.syncInventory not implemented yet (awaiting Majoo API docs)');
  }
  async getProducts(): Promise<MajooProduct[]> {
    this.assertConfigured();
    throw new Error('MajooAdapter.getProducts not implemented yet (awaiting Majoo API docs)');
  }
  async getSales(): Promise<MajooSale[]> {
    this.assertConfigured();
    throw new Error('MajooAdapter.getSales not implemented yet (awaiting Majoo API docs)');
  }
}

/** The integration service the rest of the app uses. */
export class MajooIntegrationService {
  constructor(private adapter: MajooAdapterInterface = new MockMajooAdapter()) {}

  setAdapter(adapter: MajooAdapterInterface) {
    this.adapter = adapter;
  }

  async syncProducts() {
    return this.adapter.syncProducts();
  }
  async syncSales() {
    return this.adapter.syncSales();
  }
  async syncInventory() {
    return this.adapter.syncInventory();
  }
  async getProducts() {
    return this.adapter.getProducts();
  }
  async getSales() {
    return this.adapter.getSales();
  }
}

/**
 * Feature flag: MAJOO_ENABLED.
 *   - false / unset (DEFAULT): MockMajooAdapter — NO network request is ever
 *     made to Majoo. Safe for production until a real integration exists.
 *   - true: a real MajooAdapter is used, but ONLY if MAJOO_BASE_URL and
 *     MAJOO_TOKEN are configured. If the flag is on without credentials we
 *     FAIL FAST with a loud error rather than silently running a mock (which
 *     would fake data) or half-configured HTTP calls.
 */
export function createMajooService(): MajooIntegrationService {
  const enabled = process.env.MAJOO_ENABLED === 'true';
  if (!enabled) {
    return new MajooIntegrationService(new MockMajooAdapter());
  }
  const baseUrl = process.env.MAJOO_BASE_URL;
  const token = process.env.MAJOO_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      'MAJOO_ENABLED=true but MAJOO_BASE_URL / MAJOO_TOKEN are not set. ' +
        'Refusing to enable the real Majoo adapter without credentials. ' +
        'Set MAJOO_ENABLED=false (default) or provide both environment variables.',
    );
  }
  return new MajooIntegrationService(new MajooAdapter(baseUrl, token));
}

// Lazy singleton. Importing this module never throws unless the factory's
// fail-fast condition is hit (MAJOO_ENABLED=true without credentials).
let _majoo: MajooIntegrationService | undefined;
export function majoo(): MajooIntegrationService {
  if (!_majoo) _majoo = createMajooService();
  return _majoo;
}
