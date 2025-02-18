#!/bin/bash

set -e

if [[ "${MIGRATION_ENABLED}" == "true" ]]; then
    echo "Running database migrations"
    poetry run alembic upgrade head
fi

if [[ "${MODE}" == "worker" ]]; then
    # Get the number of available CPU cores
    if [ "${CELERY_AUTO_SCALE,,}" = "true" ]; then
        AVAILABLE_CORES=$(nproc)
        MAX_WORKERS=${CELERY_MAX_WORKERS:-$AVAILABLE_CORES}
        MIN_WORKERS=${CELERY_MIN_WORKERS:-1}
        CONCURRENCY_OPTION="--autoscale=${MAX_WORKERS},${MIN_WORKERS}"
    else
        CONCURRENCY_OPTION="-c ${CELERY_WORKER_AMOUNT:-1}"
    fi

    exec poetry run celery -A app.core.celery_app.celery_app worker $CONCURRENCY_OPTION --loglevel ${LOG_LEVEL:-INFO}

else
    if [[ "${DEBUG}" == "true" ]]; then
        exec poetry run uvicorn app.main:app --host=${HOST:-0.0.0.0} --port=${PORT:-8000} --reload --log-level debug
    else
        exec poetry run gunicorn \
            --bind "${HOST:-0.0.0.0}:${PORT:-8000}" \
            --workers ${SERVER_WORKER_AMOUNT:-1} \
            --worker-class uvicorn.workers.UvicornWorker \
            --timeout ${GUNICORN_TIMEOUT:-120} \
            app.main:app
    fi
fi 