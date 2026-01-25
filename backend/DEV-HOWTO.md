# Разработка бэкенда

## Где работать
Локально в каталоге `backend/`. Прод `.env` хранится только на сервере и в git не попадает.

## Важные настройки (только через .env)
- `DEBUG` — локально `True`, на проде `False`.
- `ALLOWED_HOSTS` — список доменов (локально: `127.0.0.1,localhost`; прод: `fan-vers.com,www.fan-vers.com`).
- `CSRF_TRUSTED_ORIGINS` — домены со схемами (`http(s)://…`).
- `USE_POSTGRES` — переключатель между Postgres и SQLite.
- `SIGNING_KEY` — отдельный ключ для JWT; по умолчанию берётся из `SECRET_KEY`, но на проде хранится отдельным значением в `.env`.

> Эти значения **не хардкодим** в `settings.py`. Всё берётся через `environ.Env`. Логика прокси-заголовков (`SECURE_PROXY_SSL_HEADER`/`USE_X_FORWARDED_HOST`) уже условная от `DEBUG` и руками не трогаем.

## Локальный запуск
1. Создай `backend/.env` по образцу:
   ```env
   SECRET_KEY=...
   DEBUG=True
   USE_POSTGRES=True
   DB_NAME=fan-vers
   DB_USER=Reergard
   DB_PASS=...
   DB_HOST=127.0.0.1
   DB_PORT=5432
   ALLOWED_HOSTS=127.0.0.1,localhost
   CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
   SIGNING_KEY=...   # можно сгенерировать отдельно
   ```

2. Установи зависимости, примени миграции:
   ```bash
   pip install -r requirements.txt
   python manage.py migrate
   ```

3. Запусти dev-сервер:
   ```bash
   python manage.py runserver
   ```

## Git-флоу для бэка

```bash
git checkout main
git pull --ff-only
git checkout -b feat/api/<кратко-о-чём>
# правки/миграции
git add .
git commit -m "feat(api): ..."
git push -u origin feat/api/<...>
# создаём PR в main; деплой делает саппорт после мержа
```

## Что не коммитим
Любые `.env*`, `backend/staticfiles/`, `backend/celery.log`, дампы Redis (`dump.rdb`, `*.rdb`), `db.sqlite3`.

На сервере не редактируем код вручную — только через PR → pull на сервере.
