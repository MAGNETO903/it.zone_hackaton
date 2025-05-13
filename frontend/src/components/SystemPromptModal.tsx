// frontend/src/components/SystemPromptModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'react-feather'; // Для кнопки закрытия

interface SystemPromptModalProps {
    isOpen: boolean;
    currentPrompt: string;
    onClose: () => void;
    onSave: (newPrompt: string) => void;
    isLoading?: boolean; // Если нужно блокировать во время других операций
}

const SystemPromptModal: React.FC<SystemPromptModalProps> = ({
    isOpen,
    currentPrompt,
    onClose,
    onSave,
    isLoading
}) => {
    const [promptText, setPromptText] = useState(currentPrompt);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Обновляем текст в модалке, если currentPrompt изменился извне
    useEffect(() => {
        setPromptText(currentPrompt);
    }, [currentPrompt, isOpen]); // Добавили isOpen, чтобы при каждом открытии был свежий currentPrompt

    // Фокус на textarea при открытии модалки
    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select(); // Выделить текущий текст
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSave = () => {
        onSave(promptText.trim());
        // onClose(); // Можно закрывать сразу, или дать App компоненту это сделать
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            handleSave();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose} aria-label="Закрыть">
                    <X size={20} />
                </button>
                <h2>Системный промпт</h2>
                <p className="modal-description">
                    Задайте инструкции или роль для ассистента в этом чате.
                    Оставьте поле пустым, чтобы удалить текущий промпт.
                </p>
                <textarea
                    ref={textareaRef}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Например: Ты — дружелюбный ассистент, который любит шутить."
                    rows={5}
                    disabled={isLoading}
                />
                <div className="modal-actions">
                    <button onClick={onClose} className="button-secondary" disabled={isLoading}>
                        Отмена
                    </button>
                    <button onClick={handleSave} className="button-primary" disabled={isLoading}>
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemPromptModal;