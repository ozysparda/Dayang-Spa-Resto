import { useState, useEffect } from 'react';
import { Play, Square, Coffee } from 'lucide-react';
import api from '../services/api';

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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState({
    clockedIn: false,
    onBreak: false,
  });

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/attendance');
      setRecords(res.data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      await api.post('/attendance/clock-in');
      fetchAttendance();
      setCurrentStatus({ ...currentStatus, clockedIn: true });
    } catch (error) {
      console.error('Failed to clock in:', error);
    }
  };

  const handleClockOut = async () => {
    try {
      await api.post('/attendance/clock-out');
      fetchAttendance();
      setCurrentStatus({ ...currentStatus, clockedIn: false, onBreak: false });
    } catch (error) {
      console.error('Failed to clock out:', error);
    }
  };

  const handleBreakStart = async () => {
    try {
      await api.post('/attendance/break-start');
      fetchAttendance();
      setCurrentStatus({ ...currentStatus, onBreak: true });
    } catch (error) {
      console.error('Failed to start break:', error);
    }
  };

  const handleBreakEnd = async () => {
    try {
      await api.post('/attendance/break-end');
      fetchAttendance();
      setCurrentStatus({ ...currentStatus, onBreak: false });
    } catch (error) {
      console.error('Failed to end break:', error);
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