import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Calculator, X } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Treatment {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  defaultCommission: number;
  commissionPercent: number;
  isActive: boolean;
}

interface HppItem {
  inventoryId: string;
  productName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  lineCost: number;
}

interface HppData {
  treatmentId: string;
  treatmentName: string;
  price: number;
  materialCost: number;
  materialItems: HppItem[];
  materialRatio: number;
  commission: number;
  commissionPercent: number;
  grossMargin: number;
}

export default function Treatments() {
  const { data: treatmentsData, loading, refetch } = useAsyncData<Treatment[]>('/treatments');
  const createTreatment = useAsyncMutation();
  const updateTreatment = useAsyncMutation();
  const deleteTreatment = useAsyncMutation();

  const treatments = treatmentsData || [];

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [hppData, setHppData] = useState<HppData | null>(null);
  const [hppLoading, setHppLoading] = useState(false);

  const loadHpp = async (treatmentId: string) => {
    setHppLoading(true);
    try {
      const res = await api.get(`/treatments/${treatmentId}/hpp`);
      setHppData(res.data);
    } catch (error) {
      console.error('Failed to fetch treatment HPP:', error);
      toast.error('Failed to fetch HPP');
    } finally {
      setHppLoading(false);
    }
  };
    const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 60,
    price: 0,
    defaultCommission: 0,
    commissionPercent: 20,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTreatment) {
        await updateTreatment(`/treatments/${editingTreatment.id}`, 'PATCH', formData);
        toast.success('Treatment updated successfully');
      } else {
        await createTreatment('/treatments', 'POST', formData);
        toast.success('Treatment added successfully');
      }
      setShowModal(false);
      refetch();
      resetForm();
    } catch (error: any) {
      console.error('Failed to save treatment:', error);
      toast.error('Failed to save treatment');
    }
  };

  const handleEdit = (treatment: Treatment) => {
         setEditingTreatment(treatment);
    setFormData({
      name: treatment.name,
      description: treatment.description,
      duration: treatment.duration,
      price: treatment.price,
      defaultCommission: treatment.defaultCommission,
      commissionPercent: treatment.commissionPercent ?? 20,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this treatment?')) return;
    try {
      await deleteTreatment(`/treatments/${id}`, 'DELETE');
      refetch();
      toast.success('Treatment deactivated');
    } catch (error: any) {
      console.error('Failed to delete treatment:', error);
      toast.error('Failed to delete treatment');
    }
  };

    const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration: 60,
      price: 0,
      defaultCommission: 0,
      commissionPercent: 20,
    });
    setEditingTreatment(null);
  };

  const filteredTreatments = treatments.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold text-gray-900">Treatments</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Treatment
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search treatments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Treatments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTreatments.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No treatments found
          </div>
        ) : (
          filteredTreatments.map((treatment) => (
            <div key={treatment.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{treatment.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadHpp(treatment.id)}
                    title="View HPP / material cost"
                    className="text-green-600 hover:text-green-800"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(treatment)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(treatment.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">{treatment.description}</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration: {treatment.duration} min</span>
                <span className="font-semibold text-gray-900">Rp {treatment.price.toLocaleString()}</span>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Commission: Rp {treatment.defaultCommission.toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Treatment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingTreatment ? 'Edit Treatment' : 'Add Treatment'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Treatment Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Commission (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={formData.defaultCommission}
                  onChange={(e) => setFormData({ ...formData, defaultCommission: Number(e.target.value) })}
                  className="input-field"
                />
              </div>

                            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commissionPercent}
                  onChange={(e) => setFormData({ ...formData, commissionPercent: Number(e.target.value) })}
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Auto-calculated commission = price × {formData.commissionPercent}% (≈ Rp {Math.round(Number(formData.price || 0) * Number(formData.commissionPercent || 0) / 100).toLocaleString()})
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {editingTreatment ? 'Update' : 'Add'} Treatment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
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

      {/* HPP / Material Cost Modal */}
      {hppData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">HPP — {hppData.treatmentName}</h2>
              <button onClick={() => setHppData(null)} className="text-gray-500 hover:text-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {hppLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <>
                {/* Material breakdown */}
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Material Consumption (Treatment Recipe)
                </h3>
                {hppData.materialItems.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-4">
                    No recipe linked to this treatment yet. Link a recipe in Inventory → Recipes.
                  </p>
                ) : (
                  <table className="table mb-4 text-sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Cost/Unit</th>
                        <th className="text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hppData.materialItems.map((it) => (
                        <tr key={it.inventoryId}>
                          <td>{it.productName}</td>
                          <td className="text-right">{it.quantity} {it.unit}</td>
                          <td className="text-right">{it.costPerUnit.toLocaleString()}</td>
                          <td className="text-right font-medium">Rp {it.lineCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Cost structure */}
                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Treatment price</span>
                    <span className="font-semibold">Rp {hppData.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Material cost (HPP bahan)</span>
                    <span className="font-medium text-red-600">− Rp {hppData.materialCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Staff commission ({hppData.commissionPercent}%)
                    </span>
                    <span className="font-medium text-amber-600">− Rp {hppData.commission.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base">
                    <span className="font-semibold text-gray-900">Estimated gross margin</span>
                    <span className={`font-bold ${hppData.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rp {hppData.grossMargin.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Material cost ratio: {hppData.materialRatio}% of price. Commission is kept
                    separate from material (inventory) cost.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}