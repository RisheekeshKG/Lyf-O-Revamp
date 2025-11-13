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
import ProfileModal from "./components/ProfileModal";

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
  const [activeView, setActiveView] = useState<
    "data" | "chat" | "inbox" | "recommend"
  >("data");
  const [activeData, setActiveData] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [recommendStatus, setRecommendStatus] = useState<string>("");
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);

  // -------------------------
  // Load JSON files (same as before)
  // -------------------------
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
          loaded.push({
            name: data.name || file.replace(".json", ""),
            file,
            data,
          });
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

    // auto-open profile modal on first run if not present
    try {
      const raw = localStorage.getItem("user_profile");
      if (!raw) {
        setShowProfileModal(true);
      }
    } catch (e) {
      setShowProfileModal(true);
    }
  }, [loadDataFiles]);

  // -------------------------
  // Save JSON file
  // -------------------------
  const saveFile = useCallback(async (file: string, data: any) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.invoke(
        "writeFile",
        file,
        JSON.stringify(data, null, 2)
      );
      console.log("💾 Saved:", file);
    } catch (e) {
      console.error("❌ Save failed:", e);
    }
  }, []);

  // -------------------------
  // File selection and UI handlers (unchanged)
  // -------------------------
  const handleFileSelect = (index: number) => {
    setActiveIndex(index);
    setActiveData(dataFiles[index].data);
    setActiveView("data");
  };

  const handleViewChange = (view: "data" | "chat" | "inbox" | "recommend") => {
    setActiveView(view);
    if (view !== "data") {
      setActiveIndex(null);
      setActiveData(null);
    }
    if (view === "recommend") handleRecommend();
  };

  const requestFileDelete = (file: string) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const result = await window.electronAPI.invoke(
        "deleteFile",
        fileToDelete
      );
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

  const updateActiveData = (newData: any) => {
    if (activeIndex === null) return;
    setActiveData(newData);
    const updated = [...dataFiles];
    updated[activeIndex] = { ...updated[activeIndex], data: newData };
    setDataFiles(updated);
    saveFile(updated[activeIndex].file, newData);
  };

  // -------------------------
  // Chat handler (same)
  // -------------------------
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
        const fileName = `${jsonData.name
          .toLowerCase()
          .replace(/\s+/g, "_")}.json`;
        await window.electronAPI.invoke(
          "writeFile",
          fileName,
          JSON.stringify(jsonData, null, 2)
        );
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `✅ Created new file "${jsonData.name}" (${jsonData.type})`,
          },
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

  // -------------------------
  // Recommend: POST profile if exists, else GET random
  // -------------------------
  const handleRecommend = async () => {
    setRecommendStatus("Fetching recommendations...");
    setRecommendations([]);
    try {
      let profileRaw = null;
      try {
        profileRaw = localStorage.getItem("user_profile");
      } catch (e) {
        console.warn("localStorage not accessible:", e);
      }

      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        const res = await fetch("http://localhost:8000/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
        const data = await res.json();
        const recos = data.recommendations || [];
        if (!Array.isArray(recos))
          throw new Error("Invalid recommendations format from backend");
        setRecommendations(recos);
        setRecommendStatus(
          `✅ Found ${recos.length} templates (cluster ${data.cluster ?? "?"})`
        );
        setActiveView("recommend");
        return;
      }

      // fallback to GET random
      const res = await fetch("http://localhost:8000/recommend", {
        method: "GET",
      });
      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
      const data = await res.json();
      const recos = data.recommendations || data || [];
      if (!Array.isArray(recos))
        throw new Error("Invalid recommendations format from backend");
      setRecommendations(recos);
      setRecommendStatus(`✅ Found ${recos.length} templates (random)`);
      setActiveView("recommend");
    } catch (err: any) {
      console.error("❌ Recommend error:", err);
      setRecommendStatus(`❌ ${err.message}`);
      setActiveView("recommend");
    }
  };

  const handleSaveRecommendation = async (rec: RecommendedItem) => {
    if (!window.electronAPI) {
      alert("⚠️ Electron API not found");
      return;
    }
    try {
      const fileName = `${rec.name.toLowerCase().replace(/\s+/g, "_")}.json`;
      await window.electronAPI.invoke(
        "writeFile",
        fileName,
        JSON.stringify(rec, null, 2)
      );
      setRecommendStatus(`✅ Saved "${rec.name}"`);
      await loadDataFiles();
    } catch (err) {
      console.error("❌ Save recommend failed:", err);
      setRecommendStatus(`❌ Failed to save ${rec.name}`);
    }
  };
  const handleEnhanceRecommendation = async (rec: RecommendedItem) => {
    try {
      setRecommendStatus("✨ Enhancing template...");

      // Get user profile from localStorage
      let profile = null;
      try {
        profile = JSON.parse(localStorage.getItem("user_profile") || "null");
      } catch (e) {
        console.warn("Failed to parse user profile", e);
      }

      const res = await fetch("http://localhost:8000/chat/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: rec,
          user_profile: profile, // <-- 🔥 send user profile
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);

      const data = await res.json();
      const enhanced = data.enhanced;

      setRecommendStatus("✨ Template enhanced!");
      setRecommendations((prev) =>
        prev.map((x) => (x.name === rec.name ? enhanced : x))
      );
    } catch (err: any) {
      console.error("❌ Enhance failed:", err);
      setRecommendStatus(`❌ ${err.message}`);
    }
  };

  // -------------------------
  // Render view (unchanged)
  // -------------------------
  const renderView = () => {
    if (activeView === "chat")
      return (
        <ChatView
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          onResetChat={() => setChatMessages([])}
        />
      );
    if (activeView === "inbox") return <GmailInbox />;
    if (activeView === "recommend")
      return (
        <div className="p-6 text-gray-200 flex flex-col gap-4 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-2">Recommended Templates</h2>
          {recommendStatus && (
            <div className="text-gray-400">{recommendStatus}</div>
          )}

          {recommendations.length === 0 ? (
            <div className="text-gray-500">No recommendations yet.</div>
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
                <div className="flex gap-2">
                  {/* Enhance Button */}
                  <button
                    onClick={() => handleEnhanceRecommendation(rec)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
                  >
                    Enhance
                  </button>

                  {/* Save Button */}
                  <button
                    onClick={() => handleSaveRecommendation(rec)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      );

    if (!activeData)
      return (
        <div className="flex items-center justify-center flex-1 text-gray-400">
          No JSON file found in /data
        </div>
      );

    switch (activeData.type) {
      case "table":
        return (
          <TableView
            data={activeData}
            onValueChange={(r, c, v) =>
              updateActiveData({
                ...activeData,
                values: activeData.values.map((row: any[], i: number) =>
                  i === r ? row.map((col, j) => (j === c ? v : col)) : row
                ),
              })
            }
            onAddRow={() =>
              updateActiveData({
                ...activeData,
                values: [
                  ...activeData.values,
                  activeData.columns.map(() => ""),
                ],
              })
            }
            onDeleteRow={(r) =>
              updateActiveData({
                ...activeData,
                values: activeData.values.filter(
                  (_: any, i: number) => i !== r
                ),
              })
            }
          />
        );
      case "todolist":
        return (
          <TodoListView
            data={activeData}
            onToggleTodo={(i) =>
              updateActiveData({
                ...activeData,
                items: activeData.items.map((t: any, idx: number) =>
                  idx === i ? { ...t, done: !t.done } : t
                ),
              })
            }
            onEditTodo={(i, text) =>
              updateActiveData({
                ...activeData,
                items: activeData.items.map((t: any, idx: number) =>
                  idx === i ? { ...t, task: text } : t
                ),
              })
            }
            onAddTodo={() =>
              updateActiveData({
                ...activeData,
                items: [...activeData.items, { task: "", done: false }],
              })
            }
            onDeleteTodo={(i) =>
              updateActiveData({
                ...activeData,
                items: activeData.items.filter(
                  (_: any, idx: number) => idx !== i
                ),
              })
            }
          />
        );
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
        return (
          <div className="flex items-center justify-center flex-1 text-gray-400">
            Unsupported file type: {activeData.type}
          </div>
        );
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-[#191919] text-gray-400">
        Loading JSON files...
      </div>
    );

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

      <main className="flex-1 flex flex-col overflow-y-auto">
        {renderView()}
      </main>

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

      {/* Profile modal */}
      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onSave={(profile) => {
          // optional: kick off a recommend fetch after saving
          setTimeout(() => handleRecommend(), 200);
        }}
      />
    </div>
  );
};

export default HomePage;
