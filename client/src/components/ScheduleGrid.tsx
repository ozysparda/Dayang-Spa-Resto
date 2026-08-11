import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Staff {
  id: string;
  name: string;
  status: string;
}

interface SlotInfo {
  status: string;
  booking?: {
    customerName: string;
    treatmentName: string;
    startTime: string;
    endTime: string;
  };
}

interface ScheduleData {
  date: string;
  slots: string[];
  staff: Staff[];
  matrix: Record<string, Record<string, SlotInfo>>;
}

interface ScheduleGridProps {
  onSelectSlot: (data: { staffId: string; staffName: string; date: string; time: string }) => void;
}

const SLOT_COLORS: Record<string, string> = {
  FREE: 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer',
  BUSY: 'bg-red-50 border-red-200',
  BREAK: 'bg-yellow-50 border-yellow-200',
  IN_CHARGE: 'bg-blue-50 border-blue-200',
  OFF: 'bg-gray-100 border-gray-200',
};

const SLOT_TEXT: Record<string, string> = {
  FREE: 'text-green-700',
  BUSY: 'text-red-700',
  BREAK: 'text-yellow-700',
  IN_CHARGE: 'text-blue-700',
  OFF: 'text-gray-500',
};

export default function ScheduleGrid({ onSelectSlot }: ScheduleGridProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<ScheduleData | null>(null);

  const loadSchedule = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/bookings/schedule?date=${encodeURIComponent(targetDate)}`);
      setData(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule(date);
  }, [date]);

  const handleSlotClick = (staffId: string, staffName: string, time: string) => {
    const slot = data?.matrix?.[staffId]?.[time];
    if (!slot || slot.status !== 'FREE') return;
    onSelectSlot({ staffId, staffName, date, time });
  };

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Booking Schedule</h3>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field"
          />
          <button
            onClick={() => loadSchedule(date)}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!data || loading ? (
        <div className="text-center py-8 text-gray-500">Loading schedule...</div>
      ) : data.staff.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No staff members found</div>
      ) : (
        <div className="min-w-[900px]">
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `70px repeat(${data.staff.length}, 1fr)` }}>
            <div className="text-xs font-medium text-gray-500 px-1">TIME</div>
            {data.staff.map((s) => (
              <div key={s.id} className="text-xs font-semibold text-gray-700 text-center truncate px-1" title={s.name}>
                {s.name.toUpperCase()}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {data.slots.map((slot) => (
              <div key={slot} className="grid gap-1" style={{ gridTemplateColumns: `70px repeat(${data.staff.length}, 1fr)` }}>
                <div className="text-xs text-gray-500 px-1 py-1.5 flex items-center">{slot}</div>
                {data.staff.map((s) => {
                  const info = data.matrix?.[s.id]?.[slot] || { status: 'FREE' };
                  const isFree = info.status === 'FREE';
                  return (
                    <button
                      key={s.id}
                      disabled={!isFree}
                      onClick={() => handleSlotClick(s.id, s.name, slot)}
                      title={
                        isFree
                          ? `Click to book ${s.name} at ${slot}`
                          : info.booking
                            ? `${info.booking.customerName} - ${info.booking.treatmentName}`
                            : info.status
                      }
                      className={`border rounded px-1 py-1.5 text-xs transition-colors ${
                        isFree ? SLOT_COLORS[info.status] : SLOT_COLORS[info.status] + ' cursor-default'
                      } ${SLOT_TEXT[info.status] || 'text-gray-600'}`}
                    >
                      {isFree && <span className="flex items-center justify-center gap-0.5"><Plus className="w-3 h-3" /> FREE</span>}
                      {info.status === 'BUSY' && info.booking && (
                        <span className="block truncate">{info.booking.customerName}</span>
                      )}
                      {info.status === 'OFF' && 'OFF'}
                      {info.status === 'BREAK' && 'BREAK'}
                      {info.status === 'IN_CHARGE' && 'IN CHARGE'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> FREE</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> BUSY</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200 inline-block" /> BREAK</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block" /> IN CHARGE</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" /> OFF AIR</span>
          </div>
        </div>
      )}
    </div>
  );
}
