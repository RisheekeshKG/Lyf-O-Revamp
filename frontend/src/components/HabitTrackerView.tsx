import React from "react";

export const HabitTrackerView = ({ data }: { data: any }) => (
  <div className="p-6 space-y-3">
    <h1 className="text-xl font-semibold">{data.name}</h1>
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
            {row.map((cell, j) => <td key={j} className="py-2">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
