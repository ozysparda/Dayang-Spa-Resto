import { useState, useEffect } from 'react';
import { DollarSign, Calendar, Filter } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface CommissionRecord {
  id: string;
  bookingId: string;
  customerName: string;
  therapistName: string;
  therapistId: string;
  treatmentName: string;
  treatmentId: string;
  startTime: string;
  endTime: string;
  price: number;
  commission: number;
  room: string;
  notes: string;
  recordedBy: string;
  createdAt: string;
}

interface CommissionSummary {
  totalRevenue: number;
  totalCommission: number;
  count: number;
}

export default function Commissions() {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({ totalRevenue: 0, totalCommission: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const fetchCommissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (search) params.set('search', search);
      const response = await api.get(`/commissions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords(response.data.records || []);
      setSummary(response.data.summary || { totalRevenue: 0, totalCommission: 0, count: 0 });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch commissions';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [dateFrom, dateTo, search]);

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="p-8 text-center">Loading commissions...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Commissions</h1>
        <p className="text-gray-500 mt-1">Treatment commission summary and history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">{fmtCurrency(summary.totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Commission</p>
              <p className="text-xl font-bold text-gray-900">{fmtCurrency(summary.totalCommission)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Treatments</p>
              <p className="text-xl font-bold text-gray-900">{summary.count}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Customer</label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer name..." className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={fetchCommissions} className="btn-primary w-full">Apply Filters</button>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Therapist</th>
              <th>Treatment</th>
              <th>Time</th>
              <th>Room</th>
              <th>Price</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-500">
                  No commission records found
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td className="text-sm">{fmtDateTime(r.createdAt)}</td>
                  <td className="font-medium">{r.bookingId || '-'}</td>
                  <td>{r.customerName}</td>
                  <td>{r.therapistName}</td>
                  <td>{r.treatmentName}</td>
                  <td className="text-sm">
                    {fmtDateTime(r.startTime)} - {fmtDateTime(r.endTime)}
                  </td>
                  <td>{r.room}</td>
                  <td>{fmtCurrency(Number(r.price))}</td>
                  <td className="font-medium text-green-700">{fmtCurrency(Number(r.commission))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
