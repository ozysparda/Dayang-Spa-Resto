import { useState } from 'react';
import { Play, Square, Coffee, Filter } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface AttendanceRecord {
  id: string;
  staffName: string;
  staffId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakStart: string;
  breakEnd: string;
  status: string;
}

export default function Attendance() {
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'DEVELOPER'].includes(user?.role || '');

  const { data: recordsData, loading, refetch } = useAsyncData<AttendanceRecord[]>('/attendance');
  const clockInMutation = useAsyncMutation();
  const clockOutMutation = useAsyncMutation();

  const breakStartMutation = useAsyncMutation();
  const breakEndMutation = useAsyncMutation();

  const records = recordsData || [];

  const [currentStatus, setCurrentStatus] = useState({
    clockedIn: false,
    onBreak: false,
  });

  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    staffId: '',
  });

  const handleClockIn = async () => {
    if (currentStatus.clockedIn) {
      toast.error('Already clocked in today');
      return;
    }
    try {
      await clockInMutation('/attendance/clock-in', 'POST');
      refetch();
      setCurrentStatus({ ...currentStatus, clockedIn: true });
      toast.success('Clocked in successfully');
    } catch (error: any) {
      console.error('Failed to clock in:', error);
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!currentStatus.clockedIn) {
      toast.error('Not clocked in yet');
      return;
    }
    try {
      await clockOutMutation('/attendance/clock-out', 'POST');
      refetch();
      setCurrentStatus({ ...currentStatus, clockedIn: false, onBreak: false });
      toast.success('Clocked out successfully');
    } catch (error: any) {
      console.error('Failed to clock out:', error);
      toast.error('Failed to clock out');
    }
  };

  const handleBreakStart = async () => {
    if (!currentStatus.clockedIn) {
      toast.error('Must clock in first');
      return;
    }
    if (currentStatus.onBreak) {
      toast.error('Already on break');
      return;
    }
    try {
      await breakStartMutation('/attendance/break-start', 'POST');
      refetch();
      setCurrentStatus({ ...currentStatus, onBreak: true });
      toast.success('Break started');
    } catch (error: any) {
      console.error('Failed to start break:', error);
      toast.error('Failed to start break');
    }
  };

  const handleBreakEnd = async () => {
    if (!currentStatus.clockedIn) {
      toast.error('Must clock in first');
      return;
    }
    if (!currentStatus.onBreak) {
      toast.error('Not on break');
      return;
    }
    try {
      await breakEndMutation('/attendance/break-end', 'POST');
      refetch();
      setCurrentStatus({ ...currentStatus, onBreak: false });
      toast.success('Break ended');
    } catch (error: any) {
      console.error('Failed to end break:', error);
      toast.error('Failed to end break');
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const calculateWorkingTime = (record: AttendanceRecord): string => {
    if (!record.clockIn) return '0h 0m';

    const clockIn = new Date(record.clockIn);
    const clockOut = record.clockOut ? new Date(record.clockOut) : new Date();

    let totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60));

    // Subtract break time
    if (record.breakStart && record.breakEnd) {
      const breakStart = new Date(record.breakStart);
      const breakEnd = new Date(record.breakEnd);
      const breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
      totalMinutes -= breakMinutes;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const calculateBreakDuration = (record: AttendanceRecord): string => {
    if (!record.breakStart || !record.breakEnd) return '-';
    const breakStart = new Date(record.breakStart);
    const breakEnd = new Date(record.breakEnd);
    const minutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Attendance</h1>

      {/* Clock In/Out Controls */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Today's Attendance</h2>
        <div className="flex flex-wrap gap-4">
          {!currentStatus.clockedIn ? (
            <button
              onClick={handleClockIn}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Clock In
            </button>
          ) : (
            <>
              <button
                onClick={handleClockOut}
                className="btn-secondary flex items-center gap-2"
              >
                <Square className="w-5 h-5" />
                Clock Out
              </button>
              {!currentStatus.onBreak ? (
                <button
                  onClick={handleBreakStart}
                  className="btn-primary flex items-center gap-2"
                >
                  <Coffee className="w-5 h-5" />
                  Start Break
                </button>
              ) : (
                <button
                  onClick={handleBreakEnd}
                  className="btn-primary flex items-center gap-2"
                >
                  <Coffee className="w-5 h-5" />
                  End Break
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Admin Filters */}
      {isAdmin && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
              <input
                type="text"
                value={filters.staffId}
                onChange={(e) => setFilters({ ...filters, staffId: e.target.value })}
                placeholder="Filter by staff ID"
                className="input-field"
              />
            </div>
          </div>
        </div>
      )}

      {/* Attendance Records */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Attendance History</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {isAdmin && <th>Staff</th>}
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Break Start</th>
                <th>Break End</th>
                <th>Break Duration</th>
                <th>Total Working Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td data-label="Date">{formatDate(record.date)}</td>
                    {isAdmin && <td data-label="Staff" className="font-medium">{record.staffName}</td>}
                    <td data-label="Clock In">{formatTime(record.clockIn)}</td>
                    <td data-label="Clock Out">{formatTime(record.clockOut)}</td>
                    <td data-label="Break Start">{formatTime(record.breakStart)}</td>
                    <td data-label="Break End">{formatTime(record.breakEnd)}</td>
                    <td data-label="Break Duration">{calculateBreakDuration(record)}</td>
                    <td data-label="Working Time" className="font-medium">{calculateWorkingTime(record)}</td>
                    <td data-label="Status">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}