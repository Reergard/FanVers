import os
import django

# Сначала устанавливаем переменную окружения
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FanVers_project.settings')
django.setup()

# Импортируем ASGI приложение из asgi.py
from FanVers_project.asgi import application

if __name__ == "__main__":
    from daphne.server import Server
    import sys
    
    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
        
    print(f"Starting Daphne server on port {port}...")
    
    server = Server(
        application=application,  # Используем application из asgi.py
        endpoints=['tcp:port=' + str(port) + ':interface=127.0.0.1']
    )
    server.run() 