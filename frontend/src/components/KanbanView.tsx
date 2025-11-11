import React from "react";

export const KanbanView = ({ data }: { data: any }) => (
  <div className="flex h-full overflow-x-auto p-6 gap-4">
    {data.columns.map((col: any, idx: number) => (
      <div key={idx} className="min-w-[250px] bg-[#1f1f1f] p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-2">{col.name}</h2>
        <div className="space-y-2">
          {col.cards.map((card: string, i: number) => (
            <div key={i} className="bg-[#2b2b2b] p-2 rounded-md text-sm">{card}</div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
