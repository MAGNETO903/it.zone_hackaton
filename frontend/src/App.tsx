// --- START OF FILE App.tsx ---
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import necessary icons
import { PlusCircle, Trash, Menu, X, Send, Share2, Copy, Edit2, Check, Info } from 'react-feather';
// Import SSE parser
import { createParser } from 'eventsource-parser'; // Import createParser directly
import type { ParsedEvent as ESParsedEvent, ReconnectInterval as ESReconnectInterval } from 'eventsource-parser'; // Import types separately with aliases
// Import Markdown renderer
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';
import { useTelegramTheme } from './hooks/useTelegramTheme';

// Interface for a single chat message
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Interface for a dialogue/chat session
interface Dialogue {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    modelUsed?: string;
    systemPrompt?: string;
}

// AppProps interface removed as it's empty and App takes no props

// Backend URL - Now attempts to read from window.__BACKEND_URL__ injected by Docker/Nginx
const BACKEND_URL = (window as any).__BACKEND_URL__ || 'http://localhost:8000';


// NGROK Header
const NGROK_SKIP_BROWSER_WARNING_HEADER = { 'ngrok-skip-browser-warning': 'true' };

// LocalStorage keys
const LS_DIALOGUES_KEY = 'chatDialogues_v1';
const LS_ACTIVE_ID_KEY = 'activeDialogueId_v1';
const LS_MODEL_KEY = 'selectedLlmModel_v1';


