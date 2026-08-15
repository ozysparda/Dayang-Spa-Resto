import { useEffect, useState } from 'react';
import { Calendar, Users, Clock, Activity, UserCheck, MessageSquare, Bell, User, DollarSign } from 'lucide-react';
import { useParallelFetch, useAsyncMutation } from '../hooks/useAsyncData';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface DashboardStats {
  // Today's Bookings by status
  pendingBookings: number;
  confirmedBookings: number;
  inTreatmentBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  
  // Staff breakdown
  totalStaff: number;
  availableTherapists: number;
  inChargeStaff: number;
  busyStaff: number;     // IN_TREATMENT
  staffOnBreak: number;
  offAirStaff: number;
  
  // Financial
  todayRevenue: number;
  todayCommission: number;

  // Aggregate/Totals (returned by /dashboard/stats)
  bookingsToday: number;
  staffOnline: number;
  completedTreatments: number;
}

interface StaffStatus {
  id: string;
  name: string;
  status: string;
  outletName: string;
  currentTreatment?: string;
  currentCustomer?: string;
  startTime?: string;
  endTime?: string;
  remainingMinutes?: number;
  room?: string;
}

interface NextBooking {
  id: string;
  bookingId: string;
  customerName: string;
  startTime: string;
  endTime: string;
  status: string;
  treatmentName: string;
  therapistName: string;
  room: string;
}

interface Activity {
  id: string;
  action: string;
  entityType: string;
  userName: string;
  details: any;
  createdAt: string;
}

interface MyBooking {
  id: string;
  customerName: string;
  startTime: string;
  endTime: string;
  treatmentName: string;
  room: string;
  status: string;
  commission?: number;
}

type DashboardData = {
  stats: DashboardStats;
  staffStatus: StaffStatus[];
  nextBookings: NextBooking[];
  activities: Activity[];
  myProfile?: any;
  myTodayBookings?: MyBooking[];
};

