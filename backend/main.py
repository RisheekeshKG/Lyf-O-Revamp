# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain, ConversationChain
from langchain.memory import ConversationBufferMemory
from dotenv import load_dotenv
from pathlib import Path
from difflib import get_close_matches
from kmodes.kprototypes import KPrototypes

import os, json, uvicorn, re, traceback
import pandas as pd
import joblib
import numpy as np
import datetime

# ==========================================================
# ENV & PATHS
# ==========================================================
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "frontend" / "data"
ML_DIR = BASE_DIR
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ==========================================================
# APP
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
# LLMs
# ==========================================================
# Main chat LLM (conversational)
llm = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-1.5-pro"),
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.6,
)

# Deterministic tool LLM for tool selection
llm_tool = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-1.5-pro"),
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.0,
)

# Low-temp content generator LLM for filling rows/todos
llm_content = ChatGoogleGenerativeAI(
    model=os.getenv("MODEL_NAME", "gemini-1.5-pro"),
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.15,
)

memory = ConversationBufferMemory(return_messages=True)
chat_chain = ConversationChain(llm=llm, memory=memory)

# ==========================================================
# Load CSV + KPrototypes (optional)
# ==========================================================
CSV_PATH = ML_DIR / "clustered.csv"
if CSV_PATH.exists():
    df_users = pd.read_csv(CSV_PATH)
else:
    df_users = pd.DataFrame(columns=["age","gender","occupation","education_level","device_type","daily_usage_hours","template","cluster"])
    print(f"WARNING: {CSV_PATH} not found. /recommend will be limited until present.")

def parse_template(x):
    try:
        if pd.isna(x):
            return []
        if isinstance(x, list):
            return x
        return json.loads(str(x).replace("''", '"'))
    except Exception:
        try:
            return json.loads(str(x))
        except Exception:
            return []

if "template" in df_users.columns:
    df_users["template"] = df_users["template"].apply(parse_template)
else:
    df_users["template"] = [[] for _ in range(len(df_users))]

KPROTO_PATH = ML_DIR / "kproto_model.pkl"
if KPROTO_PATH.exists():
    kproto: KPrototypes = joblib.load(KPROTO_PATH)
else:
    kproto = None
    print(f"WARNING: kproto_model.pkl not found. /recommend will fail until model is present.")

FEATURE_COLUMNS = ["age","gender","occupation","education_level","device_type","daily_usage_hours"]
CATEGORICAL_IDX = [1,2,3,4]

def to_kproto_vector(user_dict):
    return [
        user_dict["age"],
        user_dict["gender"],
        user_dict["occupation"],
        user_dict["education_level"],
        user_dict["device_type"],
        user_dict["daily_usage_hours"],
    ]

# ==========================================================
# Helpers: validation + fixing
# ==========================================================
def today_iso():
    return datetime.date.today().isoformat()

# Allowed column types for renderer
ALLOWED_COL_TYPES = {"text","options","date","number","checkbox"}

def default_table_template(user_request: str):
    """Default columns & a sample row."""
    columns = [
        {"name":"Task","type":"text"},
        {"name":"Status","type":"options","options":["Not Started","In Progress","Completed"]},
        {"name":"Priority","type":"options","options":["High","Medium","Low"]},
        {"name":"Due Date","type":"date"}
    ]
    values = [["Define goals","Not Started","High", today_iso()]]
    return columns, values

def sanitize_column(col: Dict[str,Any]) -> Dict[str,Any]:
    """
    Ensure column object has required keys. Return sanitized column or None if invalid.
    """
    if not isinstance(col, dict):
        return None
    name = str(col.get("name","")).strip()
    if not name:
        return None
    ctype = str(col.get("type","text")).strip().lower()
    if ctype not in ALLOWED_COL_TYPES:
        # coerce unknown types to text
        ctype = "text"
    safe = {"name": name, "type": ctype}
    if ctype == "options":
        opts = col.get("options") or col.get("choices") or []
        if isinstance(opts, str):
            # attempt to parse comma-separated
            opts = [o.strip() for o in opts.split(",") if o.strip()]
        if not isinstance(opts, list) or len(opts)==0:
            opts = ["Option 1", "Option 2"]
        safe["options"] = opts
    return safe

