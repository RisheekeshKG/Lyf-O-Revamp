import React, { useMemo, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { Search, Filter, Save, Edit3, ChevronLeft, ChevronRight } from "lucide-react";

type RecommendedItem = {
  name: string;
  type: string;
  description?: string;
  tags?: string[];
  created_at?: string;
  [key: string]: any;
};

type Props = {
  recommendations: RecommendedItem[];
  status?: string;
  onSave: (rec: RecommendedItem) => void;
  onEnhance: (rec: RecommendedItem) => void;
};

export default function RecommendPremiumView({
  recommendations,
  status,
  onSave,
  onEnhance,
}: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 6;

  const allTags = useMemo(() => {
    const s = new Set<string>();
    recommendations.forEach((r) => (r.tags || []).forEach((t) => s.add(t)));
    return Array.from(s);
  }, [recommendations]);

  const filtered = useMemo(() => {
    let arr = recommendations.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          (r.type || "").toLowerCase().includes(q)
      );
    }
    if (selectedTags.length) {
      arr = arr.filter((r) => (r.tags || []).some((t) => selectedTags.includes(t)));
    }
    return arr;
  }, [recommendations, query, selectedTags]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <MotionConfig>
      <div className="p-6 bg-gradient-to-b from-[#151515] via-[#141414] to-[#0f0f0f] min-h-screen flex gap-6">
        {/* Left column: controls + grid */}
        <div className="w-2/3 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full">
              <div className="relative flex items-center w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search templates, types or descriptions..."
                  className="pl-10 pr-4 py-2 w-full bg-[#101010] border border-[#222] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 bg-[#0f0f0f] border border-[#222] rounded-lg p-2">
                <Filter className="text-gray-300" />
                <div className="flex gap-2 flex-wrap">
                  {allTags.slice(0, 6).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                        )
                      }
                      className={`text-sm px-2 py-1 rounded-md transition ${
                        selectedTags.includes(t)
                          ? "bg-purple-600 text-white"
                          : "bg-[#121212] text-gray-300 border border-[#1f1f1f]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-sm text-gray-400">{status}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {paged.map((rec, idx) => (
              <motion.div
                key={rec.name + idx}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => setActive((page - 1) * perPage + idx)}
                className={`p-4 rounded-2xl border border-[#232323] bg-gradient-to-b from-[#111] to-[#0b0b0b] cursor-pointer shadow-md flex flex-col gap-3 transition ${
                  active === (page - 1) * perPage + idx ? "ring-2 ring-purple-600" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{rec.name}</div>
                    <div className="text-xs text-gray-400">{rec.type}</div>
                  </div>
                  <div className="text-sm text-gray-400">{rec.created_at || "—"}</div>
                </div>

                <div className="text-sm text-gray-300 line-clamp-4">{rec.description || JSON.stringify(rec).slice(0, 160)}</div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex gap-2 items-center flex-wrap">
                    {(rec.tags || []).slice(0, 4).map((t) => (
                      <span key={t} className="text-xs px-2 py-1 rounded-md bg-[#121212] border border-[#1d1d1d]">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnhance(rec);
                      }}
                      className="text-sm px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6b21a8] to-[#4f46e5] text-white shadow-sm"
                    >
                      <Edit3 className="inline-block mr-2 -mt-0.5" /> Enhance
                    </button>

                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onSave(rec);
                      }}
                      className="text-sm px-3 py-1.5 rounded-lg bg-[#0b74ff] text-white shadow-sm"
                    >
                      <Save className="inline-block mr-2 -mt-0.5" /> Save
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-400">Showing {filtered.length} templates</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-md bg-[#0e0e0e] border border-[#232323]"
              >
                <ChevronLeft />
              </button>
              <div className="px-3 py-1 rounded-md bg-[#0e0e0e] border border-[#232323]">{page} / {pageCount}</div>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="p-2 rounded-md bg-[#0e0e0e] border border-[#232323]"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>

        {/* Right column: preview/details */}
        <aside className="w-1/3 bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Preview</div>
            <div className="text-sm text-gray-400">{active !== null ? `#${active + 1}` : "—"}</div>
          </div>

          {active === null ? (
            <div className="text-gray-500 text-sm">Select a template on the left to preview details, tags and actions.</div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto">
              {(() => {
                const rec = recommendations[active];
                if (!rec) return <div className="text-gray-400">Not found</div>;
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="text-2xl font-bold">{rec.name}</div>
                      <div className="text-sm text-gray-400">{rec.type} • {rec.created_at || "—"}</div>
                    </div>

                    <div className="rounded-lg p-3 bg-[#080808] border border-[#151515] text-sm text-gray-300">
                      {rec.description || JSON.stringify(rec, null, 2).slice(0, 800)}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {(rec.tags || []).map((t) => (
                        <span key={t} className="text-xs px-2 py-1 rounded-md bg-[#0f0f0f] border border-[#202020]">{t}</span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => onEnhance(rec)} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#4f46e5] text-white">Enhance</button>
                      <button onClick={() => onSave(rec)} className="flex-1 px-4 py-2 rounded-lg border border-[#2b6fd6]">Save</button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          <div className="text-xs text-gray-500">Tip: Enhance will personalize the template using your saved profile.</div>
        </aside>
      </div>
    </MotionConfig>
  );
}
