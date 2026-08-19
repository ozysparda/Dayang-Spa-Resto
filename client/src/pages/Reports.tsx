import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Loader2, BarChart3, Package } from 'lucide-react';

interface DailyReportData {
  date: string;
  treatments: { treatmentCount: number; revenue: number; commission: number };
  bills: { billCount: number; paid: number; unpaid: number; revenue: number };
  rawMaterials: { materialCount: number; totalCost: number };
}

interface CommissionRow {
  therapistId: string;
  therapistName: string;
  treatmentCount: number;
  revenue: number;
  commission: number;
}

interface RawMaterialRow {
  inventoryId: string;
  productName: string;
  unit: string;
  totalConsumed: number;
  totalCost: number;
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

export default function Reports() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(false);
  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(null);
  const [commissionData, setCommissionData] = useState<CommissionRow[]>([]);
      const [rawMaterials, setRawMaterials] = useState<RawMaterialRow[]>([]);

  const fmt = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRangeObj(dateRange, today, selectedDate);
      const [dailyRes, commissionRes, rawMaterialsRes] = await Promise.all([
        api.get<DailyReportData>('/reports/daily?date=' + start),
        api.get<CommissionRow[]>('/reports/commission?startDate=' + start + '&endDate=' + end),
        api.get<RawMaterialRow[]>('/reports/raw-materials?startDate=' + start + '&endDate=' + end),
      ]);
      setDailyReport(dailyRes.data);
      setCommissionData(commissionRes.data || []);
      setRawMaterials(rawMaterialsRes.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

      useEffect(() => {
    fetchReports();
  }, [dateRange, selectedDate]);

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary-600" />
            Reports
          </h1>
          <p className="text-gray-500 mt-1">Daily treatment, commission, and inventory reports</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <DatePreset label="Today" active={dateRange === 'today'} onClick={() => { setDateRange('today'); setSelectedDate(today); }} />
            <DatePreset label="Yesterday" active={dateRange === 'yesterday'} onClick={() => { setDateRange('yesterday'); }} />
            <DatePreset label="This Week" active={dateRange === 'this-week'} onClick={() => setDateRange('this-week')} />
            <DatePreset label="This Month" active={dateRange === 'this-month'} onClick={() => setDateRange('this-month')} />
          </div>
                    <button
            onClick={fetchReports}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Calendar className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary-600" />
          <p className="text-gray-500">Loading reports...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Treatments</p>
              <p className="text-2xl font-bold text-primary-600">{dailyReport?.treatments.treatmentCount || 0}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Revenue</p>
              <p className="text-2xl font-bold text-green-600">{fmt(dailyReport?.treatments.revenue || 0)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Commission</p>
              <p className="text-2xl font-bold text-blue-600">{fmt(dailyReport?.treatments.commission || 0)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 uppercase">Inventory Used</p>
              <p className="text-2xl font-bold text-purple-600">{fmt(dailyReport?.rawMaterials.totalCost || 0)}</p>
            </div>
          </div>

          {/* Commission Breakdown */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">Commission by Therapist</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr className="text-left text-gray-600 uppercase text-xs">
                    <th className="px-4 py-3">Therapist</th>
                    <th className="px-4 py-3 text-center">Treatments</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No commission data for this period</td>
                    </tr>
                  ) : (
                    commissionData.map((row) => (
                      <tr key={row.therapistId} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.therapistName}</td>
                        <td className="px-4 py-3 text-center">{row.treatmentCount}</td>
                        <td className="px-4 py-3 text-right">{fmt(row.revenue)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(row.commission)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Materials Consumption */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Raw Material Consumption
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr className="text-left text-gray-600 uppercase text-xs">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Unit</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rawMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No material consumption data</td>
                    </tr>
                  ) : (
                    rawMaterials.map((row) => (
                      <tr key={row.inventoryId} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.productName}</td>
                        <td className="px-4 py-3 text-center">{row.unit}</td>
                                                <td className="px-4 py-3 text-right">{Math.abs(Number(row.totalConsumed)).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{fmt(Math.abs(row.totalCost))}</td>
                      </tr>
                    ))
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
