import React, { useState } from "react";
import {
  X,
  Table,
  CheckSquare,
  FileText,
  Calendar,
  Layout,
  Activity,
  BookOpen,
} from "lucide-react";

interface FileModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type FileType =
  | "table"
  | "todolist"
  | "document"
  | "calendar"
  | "board"
  | "habit"
  | "journal";

export const FileModal: React.FC<FileModalProps> = ({ onClose, onCreated }) => {
  const [fileType, setFileType] = useState<FileType>("table");
  const [newFileName, setNewFileName] = useState("");

  // ✅ Default JSON structures for each file type
  const getDefaultData = (safeName: string): any => {
    switch (fileType) {
      case "table":
        return {
          name: safeName || "Work Table",
          type: "table",
          columns: [
            { name: "Task", type: "text" },
            { name: "Status", type: "options", options: ["In Progress", "Done"] },
            { name: "Priority", type: "options", options: ["High", "Medium", "Low"] },
            { name: "Due Date", type: "date" },
          ],
          values: [["", "In Progress", "Medium", ""]],
        };

      case "todolist":
        return {
          name: safeName || "Todo List",
          type: "todolist",
          items: [
            { task: "Example Task 1", done: false },
            { task: "Example Task 2", done: true },
          ],
        };

      case "document":
        return {
          name: safeName || "Untitled Document",
          type: "document",
          content: "# New Document\n\nStart writing your notes here...",
          lastEdited: new Date().toISOString(),
        };

      case "calendar":
        return {
          name: safeName || "My Calendar",
          type: "calendar",
          events: [
            {
              id: 1,
              title: "Meeting with team",
              date: new Date().toISOString().split("T")[0],
              description: "Project sync-up",
            },
          ],
        };

      case "board":
        return {
          name: safeName || "Project Board",
          type: "board",
          columns: [
            {
              name: "To Do",
              tasks: [{ title: "Start project", description: "Set up repo" }],
            },
            {
              name: "In Progress",
              tasks: [{ title: "Design UI", description: "Create mockups" }],
            },
            {
              name: "Done",
              tasks: [{ title: "Project Idea", description: "Finalize scope" }],
            },
          ],
        };

      case "habit":
        return {
          name: safeName || "Habit Tracker",
          type: "habit",
          habits: [
            { name: "Read", streak: 3, goal: 7 },
            { name: "Workout", streak: 5, goal: 7 },
          ],
        };

      case "journal":
        return {
          name: safeName || "My Journal",
          type: "journal",
          entries: [
            {
              date: new Date().toISOString(),
              title: "First Entry",
              content: "Today I started journaling!",
            },
          ],
        };

      default:
        return {};
    }
  };

  // ✅ Create file handler
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

  // ✅ UI
  const fileTypes: { label: string; type: FileType; icon: JSX.Element }[] = [
    { label: "Table", type: "table", icon: <Table size={16} /> },
    { label: "To-do", type: "todolist", icon: <CheckSquare size={16} /> },
    { label: "Document", type: "document", icon: <FileText size={16} /> },
    { label: "Calendar", type: "calendar", icon: <Calendar size={16} /> },
    { label: "Board", type: "board", icon: <Layout size={16} /> },
    { label: "Habit", type: "habit", icon: <Activity size={16} /> },
    { label: "Journal", type: "journal", icon: <BookOpen size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#2b2b2b] rounded-xl p-6 w-[370px] text-gray-200 relative shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-3">Create New Page</h2>

        <input
          type="text"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="Enter name..."
          className="w-full p-2 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
        />

        <label className="block text-sm mb-2">Select type:</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {fileTypes.map(({ label, type, icon }) => (
            <button
              key={type}
              onClick={() => setFileType(type)}
              className={`flex items-center justify-center gap-2 py-2 rounded-md border transition text-sm ${
                fileType === type
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-600 text-gray-300 hover:border-blue-400"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreateNewFile}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition"
        >
          Create
        </button>
      </div>
    </div>
  );
};
