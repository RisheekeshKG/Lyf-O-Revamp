from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain, ConversationChain
from langchain.memory import ConversationBufferMemory
from dotenv import load_dotenv
from pathlib import Path
from difflib import get_close_matches
import os, json, uvicorn, re

# ==========================================================
# 🌱 Environment & Path Setup
# ==========================================================
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "frontend" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ==========================================================
# ⚡ FastAPI App Setup
# ==========================================================
app = FastAPI(title="MCP-like FastAPI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# 🤖 Gemini LLM
# ==========================================================
llm = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-1.5-pro"),
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.6,
)

# ==========================================================
# 🧠 Memory + Conversation
# ==========================================================
memory = ConversationBufferMemory(return_messages=True)
chat_chain = ConversationChain(llm=llm, memory=memory)

# ==========================================================
# 🧩 Helper Utilities
# ==========================================================
def safe_filename(name: str) -> str:
    """Make a filesystem-safe lowercase filename from a name."""
    name = name.strip().lower()
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"[-\s]+", "_", name)
    if not name:
        name = "untitled"
    return f"{name}.json"


def find_best_matching_file(query: str, data_dir: Path) -> Optional[str]:
    """Return the filename in data_dir that best matches the query (by fuzzy match)."""
    try:
        files = [f for f in os.listdir(data_dir) if f.endswith(".json")]
        if not files:
            return None
        cleaned_files = {f.lower().replace("_", " ").replace(".json", ""): f for f in files}
        query_clean = query.lower().strip()
        matches = get_close_matches(query_clean, cleaned_files.keys(), n=1, cutoff=0.4)
        if matches:
            return cleaned_files[matches[0]]
        return None
    except Exception as e:
        print("⚠️ File search error:", e)
        return None


def generate_table_schema_and_values(user_request: str):
    """Generate a consistent table schema and one example row."""
    req = user_request.lower()

    if any(k in req for k in ["project", "schedule", "task", "class", "work", "todo"]):
        schema = [
            {"name": "Task", "type": "text"},
            {"name": "Status", "type": "options", "options": ["In Progress", "Completed"]},
            {"name": "Priority", "type": "options", "options": ["High", "Medium", "Low"]},
            {"name": "Due Date", "type": "date"},
        ]
        example_values = [["Hello", "In Progress", "Medium", "2025-11-11"]]
        return schema, example_values

    # fallback
    schema = [
        {"name": "Topic", "type": "text"},
        {"name": "Status", "type": "options", "options": ["Ongoing", "Done"]},
        {"name": "Deadline", "type": "date"},
    ]
    example_values = [["Default topic", "Ongoing", "2025-11-12"]]
    return schema, example_values

# ==========================================================
# 🧰 Tool Handlers
# ==========================================================
def tool_create_file(args: Dict[str, Any]):
    """Create a new Notion-like JSON file in table/todolist format."""
    name = args.get("name", "Untitled")
    file_type = args.get("type", "todolist")
    user_request = args.get("user_request", "") or name

    filename = safe_filename(name)
    filepath = DATA_DIR / filename

    if file_type == "table":
        columns, example_values = generate_table_schema_and_values(user_request)
        content = {"name": name, "type": "table", "columns": columns, "values": example_values}
    else:
        content = {
            "name": name,
            "type": "todolist",
            "items": [
                {"task": "New Task 1", "done": False},
                {"task": "New Task 2", "done": False},
            ],
        }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(content, f, indent=2)

    return {"status": "created", "path": str(filepath), "content": content}


def tool_list_files(_args=None):
    """List all JSON files in data directory."""
    try:
        files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
        return {"files": files}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def tool_update_file(args: Dict[str, Any]):
    """Update an existing JSON file — adds rows to 'values' if it's a table."""
    name = args.get("name") or args.get("user_request")
    if not name:
        return {"error": "Missing file name or user request."}

    filename = find_best_matching_file(name, DATA_DIR)
    if not filename:
        return {"error": f"No matching file found for '{name}'."}

    filepath = DATA_DIR / filename
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # If it's a table → append one example row
    if data.get("type") == "table":
        columns = data.get("columns", [])
        if not columns:
            columns, example_values = generate_table_schema_and_values(name)
            data["columns"] = columns
            data["values"] = example_values
        else:
            new_row = ["Hello", "In Progress", "Medium", "2025-11-11"]
            data.setdefault("values", []).append(new_row)
    elif data.get("type") == "todolist":
        data.setdefault("items", []).append({"task": "New Example Task", "done": False})

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"status": "updated", "matched_file": filename, "path": str(filepath), "content": data}


