from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain, ConversationChain
from langchain.memory import ConversationBufferMemory
from dotenv import load_dotenv
import os, json, uvicorn

# ==========================================================
# 🌱 Environment Setup
# ==========================================================
load_dotenv()
DATA_DIR = "./frontend/data"
os.makedirs(DATA_DIR, exist_ok=True)

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
# 🧠 Memory + Normal Chat Chain
# ==========================================================
memory = ConversationBufferMemory(return_messages=True)
chat_chain = ConversationChain(llm=llm, memory=memory)

# ==========================================================
# 🧠 Prompt for LLM Tool Reasoning
# ==========================================================
tool_prompt = PromptTemplate.from_template("""
You are a helpful assistant that can both chat and use tools.

Available tools:
{tool_descriptions}

When a user asks for a normal question, chat naturally.

When the user explicitly asks to create, list, modify, or manage a Notion-like JSON file (table or todo list),
respond in this format ONLY:

{{
  "type": "tool_call",
  "name": TOOL_NAME,
  "arguments": {{ ARGUMENTS_OBJECT }}
}}

Example:
User: "Make a todo list for my daily habits"
Assistant:
{{
  "type": "tool_call",
  "name": "create_file",
  "arguments": {{ "name": "Daily Habits", "type": "todolist" }}
}}

User: "List my existing files"
Assistant:
{{
  "type": "tool_call",
  "name": "list_files",
  "arguments": {{}}
}}

If it's not a tool request, respond normally.
User message:
{user_input}
""")

# ==========================================================
# 🧠 Content Generation Helper (for auto-filled files)
# ==========================================================
fill_prompt = PromptTemplate.from_template("""
You are a structured JSON generator that fills a table or todo list.

User request: {user_request}
File type: {file_type}

If the file type is "table":
You are given a table schema describing the columns, their types, and valid options if applicable.

Generate multiple realistic rows that strictly follow the schema.
Return ONLY valid JSON with this format:
{{
  "values": [
    ["<value for column 1>", "<value for column 2>", "<value for column 3>", "<value for column 4>"],
    ...
  ]
}}

Rules for filling:
- For "text": write short descriptive text or times like "08:00 - 10:00", "Meeting with client", etc.
- For "options": always use one of the listed options exactly (e.g., "High", "Medium", "Low").
- For "date": generate valid future dates in ISO format (YYYY-MM-DD).
- Keep the order of values matching the order of columns.
- Do NOT include markdown, extra keys, or comments — only pure JSON.

If the file type is "todolist":
Return ONLY:
{{
  "items": [
    {{"task": "Task description", "done": false}},
    {{"task": "Another task", "done": true}}
  ]
}}
""")

fill_chain = LLMChain(llm=llm, prompt=fill_prompt)

# ==========================================================
# 🧩 Tool Handlers
# ==========================================================
def tool_create_file(args: Dict[str, Any]):
    """Create a new Notion-like JSON file with auto-filled content."""
    name = args.get("name", "Untitled")
    file_type = args.get("type", "todolist")
    user_request = args.get("user_request", "")
    filename = f"{name.lower().replace(' ', '_')}.json"
    filepath = os.path.join(DATA_DIR, filename)

    # === Step 1: Base structure ===
    if file_type == "table":
        base_content = {
            "name": name,
            "type": "table",
            "columns": [
                {"name": "Task", "type": "text"},
                {"name": "Status", "type": "options", "options": ["In Progress", "Completed"]},
                {"name": "Priority", "type": "options", "options": ["High", "Medium", "Low"]},
                {"name": "Due Date", "type": "date"}
            ],
            "values": []
        }
    else:
        base_content = {
            "name": name,
            "type": "todolist",
            "items": []
        }

    # === Step 2: Generate realistic content ===
    try:
        schema_description = ""
        if file_type == "table":
            cols = base_content["columns"]
            schema_description = json.dumps(cols, indent=2)

        gen_json = fill_chain.run(
            user_request=f"{user_request or name}\n\nTable schema:\n{schema_description}",
            file_type=file_type
        )
        print("🧠 Generated JSON:", gen_json)

        # 🩹 Clean model output — remove markdown backticks and "json" tags
        clean_json = gen_json.strip()
        if clean_json.startswith("```"):
            clean_json = clean_json.strip("`")
            clean_json = clean_json.replace("json", "", 1).strip()
        generated_data = json.loads(clean_json)

    except Exception as e:
        print("⚠️ Failed to generate filled data:", e)
        generated_data = base_content

    # === Step 3: Merge base + generated ===
    # === Step 3: Merge base + generated ===
    if file_type == "table":
        if isinstance(generated_data, dict) and "values" in generated_data:
            base_content["values"] = generated_data["values"]
        elif isinstance(generated_data, list):
            # If model returned a plain list of rows
            rows = []
            for row in generated_data:
                if isinstance(row, dict):
                    rows.append(list(row.values()))
            base_content["values"] = rows

    elif file_type == "todolist":
        # Handle possible key name variations like "tasks" or "items"
        if "items" in generated_data:
            base_content["items"] = generated_data["items"]
        elif "tasks" in generated_data:
            # Convert "tasks" → "items"
            base_content["items"] = [
                {"task": t.get("description", ""), "done": t.get("completed", False)}
                for t in generated_data["tasks"]
            ]


    # === Step 4: Save ===
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(base_content, f, indent=2)

    return {"status": "created", "path": filepath, "content": base_content}


