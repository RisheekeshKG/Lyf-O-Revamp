import React, { useState } from "react";
import { X, Table, CheckSquare } from "lucide-react";

interface FileModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const FileModal: React.FC<FileModalProps> = ({ onClose, onCreated }) => {
  const [fileType, setFileType] = useState<"table" | "todolist">("table");
  const [newFileName, setNewFileName] = useState("");

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
      await window.electronAPI.invoke(
        "writeFile",
        filename,
        JSON.stringify(defaultData, null, 2)
      );
      console.log(`✅ Created: ${filename}`);
      onCreated();
      onClose();
    } catch (err) {
      console.error("❌ Error writing file:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#2b2b2b] rounded-xl p-6 w-[340px] text-gray-200 relative shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-semibold mb-3">Create New File</h2>

        <input
          type="text"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="Enter file name..."
          className="w-full p-2 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
        />

        <label className="block text-sm mb-2">Choose file type:</label>
        <div className="flex gap-3 mb-4">
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

        <button
          onClick={handleCreateNewFile}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition"
        >
          Create File
        </button>
      </div>
    </div>
  );
};
