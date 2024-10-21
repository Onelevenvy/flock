import logging
import os
import shutil
import uuid
from datetime import datetime
from tempfile import NamedTemporaryFile
from typing import IO, Annotated, Any, Dict

import aiofiles
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy import ColumnElement
from sqlmodel import and_, func, select
from starlette import status

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import (
    Message,
    Upload,
    UploadCreate,
    UploadOut,
    UploadsOut,
    UploadStatus,
    UploadUpdate,
)
from app.tasks.tasks import add_upload, edit_upload, perform_search, remove_upload

router = APIRouter()

logger = logging.getLogger(__name__)


async def valid_content_length(
    content_length: int = Header(..., le=settings.MAX_UPLOAD_SIZE),
) -> int:
    return content_length


def save_file_if_within_size_limit(file: UploadFile, file_size: int) -> IO[bytes]:
    """
    Check if the uploaded file size is smaller than the specified file size.
    This is to restrict an attacker from sending a valid Content-Length header and a
    body bigger than what the app can take.
    If the file size exceeds the limit, raise an HTTP 413 error. Otherwise, save the file
    to a temporary location and return the temporary file.

    Args:
        file (UploadFile): The file uploaded by the user.
        file_size (int): The file size in bytes.

    Raises:
        HTTPException: If the file size exceeds the maximum allowed size.

    Returns:
        IO: A temporary file containing the uploaded data.
    """
    # Check file size
    real_file_size = 0
    temp: IO[bytes] = NamedTemporaryFile(delete=False)
    for chunk in file.file:
        real_file_size += len(chunk)
        if real_file_size > file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Too large"
            )
        temp.write(chunk)
    temp.close()
    return temp


def move_upload_to_shared_folder(filename: str, temp_file_dir: str) -> str:
    """
    Move an uploaded file to a shared folder with a unique name and set its permissions.

    Args:
        filename (str): The original name of the uploaded file.
        temp_file_dir (str): The directory of the temporary file.

    Returns:
        str: The new file path in the shared folder.
    """
    file_name = f"{uuid.uuid4()}-{filename}"
    file_path = f"./app/{file_name}"
    shutil.move(temp_file_dir, file_path)
    os.chmod(file_path, 0o775)
    return file_path