def tool_list_files(_args=None):
    """List all JSON files in data directory."""
    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
    return {"files": files}


def tool_update_file(args: Dict[str, Any]):
    """Update an existing JSON file."""
    name = args.get("name")
    if not name:
        return {"error": "Missing file name."}

    filename = f"{name.lower().replace(' ', '_')}.json"
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return {"error": f"{filename} not found."}

    data = json.load(open(filepath, "r", encoding="utf-8"))
    patch = args.get("update", {})

    for key, value in patch.items():
        data[key] = value

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"status": "updated", "path": filepath, "content": data}


# ==========================================================
# 🧰 Tool Registry
# ==========================================================
TOOLS = {
    "create_file": {"description": "Create a new Notion-style JSON file.", "handler": tool_create_file},
    "list_files": {"description": "List all JSON files in data directory.", "handler": tool_list_files},
    "update_file": {"description": "Update an existing JSON file.", "handler": tool_update_file},
}

tool_descriptions = json.dumps(
    {name: {"description": t["description"]} for name, t in TOOLS.items()}, indent=2
)

tool_chain = LLMChain(llm=llm, prompt=tool_prompt)

# ==========================================================
# 🧾 API Models
# ==========================================================
class Msg(BaseModel):
    content: str
    role: Optional[str] = "user"

# ==========================================================
# 🚀 Main Chat Endpoint
# ==========================================================
@app.post("/chat/chat")
async def chat(m: Msg):
    """
    Auto-detect tool calls vs normal chat.
    If the model outputs {"type": "tool_call"...}, execute the tool.
    Otherwise, return chat text.
    """
    try:
        print(f"\n🧠 User: {m.content}")

        # Use invoke instead of deprecated .run
        llm_output = tool_chain.invoke({"user_input": m.content, "tool_descriptions": tool_descriptions})
        llm_output = llm_output["text"] if isinstance(llm_output, dict) and "text" in llm_output else llm_output
        print("🔍 Raw model output:", llm_output)

        # Try to detect tool call
        if '"type"' in llm_output and "tool_call" in llm_output:
            start = llm_output.find("{")
            end = llm_output.rfind("}") + 1
            json_str = llm_output[start:end]

            try:
                tool_call = json.loads(json_str)
            except json.JSONDecodeError:
                print("⚠️ Could not parse model output as JSON.")
                return {"mode": "chat", "generated_text": llm_output}

            tool_name = tool_call.get("name")
            args = tool_call.get("arguments", {})
            print(f"🧩 Tool call detected: {tool_name}({args})")

            if tool_name in TOOLS:
                args["user_request"] = m.content
                result = TOOLS[tool_name]["handler"](args)
                print("✅ Tool result:", result)
                return {"mode": "tool", "tool": tool_name, "result": result}
            else:
                print("⚠️ Unknown tool name:", tool_name)
                return {"mode": "error", "error": f"Unknown tool: {tool_name}"}

        else:
            # Normal chat
            print("💬 Chat mode detected.")
            reply = chat_chain.predict(input=m.content)
            return {"mode": "chat", "generated_text": reply}

    except Exception as e:
        print("❌ Exception:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================================
# 🖥️ Run Server
# ==========================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