def validate_and_fix_table(obj: Dict[str,Any]) -> Dict[str,Any]:
    """
    Ensure a table JSON has: name, type='table', columns(list), values(list of lists)
    Fix common issues:
    - columns missing -> default columns
    - columns elements invalid -> drop invalid ones
    - values rows mismatched length -> pad/truncate to columns length
    """
    if not isinstance(obj, dict):
        raise ValueError("table must be a JSON object")

    name = str(obj.get("name", "Untitled Table"))
    columns = obj.get("columns")
    values = obj.get("values") or []

    # sanitize columns
    if not isinstance(columns, list) or len(columns)==0:
        columns, default_values = default_table_template(name)
        values = values or default_values
    else:
        sanitized = []
        for col in columns:
            sc = sanitize_column(col)
            if sc:
                sanitized.append(sc)
        if len(sanitized)==0:
            columns, default_values = default_table_template(name)
            values = values or default_values
        else:
            columns = sanitized

    col_count = len(columns)

    # sanitize values: ensure list of lists and each row length matches
    fixed_values = []
    for row in values:
        if isinstance(row, list):
            # convert non-strings to strings when necessary; keep numbers for number columns
            new_row = []
            for i in range(col_count):
                val = row[i] if i < len(row) else ""
                col_type = columns[i]["type"]
                if col_type == "date":
                    # try to coerce to YYYY-MM-DD
                    try:
                        if isinstance(val, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", val):
                            new_row.append(val)
                        else:
                            # try parse to date
                            new_row.append(str(val)[:10] if val else today_iso())
                    except Exception:
                        new_row.append(today_iso())
                elif col_type == "number":
                    try:
                        new_row.append(float(val))
                    except Exception:
                        new_row.append(0)
                elif col_type == "checkbox":
                    # checkbox columns are boolean
                    if isinstance(val, bool):
                        new_row.append(val)
                    elif isinstance(val, str):
                        new_row.append(val.lower() in ("true","1","yes"))
                    else:
                        new_row.append(bool(val))
                elif col_type == "options":
                    # ensure the value is one of options
                    opts = columns[i].get("options", [])
                    sval = str(val) if val is not None else ""
                    if sval in opts:
                        new_row.append(sval)
                    else:
                        # pick first option as fallback or use value as string
                        new_row.append(opts[0] if opts else sval)
                else:
                    # text
                    new_row.append("" if val is None else str(val))
            fixed_values.append(new_row)
        else:
            # ignore non-list rows
            continue

    # if there were no valid rows, put one example
    if len(fixed_values) == 0:
        # try get a single useful example row from the columns
        example_row = []
        for c in columns:
            if c["type"] == "date":
                example_row.append(today_iso())
            elif c["type"] == "number":
                example_row.append(0)
            elif c["type"] == "checkbox":
                example_row.append(False)
            elif c["type"] == "options":
                example_row.append(c.get("options",[None])[0] or "")
            else:
                example_row.append("Example")
        fixed_values = [example_row]

    out = {"name": name, "type": "table", "columns": columns, "values": fixed_values}
    return out

def validate_and_fix_todolist(obj: Dict[str,Any]) -> Dict[str,Any]:
    """
    Ensure todolist structure: name, type='todolist', items: list of {task, done}
    """
    if not isinstance(obj, dict):
        raise ValueError("todolist must be a JSON object")
    name = str(obj.get("name","Untitled Todo"))
    items = obj.get("items") or []
    fixed_items = []
    for it in items:
        if isinstance(it, dict):
            task = str(it.get("task","")).strip()
            done = it.get("done", False)
            # coerce done to bool
            done = bool(done) if not isinstance(done, str) else (it.get("done","").lower() in ("true","1","yes"))
            if task:
                fixed_items.append({"task": task, "done": bool(done)})
    if len(fixed_items)==0:
        fixed_items = [{"task":"New Task 1","done":False}]
    out = {"name": name, "type": "todolist", "items": fixed_items}
    return out

def validate_and_fix_content(parsed: Dict[str,Any]) -> Dict[str,Any]:
    """Route to correct validator based on type."""
    t = parsed.get("type","").lower()
    if t == "table":
        return validate_and_fix_table(parsed)
    if t == "todolist":
        return validate_and_fix_todolist(parsed)
    # For habit/journal/others, do minimal normalization
    if t == "habit":
        items = parsed.get("items") or parsed.get("habits") or []
        fixed = []
        for it in items:
            if isinstance(it, dict):
                name = it.get("habit") or it.get("task") or it.get("name") or ""
                done = bool(it.get("done", False))
                if name:
                    fixed.append({"habit": str(name), "done": bool(done)})
        if not fixed:
            fixed = [{"habit":"New Habit","done":False}]
        return {"name": parsed.get("name","Untitled Habit"), "type":"habit", "items": fixed}
    # fallback: pass-through
    return parsed
class EnhanceReq(BaseModel):
    template: Dict[str, Any]
    user_profile: Optional[Dict[str, Any]] = None

@app.post("/chat/enhance")
async def enhance_template(payload: dict):
    template = payload.get("template")
    user_profile = payload.get("user_profile")

    if not template:
        raise HTTPException(status_code=400, detail="Missing template.")

    # Use llm_content to rewrite template based on the user's profile
    enhance_prompt = PromptTemplate(
        input_variables=["template", "profile"],
        template=(
            "You are an assistant that enhances a JSON template using a user's profile.\n"
            "Return ONLY valid JSON with **no trailing commas**, **no ...**, **no comments**, "
            "and the exact same structure as the input template.\n\n"
            "Input template:\n{template}\n\n"
            "User profile:\n{profile}\n\n"
            "Rules:\n"
            "1. KEEP the same keys: name, type, columns, values, items, etc.\n"
            "2. NEVER add unknown keys.\n"
            "3. ONLY modify the rows/items to be personalized.\n"
            "4. Return only JSON — no explanation.\n"
        )
    )

    chain = LLMChain(llm=llm_content, prompt=enhance_prompt)

    raw = chain.run({
        "template": json.dumps(template),
        "profile": json.dumps(user_profile or {})
    })

    # Extract JSON object only
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise HTTPException(status_code=500, detail="Invalid JSON returned")

    cleaned = match.group(0)

    try:
        enhanced = json.loads(cleaned)
    except:
        raise HTTPException(status_code=500, detail="JSON parsing failed")

    return {"enhanced": enhanced}

# ==========================================================
# Tools
# ==========================================================
def safe_filename(name: str) -> str:
    n = str(name or "").strip().lower()
    n = re.sub(r"[^\w\s-]", "", n)
    n = re.sub(r"[-\s]+", "_", n)
    return f"{n}.json" if n else "untitled.json"

def find_best_matching_file(query: str, data_dir: Path):
    try:
        files = [f for f in os.listdir(data_dir) if f.endswith(".json")]
        cleaned = {f.lower().replace("_"," ").replace(".json",""): f for f in files}
        match = get_close_matches(str(query).lower(), cleaned.keys(), n=1, cutoff=0.4)
        return cleaned[match[0]] if match else None
    except Exception:
        return None

def tool_create_file(args: Dict[str,Any]):
    """
    Accepts args:
      - name: str
      - type: str ('todolist','table','habit','journal', etc.)
      - user_request: optional str (helps LLM fill content)
    Behavior:
      - generate default template, then ask llm_content to generate full JSON content
      - validate and fix structure
      - write file into frontend/data
    """
    name = args.get("name", "Untitled")
    file_type = (args.get("type") or "todolist").lower()
    user_request = args.get("user_request") or name

    filename = safe_filename(name)
    filepath = DATA_DIR / filename

    # default content
    if file_type == "table":
        columns, values = default_table_template(user_request)
        content = {"name": name, "type": "table", "columns": columns, "values": values}
    elif file_type == "habit":
        content = {"name": name, "type": "habit", "items":[{"habit":"New Habit","done":False}]}
    elif file_type == "journal":
        content = {"name": name, "type": "journal", "entries":[{"date": today_iso(), "text": ""}]}
    else:
        content = {"name": name, "type": "todolist", "items":[{"task":"New Task 1","done":False}]}

    # Ask LLM to create concrete structure (but enforce strict validation after)
    try:
        content_prompt = PromptTemplate(
        input_variables=["name", "type", "user_request"],
        template=(
        "You are a JSON content generator. Produce a single JSON object which represents a Notion-like file.\n\n"
        "Inputs:\n"
        "- name: {name}\n"
        "- type: {type}\n"
        "- user_request: {user_request}\n\n"

        "Rules:\n"
        "1) Return ONLY valid JSON (no explanatory text).\n"
        "2) For type 'table', return an object with:\n"
        "   - \"name\"\n"
        "   - \"type\"\n"
        "   - \"columns\": an array of objects {{\"name\": \"Column Name\", \"type\": \"text\"}}.\n"
        "   - \"values\": an array of rows (each row is an array)\n"
        "   DO NOT leave columns empty. Use fields relevant to the user_request.\n"
        "\n"
        "3) For type 'todolist', return:\n"
        "   {{\"name\": \"...\", \"type\": \"todolist\", \"items\": [{{\"task\": \"...\", \"done\": false}}] }}\n"
        "\n"
        "4) For type 'habit', return:\n"
        "   {{\"name\": \"...\", \"type\": \"habit\", \"items\": [{{\"habit\": \"...\", \"done\": false}}] }}\n"
        "\n"
        "5) For type 'journal', return:\n"
        "   {{\"name\": \"...\", \"type\": \"journal\", \"entries\": [{{\"date\": \"YYYY-MM-DD\", \"text\": \"...\"}}] }}\n"
        "\n"
        "6) Make columns and example rows / todos directly relevant to the user_request.\n"
        "7) Ensure STRICT valid JSON.\n\n"

        "Example (table JSON structure):\n"
        "{{\"name\":\"Sprint Plan\",\"type\":\"table\",\"columns\":[{{\"name\":\"Task\",\"type\":\"text\"}},{{\"name\":\"Due\",\"type\":\"date\"}}],\"values\":[[\"Design UI\",\"2025-12-05\"]]}}\n\n"

        "Now generate the JSON for the request:"
        ),)

        chain = LLMChain(llm=llm_content, prompt=content_prompt)
        raw = chain.run({"name":name,"type":file_type,"user_request":user_request}) or ""
        raw = raw.strip()
        # extract first JSON object or array
        m = re.search(r"\{[\s\S]*\}$", raw) or re.search(r"\{[\s\S]*\}", raw)
        if m:
            candidate = m.group(0)
        else:
            candidate = raw

        parsed = json.loads(candidate)
        # validate and fix
        parsed_valid = validate_and_fix_content(parsed)
        content = parsed_valid
    except Exception as e:
        # Log and continue with default content
        print("⚠️ content LLM generation failed:", e)
        print(traceback.format_exc())

    # write file
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2)
    except Exception as e:
        return {"status":"error","error":f"Write failed: {e}"}

    return {"status":"created","path":str(filepath),"content":content}