TOOLS = {
    "create_file": {"description": "Create a new JSON file (table/todolist).", "handler": tool_create_file},
    "list_files": {"description": "List JSON files.", "handler": tool_list_files},
    "update_file": {"description": "Append example rows or tasks to an existing file.", "handler": tool_update_file},
}

# ==========================================================
# 🧠 Tool Reasoning Prompt
# ==========================================================
tool_prompt = PromptTemplate(
    input_variables=["tool_descriptions", "user_input"],
    template=(
        "You are a helpful assistant that can both chat and use tools.\n\n"
        "Available tools:\n{tool_descriptions}\n\n"
        "When the user asks to create, edit, or add rows to a Notion-like JSON file, "
        "respond ONLY in this JSON format (do NOT explain or use markdown):\n\n"
        "{{{{\n"
        '  "type": "tool_call",\n'
        '  "name": "TOOL_NAME",\n'
        '  "arguments": {{{{ ARGUMENTS_OBJECT }}}}\n'
        "}}}}\n\n"
        "Examples:\n\n"
        "User: Create a class schedule table\n"
        "{{{{\n"
        '  "type": "tool_call",\n'
        '  "name": "create_file",\n'
        '  "arguments": {{{{ "name": "Class Schedule Table", "type": "table" }}}}\n'
        "}}}}\n\n"
        "User: Add examples to my class schedule table\n"
        "{{{{\n"
        '  "type": "tool_call",\n'
        '  "name": "update_file",\n'
        '  "arguments": {{{{ "name": "class schedule table" }}}}\n'
        "}}}}\n\n"
        "User: Show all my files\n"
        "{{{{\n"
        '  "type": "tool_call",\n'
        '  "name": "list_files",\n'
        '  "arguments": {{{{ }}}}\n'
        "}}}}\n\n"
        "If it's not a tool request, respond conversationally.\n\n"
        "User message:\n{user_input}"
    ),
)


tool_descriptions = json.dumps({name: {"description": t["description"]} for name, t in TOOLS.items()}, indent=2)
tool_chain = LLMChain(llm=llm, prompt=tool_prompt)

# ==========================================================
# 🚀 Chat Endpoint
# ==========================================================
class Msg(BaseModel):
    content: str
    role: Optional[str] = "user"


@app.post("/chat/chat")
async def chat(m: Msg):
    """Main chat endpoint with tool detection."""
    try:
        print(f"\n🧠 User: {m.content}")
        result = tool_chain.invoke({"user_input": m.content, "tool_descriptions": tool_descriptions})
        llm_output = result.get("text", "")
        print("🔍 Raw model output:", llm_output)

        if '"type"' in llm_output and "tool_call" in llm_output:
            start = llm_output.find("{")
            end = llm_output.rfind("}") + 1
            json_str = llm_output[start:end]
            tool_call = json.loads(json_str)

            tool_name = tool_call.get("name")
            args = tool_call.get("arguments", {}) or {}
            args.setdefault("user_request", m.content)

            if tool_name in TOOLS:
                result = TOOLS[tool_name]["handler"](args)
                return {"mode": "tool", "tool": tool_name, "result": result}

        reply = chat_chain.predict(input=m.content)
        return {"mode": "chat", "generated_text": reply}

    except Exception as e:
        print("❌ Exception:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================================
# 🌟 Recommend Endpoint
# ==========================================================
@app.get("/recommend")
async def recommend():
    """Returns a few recommended JSON templates."""
    try:
        recommendations = [
            {
                "name": "Weekly Planner",
                "type": "todolist",
                "items": [
                    {"task": "Plan Monday tasks", "done": False},
                    {"task": "Plan weekend study goals", "done": False},
                ],
            },
            {
                "name": "Study Schedule",
                "type": "table",
                "columns": [
                    {"name": "Subject", "type": "text"},
                    {"name": "Time", "type": "text"},
                    {
                        "name": "Progress",
                        "type": "options",
                        "options": ["Not Started", "Ongoing", "Done"],
                    },
                ],
                "values": [
                    ["Math", "10 AM - 12 PM", "Ongoing"],
                    ["DAA", "3 PM - 5 PM", "Not Started"],
                ],
            },
            {
                "name": "Habit Tracker",
                "type": "habit",
                "items": [
                    {"habit": "Exercise", "done": False},
                    {"habit": "Read 10 pages", "done": False},
                    {"habit": "Code 1 hour", "done": False},
                ],
            },
        ]
        return recommendations
    except Exception as e:
        print("❌ Recommend error:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================================
# 🖥️ Run
# ==========================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
