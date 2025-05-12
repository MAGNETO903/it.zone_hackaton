import requests
import os



# Получаем API ключ и URL из переменных окружения
API_KEY = "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" # Например, GROQ_API_KEY
API_BASE_URL= "https://api.groq.com/openai/v1" # Например, https://api.groq.com/openai/v1

def get_llm_response(messages, model_name="llama3-8b-8192"): # Модель по умолчанию
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": messages, # Список сообщений в формате [{"role": "user", "content": "..."}]
        "max_tokens": 1024, # Опционально: ограничить длину ответа
        "stream": False, # Пока используем не-стриминг для простоты
        # "temperature": 0.7, # Опционально
    }
    chat_completion_url = f"{API_BASE_URL}/chat/completions"

    try:
        response = requests.post(chat_completion_url, headers=headers, json=payload, timeout=120) # Таймаут
        response.raise_for_status() # Проверка на HTTP ошибки (4xx, 5xx)
        data = response.json()
        # Структура ответа обычно: data['choices'][0]['message']['content']
        return data['choices'][0]['message']['content']
    except requests.exceptions.RequestException as e:
        print(f"Ошибка API запроса: {e}")
        # Можно добавить логирование или возврат специфической ошибки
        return "Извините, произошла ошибка при обращении к языковой модели."
    except (KeyError, IndexError) as e:
        print(f"Ошибка парсинга ответа API: {e}")
        print(f"Получен ответ: {response.text}") # Логируем ответ для отладки
        return "Извините, получен некорректный ответ от языковой модели."

# Пример использования:
user_messages = [{"role": "user", "content": "Привет! Как дела?"}]
model_to_use = "mixtral-8x7b-32768" # Пример модели на Groq или Together
answer = get_llm_response(user_messages, model_to_use)
print(answer)