import { useState } from 'react';
import {
    Plus, Search, Upload, Package, History, ClipboardList, TrendingUp,
  TrendingDown, Edit3, X, CheckCircle, AlertCircle, ShoppingCart, Trash2,
} from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import toast from 'react-hot-toast';

interface InventoryItem {
  id: string;
  sku?: string;
  productName: string;
  category?: string;
  quantity: number;
  unit?: string;
  cost?: number;
  sellingPrice?: number;
  minimumStock?: number;
  supplier?: string;
  isActive?: boolean;
  [key: string]: any;
}

interface Movement {
  id: string;
  inventoryId: string;
  productName: string;
  type: string;
  quantity: number;
  unit?: string;
  beforeStock?: number;
  afterStock?: number;
  reason?: string;
  notes?: string;
  createdAt: string;
}

interface OpnameItem {
  inventoryId: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  unit?: string;
  productName?: string;
}

interface Opname {
  id: string;
  status: string;
  opnameDate?: string;
  notes?: string;
  items?: OpnameItem[];
}

export default function Inventory() {
  const { data: itemsData, loading, refetch } = useAsyncData<InventoryItem[]>('/inventory');
  const refetchItems = refetch;
  const { data: summaryData } = useAsyncData<{ totals: { totalItems: number; totalValue: number; belowMin: number } }>('/inventory/summary');
  const { data: movementsData, loading: movementsLoading } = useAsyncData<Movement[]>('/inventory/movements');
  const { data: lowStockData, refetch: refetchLowStock } = useAsyncData<InventoryItem[]>('/inventory/low-stock');
  const createItem = useAsyncMutation();
  const importCsv = useAsyncMutation();
  const stockIn = useAsyncMutation();
  const stockOut = useAsyncMutation();
  const adjustStock = useAsyncMutation();
  const startOpname = useAsyncMutation();
  const confirmOpname = useAsyncMutation();

  const items = itemsData || [];
  const movements = movementsData || [];
  const lowStock = lowStockData || [];
  const summary = summaryData?.totals;

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [csvData, setCsvData] = useState('');
  const [fileName, setFileName] = useState('');
      const [importing, setImporting] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [opnameDraft, setOpnameDraft] = useState<Opname | null>(null);
  const [opnameNotes, setOpnameNotes] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'IN' | 'OUT' | 'ADJUST' | 'RETAIL' | 'WASTE'>('IN');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [actionQty, setActionQty] = useState('');
      const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    productName: '',
    category: '',
    itemType: 'BAHAN_TREATMENT',
    isReusable: false,
    quantity: 0,
    unit: '',
    cost: 0,
    sellingPrice: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem('/inventory', 'POST', formData);
      setShowModal(false);
      refetch();
      resetForm();
      toast.success('Inventory item added');
    } catch (error: any) {
      console.error('Failed to create inventory item:', error);
      toast.error('Failed to create inventory item');
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvData || !fileName) return;

    setImporting(true);
    try {
      await importCsv('/inventory/import', 'POST', { csvData, fileName });
      setShowImportModal(false);
      setCsvData('');
      setFileName('');
      refetch();
      toast.success('Inventory imported successfully');
    } catch (error: any) {
      console.error('Failed to import inventory:', error);
      toast.error('Failed to import inventory');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      try {
        const text = await file.text();
        setCsvData(text);
      } catch {
        toast.error('Failed to read file');
      }
    }
  };

    const resetForm = () => {
    setFormData({
      sku: '',
      productName: '',
      category: '',
      itemType: 'BAHAN_TREATMENT',
      isReusable: false,
      quantity: 0,
      unit: '',
      cost: 0,
      sellingPrice: 0,
    });
  };

  const openAction = (item: InventoryItem, type: 'IN' | 'OUT' | 'ADJUST' | 'RETAIL' | 'WASTE') => {
    setSelectedItem(item);
    setActionType(type);
    setActionQty('');
    setActionNotes('');
    setShowActionModal(true);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !actionQty) return;
    const qty = Number(actionQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }
    if (actionType === 'WASTE' && !actionNotes.trim()) {
      toast.error('A reason is required to record waste');
      return;
    }
    setActionLoading(true);
    try {
      if (actionType === 'IN') {
        await stockIn('/inventory/stock-in', 'POST', { inventoryId: selectedItem.id, quantity: qty, notes: actionNotes });
      } else if (actionType === 'OUT') {
        await stockOut('/inventory/stock-out', 'POST', { inventoryId: selectedItem.id, quantity: qty, notes: actionNotes });
      } else if (actionType === 'ADJUST') {
        await adjustStock('/inventory/adjustment', 'POST', { inventoryId: selectedItem.id, quantity: qty, notes: actionNotes });
      } else if (actionType === 'RETAIL') {
        await stockOut('/inventory/retail-sale', 'POST', { inventoryId: selectedItem.id, quantity: qty, notes: actionNotes });
      } else if (actionType === 'WASTE') {
        await stockOut('/inventory/waste', 'POST', { inventoryId: selectedItem.id, quantity: qty, reason: actionNotes });
      }
      setShowActionModal(false);
      refetchItems();
      refetchLowStock();
      const successMsg: Record<string, string> = {
        IN: 'Stock received',
        OUT: 'Stock issued',
        ADJUST: 'Stock adjusted',
        RETAIL: 'Retail sale recorded',
        WASTE: 'Waste recorded',
      };
      toast.success(successMsg[actionType]);
    } catch (error: any) {
      console.error('Stock action failed:', error);
      toast.error(error?.response?.data?.message || 'Stock action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartOpname = async () => {
    try {
      const res: any = await startOpname('/inventory/opnames', 'POST', { notes: opnameNotes });
      const draft = res?.id ? res : (Array.isArray(res) ? res[0] : null);
      setOpnameDraft(draft);
      toast.success('Stocktake started — adjust physical counts below');
    } catch (error: any) {
      console.error('Failed to start stocktake:', error);
      toast.error(error?.response?.data?.message || 'Failed to start stocktake');
    }
  };

  const handleUpdatePhysical = (inventoryId: string, physical: number) => {
    setOpnameDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: (prev.items || []).map((it) => {
          if (it.inventoryId !== inventoryId) return it;
          const sys = it.systemStock ?? 0;
          return { ...it, physicalStock: physical, difference: (physical ?? 0) - sys };
        }),
      };
    });
  };

  const handleConfirmOpname = async () => {
    if (!opnameDraft) return;
    try {
      await confirmOpname(`/inventory/opnames/${opnameDraft.id}/confirm`, 'POST', { items: opnameDraft.items });
      toast.success('Stocktake confirmed — adjustments applied');
      setOpnameDraft(null);
      setOpnameNotes('');
      setShowOpnameModal(false);
      refetchItems();
      refetchLowStock();
    } catch (error: any) {
      console.error('Failed to confirm stocktake:', error);
      toast.error(error?.response?.data?.message || 'Failed to confirm stocktake');
    }
  };

  const movementTypeColor = (type: string) => {
    const t = type?.toUpperCase();
    if (t === 'IN' || t === 'OPENING') return 'text-green-600';
    if (t === 'OUT' || t === 'RECIPE_CONSUMPTION') return 'text-red-600';
    if (t === 'ADJUSTMENT' || t === 'OPNAME') return 'text-orange-600';
    return 'text-gray-600';
  };

  const ITEM_TYPE_OPTIONS = [
    { value: 'BAHAN_TREATMENT', label: 'Bahan Treatment' },
    { value: 'CONSUMABLE', label: 'Consumable' },
    { value: 'RETAIL', label: 'Retail Product' },
    { value: 'REUSABLE', label: 'Reusable / Laundry' },
    { value: 'OTHER', label: 'Other' },
  ];

  const filteredItems = items.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (item.productName || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q);
    const matchesType = !itemTypeFilter || (item.itemType || 'OTHER') === itemTypeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
                              <button
            onClick={() => setShowMovementModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <History className="w-5 h-5" />
            Movement History
          </button>
          <button
            onClick={() => setShowOpnameModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <ClipboardList className="w-5 h-5" />
            Stocktake
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
            </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4 flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold">{summary.totalItems ?? items.length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-2xl font-bold">Rp {(summary.totalValue ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold">{summary.belowMin ?? lowStock.length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <History className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Recent Movements</p>
              <p className="text-2xl font-bold">{movements.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Banner */}
      {lowStock.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 items-center">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-red-800">Low stock alert:</span>
          {lowStock.slice(0, 5).map((item) => (
            <span key={item.id} className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
              {item.productName} (on hand: {item.quantity})
            </span>
          ))}
          {lowStock.length > 5 && <span className="text-xs text-red-700">+{lowStock.length - 5} more</span>}
        </div>
      )}

      {/* Search + type filter */}
      <div className="card mb-6 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={itemTypeFilter}
          onChange={(e) => setItemTypeFilter(e.target.value)}
          className="input-field md:w-56"
        >
          <option value="">All item types</option>
          {ITEM_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Quantity</th>
                                <th>Unit</th>
                <th>Min Stock</th>
                <th>Cost</th>
                <th>Selling Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                                  <td colSpan={10} className="text-center py-8 text-gray-500">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                                    <tr key={item.id} className={item.minimumStock && item.quantity <= item.minimumStock ? 'bg-red-50' : ''}>
                    <td className="font-medium">{item.sku}</td>
                    <td>{item.productName}</td>
                    <td>
                      {(() => {
                        const t = ITEM_TYPE_OPTIONS.find((o) => o.value === (item.itemType || 'OTHER'));
                        const color = item.itemType === 'RETAIL' ? 'bg-purple-100 text-purple-700'
                          : item.itemType === 'REUSABLE' ? 'bg-blue-100 text-blue-700'
                          : item.itemType === 'CONSUMABLE' ? 'bg-amber-100 text-amber-700'
                          : item.itemType === 'BAHAN_TREATMENT' ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600';
                        return (
                          <span className={`text-xs px-2 py-0.5 rounded ${color}`}>
                            {t?.label ?? 'Other'}
                            {item.isReusable ? ' ♻' : ''}
                          </span>
                        );
                      })()}
                    </td>
                    <td>{item.category}</td>
                    <td className="font-medium">{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td>{item.minimumStock ?? '-'}</td>
                    <td>Rp {(item.cost ?? 0).toLocaleString()}</td>
                    <td>Rp {(item.sellingPrice ?? 0).toLocaleString()}</td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openAction(item, 'IN')} title="Purchase / Stock In" className="p-1 text-green-600 hover:bg-green-100 rounded"><TrendingUp className="w-4 h-4" /></button>
                        <button onClick={() => openAction(item, 'RETAIL')} title="Retail Sale" className="p-1 text-purple-600 hover:bg-purple-100 rounded"><ShoppingCart className="w-4 h-4" /></button>
                        <button onClick={() => openAction(item, 'OUT')} title="Issue Stock" className="p-1 text-red-600 hover:bg-red-100 rounded"><TrendingDown className="w-4 h-4" /></button>
                        <button onClick={() => openAction(item, 'WASTE')} title="Waste" className="p-1 text-yellow-600 hover:bg-yellow-100 rounded"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={() => openAction(item, 'ADJUST')} title="Adjust" className="p-1 text-orange-600 hover:bg-orange-100 rounded"><Edit3 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Add Inventory Item</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Type
                </label>
                <select
                  value={formData.itemType}
                  onChange={(e) => {
                    const itemType = e.target.value;
                    setFormData({
                      ...formData,
                      itemType,
                      isReusable: itemType === 'REUSABLE',
                    });
                  }}
                  className="input-field"
                >
                  {ITEM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {formData.itemType === 'REUSABLE' && (
                  <p className="text-xs text-blue-600 mt-1">
                    Reusable items (towel/bedsheet/bathrobe) are laundered — treatment
                    consumption tracks usage without depleting stock.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selling Price (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Import Inventory from CSV</h2>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="input-field"
                  required
                />
              </div>

              {fileName && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">Selected: {fileName}</p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  CSV should have columns: SKU, Product Name, Category, Quantity, Unit, Cost, Selling Price
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={!csvData || importing}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setCsvData('');
                    setFileName('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
          {/* Movement History Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Stock Movement History</h3>
              <button onClick={() => setShowMovementModal(false)} className="text-gray-500 hover:text-gray-700" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {movementsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading movements...</div>
            ) : movements.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No stock movements recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Product</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Before</th>
                      <th className="text-right">After</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.createdAt).toLocaleString()}</td>
                        <td className={movementTypeColor(m.type)}>
                          <span className="font-medium">{m.type}</span>
                        </td>
                        <td>{m.productName}</td>
                        <td className="text-right font-medium">{m.quantity}</td>
                        <td className="text-right">{m.beforeStock ?? '-'}</td>
                        <td className="text-right">{m.afterStock ?? '-'}</td>
                        <td>{m.reason || m.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

          {/* Stocktake (Opname) Modal */}
      {showOpnameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Stock Take (Opname)</h3>
              <button
                onClick={() => { setShowOpnameModal(false); setOpnameDraft(null); setOpnameNotes(''); }}
                className="text-gray-500 hover:text-gray-700"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {!opnameDraft ? (
              <div className="text-center py-8">
                <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                  Start a stocktake to snapshot the current system stock for every active item.
                  Adjust the physical counts, then confirm to apply the differences.
                </p>
                <div className="mb-4">
                  <textarea
                    placeholder="Notes (optional)"
                    value={opnameNotes}
                    onChange={(e) => setOpnameNotes(e.target.value)}
                    className="input-field w-full"
                    rows={2}
                  />
                </div>
                <button onClick={handleStartOpname} className="btn-primary flex items-center gap-2 mx-auto">
                  <ClipboardList className="w-4 h-4" />
                  Start Stocktake
                </button>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">System Stock</th>
                        <th className="text-right">Physical Stock</th>
                        <th className="text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(opnameDraft.items || []).map((it: OpnameItem) => {
                        const diff = (it.physicalStock ?? 0) - (it.systemStock ?? 0);
                        return (
                          <tr key={it.inventoryId}>
                            <td>{it.productName || it.inventoryId}</td>
                            <td className="text-right">{it.systemStock}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                min="0"
                                value={it.physicalStock ?? ''}
                                onChange={(e) => handleUpdatePhysical(it.inventoryId, Number(e.target.value))}
                                className="input-field w-24 text-right"
                              />
                            </td>
                            <td className={diff === 0 ? 'text-right text-gray-500' : diff > 0 ? 'text-right text-green-600' : 'text-right text-red-600'}>
                              {diff > 0 ? '+' : ''}{diff}
                            </td>
                          </tr>
                        );
                      })}
                      {(opnameDraft.items || []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-gray-500">No items to count</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={handleConfirmOpname} className="btn-primary flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Confirm Stocktake
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

          {/* Stock Action Modal (IN / OUT / ADJUST) */}
      {showActionModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              {actionType === 'IN' ? 'Purchase / Add Stock'
                : actionType === 'OUT' ? 'Issue Stock'
                : actionType === 'RETAIL' ? 'Retail Sale'
                : actionType === 'WASTE' ? 'Record Waste'
                : 'Adjust Stock'}
            </h3>
            {actionType === 'WASTE' && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                Waste reduces stock and is recorded in the ledger with a required reason
                (expired, spilled, damaged, etc).
              </div>
            )}
            {actionType === 'RETAIL' && (
              <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded text-sm text-purple-800">
                Retail sale reduces stock directly (RETAIL_SALE). No treatment recipe involved.
              </div>
            )}
            <p className="text-sm text-gray-600 mb-4">{selectedItem.productName} — current: {selectedItem.quantity}</p>
            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {actionType === 'ADJUST' ? 'New Quantity (set balance to)' : 'Quantity'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={actionQty}
                  onChange={(e) => setActionQty(e.target.value)}
                  className="input-field"
                  disabled={actionLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {actionType === 'WASTE' ? 'Reason *' : actionType === 'ADJUST' ? 'Reason' : 'Notes'}
                </label>
                <input
                  type="text"
                  required={actionType === 'WASTE'}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="input-field"
                  disabled={actionLoading}
                  placeholder={
                    actionType === 'ADJUST' ? 'Reason for adjustment'
                    : actionType === 'WASTE' ? 'e.g. expired / spilled / damaged'
                    : 'Reason / reference'
                  }
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={actionLoading} className="btn-primary flex-1">
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowActionModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}