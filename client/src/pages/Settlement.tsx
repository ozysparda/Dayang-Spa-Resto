import { useState } from 'react';
import { Wallet, Download, CheckCircle2, Loader2, Printer, X } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface PendingBooking {
  bookingId: string;
  customerName: string;
  customerPhone?: string | null;
  treatmentName?: string | null;
  therapistName?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  price: number | string;
  commission: number | string;
  room?: string | null;
}

interface SettlementReport {
  date: string;
  totalRevenue: number;
  totalCommission: number;
  treatmentCount: number;
  completedBookings: number;
  statusBreakdown: {
    pending: number;
    confirmed: number;
    inTreatment: number;
    pendingPayment: number;
    completed: number;
    cancelled: number;
    noShow: number;
    all: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_TREATMENT: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
  NO_SHOW: 'bg-gray-100 text-gray-800 border-gray-200',
};

const formatRupiah = (value: number | string = 0) =>
  Number(value || 0).toLocaleString('id-ID');

const formatTime = (value: string) => {
  const d = new Date(value);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default function Settlement() {
  const [date, setDate] = useState('');
  const { data: pendingData, loading, refetch } = useAsyncData<PendingBooking[]>(
    '/settlements' + (date ? `?date=${date}` : '')
  );
  const mutate = useAsyncMutation();
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<SettlementReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pending = pendingData || [];

  const totalSelected = Array.from(selected);
  const totalPrice = pending
    .filter((b) => selected.has(b.bookingId))
    .reduce((sum, b) => sum + Number(b.price || 0), 0);

  const toggleSelect = (bookingId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pending.length && pending.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map((b) => b.bookingId)));
    }
  };

  const handleMarkPaid = async () => {
    if (totalSelected.length === 0) return;
    setSubmitting(true);
    try {
      const result = await mutate('/settlements/complete', 'POST', {
        bookingIds: totalSelected,
      });
      toast.success(`${result?.count ?? totalSelected.length} booking(s) marked as paid`);
      setSelected(new Set());
      refetch();
    } catch {
      // toast handled by useAsyncMutation
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await api.get<SettlementReport>(
        '/settlements/report' + (date ? `?date=${date}` : '')
      );
      setReport(res.data);
    } catch {
      // toast handled globally
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };


  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary-600" />
            Settlement
          </h1>
          <p className="text-gray-500 mt-1">
            Bookings awaiting payment — mark them paid and close the day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelected(new Set());
            }}
            className="input-field !w-auto"
          />
          <button
            onClick={handleGenerateReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Generate Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary-600" />
          Loading settlements...
        </div>
      ) : pending.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">No pending payments</p>
          <p className="text-sm text-gray-500 mt-1">
            All bookings for this day have been settled.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={pending.length > 0 && selected.size === pending.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Treatment</th>
                  <th className="px-4 py-3">Therapist</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-right">Price (Rp)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
{pending.map((booking) => (
                  <tr
                    key={booking.bookingId}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      selected.has(booking.bookingId) ? 'bg-primary-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(booking.bookingId)}
                        onChange={() => toggleSelect(booking.bookingId)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {booking.bookingId}
                      {booking.room ? (
                        <span className="block text-gray-400">{booking.room}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {booking.customerName}
                      {booking.customerPhone ? (
                        <span className="block text-xs text-gray-500">{booking.customerPhone}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{booking.treatmentName || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{booking.therapistName || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatRupiah(booking.price)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium border ' +
                          (STATUS_COLORS[booking.status] || STATUS_COLORS.PENDING)
                        }
                      >
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{totalSelected.length}</span> selected
              {totalSelected.length > 0 && (
                <span className="ml-2">
                  Total: <span className="font-semibold text-gray-900">Rp {formatRupiah(totalPrice)}</span>
                </span>
              )}
            </div>
            <button
              onClick={handleMarkPaid}
              disabled={submitting || totalSelected.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark Paid ({totalSelected.length})
            </button>
          </div>
        </div>
      )}
{report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReport(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto print-area"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Settlement Report</h2>
              <button
                onClick={() => setReport(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 print:hidden"
                aria-label="Close report"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm text-gray-500">Report date</p>
                <p className="text-xl font-bold text-gray-900">{report.date}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-700 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700">Rp {formatRupiah(report.totalRevenue)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-700 font-medium">Total Commission</p>
                  <p className="text-2xl font-bold text-blue-700">Rp {formatRupiah(report.totalCommission)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Treatments completed: <span className="font-semibold text-gray-900">{report.treatmentCount}</span>
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Pending', value: report.statusBreakdown.pending },
                    { label: 'Confirmed', value: report.statusBreakdown.confirmed },
                    { label: 'In Treatment', value: report.statusBreakdown.inTreatment },
                    { label: 'Pending Payment', value: report.statusBreakdown.pendingPayment },
                    { label: 'Completed', value: report.statusBreakdown.completed },
                    { label: 'Cancelled', value: report.statusBreakdown.cancelled },
                    { label: 'No Show', value: report.statusBreakdown.noShow },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handlePrintReport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors print:hidden"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