const STATUS_OPTIONS = [
  { value: 'FREE', label: 'FREE', emoji: '🟢' },
  { value: 'IN_CHARGE', label: 'IN CHARGE', emoji: '🟡' },
  { value: 'IN_TREATMENT', label: 'BUSY', emoji: '🔴' },
  { value: 'ON_BREAK', label: 'BREAK', emoji: '☕' },
  { value: 'OFF', label: 'OFF AIR', emoji: '⚫' },
] as const;

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const updateStatus = useAsyncMutation();
  const [myStatus, setMyStatus] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [now, setNow] = useState(new Date());

  const todayStr = new Date().toISOString().split('T')[0];

  const { data, loading, refetch } = useParallelFetch<DashboardData>([
    { key: 'stats', url: '/dashboard/stats' },
    { key: 'staffStatus', url: '/dashboard/staff-status' },
    { key: 'nextBookings', url: '/dashboard/next-bookings' },
    { key: 'activities', url: '/dashboard/activity?limit=10' },
    ...(user?.role === 'ADMIN' || user?.role === 'DEVELOPER' ? [{ key: 'adminStats', url: '/dashboard/admin-stats' }] : []),
    ...(user?.role === 'STAFF' ? [{ key: 'myProfile', url: '/staff/me' }] : []),
    ...(user?.role === 'STAFF' ? [{ key: 'myTodayBookings', url: '/bookings?date=' + todayStr }] : []),
  ]);

  // Auto-refresh data every 30 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setNow(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Update status when component mounts (sync with server)
  useEffect(() => {
    const updateMyStatus = async () => {
      if (!user?.id) return;
      try {
        await updateStatus('/staff/my-status', 'PATCH', {
          status: myStatus || 'FREE',
        });
      } catch (e: any) {
        console.error('Failed to update status:', e);
      }
    };
    updateMyStatus();
    const timeout = setTimeout(updateMyStatus, 60000); // refresh every minute
    return () => clearTimeout(timeout);
  }, [user?.id, myStatus, updateStatus]);

  // Update remaining time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync local status from the fetched staff profile
  useEffect(() => {
    if (data?.myProfile && myStatus === '') {
      setMyStatus((data.myProfile as any)?.status || 'OFF');
    }
  }, [data, myStatus]);

  const handleStatusChange = async (status: string) => {
    if (statusUpdating || status === myStatus) return;
    setStatusUpdating(true);
    try {
      await updateStatus('/staff/my-status', 'PATCH', { status });
      setMyStatus(status);
      toast.success('Status updated');
      refetch();
    } catch (e) {}
    finally { setStatusUpdating(false); }
  };

  const stats = data?.stats || {
    bookingsToday: 0,
    staffOnline: 0,
    pendingBookings: 0,
    staffOnBreak: 0,
    staffOnTreatment: 0,
    availableTherapists: 0,
    inChargeStaff: 0,
    busyStaff: 0,
    offAirStaff: 0,
    todayRevenue: 0,
    todayCommission: 0,
    confirmedBookings: 0,
    inTreatmentBookings: 0,
    completedTreatments: 0,
  };
  const staffStatus = data?.staffStatus || [];
  const nextBookings = data?.nextBookings || [];
  const activities = data?.activities || [];
    const myTodayBookings = (data?.myTodayBookings || []) as MyBooking[];
  // Today's treatments and commission are computed from completed bookings so
  // they stay in sync with the actual treatment transactions.
  const completedToday = myTodayBookings.filter(b => b.status === 'COMPLETED').length;
  const todayCommission = myTodayBookings
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + Number(b.commission || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FREE': return 'bg-green-100 text-green-800 border-green-200';
      case 'IN_TREATMENT': return 'bg-red-100 text-red-800 border-red-200';
      case 'ON_BREAK': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_CHARGE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'OFF': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'FREE': return 'FREE';
      case 'IN_TREATMENT': return 'BUSY';
      case 'ON_BREAK': return 'BREAK';
      case 'IN_CHARGE': return 'IN CHARGE';
      case 'OFF': return 'OFF AIR';
      default: return status;
    }
  };

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const isStaff = user?.role === 'STAFF';

  if (isStaff) {
    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
                <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Hi, {user.name}</h1>
          <p className="text-gray-500 mt-1">{todayLabel}</p>
          <p className="text-sm text-gray-400 mt-1">{now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Treatments Today</p>
                <p className="text-2xl font-bold text-gray-900">{completedToday}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Today's Commission</p>
                <p className="text-2xl font-bold text-gray-900">Rp {todayCommission.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Attendance</p>
                <button onClick={() => navigate('/attendance')} className="text-blue-600 hover:underline text-sm font-medium">Open</button>
              </div>
            </div>
          </div>
                </div>

        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            My Availability
          </h2>
          <p className="text-sm text-gray-500 mb-3">Current status: <span className="font-medium text-gray-900">{getStatusLabel(myStatus)}</span></p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                disabled={statusUpdating}
                className={"px-3 py-2 rounded-lg text-sm font-medium transition-all " +
                  (myStatus === option.value
                    ? 'bg-primary-600 text-white ring-2 ring-primary-500 ring-offset-2'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200') +
                  " disabled:opacity-50"}
              >
                {option.emoji} {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Today's Schedule
          </h2>
          {myTodayBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No bookings scheduled for today</p>
              <p className="text-sm mt-1">You are currently <span className="font-medium">{getStatusLabel(myStatus).toLowerCase()}</span></p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTodayBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-l-4 border-primary-500">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-primary-700">
                        {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                      </span>
                      <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + getStatusColor(booking.status)}>
                        {booking.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">{booking.treatmentName || 'Treatment'}</p>
                    <p className="text-sm text-gray-600">Customer: {booking.customerName}</p>
                    <p className="text-sm text-gray-500">Room: {booking.room}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Upcoming Treatment
          </h2>
          {nextBookings.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No upcoming treatments</p>
          ) : (
            <div className="space-y-3">
              {nextBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{booking.customerName}</p>
                    <p className="text-sm text-gray-600">{booking.treatmentName}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(booking.startTime)} {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-600">{booking.room}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => navigate('/announcements')} className="card hover:shadow-md transition-shadow text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium text-gray-900 text-sm">Announcements</p>
          </button>
          <button onClick={() => navigate('/chat')} className="card hover:shadow-md transition-shadow text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium text-gray-900 text-sm">Chat</p>
          </button>
          <button onClick={() => navigate('/profile')} className="card hover:shadow-md transition-shadow text-center">
            <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium text-gray-900 text-sm">Profile</p>
          </button>
          <button onClick={() => navigate('/attendance')} className="card hover:shadow-md transition-shadow text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium text-gray-900 text-sm">Attendance</p>
          </button>
        </div>
      </div>
    );
  }

  // Admin/Developer Dashboard
  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your outlet</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{stats.bookingsToday}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Staff Online</p>
              <p className="text-2xl font-bold text-gray-900">{stats.staffOnline}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingBookings}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-2xl font-bold text-gray-900">{stats.availableTherapists}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In-Charge</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inChargeStaff}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Busy</p>
              <p className="text-2xl font-bold text-gray-900">{stats.busyStaff}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Off-Air</p>
              <p className="text-2xl font-bold text-gray-900">{stats.offAirStaff}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Confirmed</p>
              <p className="text-2xl font-bold text-blue-600">{stats.confirmedBookings}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In-Treatment</p>
              <p className="text-2xl font-bold text-red-600">{stats.inTreatmentBookings}</p>
            </div>
            <Clock className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedTreatments}</p>
            </div>
            <Activity className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Revenue</p>
              <p className="text-2xl font-bold text-green-600">Rp {stats.todayRevenue.toLocaleString('id-ID')}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Commission</p>
              <p className="text-2xl font-bold text-purple-600">Rp {stats.todayCommission.toLocaleString('id-ID')}</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="card lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Staff Availability
          </h2>
          <div className="space-y-3">
            {staffStatus.length === 0 ? (
              <p className="text-gray-500 text-sm">No staff data available</p>
            ) : (
              staffStatus.map((staff) => {
                const statusEmoji = {
                  'FREE': '🟢',
                  'IN_CHARGE': '🟡',
                  'IN_TREATMENT': '🔴',
                  'ON_BREAK': '☕',
                  'OFF': '⚫'
                }[staff.status] || '⚪';

                return (
                  <div key={staff.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{staff.name}</p>
                        <p className="text-xs text-gray-500">{staff.outletName}</p>
                      </div>
                      <span className={"px-3 py-1 rounded-full text-xs font-medium border " + getStatusColor(staff.status)}>
                        {statusEmoji} {getStatusLabel(staff.status)}
                      </span>
                    </div>

                    {staff.status === 'IN_TREATMENT' && staff.currentTreatment && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                        <p className="text-sm font-medium text-gray-700">{staff.currentTreatment}</p>
                        {staff.currentCustomer && (
                          <p className="text-xs text-gray-600">Customer: {staff.currentCustomer}</p>
                        )}
                        {staff.startTime && staff.endTime && (
                          <p className="text-xs text-gray-600">
                            Time: {formatTime(staff.startTime)} - {formatTime(staff.endTime)}
                          </p>
                        )}
                        {staff.room && (
                          <p className="text-xs text-gray-600">Room: {staff.room}</p>
                        )}
                        {staff.endTime && (
                          <p className="text-xs font-medium text-red-600 mt-1">
                            {(() => {
                              const end = new Date(staff.endTime);
                              const diff = end.getTime() - now.getTime();
                              const mins = Math.max(0, Math.ceil(diff / (1000 * 60)));
                              return `${mins} minute${mins !== 1 ? 's' : ''} remaining`;
                            })()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="card lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Next Bookings
          </h2>
          <div className="space-y-3">
            {nextBookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming bookings</p>
            ) : (
              nextBookings.slice(0, 5).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{booking.customerName}</p>
                    <p className="text-sm text-gray-500">
                      {booking.treatmentName} with {booking.therapistName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(booking.startTime)} {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-600">{booking.room}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </h2>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.userName}</span> {activity.action.toLowerCase().replace(/_/g, ' ')}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-gray-500 mt-1">
                        {JSON.stringify(activity.details)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(activity.createdAt)} {formatTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}