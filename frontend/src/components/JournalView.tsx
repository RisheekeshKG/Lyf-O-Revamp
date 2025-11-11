import React from "react";

export const JournalView = ({ data }: { data: any }) => (
  <div className="p-6 space-y-4">
    <h1 className="text-xl font-semibold">{data.name}</h1>
    {data.entries.map((entry: any, idx: number) => (
      <div key={idx} className="bg-[#1f1f1f] p-4 rounded-lg border border-gray-700">
        <div className="text-sm text-gray-400">{entry.date} — Mood: {entry.mood}</div>
        <p className="mt-2">{entry.entry}</p>
      </div>
    ))}
  </div>
);
