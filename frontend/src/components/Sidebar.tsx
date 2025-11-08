import React, { memo, useMemo, useState } from "react";
import {
  Settings,
  Search,
  HomeIcon,
  Inbox,
  Briefcase,
  ShoppingCart,
  MessageCircle,
  Plus,
  X,
  Table,
  CheckSquare,
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = memo(
  ({ icon, text, badge, active, onClick }) => (
    <div
      onClick={onClick}
      className={`flex justify-between items-center px-3 py-2 rounded-md cursor-pointer select-none transition-colors ${
        active ? "bg-[#2b2b2b] text-white" : "hover:bg-[#2b2b2b]"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm truncate">{text}</span>
      </div>
      {badge && (
        <span className="text-xs bg-blue-700 px-1.5 py-0.5 rounded-md">
          {badge}
        </span>
      )}
    </div>
  )
);

SidebarItem.displayName = "SidebarItem";

interface SidebarProps {
  dataFiles: Array<{ name: string; file: string; data: any }>;
  activeIndex: number;
  activeView: "data" | "chat";
  onFileSelect: (index: number) => void;
  onViewChange: (view: "data" | "chat") => void;
  onReload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = memo(
  ({ dataFiles, activeIndex, activeView, onFileSelect, onViewChange, onReload }) => {
    const [showModal, setShowModal] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [fileType, setFileType] = useState<"table" | "todolist">("table");

    const privateItems = useMemo(
      () =>
        dataFiles.map((f, idx) => (
          <SidebarItem
            key={f.file}
            icon={<Briefcase size={18} />}
            text={f.name}
            active={idx === activeIndex && activeView === "data"}
            onClick={() => onFileSelect(idx)}
          />
        )),
      [dataFiles, activeIndex, activeView, onFileSelect]
    );

    const getDefaultData = (safeName: string) => {
      if (fileType === "table") {
        return {
          name: safeName || "Work Tasks",
          type: "table",
          columns: [
            { name: "Task", type: "text" },
            {
              name: "Status",
              type: "options",
              options: ["In Progress", "Completed"],
            },
            {
              name: "Priority",
              type: "options",
              options: ["High", "Medium", "Low"],
            },
            { name: "Due Date", type: "date" },
          ],
          values: [["", "In Progress", "Medium", ""]],
        };
      } else {
        return {
          name: safeName || "Personal Tasks",
          type: "todolist",
          items: [
            { task: "New Task 1", done: false },
            { task: "New Task 2", done: false },
          ],
        };
      }
    };

    const handleCreateNewFile = async () => {
      if (!newFileName.trim()) return;

      const safeName = newFileName.trim().replace(/\s+/g, "_").toLowerCase();
      const filename = `${safeName}.json`;

      const defaultData = getDefaultData(safeName);

      try {
        console.log(`🟦 Creating new ${fileType} file:`, filename);
        await window.electronAPI.invoke(
          "writeFile",
          filename,
          JSON.stringify(defaultData, null, 2)
        );
        console.log(`✅ File created: ${filename}`);
        setShowModal(false);
        setNewFileName("");
        setFileType("table");
        onReload();
      } catch (err) {
        console.error("❌ Error creating file:", err);
      }
    };

    return (
      <>
        {/* === Sidebar Layout === */}
        <aside className="w-60 bg-[#1f1f1f] border-r border-gray-700 flex flex-col justify-between">
          <div>
            <div className="p-4 text-lg font-semibold truncate">
              Risheekesh K G&apos;s Space
            </div>

            <nav className="flex flex-col gap-1 px-3 overflow-y-auto">
              <SidebarItem icon={<Search size={18} />} text="Search" />
              <SidebarItem icon={<HomeIcon size={18} />} text="Home" />
              <SidebarItem
                icon={<MessageCircle size={18} />}
                text="AI Chat"
                active={activeView === "chat"}
                onClick={() => onViewChange("chat")}
              />
              <SidebarItem icon={<Inbox size={18} />} text="Inbox" />

              <div className="pt-3 text-xs text-gray-400 uppercase flex items-center justify-between">
                <span>Private</span>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-gray-400 hover:text-white transition"
                  title="Create new file"
                >
                  <Plus size={14} />
                </button>
              </div>

              {privateItems}

              <div className="pt-3 text-xs text-gray-400 uppercase">Shared</div>
              <SidebarItem
                icon={<ShoppingCart size={18} />}
                text="Shared Resources"
              />
            </nav>
          </div>

          <div className="p-3 border-t border-gray-700">
            <SidebarItem icon={<Settings size={18} />} text="Settings" />
          </div>
        </aside>

        {/* === Modal for creating file === */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-[#2b2b2b] rounded-xl p-6 w-[340px] text-gray-200 relative shadow-lg">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
              <h2 className="text-lg font-semibold mb-3">Create New File</h2>

              {/* File name input */}
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter file name..."
                className="w-full p-2 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
              />

              {/* Type selector */}
              <div className="mb-4">
                <label className="block text-sm mb-2">Choose file type:</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFileType("table")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md border transition ${
                      fileType === "table"
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-600 text-gray-300 hover:border-blue-400"
                    }`}
                  >
                    <Table size={16} />
                    Table
                  </button>

                  <button
                    onClick={() => setFileType("todolist")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md border transition ${
                      fileType === "todolist"
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-600 text-gray-300 hover:border-blue-400"
                    }`}
                  >
                    <CheckSquare size={16} />
                    List
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateNewFile}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition"
              >
                Create File
              </button>
            </div>
          </div>
        )}
      </>
    );
  }
);

Sidebar.displayName = "Sidebar";