@router.get("/", response_model=UploadsOut)
def read_uploads(
    session: SessionDep,
    current_user: CurrentUser,
    status: UploadStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve uploads.
    """
    filters = []
    if status:
        filters.append(Upload.status == status)
    if not current_user.is_superuser:
        filters.append(Upload.owner_id == current_user.id)

    filter_conditions: ColumnElement[bool] | bool = and_(*filters) if filters else True

    count_statement = select(func.count()).select_from(Upload).where(filter_conditions)
    statement = select(Upload).where(filter_conditions).offset(skip).limit(limit)

    count = session.exec(count_statement).one()
    uploads = session.exec(statement).all()

    return UploadsOut(data=uploads, count=count)


def get_file_type(filename: str) -> str:
    extension = filename.split(".")[-1].lower()
    file_types = {
        "pdf": "pdf",
        "docx": "docx",
        "pptx": "pptx",
        "xlsx": "xlsx",
        "txt": "txt",
        "html": "html",
        "md": "md",
    }
    return file_types.get(extension, "unknown")


@router.post("/", response_model=UploadOut)
async def create_upload(
    session: SessionDep,
    current_user: CurrentUser,
    name: Annotated[str, Form()],
    description: Annotated[str, Form()],
    file_type: Annotated[str, Form()],
    chunk_size: Annotated[int, Form()],
    chunk_overlap: Annotated[int, Form()],
    web_url: Annotated[str | None, Form()] = None,
    file: UploadFile | None = None,
) -> Any:
    """Create upload"""
    logger.info(f"Received upload request: file_type={file_type}, name={name}")

    try:
        if file_type not in ["file", "web"]:
            raise HTTPException(
                status_code=400, detail=f"Invalid file type: {file_type}"
            )

        if file_type == "web" and not web_url:
            raise HTTPException(
                status_code=400, detail="Web URL is required for web uploads"
            )

        if file_type == "file" and not file:
            raise HTTPException(
                status_code=400, detail="File is required for file uploads"
            )

        try:
            chunk_size = int(chunk_size)
            chunk_overlap = int(chunk_overlap)
            if chunk_size <= 0 or chunk_overlap < 0:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid chunk size or overlap")

        if file_type == "file":
            actual_file_type = get_file_type(file.filename)
            if actual_file_type == "unknown":
                raise HTTPException(status_code=400, detail="Unsupported file type")
        else:
            actual_file_type = "web"

        upload = Upload.model_validate(
            UploadCreate(
                name=name,
                description=description,
                file_type=actual_file_type,
                web_url=web_url,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            ),
            update={"owner_id": current_user.id, "status": UploadStatus.IN_PROGRESS},
        )
        session.add(upload)
        session.commit()

        if current_user.id is None or upload.id is None:
            raise HTTPException(
                status_code=500, detail="Failed to retrieve user and upload ID"
            )

        if file_type == "web":
            # 处理网页上传
            add_upload.delay(
                web_url, upload.id, current_user.id, chunk_size, chunk_overlap
            )
        else:
            # 处理文件上传
            if not file or not file.filename:
                raise HTTPException(status_code=400, detail="File is required")

            file_path = await save_upload_file(file)
            add_upload.delay(
                file_path, upload.id, current_user.id, chunk_size, chunk_overlap
            )

        logger.info(f"Upload created successfully: id={upload.id}")
        return upload
    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        if "upload" in locals():
            session.delete(upload)
            session.commit()
        raise HTTPException(
            status_code=500, detail=f"Failed to process upload: {str(e)}"
        )


async def save_upload_file(file: UploadFile) -> str:
    file_name = f"{uuid.uuid4()}-{file.filename}"
    file_path = f"./app/{file_name}"

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    os.chmod(file_path, 0o775)
    return file_path


@router.put("/{id}", response_model=UploadOut)
def update_upload(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    name: str | None = Form(None),
    description: str | None = Form(None),
    file_type: str | None = Form(None),
    chunk_size: Annotated[int, Form(ge=0)] | None = Form(None),
    chunk_overlap: Annotated[int, Form(ge=0)] | None = Form(None),
    web_url: str | None = Form(None),
    file: UploadFile | None = File(None),
    file_size: int = Depends(valid_content_length),
) -> Any:
    """Update upload"""
    upload = session.get(Upload, id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    if not current_user.is_superuser and upload.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data: dict[str, Any] = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if file_type is not None:
        update_data["file_type"] = file_type
    if web_url is not None:
        update_data["web_url"] = web_url
    if chunk_size is not None:
        update_data["chunk_size"] = chunk_size
    if chunk_overlap is not None:
        update_data["chunk_overlap"] = chunk_overlap

    if update_data:
        update_data["last_modified"] = datetime.now()
        update_dict = UploadUpdate(**update_data).model_dump(exclude_unset=True)
        upload.sqlmodel_update(update_dict)
        session.add(upload)

    if file_type == "web" and web_url:
        # 处理网页更新
        upload.status = UploadStatus.IN_PROGRESS
        session.add(upload)
        session.commit()
        edit_upload.delay(
            web_url,
            id,
            upload.owner_id,
            chunk_size or upload.chunk_size,
            chunk_overlap or upload.chunk_overlap,
        )
    elif file:
        # 处理文件更新
        if file.content_type not in [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "text/html",
            "text/markdown",
        ]:
            raise HTTPException(status_code=400, detail="Invalid file type")

        temp_file = save_file_if_within_size_limit(file, file_size)
        if upload.owner_id is None:
            raise HTTPException(status_code=500, detail="Failed to retrieve owner ID")

        upload.status = UploadStatus.IN_PROGRESS
        session.add(upload)
        session.commit()

        if not file.filename or not isinstance(temp_file.name, str):
            raise HTTPException(status_code=500, detail="Failed to upload file")

        file_path = move_upload_to_shared_folder(file.filename, temp_file.name)
        edit_upload.delay(
            file_path,
            id,
            upload.owner_id,
            chunk_size or upload.chunk_size,
            chunk_overlap or upload.chunk_overlap,
        )

    session.commit()
    session.refresh(upload)
    return upload


@router.delete("/{id}")
def delete_upload(session: SessionDep, current_user: CurrentUser, id: int) -> Message:
    upload = session.get(Upload, id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    if not current_user.is_superuser and upload.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    try:
        # Set upload status to in progress
        upload.status = UploadStatus.IN_PROGRESS
        session.add(upload)
        session.commit()

        if upload.owner_id is None:
            raise HTTPException(status_code=500, detail="Failed to retrieve owner ID")

        remove_upload.delay(id, upload.owner_id)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete upload") from e

    return Message(message="Upload deleted successfully")


@router.post("/{upload_id}/search")
async def search_upload(
    upload_id: int,
    current_user: CurrentUser,
    search_params: Dict[str, Any],
    session: SessionDep,
):
    """
    Initiate an asynchronous search within a specific upload.
    """
    upload = session.get(Upload, upload_id)
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    if not current_user.is_superuser and upload.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    search_type = search_params.get("search_type", "vector")
    if search_type not in ["vector", "fulltext", "hybrid"]:
        raise HTTPException(status_code=400, detail="Invalid search type")

    task = perform_search.delay(
        current_user.id,
        upload_id,
        search_params["query"],
        search_type,
        search_params.get("top_k", 5),
        search_params.get("score_threshold", 0.5),
    )

    return {"task_id": task.id}


@router.get("/{upload_id}/search/{task_id}")
async def get_search_results(task_id: str):
    """
    Retrieve the results of an asynchronous search task.
    """
    task_result = AsyncResult(task_id)
    if task_result.ready():
        return {"status": "completed", "results": task_result.result}
    else:
        return {"status": "pending"}