def tool_list_files(_args=None):
    try:
        files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
        return {"status":"ok","files":files}
    except Exception as e:
        return {"status":"error","error":str(e)}

def tool_update_file(args: Dict[str,Any]):
    """
    Update a matching file:
      - table: append a generated row based on user_request (or filename)
      - todolist: append a generated item
      - otherwise: increment a small metadata counter
    """
    name = args.get("name") or args.get("user_request") or ""
    filename = find_best_matching_file(name, DATA_DIR)
    if not filename:
        return {"status":"error","error":"No matching file found."}

    filepath = DATA_DIR / filename
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return {"status":"error","error":f"Failed to open file: {e}"}

    user_request = args.get("user_request") or name.replace(".json","")

    if data.get("type") == "table":
        # generate one row using llm_content based on columns
        try:
            prompt = PromptTemplate(
                input_variables=["columns","user_request"],
                template=(
                    "Given the columns JSON: {columns}\n"
                    "and the user_request: {user_request}\n"
                    "Return exactly one JSON array representing one row that matches the columns.\n"
                    "Return only the JSON array. Example: [\"Task name\",\"In Progress\",\"High\",\"2025-12-01\"]\n"
                )
            )
            chain = LLMChain(llm=llm_content, prompt=prompt)
            cols_json = json.dumps(data.get("columns",[]))
            raw = chain.run({"columns":cols_json,"user_request":user_request}) or ""
            raw = raw.strip()
            m = re.search(r"\[[\s\S]*\]", raw)
            arr = None
            if m:
                arr = json.loads(m.group(0))
            else:
                # try direct parse
                arr = json.loads(raw)
            # ensure list and correct length
            if isinstance(arr, list):
                # pad/truncate to columns count
                col_count = len(data.get("columns",[]))
                new_row = []
                for i in range(col_count):
                    v = arr[i] if i < len(arr) else ""
                    # basic normalization for date / number / checkbox
                    ctype = data["columns"][i].get("type","text")
                    if ctype == "date":
                        if isinstance(v,str) and re.match(r"^\d{4}-\d{2}-\d{2}$", v):
                            new_row.append(v)
                        else:
                            new_row.append(today_iso())
                    elif ctype == "number":
                        try:
                            new_row.append(float(v))
                        except Exception:
                            new_row.append(0)
                    elif ctype == "checkbox":
                        if isinstance(v,bool):
                            new_row.append(v)
                        else:
                            if isinstance(v,str):
                                new_row.append(v.lower() in ("true","1","yes"))
                            else:
                                new_row.append(bool(v))
                    elif ctype == "options":
                        opts = data["columns"][i].get("options",[])
                        sval = str(v) if v is not None else ""
                        new_row.append(sval if sval in opts else (opts[0] if opts else sval))
                    else:
                        new_row.append("" if v is None else str(v))
                data.setdefault("values",[]).append(new_row)
            else:
                # fallback: append example row
                cols = data.get("columns",[])
                example = []
                for c in cols:
                    if c.get("type") == "date":
                        example.append(today_iso())
                    elif c.get("type") == "number":
                        example.append(0)
                    elif c.get("type") == "checkbox":
                        example.append(False)
                    elif c.get("type") == "options":
                        example.append(c.get("options",[""])[0] if c.get("options") else "")
                    else:
                        example.append("New")
                data.setdefault("values",[]).append(example)
        except Exception as e:
            print("⚠️ update row LLM failed:", e)
            # fallback example
            cols = data.get("columns",[])
            example = []
            for c in cols:
                if c.get("type") == "date":
                    example.append(today_iso())
                elif c.get("type") == "number":
                    example.append(0)
                elif c.get("type") == "checkbox":
                    example.append(False)
                elif c.get("type") == "options":
                    example.append(c.get("options",[""])[0] if c.get("options") else "")
                else:
                    example.append("New")
            data.setdefault("values",[]).append(example)

    elif data.get("type") == "todolist":
        # generate a todo item
        try:
            prompt = PromptTemplate(
                input_variables=["user_request"],
                template=(
                    "Given the user_request: {user_request}\n"
                    "Return exactly one JSON object representing a todo item: {\"task\":\"...\",\"done\":false}\n"
                    "Return only that JSON object."
                )
            )
            chain = LLMChain(llm=llm_content, prompt=prompt)
            raw = chain.run({"user_request":user_request}) or ""
            raw = raw.strip()
            m = re.search(r"\{[\s\S]*\}", raw)
            if m:
                obj = json.loads(m.group(0))
            else:
                obj = json.loads(raw)
            if isinstance(obj, dict) and "task" in obj:
                data.setdefault("items",[]).append({"task": str(obj.get("task")),"done": bool(obj.get("done",False))})
            else:
                data.setdefault("items",[]).append({"task":"New Example Task","done":False})
        except Exception as e:
            print("⚠️ update todo LLM failed:", e)
            data.setdefault("items",[]).append({"task":"New Example Task","done":False})
    else:
        # generic: increment meta counter
        if isinstance(data, dict):
            data.setdefault("meta_update_count",0)
            data["meta_update_count"] += 1

    # Save
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        return {"status":"error","error":f"Failed to write updated file: {e}"}

    return {"status":"updated","file":filename,"content":data}

