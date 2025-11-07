import React, { useEffect, useState } from "react";
import {
  Briefcase,
  Home as HomeIcon,
  ListTodo,
  Settings,
  ShoppingCart,
  Search,
  Inbox,
  Plus,
  Trash2,
} from "lucide-react";

const HomePage: React.FC = () => {
  const [dataFiles, setDataFiles] = useState<{ name: string; file: string; data: any }[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // 🔹 Dynamically import all JSON files from src/data
  useEffect(() => {
    const loadData = async () => {
      const modules = import.meta.glob("@/data/*.json", { eager: true });
      const files = Object.entries(modules).map(([path, content]) => {
        const name = path.split("/").pop()?.replace(".json", "") || "Untitled";
        return { name, file: path, data: content as any };
      });
      setDataFiles(files);
    };
    loadData();
  }, []);

  const activeData = dataFiles[activeIndex]?.data;

  // 🔹 Update specific cell
  const handleValueChange = (rowIndex: number, colIndex: number, newValue: string) => {
    const updated = { ...activeData };
    updated.values[rowIndex][colIndex] = newValue;

    const newFiles = [...dataFiles];
    newFiles[activeIndex].data = updated;
    setDataFiles(newFiles);
  };

  // 🔹 Add new row
  const handleAddRow = () => {
    const updated = { ...activeData };
    const newRow = activeData.columns.map(() => "");
    updated.values.push(newRow);

    const newFiles = [...dataFiles];
    newFiles[activeIndex].data = updated;
    setDataFiles(newFiles);
  };

  // 🔹 Delete row
  const handleDeleteRow = (rowIndex: number) => {
    const updated = { ...activeData };
    updated.values.splice(rowIndex, 1);

    const newFiles = [...dataFiles];
    newFiles[activeIndex].data = updated;
    setDataFiles(newFiles);
  };

  return (
    <div className="flex h-screen bg-[#191919] text-gray-200 font-sans">
      {/* Sidebar */}
      <aside className="w-60 bg-[#1f1f1f] border-r border-gray-700 flex flex-col justify-between">
        <div>
          <div className="p-4 text-lg font-semibold">Risheekesh K G’s Space</div>

          <nav className="flex flex-col gap-1 px-3">
            <SidebarItem icon={<Search size={18} />} text="Search" />
            <SidebarItem icon={<HomeIcon size={18} />} text="Home" />
            <SidebarItem icon={<ListTodo size={18} />} text="Meetings" badge="New" />
            <SidebarItem icon={<Inbox size={18} />} text="Inbox" />

            <div className="pt-3 text-xs text-gray-400 uppercase">Private</div>
            {dataFiles.map((f, idx) => (
              <SidebarItem
                key={idx}
                icon={<Briefcase size={18} />}
                text={f.name}
                active={idx === activeIndex}
                onClick={() => setActiveIndex(idx)}
              />
            ))}

            <div className="pt-3 text-xs text-gray-400 uppercase">Shared</div>
            <SidebarItem icon={<ShoppingCart size={18} />} text="Shared Resources" />
          </nav>
        </div>

        <div className="p-3">
          <SidebarItem icon={<Settings size={18} />} text="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {activeData ? (
          <>
            <header className="border-b border-gray-700 p-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Briefcase size={20} /> {activeData.name || dataFiles[activeIndex].name}
              </h1>
              <button
                onClick={handleAddRow}
                className="flex items-center gap-2 bg-blue-600 px-3 py-1.5 rounded-md text-sm hover:bg-blue-700"
              >
                <Plus size={16} /> Add Row
              </button>
            </header>

            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-gray-700 text-gray-400 text-sm">
                  <tr>
                    {activeData.columns.map((col: any, idx: number) => (
                      <th key={idx} className="pb-3">
                        {col.name}
                      </th>
                    ))}
                    <th className="pb-3 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="text-sm">
                  {activeData.values.map((row: any[], rowIndex: number) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-gray-800 hover:bg-[#222] transition"
                    >
                      {row.map((value, colIndex) => {
                        const col = activeData.columns[colIndex];
                        switch (col.type) {
                          case "options":
                            return (
                              <td key={colIndex} className="py-3">
                                <EditableOptionCell
                                  value={value}
                                  options={col.options || []}
                                  onChange={(v) =>
                                    handleValueChange(rowIndex, colIndex, v)
                                  }
                                />
                              </td>
                            );
                          case "date":
                            return (
                              <td key={colIndex} className="py-3">
                                <EditableDateCell
                                  value={value}
                                  onChange={(v) =>
                                    handleValueChange(rowIndex, colIndex, v)
                                  }
                                />
                              </td>
                            );
                          default:
                            return (
                              <td key={colIndex} className="py-3">
                                <EditableTextCell
                                  value={value}
                                  onChange={(v) =>
                                    handleValueChange(rowIndex, colIndex, v)
                                  }
                                />
                              </td>
                            );
                        }
                      })}
                      <td className="text-center">
                        <button
                          onClick={() => handleDeleteRow(rowIndex)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-gray-500">
            Loading data...
          </div>
        )}
      </main>
    </div>
  );
};

//
// Editable Components
//
const EditableTextCell = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  return editing ? (
    <input
      type="text"
      value={tempValue}
      onChange={(e) => setTempValue(e.target.value)}
      onBlur={() => {
        onChange(tempValue);
        setEditing(false);
      }}
      className="bg-[#1f1f1f] text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm w-full"
      autoFocus
    />
  ) : (
    <span onClick={() => setEditing(true)} className="cursor-text hover:underline">
      {value || "—"}
    </span>
  );
};

const EditableDateCell = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const formatted = value
    ? new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
  return editing ? (
    <input
      type="date"
      value={tempValue || ""}
      onChange={(e) => {
        setTempValue(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => setEditing(false)}
      className="bg-[#1f1f1f] text-gray-100 border border-gray-600 rounded px-2 py-1 text-sm w-[150px]"
      autoFocus
    />
  ) : (
    <span onClick={() => setEditing(true)} className="cursor-pointer hover:underline">
      {formatted}
    </span>
  );
};

const EditableOptionCell = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  return editing ? (
    <select
      value={tempValue}
      onChange={(e) => {
        setTempValue(e.target.value);
        onChange(e.target.value);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      className="bg-[#1f1f1f] text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm"
      autoFocus
    >
      {options.map((opt) => (
        <option key={opt}>{opt}</option>
      ))}
    </select>
  ) : (
    <span onClick={() => setEditing(true)} className="cursor-pointer hover:underline">
      {value || "—"}
    </span>
  );
};

const SidebarItem = ({
  icon,
  text,
  badge,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  text: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`flex justify-between items-center px-3 py-2 rounded-md cursor-pointer ${
      active ? "bg-[#2b2b2b] text-white" : "hover:bg-[#2b2b2b]"
    }`}
  >
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm">{text}</span>
    </div>
    {badge && <span className="text-xs bg-blue-700 px-1.5 py-0.5 rounded-md">{badge}</span>}
  </div>
);

export default HomePage;
