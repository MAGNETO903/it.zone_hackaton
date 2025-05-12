# Пример для Python с использованием библиотеки openai
# pip install openai
import openai
import os

# Лучше хранить ключ в переменных окружения, но для хакатона можно и так
api_key = "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" # ВАШ КЛЮЧ ОТ GROQ ИЛИ ДРУГОГО СЕРВИСА
base_url= "https://api.groq.com/openai/v1"


client = openai.OpenAI(
    api_key=api_key,
    base_url=base_url,
)

try:
    chat_completion = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "user", "content": "Why is the sky blue?"}
        ],
        # stream=True # Если хочешь стриминг
    )
    print(chat_completion.choices[0].message.content)

except Exception as e:
    print(f"An error occurred: {e}")