TOOLS = {
    "create_file": {"handler": tool_create_file},
    "list_files": {"handler": tool_list_files},
    "update_file": {"handler": tool_update_file},
}

# ==========================================================
# Tool selector prompt (deterministic)
# ==========================================================
tool_prompt = PromptTemplate(
    input_variables=["tool_descriptions","user_input"],
    template=(
        "You are a tool-selector. If the user explicitly asks to CREATE, UPDATE or LIST a JSON file, "
        "return exactly one JSON object (no surrounding text) with keys:\n"
        "  - type: \"tool_call\"\n"
        "  - name: one of: create_file, update_file, list_files\n"
        "  - arguments: an object with arguments\n\n"
        "Generate realistic argument values based on the user's request. If the user did NOT ask for a file operation return exactly: NO_TOOL\n\n"
        "Tools:\n{tool_descriptions}\n\n"
        "User message:\n{user_input}\n"
    )
)
tool_descriptions = json.dumps({k: {"description": TOOLS[k]["handler"].__doc__ or ""} for k in TOOLS}, indent=2)
tool_chain = LLMChain(llm=llm_tool, prompt=tool_prompt)

# ==========================================================
# Chat endpoint (tool selection + fallback to chat)
# ==========================================================
class Msg(BaseModel):
    content: str

