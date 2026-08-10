import { useState } from 'react';
import { Play, Square, Coffee } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import toast from 'react-hot-toast';

interface AttendanceRecord {
  id: string;
  staffName: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakStart: string;
  breakEnd: string;
  status: string;
}

export default function Attendance() {
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

  const handleClockIn = async () => {
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
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

      {/* Attendance Records */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Attendance History</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Break Start</th>
                <th>Break End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.date)}</td>
                    <td className="font-medium">{record.staffName}</td>
                    <td>{formatTime(record.clockIn)}</td>
                    <td>{formatTime(record.clockOut)}</td>
                    <td>{formatTime(record.breakStart)}</td>
                    <td>{formatTime(record.breakEnd)}</td>
                    <td>
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