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

# --- Data model for export request ---
# Note: The provided diff used ExportRequest, but the original /export endpoint
# used dialogue: Dict[str, Any]. Let's assume the frontend sends the whole dialogue object.
# If frontend sends title+messages, keep ExportRequest. If it sends the whole Dialogue, adjust.
# For now, keeping it flexible with a general Dict, matching original likely intent.
# class ExportRequest(BaseModel):
#     title: str # Assuming frontend sends title separately if using this model
#     messages: List[ChatMessageInput]
class ExportRequestDialogue(BaseModel):
     dialogue: Dict[str, Any] = Field(..., description="The entire dialogue object from frontend")


# --- Jinja2 Template Setup for Viewer ---
templates = Jinja2Templates(directory="templates")

# --- FastAPI Application ---
app = FastAPI(title="LLM Chat Backend with Async Streaming")

# --- Optional: Static Files Mount (if needed for viewer CSS/JS) ---
# app.mount("/static", StaticFiles(directory="static"), name="static")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for simplicity, adjust for production
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods
    allow_headers=["*"], # Allow all headers
)

# --- Standard Endpoints ---

@app.get("/")
async def read_root():
    return {"message": "LLM Chat Backend with Async Streaming is running!"}

# Define available models directly or fetch dynamically if preferred
AVAILABLE_MODELS = [
    "gemma2-9b-it",
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
]

@app.get("/models")
async def get_available_models():
    return {"models": AVAILABLE_MODELS}

@app.post("/export", status_code=201)
# Adjust based on what frontend sends: ExportRequest or ExportRequestDialogue
async def handle_export(export_request: ExportRequestDialogue = Body(...)):
    export_id = uuid.uuid4().hex
    dialogue_data = export_request.dialogue # Extract the dialogue data

    # Basic validation: Ensure required keys exist
    if not all(k in dialogue_data for k in ["title", "messages"]):
        raise HTTPException(status_code=400, detail="Invalid dialogue data structure provided for export.")

    # Store the relevant parts (or the whole object if simple)
    export_data = {
        "title": dialogue_data.get("title", "Untitled Export"), # Use get for safety
        "messages": dialogue_data.get("messages", [])
        # You could store other fields like 'id', 'createdAt', 'modelUsed' if needed by viewer
    }
    exported_dialogues[export_id] = export_data
    print(f"--- Dialogue exported ---")
    print(f"Export ID: {export_id}")
    print(f"Stored data: {export_data}") # Log the stored data
    export_link = f"{BASE_EXPORT_URL.rstrip('/')}/view/{export_id}"
    return {"url": export_link} # Return 'url' key as expected by frontend

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
    # Pass necessary context to the template
    return templates.TemplateResponse(
        name="viewer.html",
        context={
            "request": request,
            "export_id": export_id,
            "backend_base_url": BASE_EXPORT_URL.rstrip('/') # Pass the base URL for API calls from viewer JS
            }
    )

# --- ASYNCHRONOUS STREAMING GENERATOR ---
async def stream_llm_response(model: str, messages: List[Dict[str, str]]):
    """ASYNCHRONOUS generator for streaming LLM responses via SSE."""
    try:
        # ---> USE ASYNC CLIENT and await <---
        stream = await async_client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        )
        # ----------------------------------------->
        print(f"[BACKEND LOG 1] Async Stream started for model: {model}")
        stream_entered = False # Flag to check if loop was entered

        # ---> Use 'async for' <---
        async for chunk in stream:
            stream_entered = True
            # print(f"[BACKEND LOG 2] Raw chunk: {chunk}") # Optional verbose log
            content = None
            try:
                # Check if delta and content exist before accessing
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                     content = chunk.choices[0].delta.content
                     # print(f"[BACKEND LOG 3] Extracted content: {content!r}") # Optional log
                # else: # Optional log for empty/non-content chunks
                #     print(f"[BACKEND LOG Info] Chunk without content: {chunk}")
            except (AttributeError, IndexError, TypeError): # Catch potential errors
                print(f"[BACKEND LOG Error] Could not extract content from chunk: {chunk}")
                continue # Skip this chunk if content extraction fails

            if content is not None:
                # --- ADDED LOG 4 ---
                print(f"[BACKEND LOG 4] Yielding token: {content!r}")
                yield f"data: {json.dumps({'token': content})}\n\n"
                # await asyncio.sleep(0.01) # Usually not needed with async for, uncomment for testing flow

        # --- ADDED LOG 5 ---
        if not stream_entered:
             print("!!! [BACKEND LOG 5] WARNING: Async stream loop was NOT entered. Stream might be empty or closed immediately.")

        # Optional: Signal the end of the stream
        # --- ADDED LOG 6 ---
        print(f"[BACKEND LOG 6] Async Stream loop finished for model: {model}")
        yield f"event: end\ndata: {{}}\n\n"

    except openai.APIError as e:
         print(f"!!! Groq API error during async stream: {e}")
         # Attempt to extract a useful message, default to string representation
         error_message = str(e)
         if hasattr(e, 'message'): error_message = e.message
         elif hasattr(e, 'body') and isinstance(e.body, dict) and 'message' in e.body: error_message = e.body['message']
         status_code = getattr(e, 'status_code', 500)
         # Send error details to the client via SSE 'error' event
         error_payload = json.dumps({'error': f'Ошибка API Groq: {error_message}', 'status_code': status_code})
         yield f"event: error\ndata: {error_payload}\n\n"
         print(f"Sent SSE error event: {error_payload}")

    except Exception as e:
         print(f"!!! An unexpected error occurred during async stream: {e}")
         # Send a generic error to the client via SSE 'error' event
         error_payload = json.dumps({'error': f'Внутренняя ошибка сервера при стриминге: {str(e)}'})
         yield f"event: error\ndata: {error_payload}\n\n"
         print(f"Sent SSE generic error event: {error_payload}")


# The /chat endpoint remains async def, now calling the async generator
@app.post("/chat")
async def handle_chat_streaming(chat_request: ChatRequest = Body(...)):
    """
    Handles chat requests, utilizes the async stream_llm_response generator
    for generating the response from Groq, and returns a StreamingResponse.
    """
    print(f"Received chat request for model: {chat_request.model}")
    # Prepare messages in the format required by the API client
    messages_for_api = [msg.model_dump() for msg in chat_request.messages]

    # Return a StreamingResponse using the async generator
    # FastAPI correctly handles iterating over the async generator
    return StreamingResponse(
        stream_llm_response(chat_request.model, messages_for_api),
        media_type="text/event-stream"
    )

# --- Server Run ---
if __name__ == "__main__":
    import uvicorn
    # Use reload=True for development, remove or set to False for production
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# --- END OF FILE main.py ---