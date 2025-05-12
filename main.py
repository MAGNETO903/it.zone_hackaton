# --- START OF FILE main.py ---

import asyncio # Import asyncio
from fastapi import FastAPI, HTTPException, Body, Request, Depends
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
# from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import openai # Keep for potential sync operations or APIError type hinting
# ---> IMPORT ASYNC CLIENT <---
from openai import AsyncOpenAI
# --------------------------------------->
import os
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import uuid
import json
# import time # No longer needed if using asyncio.sleep or no sleep

# --- Configuration ---
API_KEY = os.getenv("GROQ_API_KEY", "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") # Your key
BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

if not API_KEY:
    raise ValueError("GROQ_API_KEY environment variable or hardcoded key is required")

# ---> CREATE ASYNC CLIENT <---
async_client = AsyncOpenAI(
    api_key=API_KEY,
    base_url=BASE_URL,
)
# ----------------------------------->

# --- Storage for exported dialogues (In-memory - for hackathon) ---
exported_dialogues: Dict[str, Dict[str, Any]] = {}

# --- Base URL for export links (REPLACE WITH YOUR PUBLIC ADDRESS) ---
BASE_EXPORT_URL = os.getenv("BASE_EXPORT_URL", "https://951f-79-127-206-187.ngrok-free.app") # Example! REPLACE!
print(f"--- IMPORTANT: Using BASE_EXPORT_URL: {BASE_EXPORT_URL} ---")
print(f"--- Make sure this URL is publicly accessible for export links to work! ---")

# --- Pydantic Data Models ---
class ChatMessageInput(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessageInput]

class ExportRequestDialogue(BaseModel):
     dialogue: Dict[str, Any] = Field(..., description="The entire dialogue object from frontend")


# --- Jinja2 Template Setup for Viewer ---
templates = Jinja2Templates(directory="templates")

# --- FastAPI Application ---
app = FastAPI(title="LLM Chat Backend with Async Streaming")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Standard Endpoints ---

@app.get("/")
async def read_root():
    return {"message": "LLM Chat Backend with Async Streaming is running!"}

AVAILABLE_MODELS = [
    "gemma2-9b-it",
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
]

@app.get("/models")
async def get_available_models():
    return {"models": AVAILABLE_MODELS}

@app.post("/export", status_code=201)
async def handle_export(export_request: ExportRequestDialogue = Body(...)):
    export_id = uuid.uuid4().hex
    dialogue_data = export_request.dialogue

    if not all(k in dialogue_data for k in ["title", "messages"]):
        raise HTTPException(status_code=400, detail="Invalid dialogue data structure provided for export.")

    export_data = {
        "title": dialogue_data.get("title", "Untitled Export"),
        "messages": dialogue_data.get("messages", [])
    }
    exported_dialogues[export_id] = export_data
    print(f"--- Dialogue exported ---")
    print(f"Export ID: {export_id}")
    print(f"Stored data: {export_data}")
    export_link = f"{BASE_EXPORT_URL.rstrip('/')}/view/{export_id}"
    return {"url": export_link}

@app.get("/view-data/{export_id}")
async def get_view_data(export_id: str):
    dialogue_data = exported_dialogues.get(export_id)
    print(f"--- Requesting data for view ---")
    print(f"Requested Export ID: {export_id}")
    if not dialogue_data:
        print(f"Exported dialogue not found for ID: {export_id}")
        raise HTTPException(status_code=404, detail="Exported dialogue not found")
    print(f"Found data: {dialogue_data}")
    print(f"Serving data for exported dialogue ID: {export_id}")
    return dialogue_data

@app.get("/view/{export_id}", response_class=HTMLResponse)
async def view_exported_dialogue(request: Request, export_id: str):
    if export_id not in exported_dialogues:
         print(f"Attempted to view non-existent export ID: {export_id}")
         raise HTTPException(status_code=404, detail="Exported dialogue not found")
    print(f"Rendering viewer page for export ID: {export_id}")
    return templates.TemplateResponse(
        name="viewer.html",
        context={
            "request": request,
            "export_id": export_id,
            "backend_base_url": BASE_EXPORT_URL.rstrip('/')
            }
    )

# --- ASYNCHRONOUS STREAMING GENERATOR ---
async def stream_llm_response(model: str, messages: List[Dict[str, str]]):
    """ASYNCHRONOUS generator for streaming LLM responses via SSE."""
    try:
        stream = await async_client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        )
        print(f"[BACKEND LOG 1] Async Stream started for model: {model}")
        stream_entered = False

        async for chunk in stream:
            stream_entered = True
            content = None
            try:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                     content = chunk.choices[0].delta.content
            except (AttributeError, IndexError, TypeError):
                print(f"[BACKEND LOG Error] Could not extract content from chunk: {chunk}")
                continue

            if content is not None:
                print(f"[BACKEND LOG 4] Yielding token: {content!r}")
                # --- MODIFICATION: Added ensure_ascii=False ---
                sse_data_line = f"data: {json.dumps({'token': content}, ensure_ascii=False)}\n\n"
                yield sse_data_line.encode('utf-8')
                # ---------------------------------------------
                # await asyncio.sleep(0.01)

        if not stream_entered:
             print("!!! [BACKEND LOG 5] WARNING: Async stream loop was NOT entered. Stream might be empty or closed immediately.")

        print(f"[BACKEND LOG 6] Async Stream loop finished for model: {model}")
        # --- MODIFICATION: No json.dumps here, so ensure_ascii not applicable ---
        sse_end_event = f"event: end\ndata: {{}}\n\n"
        yield sse_end_event.encode('utf-8')
        # -------------------------------------------------------------

    except openai.APIError as e:
         print(f"!!! Groq API error during async stream: {e}")
         # --- MODIFICATION: Use repr(e) for potentially safer string conversion ---
         error_message = repr(e)
         if hasattr(e, 'message') and e.message: error_message = e.message
         elif hasattr(e, 'body') and isinstance(e.body, dict) and 'message' in e.body: error_message = e.body['message']
         status_code = getattr(e, 'status_code', 500)
         # --- MODIFICATION: Added ensure_ascii=False ---
         error_payload = json.dumps({'error': f'Ошибка API Groq: {error_message}', 'status_code': status_code}, ensure_ascii=False)
         sse_error_event = f"event: error\ndata: {error_payload}\n\n"
         yield sse_error_event.encode('utf-8')
         print(f"Sent SSE error event: {error_payload}")

    except Exception as e:
         print(f"!!! An unexpected error occurred during async stream: {e}")
         # --- MODIFICATION: Use repr(e) and ensure_ascii=False ---
         error_payload_dict = {'error': f'Внутренняя ошибка сервера при стриминге: {repr(e)}'}
         error_payload = json.dumps(error_payload_dict, ensure_ascii=False)
         sse_generic_error_event = f"event: error\ndata: {error_payload}\n\n"
         yield sse_generic_error_event.encode('utf-8')
         print(f"Sent SSE generic error event: {error_payload}")


@app.post("/chat")
async def handle_chat_streaming(chat_request: ChatRequest = Body(...)):
    """
    Handles chat requests, utilizes the async stream_llm_response generator
    for generating the response from Groq, and returns a StreamingResponse.
    """
    print(f"Received chat request for model: {chat_request.model}")
    messages_for_api = [msg.model_dump() for msg in chat_request.messages]

    return StreamingResponse(
        stream_llm_response(chat_request.model, messages_for_api),
        media_type="text/event-stream; charset=utf-8"
    )

# --- Server Run ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# --- END OF FILE main.py ---