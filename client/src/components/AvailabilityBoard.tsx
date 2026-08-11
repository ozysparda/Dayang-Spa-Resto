import { useState, useEffect } from 'react';
import { UserCheck, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import AvailabilityGroup from './AvailabilityGroup';

export default function AvailabilityBoard({ treatments, onDateChange, onTimeChange, onTreatmentChange, onSelectStaff }: any) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [treatment, setTreatment] = useState('');

  useEffect(() => {
    onDateChange(date);
    onTimeChange(time);
    onTreatmentChange(treatment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAvailability = async () => {
    if (!date || !time) return;
    setLoading(true);
    setResult(null);
    try {
      const startTime = `${date}T${time}:00`;
      const params = new URLSearchParams({ startTime });
      if (treatment) params.set('treatmentId', treatment);
      const res = await api.get(`/bookings/availability?${params.toString()}`);
      setResult(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to check availability');
    } finally {
      setLoading(false);
    }
  };

    const handleSelect = (staffMember: any) =>
    onSelectStaff({ staff: staffMember, date, time, treatment });


  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); onDateChange(e.target.value); }} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
          <input type="time" value={time} onChange={(e) => { setTime(e.target.value); onTimeChange(e.target.value); }} className="input-field" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Treatment (optional)</label>
          <select value={treatment} onChange={(e) => { setTreatment(e.target.value); onTreatmentChange(e.target.value); }} className="input-field">
            <option value="">Any treatment</option>
            {treatments.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name} — {t.duration} min</option>
            ))}
          </select>
        </div>
        <button onClick={checkAvailability} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    {loading ? 'Checking...' : 'Check Availability'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Slot:{' '}
              {new Date(result.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
              {new Date(result.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({result.duration} min)
            </span>
            {result.treatmentName && <span>Treatment: {result.treatmentName}</span>}
          </div>

          <AvailabilityGroup label="Available" color="green" items={result.available} onSelect={handleSelect} emptyMsg="No staff available for this slot" />
          <AvailabilityGroup
            label="Busy"
            color="red"
            items={result.busy}
            busy
            renderDetail={(b: any) => (
              <span className="text-sm text-gray-700">
                {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {b.customerName} · {b.treatmentName}
              </span>
            )}
            emptyMsg="No staff busy in this slot"
          />
          <AvailabilityGroup label="Off Air" color="gray" items={result.offAir} busy emptyMsg="All staff are on duty" />
        </div>
      )}
    </div>
  );
}