function App() { // No props
    useTelegramTheme();

    // --- STATE MANAGEMENT ---
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [activeDialogueId, setActiveDialogueId] = useState<string | null>(null);
    const [userInput, setUserInput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [modelsLoading, setModelsLoading] = useState<boolean>(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => window.innerWidth >= 768);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [exportLink, setExportLink] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<string>('');

    // --- Editing State ---
    const [editingMessageKey, setEditingMessageKey] = useState<string | null>(null);
    const [editText, setEditText] = useState<string>('');

    // --- Refs ---
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const streamingDialogueIdRef = useRef<string | null>(null);


    // --- HELPER FUNCTIONS ---
    const getActiveDialogue = useCallback((): Dialogue | undefined => {
        return dialogues.find(d => d.id === activeDialogueId);
    }, [dialogues, activeDialogueId]);

    const scrollToBottom = () => {
        const delay = editingMessageKey ? 150 : 100;
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, delay);
    };

    // --- EFFECTS ---
     useEffect(() => { scrollToBottom(); }, [activeDialogueId, dialogues, editingMessageKey]);

    useEffect(() => {
        if (editingMessageKey && editTextAreaRef.current) {
            editTextAreaRef.current.focus();
            editTextAreaRef.current.selectionStart = editTextAreaRef.current.value.length;
            editTextAreaRef.current.selectionEnd = editTextAreaRef.current.value.length;
        }
    }, [editingMessageKey]);

    // Fetch models
    useEffect(() => {
        const fetchModels = async () => {
            setModelsLoading(true);
            setError(null);
            try {
                const response = await fetch(`${BACKEND_URL}/models`, {
                    headers: NGROK_SKIP_BROWSER_WARNING_HEADER
                });
                if (!response.ok) {
                     throw new Error(`Ошибка загрузки моделей: ${response.statusText}`);
                }
                const data = await response.json();
                const models = data.models || [];
                setAvailableModels(models);
                const savedModel = localStorage.getItem(LS_MODEL_KEY);
                if (models.length > 0) {
                     if (savedModel && models.includes(savedModel)) { setSelectedModel(savedModel); }
                     else { setSelectedModel(models[0]); }
                } else { setError("Список доступных моделей пуст."); }
            } catch (err) {
                console.error("Error fetching models:", err);
                setError(err instanceof Error ? err.message : "Не удалось загрузить список моделей.");
                setAvailableModels([]);
            } finally {
                setModelsLoading(false);
            }
        };
        fetchModels();
     }, []);

    // Load from localStorage
    useEffect(() => {
        try {
             const savedDialogues = localStorage.getItem(LS_DIALOGUES_KEY); const savedActiveId = localStorage.getItem(LS_ACTIVE_ID_KEY); let loadedDialogues: Dialogue[] = [];
             if (savedDialogues) { loadedDialogues = JSON.parse(savedDialogues); if (!Array.isArray(loadedDialogues)) { loadedDialogues = []; } setDialogues(loadedDialogues); }
             if (savedActiveId && loadedDialogues.some(d => d.id === savedActiveId)) { setActiveDialogueId(savedActiveId); } else if (loadedDialogues.length > 0) { setActiveDialogueId(loadedDialogues[0].id); } else { setActiveDialogueId(null); }
        } catch (error) { console.error("Failed to load data from localStorage:", error); localStorage.removeItem(LS_DIALOGUES_KEY); localStorage.removeItem(LS_ACTIVE_ID_KEY); setDialogues([]); setActiveDialogueId(null); }
     }, []);

    // Save to localStorage
    useEffect(() => {
        try {
            if (dialogues.length > 0) { const sortedDialogues = [...dialogues].sort((a, b) => b.createdAt - a.createdAt); localStorage.setItem(LS_DIALOGUES_KEY, JSON.stringify(sortedDialogues)); } else { localStorage.removeItem(LS_DIALOGUES_KEY); }
            if (activeDialogueId) { localStorage.setItem(LS_ACTIVE_ID_KEY, activeDialogueId); } else { localStorage.removeItem(LS_ACTIVE_ID_KEY); }
            if (selectedModel) { localStorage.setItem(LS_MODEL_KEY, selectedModel); } else { localStorage.removeItem(LS_MODEL_KEY); }
        } catch (error) { console.error("Failed to save data to localStorage:", error); }
     }, [dialogues, activeDialogueId, selectedModel]);


    // Cleanup AbortController
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                console.log("Aborting previous fetch request on component unmount");
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // --- ACTION HANDLERS ---

    const stopStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            console.log("Stopping stream via AbortController");
            abortControllerRef.current.abort("User aborted");
            abortControllerRef.current = null;
            setIsLoading(false);
            setDialogues(prev => prev.map(d => {
                 if (d.id === activeDialogueId) {
                      const msgs = d.messages;
                      const lastAssistantIndex = msgs.map(m => m.role).lastIndexOf('assistant');
                      if (lastAssistantIndex !== -1 && msgs[lastAssistantIndex].content === '') {
                           console.log("Removing empty placeholder on stopStreaming");
                           return { ...d, messages: msgs.slice(0, lastAssistantIndex) };
                      }
                 }
                 return d;
            }));
        }
    }, [activeDialogueId, setIsLoading, setDialogues]);


    const streamResponse = useCallback(async (dialogueIdToUpdate: string, messagesForApi: ChatMessage[]) => {
        setIsLoading(true);
        setError(null);
        setExportLink(null);
        setCopySuccess('');

        if (abortControllerRef.current) {
            console.log("Aborting previous fetch before starting new one.");
            abortControllerRef.current.abort("Starting new request");
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        streamingDialogueIdRef.current = dialogueIdToUpdate;
        console.log(`[streamResponse] Set streamingDialogueIdRef to: ${streamingDialogueIdRef.current}`);

        let currentAccumulatedContent = '';

        try {
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...NGROK_SKIP_BROWSER_WARNING_HEADER },
                body: JSON.stringify({ model: selectedModel, messages: messagesForApi }),
                signal: signal,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => `Status: ${response.status}`);
                throw new Error(`Ошибка сети: ${response.status} ${response.statusText} - ${errorText}`);
            }
            if (!response.body) {
                 throw new Error("Ответ сервера не содержит тела для стриминга.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const handleParserEvent = (event: ESParsedEvent | ESReconnectInterval) => { // Use aliased types
                console.log("--- [FRONTEND LOG 0] Entering handleParserEvent ---", event);

                if (event.type === 'event' && event.event === 'error') {
                    console.log("[handleParserEvent] Processing 'error' event");
                    try {
                        const errorData = JSON.parse(event.data || '{}');
                        console.error("SSE Error Event Data:", errorData);
                        setError(errorData.error || "Ошибка от сервера во время стриминга.");
                    } catch (parseError) {
                        console.error("Error parsing SSE error event data:", parseError, "Raw data:", event.data);
                        setError("Не удалось распознать ошибку от сервера.");
                    }
                    setIsLoading(false);
                    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
                        abortControllerRef.current.abort("SSE Error Event Received");
                    }
                    return;
                }

                if (event.type === 'event' && event.event === 'end') {
                    console.log("[handleParserEvent] Processing 'end' event");
                    return;
                }

                if ('data' in event && event.data) { // Ensure data exists and is not null/undefined
                    const eventData = event.data;
                    console.log("[FRONTEND LOG B] Raw data found:", eventData);
                    try {
                        const parsedData = JSON.parse(eventData);
                        console.log("[FRONTEND LOG C] Parsed data:", parsedData);

                        if (parsedData && typeof parsedData.token === 'string') {
                            const token = parsedData.token;
                            console.log(">>> [FRONTEND LOG D] Token found:", token);
                            currentAccumulatedContent += token;

                            const currentStreamingId = streamingDialogueIdRef.current;
                            if (!currentStreamingId) {
                                console.warn("StreamingDialogueIdRef is null inside handleParserEvent, skipping state update for token.");
                                return;
                            }
                            setDialogues(prevDialogues => {
                                return prevDialogues.map(dialogue => {
                                    if (dialogue.id === currentStreamingId) {
                                        const updatedMessages = [...dialogue.messages];
                                        const lastMessageIndex = updatedMessages.length - 1;
                                        if (lastMessageIndex >= 0 && updatedMessages[lastMessageIndex].role === 'assistant') {
                                            updatedMessages[lastMessageIndex] = {
                                                ...updatedMessages[lastMessageIndex],
                                                content: currentAccumulatedContent
                                            };
                                            return { ...dialogue, messages: updatedMessages };
                                        } else {
                                            console.warn(`[setDialogues update] Last message mismatch for dialogue ${currentStreamingId}. Expected assistant placeholder at index ${lastMessageIndex}. Found:`, updatedMessages[lastMessageIndex]);
                                        }
                                    }
                                    return dialogue;
                                });
                            });
                        } else {
                            console.log("[FRONTEND LOG E] No token found in parsed data:", parsedData);
                        }
                    } catch (parseError) {
                        console.error("[FRONTEND LOG F] Error parsing JSON data in handleParserEvent:", parseError, "Raw data:", eventData);
                        setError("Ошибка обработки данных от сервера.");
                        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
                             abortControllerRef.current.abort("SSE JSON Parsing Error");
                             setIsLoading(false);
                        }
                    }
                } else if (event.type === 'reconnect-interval') {
                    console.log('[handleParserEvent] Received reconnect-interval event:', event.value);
                } else if ('data' in event && !event.data) {
                     console.log("[FRONTEND LOG H] Event has 'data' field, but it is empty or null.");
                }
                 else {
                    console.warn("[handleParserEvent] Unexpected event structure received (no specific event name, no 'data' field, not reconnect-interval):", event);
                }
            };

            const parser = createParser(handleParserEvent as any); // Use as any if type conflict persists with ESParsedEvent union

            while (true) {
                if (signal.aborted) {
                     console.log("Signal aborted detected in read loop.");
                     throw signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason) || 'Aborted by signal');
                }
                const { done, value } = await reader.read();
                if (done) {
                    console.log("Reader finished (done is true).");
                    break;
                }
                const textChunk = decoder.decode(value, { stream: true });
                console.log("[FRONTEND LOG G] Feeding parser with chunk:", textChunk);
                parser.feed(textChunk);
            }
            console.log("Exited reader loop normally (stream finished).");
        } catch (err) {
             if (err instanceof Error) {
                 if (err.name === 'AbortError' || (signal.aborted && (err.message.includes('aborted') || err.message.includes('cancel'))) ) {
                     const reason = signal.reason || err.message || "Aborted";
                     console.log(`Fetch aborted: ${reason}`);
                     if (reason !== "User aborted" && !reason.startsWith("SSE ") && !reason.startsWith("Starting new request")) {
                          setError(`Операция прервана: ${reason}`);
                     }
                 } else {
                     console.error("Error during streaming fetch/processing:", err);
                     setError(err.message || "Не удалось отправить или обработать сообщение.");
                 }
                 if (signal.reason !== 'User aborted') {
                      setDialogues(prev => prev.map(d => {
                          const idToClean = streamingDialogueIdRef.current ?? dialogueIdToUpdate;
                          if (d.id === idToClean) {
                               const msgs = d.messages;
                               const lastAssistantIndex = msgs.map(m => m.role).lastIndexOf('assistant');
                               if (lastAssistantIndex !== -1 && msgs[lastAssistantIndex].content === '') {
                                    console.log(`Cleaning up empty assistant message for dialogue ${idToClean} due to error/abort: ${signal.reason || err.message}`);
                                    return { ...d, messages: msgs.slice(0, lastAssistantIndex) };
                               }
                          }
                          return d;
                      }));
                 }
             } else {
                console.error("Unknown error type during streaming:", err);
                setError("Произошла неизвестная ошибка во время обработки запроса.");
             }
        } finally {
             console.log(`Stream finally block executing for dialogue: ${streamingDialogueIdRef.current ?? dialogueIdToUpdate}`);
             setIsLoading(false);
             if (abortControllerRef.current && abortControllerRef.current.signal === signal) {
                  console.log("Clearing AbortController ref in finally.");
                  abortControllerRef.current = null;
             }
             streamingDialogueIdRef.current = null;
             console.log("Cleared streamingDialogueIdRef in finally.");
        }
    }, [selectedModel, setIsLoading, setError, setDialogues, setExportLink, setCopySuccess]);


    const sendMessage = useCallback(async () => {
        const currentDialogue = getActiveDialogue();
        if (!activeDialogueId || !userInput.trim() || isLoading || !selectedModel || !currentDialogue || editingMessageKey) {
            console.warn("SendMessage checks failed:", { activeDialogueId, userInput: userInput.trim(), isLoading, selectedModel, currentDialogueExists: !!currentDialogue, editingMessageKey });
            return;
        }

        const newUserMessage: ChatMessage = { role: 'user', content: userInput.trim() };
        const dialogueIdToUpdate = activeDialogueId;
        const assistantMessagePlaceholder: ChatMessage = { role: 'assistant', content: '' };

        const messagesForApi: ChatMessage[] = [];
        if (currentDialogue?.systemPrompt) {
            messagesForApi.push({ role: 'system', content: currentDialogue.systemPrompt });
        }
        const currentHistory = currentDialogue?.messages || [];
        [...currentHistory, newUserMessage].forEach(msg => {
            messagesForApi.push({ role: msg.role, content: msg.content });
        });

        setDialogues(prevDialogues => prevDialogues.map(dialogue => {
            if (dialogue.id === dialogueIdToUpdate) {
                 const newTitle = (dialogue.messages.length === 0 && dialogue.title.startsWith("Новый чат"))
                     ? newUserMessage.content.substring(0, 35) + (newUserMessage.content.length > 35 ? '...' : '')
                     : dialogue.title;
                 const existingMessages = dialogue.messages || [];
                 return {
                     ...dialogue,
                     title: newTitle,
                     messages: [...existingMessages, newUserMessage, assistantMessagePlaceholder],
                     modelUsed: selectedModel
                 };
            }
            return dialogue;
        }));

        setUserInput('');
        streamResponse(dialogueIdToUpdate, messagesForApi);

    }, [userInput, isLoading, selectedModel, activeDialogueId, getActiveDialogue, editingMessageKey, setDialogues, setUserInput, streamResponse]);


    const cancelEditing = useCallback(() => {
        setEditingMessageKey(null);
        setEditText('');
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingMessageKey || !editText.trim() || isLoading || !selectedModel) {
            console.warn("handleSaveEdit checks failed:", { editingMessageKey, editText: editText.trim(), isLoading, selectedModel });
            cancelEditing();
            return;
        }

        const lastDashIndex = editingMessageKey.lastIndexOf('-');
        if (lastDashIndex === -1) {
            console.error("Invalid editingMessageKey format:", editingMessageKey);
            cancelEditing(); return;
        }
        const dialogueId = editingMessageKey.substring(0, lastDashIndex);
        const messageIndexStr = editingMessageKey.substring(lastDashIndex + 1);
        const messageIndex = parseInt(messageIndexStr, 10);
        if (isNaN(messageIndex)) {
            console.error("Invalid message index in editingMessageKey:", messageIndexStr);
            cancelEditing(); return;
        }

        const dialogueToEdit = dialogues.find(d => d.id === dialogueId);
        if (!dialogueToEdit) {
            console.error("Dialogue not found for editing:", dialogueId);
            cancelEditing(); return;
        }

        const originalMessages = dialogueToEdit.messages;
        const updatedContent = editText.trim();

        if (messageIndex < 0 || messageIndex >= originalMessages.length || originalMessages[messageIndex]?.role !== 'user') {
            console.error("Invalid message index or trying to edit non-user message:", messageIndex);
            cancelEditing(); return;
        }
        if (originalMessages[messageIndex]?.content === updatedContent) {
             console.log("Edit cancelled: Content unchanged.");
             cancelEditing(); return;
        }

        const messagesForApi: ChatMessage[] = [];
        if (dialogueToEdit?.systemPrompt) {
            messagesForApi.push({ role: 'system', content: dialogueToEdit.systemPrompt });
        }

        const historyUpToEditedWithEdit = originalMessages
            .slice(0, messageIndex + 1)
            .map((msg, idx) =>
                idx === messageIndex
                ? { role: 'user' as 'user', content: updatedContent }
                : { role: msg.role, content: msg.content }
            );

        historyUpToEditedWithEdit.forEach(msg => {
            messagesForApi.push({ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content });
        });

        const assistantMessagePlaceholder: ChatMessage = { role: 'assistant', content: '' };
        setDialogues(prevDialogues => prevDialogues.map(d =>
            d.id === dialogueId ? {
                ...d,
                messages: [
                    ...originalMessages.slice(0, messageIndex),
                    { role: 'user', content: updatedContent },
                    assistantMessagePlaceholder
                ]
            } : d
        ));

        cancelEditing();
        streamResponse(dialogueId, messagesForApi);

    }, [editingMessageKey, editText, dialogues, selectedModel, isLoading, cancelEditing, setDialogues, streamResponse]);


    const startEditing = (dialogueId: string, messageIndex: number, currentContent: string) => {
        if (isLoading || exportingId || editingMessageKey) return;
        stopStreaming();
        const messageKey = `${dialogueId}-${messageIndex}`;
        setEditingMessageKey(messageKey);
        setEditText(currentContent);
        setError(null);
        setExportLink(null);
        setCopySuccess('');
    };

    const createNewDialogue = useCallback(() => {
        if (isLoading || editingMessageKey) return;
        stopStreaming();
        cancelEditing();
        setError(null);
        setExportLink(null);
        setCopySuccess('');

        const newDialogueId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newDialogue: Dialogue = {
            id: newDialogueId,
            title: `Новый чат ${dialogues.length + 1}`,
            messages: [],
            createdAt: Date.now(),
            systemPrompt: undefined,
            modelUsed: selectedModel || undefined
        };

        setDialogues(prev => [newDialogue, ...prev]);
        setActiveDialogueId(newDialogueId);
        setUserInput('');
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    }, [isLoading, editingMessageKey, dialogues, selectedModel, stopStreaming, cancelEditing, setDialogues, setActiveDialogueId, setError, setUserInput, setIsSidebarOpen, setExportLink, setCopySuccess]);

    const deleteDialogue = useCallback((idToDelete: string) => {
        if (isLoading || editingMessageKey) return;

        if (isLoading && streamingDialogueIdRef.current === idToDelete) {
            stopStreaming();
        }
        if (editingMessageKey?.startsWith(idToDelete)) {
            cancelEditing();
        }

        const remainingDialogues = dialogues.filter(d => d.id !== idToDelete);
        setDialogues(remainingDialogues);

        if (activeDialogueId === idToDelete) {
             setError(null);
             setExportLink(null);
             setCopySuccess('');
            if (remainingDialogues.length > 0) {
                const sortedRemaining = [...remainingDialogues].sort((a, b) => b.createdAt - a.createdAt);
                setActiveDialogueId(sortedRemaining[0].id);
            } else {
                 setActiveDialogueId(null);
            }
        }
    }, [dialogues, activeDialogueId, editingMessageKey, isLoading, stopStreaming, cancelEditing, setError, setDialogues, setActiveDialogueId, setExportLink, setCopySuccess]);

    useEffect(() => {
        if (!modelsLoading && dialogues.length === 0 && !activeDialogueId && !isLoading && !editingMessageKey && availableModels.length > 0) {
            console.log("No dialogues found, creating initial one.");
            createNewDialogue();
        }
    }, [modelsLoading, dialogues, activeDialogueId, isLoading, editingMessageKey, availableModels, createNewDialogue]);


    const selectDialogue = (id: string) => {
        if (id === activeDialogueId || isLoading || editingMessageKey) {
            return;
        }
        stopStreaming();
        cancelEditing();
        setActiveDialogueId(id);
        setError(null);
        setExportLink(null);
        setCopySuccess('');

        const selectedDialog = dialogues.find(d => d.id === id);
        if (selectedDialog?.modelUsed && availableModels.includes(selectedDialog.modelUsed)) {
            setSelectedModel(selectedDialog.modelUsed);
        } else if (availableModels.length > 0) {
             if (!selectedModel || !availableModels.includes(selectedModel)) {
                setSelectedModel(availableModels[0]);
             }
        }

        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!isLoading && !editingMessageKey && userInput.trim() && activeDialogueId && selectedModel) {
                sendMessage();
            }
        }
    };

    const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = event.target.value;
        if (newModel && !isLoading && !editingMessageKey && !exportingId) {
            stopStreaming();
            setSelectedModel(newModel);
            localStorage.setItem(LS_MODEL_KEY, newModel);
            setError(null);
        }
    };

    const closeSidebar = () => setIsSidebarOpen(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const copyToClipboard = useCallback((text: string | null) => {
        if (!text) return;
        if (!navigator.clipboard) {
            setCopySuccess('Копирование недоступно (небезопасный контекст).');
            console.warn("Clipboard API not available. Ensure page is served over HTTPS or localhost.");
            setTimeout(() => setCopySuccess(''), 3000);
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            setCopySuccess('Ссылка скопирована!');
            setTimeout(() => setCopySuccess(''), 3000);
        }).catch(err => {
            setCopySuccess('Ошибка копирования ссылки.');
            console.error('Failed to copy text: ', err);
             setTimeout(() => setCopySuccess(''), 3000);
        });
    }, []);

    const handleExport = useCallback(async (dialogueToExport: Dialogue | undefined) => {
         if (!dialogueToExport || exportingId || editingMessageKey || isLoading) return;

         stopStreaming();
         const dialogueId = dialogueToExport.id;
         setExportingId(dialogueId);
         setExportLink(null);
         setCopySuccess('');
         setError(null);

         try {
             const response = await fetch(`${BACKEND_URL}/export`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', ...NGROK_SKIP_BROWSER_WARNING_HEADER },
                 body: JSON.stringify({ dialogue: dialogueToExport }),
             });

             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
                 throw new Error(errorData.error || `Ошибка экспорта: ${response.statusText}`);
             }

             const data = await response.json();
             if (data.url) {
                 setExportLink(data.url);
                 copyToClipboard(data.url);
             } else {
                 throw new Error("Не удалось получить ссылку для экспорта от сервера.");
             }

         } catch (err) {
             console.error("Export failed:", err);
             setError(err instanceof Error ? err.message : "Неизвестная ошибка при экспорте.");
             setExportLink(null);
             setCopySuccess('');
         } finally {
             setExportingId(null);
         }
     }, [exportingId, editingMessageKey, isLoading, BACKEND_URL, stopStreaming, copyToClipboard, setError, setExportingId, setExportLink, setCopySuccess]);

    const handleSetSystemPrompt = useCallback(() => {
        const currentDialogue = getActiveDialogue();
        if (!currentDialogue || !activeDialogueId) return;

        const currentSystemPrompt = currentDialogue.systemPrompt || '';
        const newSystemPrompt = prompt(
            "Введите системный промпт для этого чата (оставьте пустым, чтобы удалить):",
            currentSystemPrompt
        );

        if (newSystemPrompt !== null) {
            setDialogues(prevDialogues =>
                prevDialogues.map(d =>
                    d.id === activeDialogueId
                        ? { ...d, systemPrompt: newSystemPrompt.trim() ? newSystemPrompt.trim() : undefined }
                        : d
                )
            );
        }
    }, [activeDialogueId, dialogues, getActiveDialogue, setDialogues]);


    // --- RENDER LOGIC ---
    const currentMessages = getActiveDialogue()?.messages || [];
    const currentActiveDialogue = getActiveDialogue();
    const textAreaRows = Math.min(userInput.split('\n').length, 5);

    return (
         <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            {/* Sidebar */}
            <div className="sidebar">
                 <button className="new-chat-button" onClick={createNewDialogue} disabled={isLoading || !!exportingId || !!editingMessageKey}>
                     <PlusCircle size={18} /> Новый чат
                 </button>
                 <div className="dialogue-list">
                     {[...dialogues].sort((a, b) => b.createdAt - a.createdAt).map(dialogue => {
                         const isActive = dialogue.id === activeDialogueId;
                         const isDisabled = !!editingMessageKey || isLoading || !!exportingId;
                         return (
                             <div
                                 key={dialogue.id}
                                 className={`dialogue-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                                 onClick={() => !isDisabled && selectDialogue(dialogue.id)}
                                 title={dialogue.title}
                             >
                                 <span className="dialogue-title">{dialogue.title}</span>
                                 <div className="dialogue-actions">
                                     {isActive && dialogue.messages.length > 0 && !editingMessageKey && (
                                         <button
                                             className="action-button export-button"
                                             onClick={(e) => { e.stopPropagation(); handleExport(dialogue); }}
                                             disabled={exportingId === dialogue.id || isLoading}
                                             title="Экспортировать чат"
                                             aria-label="Экспортировать чат"
                                         >
                                             {exportingId === dialogue.id ? <div className="loader-small"></div> : <Share2 size={14} />}
                                         </button>
                                     )}
                                     {dialogues.length > 1 && !editingMessageKey && (
                                         <button
                                             className="action-button delete-dialogue-button"
                                             onClick={(e) => { e.stopPropagation(); deleteDialogue(dialogue.id); }}
                                             disabled={isLoading || !!exportingId}
                                             title="Удалить чат"
                                             aria-label="Удалить чат"
                                         >
                                             <Trash size={14} />
                                         </button>
                                     )}
                                 </div>
                             </div>
                         );
                     })}
                     {dialogues.length === 0 && !modelsLoading && ( <div className="dialogue-list-empty">Нет чатов</div> )}
                 </div>
                 {activeDialogueId && !editingMessageKey && !isLoading && (exportLink || copySuccess) && (
                     <div className="export-info">
                         {copySuccess && <p className={`copy-feedback ${copySuccess.includes('Ошибка') || copySuccess.includes('недоступно') ? 'error' : 'success'}`}>{copySuccess}</p>}
                         {exportLink && (!copySuccess || copySuccess.includes('Ошибка') || copySuccess.includes('недоступно')) && (
                             <div className="export-link-container">
                                 <a href={exportLink} target="_blank" rel="noopener noreferrer" title={exportLink}> {exportLink.substring(0, 30)}... </a>
                                 <button className="copy-link-button" onClick={() => copyToClipboard(exportLink)} title="Скопировать ссылку" aria-label="Скопировать ссылку"> <Copy size={14} /> </button>
                             </div>
                         )}
                          {exportLink && copySuccess === 'Ссылка скопирована!' && (
                             <div className="export-link-container simplified">
                                 <a href={exportLink} target="_blank" rel="noopener noreferrer" title={exportLink}> Открыть скопированную ссылку </a>
                             </div>
                         )}
                     </div>
                 )}
            </div> {/* End Sidebar */}

             {/* Main Chat Area */}
            <div className="chat-main">
                {isSidebarOpen && <div className="overlay" onClick={closeSidebar}></div>}
                <button
                    className="sidebar-toggle-button"
                    onClick={toggleSidebar}
                    title={isSidebarOpen ? "Скрыть панель" : "Показать панель"}
                    aria-label={isSidebarOpen ? "Скрыть панель чатов" : "Показать панель чатов"}
                    disabled={!!editingMessageKey || isLoading || !!exportingId}
                 >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <div className="chat-header">
                     <h1 title={currentActiveDialogue?.title}>{currentActiveDialogue?.title || "Чат"}</h1>
                     {currentActiveDialogue?.systemPrompt && (
                        <div className="active-system-prompt" title={currentActiveDialogue.systemPrompt}>
                            <strong>Сист. промпт:</strong> {currentActiveDialogue.systemPrompt.substring(0, 60)}{currentActiveDialogue.systemPrompt.length > 60 ? '...' : ''}
                        </div>
                     )}
                     <div className="header-controls">
                        <div className="model-selector">
                            <select
                                id="model-select"
                                value={selectedModel}
                                onChange={handleModelChange}
                                disabled={modelsLoading || isLoading || availableModels.length === 0 || !!editingMessageKey || !!exportingId}
                                title={modelsLoading ? "Модели загружаются..." : availableModels.length === 0 ? "Модели недоступны" : "Выберите модель ИИ"}
                            >
                                {modelsLoading && <option value="" disabled>Загрузка...</option>}
                                {!modelsLoading && availableModels.length === 0 && <option value="" disabled>Нет моделей</option>}
                                {availableModels.map(modelName => ( <option key={modelName} value={modelName}>{modelName}</option> ))}
                            </select>
                        </div>
                        {currentActiveDialogue && (
                            <button
                                className="system-prompt-button"
                                onClick={handleSetSystemPrompt}
                                disabled={isLoading || !!editingMessageKey || !!exportingId || !activeDialogueId}
                                title="Задать/изменить системный промпт для этого чата"
                                aria-label="Задать системный промпт"
                            >
                                <Info size={16} />
                                <span>Промпт</span>
                            </button>
                        )}
                     </div>
                </div>
                <div className="chat-messages">
                    {currentMessages.map((msg, index) => {
                        const messageKey = `${activeDialogueId}-${index}`;
                        const isEditingThisMessage = editingMessageKey === messageKey;
                        const isLastStreamingMessage = index === currentMessages.length - 1 && msg.role === 'assistant' && isLoading;

                        if (msg.role === 'system') return null;

                        return (
                            <div key={messageKey} className={`message ${msg.role} ${isEditingThisMessage ? 'editing' : ''}`}>
                                <div className="message-content">
                                    {isEditingThisMessage ? (
                                        <div className="edit-area">
                                            <textarea
                                                ref={editTextAreaRef}
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                rows={Math.max(3, Math.min(editText.split('\n').length, 15))}
                                                disabled={isLoading}
                                                onKeyDown={(e) => {
                                                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSaveEdit(); }
                                                      else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
                                                }}
                                                aria-label="Редактирование сообщения"
                                            />
                                            <div className="edit-buttons">
                                                 <button onClick={handleSaveEdit} disabled={!editText.trim() || isLoading} className="edit-save" title="Сохранить (Ctrl+Enter / Cmd+Enter)"> <Check size={16} /> </button>
                                                 <button onClick={cancelEditing} disabled={isLoading} className="edit-cancel" title="Отмена (Escape)"> <X size={16} /> </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {msg.role === 'assistant' ? (
                                                <div className="markdown-content">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content.trim() + (isLastStreamingMessage ? '▍' : '')}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <p style={{ whiteSpace: 'pre-wrap' }}>
                                                    {msg.content.trim()}
                                                </p>
                                            )}
                                             {msg.role === 'user' && !isLoading && !editingMessageKey && !exportingId && (
                                                <button
                                                    className="edit-message-button"
                                                    onClick={() => startEditing(activeDialogueId!, index, msg.content)}
                                                    title="Редактировать сообщение"
                                                    aria-label="Редактировать сообщение">
                                                    <Edit2 size={14} />
                                                 </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                     {error && (!exportLink || !copySuccess || copySuccess.includes('Ошибка')) && (
                        <div className="message error-message"> <p>{error}</p> </div>
                     )}
                     {!isLoading && currentMessages.length === 0 && activeDialogueId && !editingMessageKey && !error && (
                         <div className="chat-empty-state">
                             <p>Начните диалог, отправив сообщение. Вы можете задать <button onClick={handleSetSystemPrompt} className="link-button">системный промпт</button> для этого чата.</p>
                         </div>
                     )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="chat-input-area">
                    <textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                             editingMessageKey ? "Завершите редактирование для ввода нового сообщения"
                             : exportingId ? "Идет экспорт..."
                             : !activeDialogueId ? "Создайте или выберите чат для начала"
                             : modelsLoading ? "Загрузка моделей..."
                             : !selectedModel ? "Выберите модель ИИ перед началом"
                             : isLoading ? "ИИ генерирует ответ..."
                             : "Введите сообщение (Shift+Enter для новой строки)"
                         }
                        rows={textAreaRows}
                        disabled={isLoading || modelsLoading || !activeDialogueId || (!modelsLoading && !selectedModel) || !!editingMessageKey || !!exportingId}
                        title={
                            isLoading ? "ИИ генерирует ответ..."
                            : editingMessageKey ? "Завершите редактирование для ввода нового сообщения"
                            : !!exportingId ? "Дождитесь завершения экспорта"
                            : !activeDialogueId ? "Не выбран чат"
                            : !selectedModel && !modelsLoading ? "Не выбрана модель ИИ"
                            : ""
                        }
                        aria-label="Поле ввода сообщения"
                     />
                    {isLoading ? (
                         <button onClick={stopStreaming} className="stop-button" title="Остановить генерацию" aria-label="Остановить генерацию"> <X size={18} /> </button>
                    ) : (
                         <button
                             onClick={sendMessage}
                             disabled={
                                isLoading || modelsLoading || !activeDialogueId || !selectedModel || !userInput.trim() || !!editingMessageKey || !!exportingId
                             }
                             title={
                                editingMessageKey ? "Завершите редактирование"
                                : !!exportingId ? "Экспорт выполняется..."
                                : !activeDialogueId ? "Не выбран чат"
                                : !selectedModel && !modelsLoading ? "Не выбрана модель"
                                : !userInput.trim() ? "Введите сообщение"
                                : "Отправить сообщение (Enter)"
                             }
                             aria-label="Отправить сообщение"
                         > <Send size={18} /> </button>
                    )}
                </div>
            </div> {/* End Chat Main */}
        </div> // End App Container
    );
}
export default App;
// --- END OF FILE App.tsx ---