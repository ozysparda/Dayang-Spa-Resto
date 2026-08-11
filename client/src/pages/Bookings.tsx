import { useState, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Booking {
  id: string;
  bookingId: string;
  customerName: string;
  treatmentName: string;
  therapistName: string;
  outletName: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  commission: number;
  status: string;
  notes?: string;
}

interface Treatment {
  id: string;
  name: string;
  duration: number;
  price: number;
  defaultCommission: number;
}

interface Staff {
  id: string;
  name: string;
  status: string;
}

export default function Bookings() {
  const { data: bookingsData, loading, refetch } = useAsyncData<Booking[]>('/bookings');
  const { data: treatmentsData } = useAsyncData<Treatment[]>('/treatments');
  const { data: staffData } = useAsyncData<Staff[]>('/staff');
  const createBooking = useAsyncMutation();

  const bookings = bookingsData || [];
  const treatments = treatmentsData || [];
  const staff = staffData || [];

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    treatmentId: '',
    staffId: '',
    room: '',
    date: '',
    startTime: '',
    endTime: '',
    duration: 0,
    price: 0,
    commission: 0,
    notes: '',
  });

  // Auto-calculate end time when treatment or start time changes
  useEffect(() => {
    if (formData.treatmentId && formData.startTime && formData.date) {
      const treatment = treatments.find(t => t.id === formData.treatmentId);
      if (treatment) {
        const [hours, minutes] = formData.startTime.split(':').map(Number);
        const startDate = new Date(`${formData.date}T${formData.startTime}`);
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + treatment.duration);
        
        const endHours = endDate.getHours().toString().padStart(2, '0');
        const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
        const endTime = `${endHours}:${endMinutes}`;
        
        setFormData(prev => ({
          ...prev,
          duration: treatment.duration,
          endTime,
          price: treatment.price,
          commission: treatment.defaultCommission,
        }));
      }
    }
  }, [formData.treatmentId, formData.startTime, formData.date, treatments]);

  // Check therapist availability whenever time or therapist changes
  useEffect(() => {
    if (formData.staffId && formData.startTime && formData.endTime && formData.date) {
      const controller = new AbortController();
      let cancelled = false;

      const checkAvailability = async () => {
        try {
          const startDateTime = `${formData.date}T${formData.startTime}`;
          const endDateTime = `${formData.date}T${formData.endTime}`;
          const response = await api.get(`/bookings/available-therapists?startTime=${encodeURIComponent(startDateTime)}&endTime=${encodeURIComponent(endDateTime)}`, { signal: controller.signal });
          if (cancelled) return;
          const data = response.data;

          if (response.status === 200) {
            const isAvailable = data.some((t: Staff) => t.id === formData.staffId);
            if (!isAvailable && formData.staffId) {
              setAvailabilityError('This therapist has a conflicting booking during the selected time');
            } else {
              setAvailabilityError(null);
            }
          }
        } catch (error: any) {
          const aborted = error && (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED');
          if (cancelled || aborted) return;
          console.error('Availability check failed:', error);
        }
      };

      checkAvailability();
      return () => { cancelled = true; controller.abort(); };
    } else {
      setAvailabilityError(null);
    }
  }, [formData.staffId, formData.startTime, formData.endTime, formData.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (availabilityError) {
      toast.error('Please resolve the scheduling conflict before creating the booking');
      return;
    }
    
    try {
      // Server expects therapistId (not staffId) for the therapist field
      const payload = {
        customerName: formData.customerName,
        treatmentId: formData.treatmentId,
        therapistId: formData.staffId,
        room: formData.room,
        date: formData.date,
        startTime: `${formData.date}T${formData.startTime}`,
        endTime: `${formData.date}T${formData.endTime}`,
        price: formData.price,
        commission: formData.commission,
        notes: formData.notes,
        duration: formData.duration,
      };
      await createBooking('/bookings', 'POST', payload);
      setShowModal(false);
      refetch();
      resetForm();
      toast.success('Booking created successfully');
    } catch (error: any) {
      console.error('Failed to create booking:', error);
      const message = error.response?.data?.message || 'Failed to create booking';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      treatmentId: '',
      staffId: '',
      room: '',
      date: '',
      startTime: '',
      endTime: '',
      duration: 0,
      price: 0,
      commission: 0,
      notes: '',
    });
    setAvailabilityError(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.treatmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.therapistName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || booking.status === filterStatus;
    return matchesSearch && matchesFilter;
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
        <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Treatment</th>
                <th>Therapist</th>
                <th>Date & Time</th>
                <th>Room</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="font-medium">{booking.bookingId}</td>
                    <td>{booking.customerName}</td>
                    <td>{booking.treatmentName}</td>
                    <td>{booking.therapistName}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-sm">{new Date(booking.date).toLocaleDateString()}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                          {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td>{booking.room}</td>
                    <td>Rp {booking.price.toLocaleString()}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">New Booking</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Treatment
                </label>
                <select
                  required
                  value={formData.treatmentId}
                  onChange={(e) => {
                    const treatment = treatments.find(t => t.id === e.target.value);
                    if (treatment) {
                      setFormData({
                        ...formData,
                        treatmentId: e.target.value,
                        price: treatment.price,
                        commission: treatment.defaultCommission,
                      });
                    }
                  }}
                  className="input-field"
                >
                  <option value="">Select treatment</option>
                  {treatments.map((treatment) => (
                    <option key={treatment.id} value={treatment.id}>
                      {treatment.name} - Rp {treatment.price.toLocaleString()} ({treatment.duration} min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Therapist
                </label>
                <select
                  required
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className={`input-field ${availabilityError ? 'border-red-500' : ''}`}
                >
                  <option value="">Select therapist</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
                {formData.staffId && formData.startTime && formData.endTime && (
                  <div className="mt-2">
                    {availabilityError ? (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        {availabilityError}
                      </p>
                    ) : (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Available for selected time slot
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  readOnly
                  value={formData.duration || ''}
                  className="input-field bg-gray-100"
                  placeholder="Auto-calculated from treatment"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated from selected treatment</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  readOnly
                  value={formData.endTime}
                  className="input-field bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated based on start time + duration</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room/Location
                </label>
                <input
                  type="text"
                  required
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    Commission (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.commission}
                    onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Create Booking
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
    </div>
  );
}