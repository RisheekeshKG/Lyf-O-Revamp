import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeView, setActiveView] = useState<"data" | "chat">("data");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeData, setActiveData] = useState<any>(null);

  // ✅ Load JSON files on startup
  useEffect(() => {
    const loadData = async () => {
      try {
        // Wait for preload to inject
        for (let i = 0; i < 20 && !window.electronAPI; i++) {
          await new Promise((r) => setTimeout(r, 50));
        }

        if (!window.electronAPI) {
          console.warn("⚠️ electronAPI not found — preload may not be loaded");
          setLoading(false);
          return;
        }

        const files: string[] = await window.electronAPI.invoke("readDir");
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        const loaded: DataFile[] = [];

        for (const file of jsonFiles) {
          const data = await window.electronAPI.invoke("readFile", file);
          if (data && data.type) {
            loaded.push({
              name: data.name || file.replace(".json", ""),
              file,
              data,
            });
          }
        }

        setDataFiles(loaded);
        if (loaded.length > 0) {
          setActiveIndex(0);
          setActiveData(loaded[0].data);
        }
      } catch (error) {
        console.error("❌ Error loading JSON:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ✅ Save file helper (no reload)
  const saveFile = useCallback(async (file: string, data: any) => {
    try {
      if (!window.electronAPI) return;
      await window.electronAPI.invoke("writeFile", file, JSON.stringify(data, null, 2));
      console.log("💾 Saved:", file);
    } catch (e) {
      console.error("❌ Save failed:", e);
    }
  }, []);

  // ✅ File switching
  const handleFileSelect = (index: number) => {
    setActiveIndex(index);
    setActiveData(dataFiles[index].data);
    setActiveView("data");
  };

  // ✅ Data updating
  const updateActiveData = (newData: any) => {
    setActiveData(newData);
    const updatedFiles = [...dataFiles];
    updatedFiles[activeIndex] = { ...updatedFiles[activeIndex], data: newData };
    setDataFiles(updatedFiles);
    saveFile(updatedFiles[activeIndex].file, newData);
  };

  // ✅ Chat handler
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = { sender: "user", text: message };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("http://localhost:8000/chat/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ content: message, role: "user" }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

      const data = await response.json();
      const aiMessage: ChatMessage = {
        sender: "ai",
        text: data.generated_text || "⚙️ No response received.",
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: `❌ Error: ${error.message}` },
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

  // === Render ===
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#191919] text-gray-400">
        Loading JSON files...
      </div>
    );
  }

  if (!activeData) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#191919] text-gray-400">
        No JSON file found in /data
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#191919] text-gray-200 font-sans overflow-hidden">
      <Sidebar
        dataFiles={dataFiles}
        activeIndex={activeIndex}
        activeView={activeView}
        onFileSelect={handleFileSelect}
        onViewChange={setActiveView}
      />

      <main className="flex-1 flex flex-col overflow-y-auto scroll-smooth">
        {activeView === "chat" ? (
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
    </div>
  );
};

export default HomePage;
