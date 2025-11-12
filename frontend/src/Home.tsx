import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { FileModal } from "./components/FileModal";
import { DeleteModal } from "./components/DeleteModal";
import { TableView } from "./components/TableView";
import { TodoListView } from "./components/TodoListView";
import { DocumentView } from "./components/DocumentView";
import { CalendarView } from "./components/CalendarView";
import { KanbanView } from "./components/KanbanView";
import { HabitTrackerView } from "./components/HabitTrackerView";
import { JournalView } from "./components/JournalView";
import { ChatView } from "./components/ChatView";
import { GmailInbox } from "./components/GmailInbox";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

interface DataFile {
  name: string;
  file: string;
  data: any;
}

interface RecommendedItem {
  name: string;
  type: string;
  [key: string]: any;
}

const HomePage: React.FC = () => {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"data" | "chat" | "inbox" | "recommend">("data");
  const [activeData, setActiveData] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [recommendStatus, setRecommendStatus] = useState<string>("");
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);

  // ✅ Load JSON files
  const loadDataFiles = useCallback(async () => {
    try {
      for (let i = 0; i < 20 && !window.electronAPI; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }

      if (!window.electronAPI) {
        console.warn("⚠️ electronAPI not found — preload not loaded");
        setLoading(false);
        return;
      }

      const files: string[] = await window.electronAPI.invoke("readDir");
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      const loaded: DataFile[] = [];

      for (const file of jsonFiles) {
        try {
          const raw = await window.electronAPI.invoke("readFile", file);
          if (!raw) continue;

          const data = typeof raw === "string" ? JSON.parse(raw) : raw;
          loaded.push({ name: data.name || file.replace(".json", ""), file, data });
        } catch (err) {
          console.error(`❌ Failed to parse ${file}:`, err);
        }
      }

      setDataFiles(loaded);
      if (loaded.length > 0) {
        setActiveIndex(0);
        setActiveData(loaded[0].data);
      } else {
        setActiveIndex(null);
        setActiveData(null);
      }
    } catch (err) {
      console.error("❌ Error loading JSON files:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataFiles();
  }, [loadDataFiles]);

  // ✅ Save JSON file
  const saveFile = useCallback(async (file: string, data: any) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.invoke("writeFile", file, JSON.stringify(data, null, 2));
      console.log("💾 Saved:", file);
    } catch (e) {
      console.error("❌ Save failed:", e);
    }
  }, []);

  // ✅ File selection
  const handleFileSelect = (index: number) => {
    setActiveIndex(index);
    setActiveData(dataFiles[index].data);
    setActiveView("data");
  };

  // ✅ View change (Sidebar)
  const handleViewChange = (view: "data" | "chat" | "inbox" | "recommend") => {
    setActiveView(view);
    if (view !== "data") {
      setActiveIndex(null);
      setActiveData(null);
    }
    if (view === "recommend") handleRecommend();
  };

  // ✅ Recommend logic (fetch from backend)
  const handleRecommend = async () => {
    setRecommendStatus("Fetching recommendations...");
    setRecommendations([]);
    try {
      const res = await fetch("http://localhost:8000/recommend", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);

      const result = await res.json();
      if (!Array.isArray(result)) throw new Error("Invalid format: expected array of JSONs");

      // 🩹 Normalize structures (fixes habit tracker)
      const normalized = result.map((jsonData: any) => {
        if (jsonData.type === "habit") {
          jsonData.items = jsonData.items || jsonData.habits || [];
        }
        if (jsonData.type === "todolist") {
          jsonData.items = jsonData.items || [];
        }
        return jsonData;
      });

      setRecommendations(normalized);
      setRecommendStatus(`✅ Found ${normalized.length} recommended templates`);
    } catch (err: any) {
      console.error("❌ Recommend error:", err);
      setRecommendStatus(`❌ ${err.message}`);
    }
  };

  const handleSaveRecommendation = async (rec: RecommendedItem) => {
    if (!window.electronAPI) {
      alert("⚠️ Electron API not found");
      return;
    }
    try {
      const fileName = `${rec.name.toLowerCase().replace(/\s+/g, "_")}.json`;
      await window.electronAPI.invoke("writeFile", fileName, JSON.stringify(rec, null, 2));
      setRecommendStatus(`✅ Saved "${rec.name}"`);
      await loadDataFiles();
    } catch (err) {
      console.error("❌ Save recommend failed:", err);
      setRecommendStatus(`❌ Failed to save ${rec.name}`);
    }
  };

  // ✅ Delete logic
  const requestFileDelete = (file: string) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const result = await window.electronAPI.invoke("deleteFile", fileToDelete);
      if (result?.success) {
        const updatedFiles = dataFiles.filter((f) => f.file !== fileToDelete);
        setDataFiles(updatedFiles);
        if (dataFiles[activeIndex!]?.file === fileToDelete) {
          if (updatedFiles.length > 0) {
            setActiveIndex(0);
            setActiveData(updatedFiles[0].data);
          } else {
            setActiveIndex(null);
            setActiveData(null);
          }
        }
      } else {
        alert("❌ Failed to delete file");
      }
    } catch (err) {
      console.error("❌ Delete failed:", err);
    } finally {
      setShowDeleteModal(false);
      setFileToDelete(null);
    }
  };

  // ✅ Data update handler
  const updateActiveData = (newData: any) => {
    if (activeIndex === null) return;
    setActiveData(newData);
    const updated = [...dataFiles];
    updated[activeIndex] = { ...updated[activeIndex], data: newData };
    setDataFiles(updated);
    saveFile(updated[activeIndex].file, newData);
  };

  // ✅ Chat logic
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    setChatMessages((prev) => [...prev, { sender: "user", text: message }]);
    try {
      const res = await fetch("http://localhost:8000/chat/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message, role: "user" }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
      const data = await res.json();
      if (data.mode === "tool" && data.result?.content) {
        const jsonData = data.result.content;
        const fileName = `${jsonData.name.toLowerCase().replace(/\s+/g, "_")}.json`;
        await window.electronAPI.invoke("writeFile", fileName, JSON.stringify(jsonData, null, 2));
        setChatMessages((prev) => [
          ...prev,
          { sender: "ai", text: `✅ Created new file "${jsonData.name}" (${jsonData.type})` },
        ]);
        await loadDataFiles();
        setActiveView("data");
        return;
      }
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: data.generated_text || "⚙️ No response" },
      ]);
    } catch (err: any) {
      console.error("❌ Chat error:", err);
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: `❌ ${err.message}` },
      ]);
    }
  };

  // ✅ Render correct component
  const renderView = () => {
    if (activeView === "chat")
      return <ChatView messages={chatMessages} onSendMessage={handleSendMessage} onResetChat={() => setChatMessages([])} />;
    if (activeView === "inbox") return <GmailInbox />;
    if (activeView === "recommend")
      return (
        <div className="p-6 text-gray-200 flex flex-col gap-4 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2">Recommended Templates</h2>
          {recommendStatus && <div className="text-gray-400">{recommendStatus}</div>}

          {recommendations.length === 0 ? (
            <div className="text-gray-500">Fetching recommendations...</div>
          ) : (
            recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="bg-[#2a2a2a] rounded-xl p-4 flex justify-between items-center hover:bg-[#333333] transition"
              >
                <div>
                  <div className="text-lg font-semibold">{rec.name}</div>
                  <div className="text-sm text-gray-400">Type: {rec.type}</div>
                  <pre className="text-xs text-gray-500 mt-1 max-w-md overflow-hidden whitespace-pre-wrap">
                    {JSON.stringify(rec, null, 2).slice(0, 180)}...
                  </pre>
                </div>
                <button
                  onClick={() => handleSaveRecommendation(rec)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
                >
                  Save
                </button>
              </div>
            ))
          )}
        </div>
      );

    if (!activeData)
      return <div className="flex items-center justify-center flex-1 text-gray-400">No JSON file found in /data</div>;

    switch (activeData.type) {
      case "table":
        return <TableView data={activeData} onValueChange={(r, c, v) => updateActiveData({
          ...activeData,
          values: activeData.values.map((row: any[], i: number) =>
            i === r ? row.map((col, j) => (j === c ? v : col)) : row
          ),
        })} onAddRow={() => updateActiveData({ ...activeData, values: [...activeData.values, activeData.columns.map(() => "")] })} onDeleteRow={(r) => updateActiveData({ ...activeData, values: activeData.values.filter((_: any, i: number) => i !== r) })} />;
      case "todolist":
        return <TodoListView data={activeData} onToggleTodo={(i) => updateActiveData({ ...activeData, items: activeData.items.map((t: any, idx: number) => idx === i ? { ...t, done: !t.done } : t) })} onEditTodo={(i, text) => updateActiveData({ ...activeData, items: activeData.items.map((t: any, idx: number) => idx === i ? { ...t, task: text } : t) })} onAddTodo={() => updateActiveData({ ...activeData, items: [...activeData.items, { task: "", done: false }] })} onDeleteTodo={(i) => updateActiveData({ ...activeData, items: activeData.items.filter((_: any, idx: number) => idx !== i) })} />;
      case "document":
        return <DocumentView data={activeData} onChange={updateActiveData} />;
      case "calendar":
        return <CalendarView data={activeData} />;
      case "board":
        return <KanbanView data={activeData} />;
      case "habit":
        return <HabitTrackerView data={activeData} />;
      case "journal":
        return <JournalView data={activeData} />;
      default:
        return <div className="flex items-center justify-center flex-1 text-gray-400">Unsupported file type: {activeData.type}</div>;
    }
  };

  if (loading)
    return <div className="flex items-center justify-center h-screen bg-[#191919] text-gray-400">Loading JSON files...</div>;

  return (
    <div className="flex h-screen bg-[#191919] text-gray-200 font-sans overflow-hidden">
      <Sidebar
        dataFiles={dataFiles}
        activeIndex={activeIndex ?? -1}
        activeView={activeView}
        onFileSelect={handleFileSelect}
        onViewChange={handleViewChange}
        onCreateNew={() => setShowModal(true)}
        onDeleteFile={requestFileDelete}
      />

      <main className="flex-1 flex flex-col overflow-y-auto">{renderView()}</main>

      {showModal && (
        <FileModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadDataFiles();
          }}
        />
      )}

      {showDeleteModal && fileToDelete && (
        <DeleteModal
          fileName={fileToDelete}
          onConfirm={confirmDeleteFile}
          onCancel={() => {
            setShowDeleteModal(false);
            setFileToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default HomePage;
