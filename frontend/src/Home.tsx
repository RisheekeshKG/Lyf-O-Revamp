import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { FileModal } from "./components/FileModal";
import { TableView } from "./components/TableView";
import { TodoListView } from "./components/TodoListView";
import { ChatView } from "./components/ChatView";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

interface DataFile {
  name: string;
  file: string;
  data: any;
}

const HomePage: React.FC = () => {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"data" | "chat">("data");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeData, setActiveData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // ✅ Load all JSON files in /data
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

      console.log("📂 Fetching files from /data...");
      const files: string[] = await window.electronAPI.invoke("readDir");
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      console.log("📄 Found:", jsonFiles);

      const loaded: DataFile[] = [];
      for (const file of jsonFiles) {
        const data = await window.electronAPI.invoke("readFile", file);
        if (data) {
          loaded.push({
            name: data.name || file.replace(".json", ""),
            file,
            data,
          });
        }
      }

      setDataFiles(loaded);

      // Reset active selection safely
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

  // ✅ Save file helper
  const saveFile = useCallback(async (file: string, data: any) => {
    try {
      if (!window.electronAPI) return;
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

  // ✅ File selection
  const handleFileSelect = (index: number) => {
    setActiveIndex(index);
    setActiveData(dataFiles[index].data);
    setActiveView("data");
  };

  // ✅ Delete file
  const handleDeleteFile = async (file: string) => {
    if (!window.confirm(`🗑️ Delete "${file}" permanently?`)) return;
    try {
      console.log("🧭 Requesting deletion for:", file);
      const result = await window.electronAPI.invoke("deleteFile", file);
      console.log("🧾 deleteFile result:", result);

      if (result?.success) {
        console.log("🗑️ File deleted:", file);
        await loadDataFiles();

        // If the deleted file was active, clear state
        if (dataFiles[activeIndex!]?.file === file) {
          setActiveIndex(null);
          setActiveData(null);
        }
      } else {
        alert("❌ Failed to delete file: " + (result?.error || "Unknown error"));
      }
    } catch (err) {
      console.error("❌ Delete failed:", err);
    }
  };

  // ✅ Update and persist file data
  const updateActiveData = (newData: any) => {
    if (activeIndex === null) return;
    setActiveData(newData);
    const updated = [...dataFiles];
    updated[activeIndex] = { ...updated[activeIndex], data: newData };
    setDataFiles(updated);
    saveFile(updated[activeIndex].file, newData);
  };

  // ✅ Chat handler (normal + MCP tool mode)
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
      console.log("🤖 AI Response:", data);

      // === If AI returns a JSON for new file (tool mode)
      if (data.mode === "tool" && data.result?.content) {
        const jsonData = data.result.content;
        const fileName = `${jsonData.name
          .toLowerCase()
          .replace(/\s+/g, "_")}.json`;

        console.log("🧩 Creating new AI file:", fileName);
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

      // === Normal chat reply
      const aiMessage =
        data.generated_text || data.result || "⚙️ No response received.";
      setChatMessages((prev) => [...prev, { sender: "ai", text: aiMessage }]);
    } catch (err: any) {
      console.error("❌ Chat error:", err);
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: `❌ Error: ${err.message}` },
      ]);
    }
  };

  // === Table actions ===
  const handleValueChange = (row: number, col: number, val: string) => {
    const newValues = activeData.values.map((r: any[], i: number) =>
      i === row ? r.map((c, j) => (j === col ? val : c)) : r
    );
    updateActiveData({ ...activeData, values: newValues });
  };

  const handleAddRow = () => {
    const newRow = activeData.columns.map(() => "");
    updateActiveData({ ...activeData, values: [...activeData.values, newRow] });
  };

  const handleDeleteRow = (row: number) => {
    const newValues = activeData.values.filter((_: any, i: number) => i !== row);
    updateActiveData({ ...activeData, values: newValues });
  };

  // === Todo actions ===
  const handleToggleTodo = (i: number) => {
    const newItems = activeData.items.map((t: any, idx: number) =>
      idx === i ? { ...t, done: !t.done } : t
    );
    updateActiveData({ ...activeData, items: newItems });
  };

  const handleEditTodo = (i: number, text: string) => {
    const newItems = activeData.items.map((t: any, idx: number) =>
      idx === i ? { ...t, task: text } : t
    );
    updateActiveData({ ...activeData, items: newItems });
  };

  const handleAddTodo = () => {
    const newItems = [...activeData.items, { task: "", done: false }];
    updateActiveData({ ...activeData, items: newItems });
  };

  const handleDeleteTodo = (i: number) => {
    const newItems = activeData.items.filter((_: any, idx: number) => idx !== i);
    updateActiveData({ ...activeData, items: newItems });
  };

  // === Render states ===
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
        onViewChange={setActiveView}
        onCreateNew={() => setShowModal(true)}
        onDeleteFile={handleDeleteFile}
      />

      <main className="flex-1 flex flex-col overflow-y-auto scroll-smooth">
        {!activeData ? (
          <div className="flex items-center justify-center flex-1 text-gray-400">
            No JSON file found in /data
          </div>
        ) : activeView === "chat" ? (
          <ChatView messages={chatMessages} onSendMessage={handleSendMessage} />
        ) : activeData.type === "table" ? (
          <TableView
            data={activeData}
            onValueChange={handleValueChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />
        ) : activeData.type === "todolist" ? (
          <TodoListView
            data={activeData}
            onToggleTodo={handleToggleTodo}
            onEditTodo={handleEditTodo}
            onAddTodo={handleAddTodo}
            onDeleteTodo={handleDeleteTodo}
          />
        ) : (
          <div className="flex items-center justify-center flex-1 text-gray-400">
            Unsupported file type: {activeData.type}
          </div>
        )}
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
    </div>
  );
};

export default HomePage;
