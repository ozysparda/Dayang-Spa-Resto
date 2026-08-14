import { useState, useEffect } from 'react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import toast from 'react-hot-toast';

interface Staff { id: string; name: string; status: string; }
interface Treatment { id: string; name: string; duration: number; price: number; defaultCommission: number; commissionPercent: number; }

export default function TreatmentInput() {
  const { data: staffData } = useAsyncData<Staff[]>('/staff');
  const { data: treatmentsData } = useAsyncData<Treatment[]>('/treatments');
  const recordTreatment = useAsyncMutation();

  const staff = staffData || [];
  const treatments = treatmentsData || [];

  const [formData, setFormData] = useState({
    therapistId: '', treatmentId: '', bookingId: '', customerName: '', customerPhone: '',
    startTime: '', endTime: '', duration: 0, price: 0, commission: 0, room: '', notes: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (formData.treatmentId && formData.startTime) {
      const t = treatments.find(x => x.id === formData.treatmentId);
            if (t) {
        // Phase 4: Use proper date/time arithmetic for duration calculation
        const start = new Date(formData.startTime);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + t.duration);
        const fmt = (d: Date) => d.toISOString().slice(0, 16);
        const resolvedPrice = t.price || formData.price || 0;
        const resolvedCommission = Math.round(Number(resolvedPrice) * Number(t.commissionPercent || 0) / 100);
        setFormData(p => ({ ...p, duration: t.duration, endTime: fmt(end), price: resolvedPrice, commission: resolvedCommission }));
      }
    }
  }, [formData.treatmentId, formData.startTime, treatments]);

  useEffect(() => {
    if (formData.therapistId) {
      const s = staff.find(x => x.id === formData.therapistId);
      if (s) setFormData(p => ({ ...p, customerName: p.customerName || s.name }));
    }
  }, [formData.therapistId, staff]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.therapistId) {
      errors.therapistId = 'Therapist is required';
    }

    if (!formData.treatmentId) {
      errors.treatmentId = 'Treatment is required';
    }

    if (!formData.startTime) {
      errors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      errors.endTime = 'End time is required';
    }

    if (formData.price <= 0) {
      errors.price = 'Price must be greater than 0';
    }

    if (isNaN(formData.price)) {
      errors.price = 'Price must be a number';
    }

    if (isNaN(formData.commission)) {
      errors.commission = 'Commission must be a number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Phase 16: Validate form before submission
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    try {
      setSaving(true);
      await recordTreatment('/treatments/input', 'POST', formData);
      toast.success('Treatment recorded');
      setFormData({ therapistId: '', treatmentId: '', bookingId: '', customerName: '', customerPhone: '', startTime: '', endTime: '', duration: 0, price: 0, commission: 0, room: '', notes: '' });
      setValidationErrors({});
    } catch (err: any) {
      // Phase 17: Friendly error messages
      const message = err.response?.data?.message || 'Failed to record treatment';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Treatment Input</h1>
      <p className="text-gray-500 mb-6">Record completed treatments and generate commissions</p>
      <div className="max-w-2xl card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Therapist</label>
              <select required value={formData.therapistId} onChange={e => setFormData({ ...formData, therapistId: e.target.value })} className={"input-field " + (validationErrors.therapistId ? "border-red-500" : "")}>
                <option value="">Select therapist</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
              </select>
              {validationErrors.therapistId && <p className="text-red-500 text-xs mt-1">{validationErrors.therapistId}</p>}
            </div>
            <div>
              <label className="label">Treatment</label>
              <select required value={formData.treatmentId} onChange={e => setFormData({ ...formData, treatmentId: e.target.value })} className={"input-field " + (validationErrors.treatmentId ? "border-red-500" : "")}>
                <option value="">Select treatment</option>
                {treatments.map(t => <option key={t.id} value={t.id}>{t.name} - Rp {t.price.toLocaleString()} ({t.duration} min)</option>)}
              </select>
              {validationErrors.treatmentId && <p className="text-red-500 text-xs mt-1">{validationErrors.treatmentId}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Customer Name</label>
              <input type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="input-field" placeholder="Walk-in or booking customer" />
            </div>
            <div>
              <label className="label">Customer Phone</label>
              <input type="tel" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} className="input-field" placeholder="08xxxxxxxxxx" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Time</label>
              <input type="datetime-local" required value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className={"input-field " + (validationErrors.startTime ? "border-red-500" : "")} />
              {validationErrors.startTime && <p className="text-red-500 text-xs mt-1">{validationErrors.startTime}</p>}
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="datetime-local" value={formData.endTime} readOnly className="input-field bg-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" readOnly value={formData.duration || ''} className="input-field bg-gray-100" />
            </div>
            <div>
              <label className="label">Price (Rp)</label>
              <input type="number" required value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} className={"input-field " + (validationErrors.price ? "border-red-500" : "")} />
              {validationErrors.price && <p className="text-red-500 text-xs mt-1">{validationErrors.price}</p>}
            </div>
            <div>
              <label className="label">Commission (Rp)</label>
              <input type="number" required value={formData.commission} onChange={e => setFormData({ ...formData, commission: Number(e.target.value) })} className={"input-field " + (validationErrors.commission ? "border-red-500" : "")} />
              {validationErrors.commission && <p className="text-red-500 text-xs mt-1">{validationErrors.commission}</p>}
            </div>
          </div>
          <div>
            <label className="label">Room / Location</label>
            <input type="text" value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })} className="input-field" placeholder="e.g. Dayang 1 - Room 2" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} placeholder="Optional notes" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Saving...' : 'Record Treatment'}
            </button>
            <button type="button" onClick={() => { setFormData({ therapistId: '', treatmentId: '', bookingId: '', customerName: '', customerPhone: '', startTime: '', endTime: '', duration: 0, price: 0, commission: 0, room: '', notes: '' }); setValidationErrors({}); }} className="btn-secondary flex-1">Clear</button>
          </div>
        </form>
      </div>
    </div>
  );
}
