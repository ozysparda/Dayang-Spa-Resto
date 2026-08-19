import { useState, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { api } from '../services/api';
import AvailabilityBoard from '../components/AvailabilityBoard';
import ScheduleGrid from '../components/ScheduleGrid';
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
  commissionPercent: number;
}

interface Staff {
  id: string;
  name: string;
  status: string;
  gender?: string;
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

  const checkBookingAvailability = async () => {
    if (!formData.staffId || !formData.date || !formData.startTime || !formData.treatmentId) {
      setAvailabilityError(null);
      return;
    }
    
    const treatment = treatments.find(t => t.id === formData.treatmentId);
    if (!treatment) {
      setAvailabilityError('Treatment not found');
      return;
    }

    const [hours, minutes] = formData.startTime.split(':').map(Number);
    const startDate = new Date(`${formData.date}T${formData.startTime}`);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + treatment.duration);

    try {
      const params = new URLSearchParams({
        date: formData.date,
        startTime: formData.startTime,
        duration: treatment.duration.toString(),
        staffId: formData.staffId,
      });
      const res = await api.get(`/bookings/availability?${params.toString()}`);
      const isAvailable = res.data.available.includes(formData.staffId);
      if (isAvailable) {
        setAvailabilityError(null);
      } else {
        const therapistName = staff.find(s => s.id === formData.staffId)?.name || 'the selected therapist';
        setAvailabilityError(` ${therapistName} is already booked at this time. Choose a different time or therapist.`);
      }
    } catch (e: any) {
      setAvailabilityError('Failed to check availability. Please try again.');
    }
  };

    // Top-level view toggle between bookings list, availability board, and schedule grid.
  const [view, setView] = useState<'bookings' | 'availability' | 'schedule'>('bookings');

  // When a therapist is selected from the availability board, pre-fill the
  // new-booking form and switch to the booking flow.
  const selectAvailableStaff = (selection: { staff: any; date: string; time: string; treatment: string }) => {
    setFormData({
      ...formData,
      staffId: selection.staff.id,
      ...(selection.treatment ? { treatmentId: selection.treatment } : {}),
      date: selection.date,
      startTime: selection.time,
    });
    setView('bookings');
    setShowModal(true);
  };
    const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    treatmentId: '',
    staffId: '',
    room: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    duration: 0,
    price: 0,
    commission: 0,
    notes: '',
    status: 'PENDING',
    preferredGender: 'Any',
  });

  // Auto-calculate end time, duration, price, commission when treatment or start time changes
    // Auto-calculate end time, duration, price, commission when treatment or start time changes.
  // Commission is computed as price * commissionPercent / 100 (configurable percentage).
  useEffect(() => {
    if (formData.treatmentId && formData.startTime && formData.date) {
      const treatment = treatments.find(t => t.id === formData.treatmentId);
      if (treatment) {
        const [hours, minutes] = formData.startTime.split(':').map(Number);
        const startDate = new Date(`${formData.date}T${formData.startTime}`);
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate);
        // Correct date/time arithmetic: 10:10 + 60 min = 11:10 (never 10:60)
        endDate.setMinutes(endDate.getMinutes() + treatment.duration);
        const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const resolvedPrice = treatment.price || formData.price || 0;
        const resolvedCommission = Math.round(
          Number(resolvedPrice) * Number(treatment.commissionPercent || 0) / 100
        );

        setFormData(prev => ({
          ...prev,
          duration: treatment.duration,
          endTime,
          price: resolvedPrice,
          commission: resolvedCommission || prev.commission,
        }));
      }
    }
    }, [formData.treatmentId, formData.startTime, formData.date, treatments]);

  // Check therapist availability when staff/date/time/treatment changes
  useEffect(() => {
    if (formData.staffId && formData.date && formData.startTime && formData.treatmentId) {
      checkBookingAvailability();
    }
  }, [formData.staffId, formData.date, formData.startTime, formData.treatmentId, availabilityError]);

  // Phase 16: Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      errors.customerName = 'Customer name is required';
    }

    if (!formData.treatmentId) {
      errors.treatmentId = 'Treatment is required';
    }

    if (!formData.staffId) {
      errors.staffId = 'Staff/therapist is required';
    }

    if (!formData.date) {
      errors.date = 'Date is required';
    }

    if (!formData.startTime) {
      errors.startTime = 'Start time is required';
    }

    if (!formData.room.trim()) {
      errors.room = 'Room/location is required';
    }

    // Validate duration is positive
    if (formData.duration <= 0) {
      errors.duration = 'Duration must be positive';
    }

    // Validate price and commission are numeric
    if (isNaN(formData.price) || formData.price < 0) {
      errors.price = 'Price must be a valid positive number';
    }

    if (isNaN(formData.commission) || formData.commission < 0) {
      errors.commission = 'Commission must be a valid positive number';
    }

    // Validate end time is after start time
    if (formData.startTime && formData.endTime) {
      if (formData.endTime <= formData.startTime) {
        errors.endTime = 'End time must be after start time';
      }
    }

    return Object.keys(errors).length === 0;
  };

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
          setAvailabilityError('Unable to check therapist availability');
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

    // Phase 16: Validate form before submission
    if (!validateForm()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    if (availabilityError) {
      toast.error('Please resolve the scheduling conflict before creating the booking');
      return;
    }

    try {
            const payload = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
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
        status: formData.status,
        preferredGender: formData.preferredGender,
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

  const updateBookingStatus = useAsyncMutation();
  
  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      await updateBookingStatus(`/bookings/${bookingId}`, 'PATCH', { status: newStatus });
      refetch();
      toast.success(`Booking ${newStatus.toLowerCase()}`);
    } catch (error: any) {
      console.error('Failed to update booking status:', error);
      toast.error('Failed to update booking status');
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      treatmentId: '',
      staffId: '',
      room: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '',
      endTime: '',
      duration: 0,
      price: 0,
      commission: 0,
      notes: '',
      status: 'PENDING',
      preferredGender: 'Any',
    });
    setAvailabilityError(null);
  };

    const getStatusColor = (status: string) => {
    switch (status) {
            case 'PENDING_PAYMENT':
        return 'bg-amber-100 text-amber-800';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'IN_TREATMENT':
        return 'bg-orange-100 text-orange-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'NO_SHOW':
        return 'bg-purple-100 text-purple-800';
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

      {/* View tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setView('bookings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === 'bookings' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          Today's Bookings
        </button>
        <button
          onClick={() => setView('availability')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === 'availability' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          Staff Availability
        </button>
        <button
          onClick={() => setView('schedule')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === 'schedule' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          Schedule
        </button>
      </div>

      {view === 'availability' && (
        <div className="card mb-6">
          <AvailabilityBoard
            treatments={treatments}
            onDateChange={() => {}}
            onTimeChange={() => {}}
            onTreatmentChange={() => {}}
            onSelectStaff={selectAvailableStaff}
          />
        </div>
      )}

      {view === 'schedule' && (
        <div className="mb-6">
          <ScheduleGrid
            onSelectSlot={(slot) => {
              setFormData({
                ...formData,
                staffId: slot.staffId,
                date: slot.date,
                startTime: slot.time,
              });
              setShowModal(true);
            }}
          />
        </div>
      )}

      {view === 'bookings' && (
      <>
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
              <option value="IN_TREATMENT">In Treatment</option>
              <option value="PENDING_PAYMENT">Pending Payment</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
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
                <th>Phone</th>
                <th>Treatment</th>
                <th>Therapist</th>
                <th>Date & Time</th>
                <th>Room</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="font-medium">{booking.bookingId}</td>
                    <td>{booking.customerName}</td>
                    <td className="text-sm text-gray-600">{(booking as any).customerPhone || '-'}</td>
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
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {booking.status === 'PENDING' && (
                          <button onClick={() => handleStatusChange(booking.id, 'CONFIRMED')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Confirm</button>
                        )}
                        {booking.status === 'CONFIRMED' && (
                          <button onClick={() => handleStatusChange(booking.id, 'IN_TREATMENT')} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Start</button>
                        )}
                                 {booking.status === 'IN_TREATMENT' && (
                          <button onClick={() => handleStatusChange(booking.id, 'PENDING_PAYMENT')} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200">Mark for Payment</button>
                        )}
                        {(booking.status === 'IN_TREATMENT' || booking.status === 'CONFIRMED') && (
                          <button onClick={() => handleStatusChange(booking.id, 'COMPLETED')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Complete</button>
                        )}
                                                {['PENDING', 'CONFIRMED', 'IN_TREATMENT'].includes(booking.status) && (
                          <button onClick={() => handleStatusChange(booking.id, 'CANCELLED')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Cancel</button>
                        )}
                        {booking.status === 'CONFIRMED' && (
                          <button onClick={() => handleStatusChange(booking.id, 'NO_SHOW')} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">No Show</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
              </div>
      </div>
      </>
      )}

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
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="input-field"
                  placeholder="08xxxxxxxxxx"
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
                  Preferred Therapist Gender
                </label>
                <select
                  value={formData.preferredGender}
                  onChange={(e) => setFormData({ ...formData, preferredGender: e.target.value, staffId: '' })}
                  className="input-field"
                >
                  <option value="Any">Any</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
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
                  {staff
                    .filter((s) =>
                      formData.preferredGender === 'Any'
                        ? true
                        : (s as any)?.gender === formData.preferredGender
                    )
                    .map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.gender && s.gender !== 'Unspecified' ? ` (${s.gender})` : ''} ({s.status})
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