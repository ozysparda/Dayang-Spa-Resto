import { useEffect, useState } from 'react';
import { Calendar, Users, Clock, AlertCircle, Activity, UserCheck } from 'lucide-react';
import { useParallelFetch, useAsyncMutation } from '../hooks/useAsyncData';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface DashboardStats {
  bookingsToday: number;
  staffOnline: number;
  pendingBookings: number;
  staffOnBreak: number;
  staffOnTreatment: number;
  availableTherapists: number;
}

interface StaffStatus {
  id: string;
  name: string;
  status: string;
  outletName: string;
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

type DashboardData = {
  stats: DashboardStats;
  staffStatus: StaffStatus[];
  nextBookings: NextBooking[];
  activities: Activity[];
  myProfile?: any;
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const updateStatus = useAsyncMutation();
  const [myStatus, setMyStatus] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Auto-refresh dashboard data every 30 seconds for real-time updates
  const { data, loading, refetch } = useParallelFetch<DashboardData>([
    { key: 'stats', url: '/dashboard/stats' },
    { key: 'staffStatus', url: '/dashboard/staff-status' },
    { key: 'nextBookings', url: '/dashboard/next-bookings' },
    { key: 'activities', url: '/dashboard/activity?limit=10' },
    ...(user?.role === 'STAFF' ? [{ key: 'myProfile', url: '/staff/me' }] : []),
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  // Sync local status from the fetched staff profile
  useEffect(() => {
    if (data?.myProfile && myStatus === '') {
      setMyStatus((data.myProfile)?.status || 'OFF');
    }
  }, [data, myStatus]);

    const handleStatusChange = async (status: string) => {
    if (statusUpdating || status === myStatus) return;
    setStatusUpdating(true);
    try {
      await updateStatus('/staff/my-status', 'PATCH', { status });
      setMyStatus(status);
      toast.success('Status updated to ' + status.replace(/_/g, ' '));
      refetch();
    } catch (error) {
      // Error handled by useAsyncMutation
    } finally {
      setStatusUpdating(false);
    }
  };
  const stats = data?.stats || {
    bookingsToday: 0,
    staffOnline: 0,
    pendingBookings: 0,
    staffOnBreak: 0,
    staffOnTreatment: 0,
    availableTherapists: 0,
  };
  const staffStatus = data?.staffStatus || [];
  const nextBookings = data?.nextBookings || [];
  const activities = data?.activities || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FREE':
        return 'bg-green-100 text-green-800';
      case 'IN_TREATMENT':
        return 'bg-blue-100 text-blue-800';
      case 'ON_BREAK':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_CHARGE':
        return 'bg-purple-100 text-purple-800';
      case 'OFF':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const isStaff = user?.role === 'STAFF';
  const isAdmin = ['ADMIN', 'DEVELOPER'].includes(user?.role || '');

  const statCards = [
    { label: 'Bookings Today', value: stats.bookingsToday, icon: Calendar, color: 'bg-blue-500' },
    ...(isAdmin ? [{ label: 'Staff Online', value: stats.staffOnline, icon: Users, color: 'bg-green-500' }] : []),
    ...(isAdmin ? [{ label: 'Pending Bookings', value: stats.pendingBookings, icon: Clock, color: 'bg-yellow-500' }] : []),
    ...(isAdmin ? [{ label: 'Staff on Break', value: stats.staffOnBreak, icon: AlertCircle, color: 'bg-orange-500' }] : []),
    ...(isStaff ? [{ label: 'My Status', value: stats.availableTherapists > 0 ? 'Active' : 'Inactive', icon: Activity, color: 'bg-purple-500' }] : []),
  ];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Staff self status control (STAFF role only) */}
      {isStaff && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            My Availability
          </h2>
          <p className="text-sm text-gray-500 mb-3">Current status: <span className="font-medium text-gray-900">{myStatus ? myStatus.replace(/_/g, ' ') : '...'}</span></p>
          <div className="flex flex-wrap gap-2">
            {['FREE', 'IN_CHARGE', 'ON_BREAK', 'OFF'].map((st) => (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                disabled={statusUpdating}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${myStatus === st ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Staff Status */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Staff Status
          </h2>
          <div className="space-y-3">
            {staffStatus.length === 0 ? (
              <p className="text-gray-500 text-sm">No staff data available</p>
            ) : (
              staffStatus.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{staff.name}</p>
                    <p className="text-sm text-gray-500">{staff.outletName}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(staff.status)}`}>
                    {staff.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Next Bookings */}
        <div className="card">
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
      </div>

      {/* Activity Feed */}
      <div className="card">
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
  );
}