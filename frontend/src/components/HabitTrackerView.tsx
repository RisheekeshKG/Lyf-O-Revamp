import React from "react";

export const HabitTrackerView = ({ data }: { data: any }) => {
  // Normalize shapes — support both table and items-based formats
  const hasTable = Array.isArray(data?.columns) && Array.isArray(data?.values);
  const hasItems = Array.isArray(data?.items);

  if (!hasTable && !hasItems) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        ⚠️ Invalid Habit Tracker data structure.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{data.name || "Habit Tracker"}</h1>

      {/* ✅ Table-based habit tracker */}
      {hasTable && (
        <table className="w-full text-left border-collapse">
          <thead className="border-b border-gray-700 text-gray-400 text-sm">
            <tr>
              {data.columns.map((c: any) => (
                <th key={c.name} className="pb-3">{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.values.map((row: any[], i: number) => (
              <tr key={i} className="border-b border-gray-800">
                {row.map((cell: any, j: number) => (
                  <td key={j} className="py-2">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ✅ Simple items-based habit tracker */}
      {hasItems && (
        <div className="space-y-2">
          {data.items.map((h: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between bg-[#2a2a2a] rounded-md px-3 py-2 hover:bg-[#333] transition"
            >
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={!!h.done} readOnly />
                <span className={h.done ? "line-through text-gray-500" : ""}>
                  {h.habit || h.task || `Habit ${i + 1}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
