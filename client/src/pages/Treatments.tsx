import { useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
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

export default function Treatments() {
  const { data: treatmentsData, loading, refetch } = useAsyncData<Treatment[]>('/treatments');
  const createTreatment = useAsyncMutation();
  const updateTreatment = useAsyncMutation();
  const deleteTreatment = useAsyncMutation();

  const treatments = treatmentsData || [];

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
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
    </div>
  );
}