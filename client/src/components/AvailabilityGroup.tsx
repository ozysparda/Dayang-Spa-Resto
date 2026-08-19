interface Props {
  label: string;
  color: 'green' | 'red' | 'gray';
  items: any[];
  busy?: boolean;
  emptyMsg: string;
  onSelect?: (s: any) => void;
  renderDetail?: (b: any) => any;
}

export default function AvailabilityGroup({ label, color, items, busy, emptyMsg, onSelect, renderDetail }: Props) {
  const dotClass = { green: 'bg-green-500', red: 'bg-red-500', gray: 'bg-gray-400' }[color];
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
        <span className={`w-3 h-3 ${dotClass} rounded-full`}></span> {label} ({items.length})
      </h3>
      <div className="grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyMsg}</p>
        ) : (
          items.map((s: any, i: number) => (
            <div
              key={`${s.id}-${i}`}
              className={`flex items-center justify-between p-3 ${busy ? 'bg-red-50' : 'bg-green-50'} rounded-lg`}
            >
                            <div>
                <div className="flex justify-between">
                  <span className="font-medium">
                    {s.name}
                    {s.gender && s.gender !== 'Unspecified' && (
                      <span className="text-xs text-gray-500 ml-1">({s.gender})</span>
                    )}
                  </span>
                  {s.status && <span className="text-xs text-gray-500 ml-2">{s.status}</span>}
                </div>
                {busy && s.bookings && s.bookings.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {s.bookings.map((b: any, j: number) =>
                      renderDetail ? renderDetail(b) : <span key={j} className="text-sm text-gray-700" />
                    )}
                  </div>
                )}
              </div>
              {onSelect && (
                <button onClick={() => onSelect(s)} className="btn-primary btn-sm">
                  Select
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
