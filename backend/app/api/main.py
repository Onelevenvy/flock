from fastapi import APIRouter

from app.api.routes import (
    apikeys,
    graphs,
    login,
    members,
    provider,
    providermodel,
    skills,
    teams,
    threads,
    uploads,
    users,
    utils,
)

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(
    members.router, prefix="/teams/{team_id}/members", tags=["members"]
)
api_router.include_router(skills.router, prefix="/tools", tags=["tools"])
api_router.include_router(
    threads.router, prefix="/teams/{team_id}/threads", tags=["threads"]
)
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])


api_router.include_router(provider.router, prefix="/provider", tags=["provider"])

api_router.include_router(providermodel.router, prefix="/model", tags=["model"])
api_router.include_router(
    graphs.router, prefix="/teams/{team_id}/graphs", tags=["graphs"]
)
api_router.include_router(
    apikeys.router, prefix="/teams/{team_id}/api-keys", tags=["api-keys"]
)
