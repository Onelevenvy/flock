#!/bin/bash
# entrypoint.sh (This is the final UV version)

set -e

# Worker mode: Start Celery worker
if [[ "${MODE}" == "worker" ]]; then
    if [ "${CELERY_AUTO_SCALE,,}" = "true" ]; then
        AVAILABLE_CORES=$(nproc)
        MAX_WORKERS=${CELERY_MAX_WORKERS:-$AVAILABLE_CORES}
        MIN_WORKERS=${CELERY_MIN_WORKERS:-1}
        CONCURRENCY_OPTION="--autoscale=${MAX_WORKERS},${MIN_WORKERS}"
    else
        CONCURRENCY_OPTION="-c ${CELERY_WORKER_AMOUNT:-1}"
    fi
    
    # Use uv run to start celery
    exec uv run celery -A app.core.celery_app.celery_app worker $CONCURRENCY_OPTION --loglevel ${LOG_LEVEL:-INFO}

# API mode (default)
else
    # Debug mode: Use uvicorn with hot-reload
    if [[ "${DEBUG}" == "true" ]]; then
        # Use uv run to perform database migrations
        uv run alembic upgrade head
        # Use uv run to start uvicorn
        exec uv run uvicorn app.main:app --host=${HOST:-0.0.0.0} --port=${PORT:-8000} --reload --log-level debug
        
    # Production mode: Use gunicorn
    else
        # Use uv run to perform database migrations
        uv run alembic upgrade head
        # Use uv run to start gunicorn
        exec uv run gunicorn \
            --bind "${HOST:-0.0.0.0}:${PORT:-8000}" \
            --workers ${SERVER_WORKER_AMOUNT:-1} \
            --worker-class uvicorn.workers.UvicornWorker \
            --timeout ${GUNICORN_TIMEOUT:-120} \
            app.main:app
    fi
fi