@app.post("/chat/chat")
async def chat(m: Msg):
    try:
        # 1) deterministic tool selector
        tool_result = tool_chain.invoke({"user_input": m.content, "tool_descriptions": tool_descriptions})
        tool_text = tool_result.get("text") or tool_result.get("output_text") or str(tool_result)
        print("TOOL LLM OUTPUT:", tool_text)

        if tool_text.strip() == "NO_TOOL":
            # fallback to regular chat
            resp = chat_chain.predict(input=m.content)
            if isinstance(resp, dict):
                resp = resp.get("output_text") or str(resp)
            return {"mode":"chat","generated_text":resp}

        # try extract JSON object
        match = re.search(r"\{[\s\S]*\}", tool_text)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if (
                    isinstance(parsed, dict)
                    and parsed.get("type") == "tool_call"
                    and parsed.get("name") in TOOLS
                    and isinstance(parsed.get("arguments", {}), dict)
                ):
                    tool_name = parsed["name"]
                    args = parsed.get("arguments", {})
                    args.setdefault("user_request", m.content)
                    output = TOOLS[tool_name]["handler"](args)
                    return {"mode":"tool","result":output}
            except Exception as e:
                print("Failed parse tool JSON:", e, "raw:", match.group(0))
                # fall through to chat fallback

        # final fallback: normal chat
        resp = chat_chain.predict(input=m.content)
        if isinstance(resp, dict):
            resp = resp.get("output_text") or str(resp)
        return {"mode":"chat","generated_text":resp}

    except Exception as e:
        print("CHAT ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================================
# Recommender endpoints (kept same behavior)
# ==========================================================
@app.get("/recommend")
async def recommend_random():
    if kproto is None:
        raise HTTPException(status_code=500, detail="kproto model is not loaded on server.")
    if df_users.empty:
        raise HTTPException(status_code=500, detail="User CSV not loaded or empty.")
    u = df_users.sample(1).iloc[0]
    user_vec = to_kproto_vector(u[FEATURE_COLUMNS].to_dict())
    user_np = np.array([user_vec], dtype=object)
    cluster = int(kproto.predict(user_np, categorical=CATEGORICAL_IDX)[0])
    cluster_users = df_users[df_users["cluster"] == cluster]
    templates = []
    for row in cluster_users["template"]:
        if row is None:
            continue
        if isinstance(row, str):
            try:
                row = json.loads(row)
            except:
                continue
        if isinstance(row, dict):
            row = [row]
        if isinstance(row, list):
            for item in row:
                if isinstance(item, dict):
                    templates.append(item)
    seen = set()
    unique = []
    for t in templates:
        nm = t.get("name","").lower().strip()
        if nm and nm not in seen:
            seen.add(nm)
            unique.append(t)
    return {"mode":"random","cluster":cluster,"user_used":u[FEATURE_COLUMNS].to_dict(),"recommendations":unique[:3]}

class UserProfile(BaseModel):
    age: int
    gender: str
    occupation: str
    education_level: str
    device_type: str
    daily_usage_hours: float

@app.post("/recommend")
async def recommend_user(p: UserProfile):
    if kproto is None:
        raise HTTPException(status_code=500, detail="kproto model is not loaded on server.")
    user_clean = {
        "age": float(p.age),
        "gender": str(p.gender),
        "occupation": str(p.occupation),
        "education_level": str(p.education_level),
        "device_type": str(p.device_type),
        "daily_usage_hours": float(p.daily_usage_hours),
    }
    user_vec = to_kproto_vector(user_clean)
    user_np = np.array([user_vec], dtype=object)
    cluster = int(kproto.predict(user_np, categorical=CATEGORICAL_IDX)[0])
    cluster_users = df_users[df_users["cluster"] == cluster]
    if cluster_users.empty:
        return {"mode":"input_user","cluster":cluster,"user":p.dict(),"recommendations":[],"reason":"No users found in this cluster"}
    templates = []
    for row in cluster_users["template"]:
        if row is None:
            continue
        if isinstance(row, str):
            try:
                row = json.loads(row)
            except:
                continue
        if isinstance(row, dict):
            row = [row]
        if isinstance(row, list):
            for item in row:
                if isinstance(item, dict):
                    templates.append(item)
    if not templates:
        return {"mode":"input_user","cluster":cluster,"user":p.dict(),"recommendations":[],"reason":"Cluster has no templates"}
    seen = set()
    unique = []
    for t in templates:
        nm = t.get("name","").strip().lower()
        if nm and nm not in seen:
            seen.add(nm)
            unique.append(t)
    return {"mode":"input_user","cluster":cluster,"user":p.dict(),"recommendations":unique[:3]}

# ==========================================================
# RUN
# ==========================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
