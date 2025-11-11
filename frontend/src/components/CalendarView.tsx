import React from "react";

export const CalendarView = ({ data }: { data: any }) => (
  <div className="p-6 space-y-3">
    <h1 className="text-xl font-semibold mb-2">{data.name}</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {data.events.map((e: any, idx: number) => (
        <div key={idx} className="bg-[#1f1f1f] p-4 rounded-md border border-gray-700">
          <div className="text-lg font-medium">{e.title}</div>
          <div className="text-sm text-gray-400">{e.date}</div>
          <div className="text-sm text-blue-400">{e.status}</div>
        </div>
      ))}
    </div>
  </div>
);
