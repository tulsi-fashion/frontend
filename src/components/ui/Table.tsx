import { ReactNode } from 'react';

interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  loading?: boolean;
}

export default function Table<T extends { id?: string }>({ columns, data, emptyMessage = 'No data found.', loading }: TableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-[#f5f7fb] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e5e9f0]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f5f7fb] border-b border-[#e5e9f0]">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-3 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide whitespace-nowrap ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e5e9f0] bg-white">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[#798397] text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr key={(row as { id?: string }).id || ri} className="hover:bg-[#f9fafb] transition-colors">
                {columns.map((col, ci) => (
                  <td key={ci} className={`px-4 py-3 text-[#20283b] ${col.className || ''}`}>
                    {col.render ? col.render(row) : col.accessor ? String(row[col.accessor] ?? '') : ''}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
