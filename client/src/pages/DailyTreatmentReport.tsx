import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Loader2, TrendingUp, Zap } from 'lucide-react';

interface TreatmentRow {
  treatmentId: string;
  treatmentName: string;
  treatmentCount: number;
  revenue: number;
  commission: number;
}

const DatePreset = ({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {label}
  </button>
);

function getDateRangeObj(dateRange: string, today: string, selectedDate: string): { start: string; end: string } {
  switch (dateRange) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const dStr = d.toISOString().split('T')[0];
      return { start: dStr, end: dStr };
    }
    case 'this-week': {
      const d = new Date();
      const day = d.getDay() || 7;
      const start = new Date(d);
      start.setDate(d.getDate() - (day - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'this-month': {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    default:
      return { start: selectedDate, end: selectedDate };
  }
}

export default function DailyTreatmentReport() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(false);
  const [treatmentData, setTreatmentData] = useState<TreatmentRow[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalCommission: 0, totalTreatments: 0 });

  const fmt = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  const fetchTreatmentReport = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRangeObj(dateRange, today, selectedDate);
      const res = await api.get<any>(`/reports/treatments?startDate=${start}&endDate=${end}`);
      const data = res.data || [];
      setTreatmentData(data);
      
      // Calculate summary from data
      const totalRevenue = data.reduce((sum: number, row: TreatmentRow) => sum + Number(row.revenue || 0), 0);
      const totalCommission = data.reduce((sum: number, row: TreatmentRow) => sum + Number(row.commission || 0), 0);
      const totalTreatments = data.reduce((sum: number, row: TreatmentRow) => sum + Number(row.treatmentCount || 0), 0);
      
      setSummary({ totalRevenue, totalCommission, totalTreatments });
    } catch (e: any) {
      console.error('Treatment report error:', e);
      toast.error(e.response?.data?.message || 'Failed to fetch treatment report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreatmentReport();
  }, [dateRange, selectedDate]);

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary-600" />
            Daily Treatment Report
          </h1>
          <p className="text-gray-500 mt-1">Treatment performance and revenue analysis</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <DatePreset 
              label="Today" 
              active={dateRange === 'today'} 
              onClick={() => { setDateRange('today'); setSelectedDate(today); }} 
            />
            <DatePreset 
              label="Yesterday" 
              active={dateRange === 'yesterday'} 
              onClick={() => { setDateRange('yesterday'); }} 
            />
            <DatePreset 
              label="This Week" 
              active={dateRange === 'this-week'} 
              onClick={() => setDateRange('this-week')} 
            />
            <DatePreset 
              label="This Month" 
              active={dateRange === 'this-month'} 
              onClick={() => setDateRange('this-month')} 
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => { setSelectedDate(e.target.value); setDateRange('custom'); }}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary-600" />
          <p className="text-gray-500">Loading treatment report...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-xl font-bold text-gray-900">{fmt(summary.totalRevenue)}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Commission</p>
                  <p className="text-xl font-bold text-gray-900">{fmt(summary.totalCommission)}</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Treatments</p>
                  <p className="text-xl font-bold text-gray-900">{summary.totalTreatments}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Treatment Breakdown */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">Performance by Treatment Type</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr className="text-left text-gray-600 uppercase text-xs">
                    <th className="px-4 py-3">Treatment</th>
                    <th className="px-4 py-3 text-center">Count</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Avg. Price</th>
                  </tr>
                </thead>
                <tbody>
                  {treatmentData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No treatment data for this period
                      </td>
                    </tr>
                  ) : (
                    treatmentData
                      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
                      .map((row) => {
                        const avgPrice = row.treatmentCount > 0 ? row.revenue / row.treatmentCount : 0;
                        return (
                          <tr key={row.treatmentId} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{row.treatmentName || 'Unknown'}</td>
                            <td className="px-4 py-3 text-center">{row.treatmentCount}</td>
                            <td className="px-4 py-3 text-right">{fmt(row.revenue)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(row.commission)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmt(avgPrice)}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}