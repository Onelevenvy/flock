import logging
from typing import Dict, Type

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, selectinload
from sqlmodel import SQLModel

# ==========================================================
# 假设的导入路径，请根据您的项目结构进行调整
# ==========================================================
# 您的数据库会话依赖项
from app.api.deps import CurrentUser, SessionDep
# 您的所有模型
from app.db.rbac import (AccessScope, ActionType, Group, ResourceType,
                         RolePermission, User)
from app.db.toolprovider import Tool, ToolProvider

# 您的认证依赖项，用于获取当前用户


# 日志记录器
logger = logging.getLogger(__name__)

# ==========================================================
# 辅助配置：将资源类型映射到其对应的SQLModel模型
# 这对于在 scope check 中动态获取资源对象至关重要
# ==========================================================
RESOURCE_MODEL_MAP: Dict[ResourceType, Type[SQLModel]] = {
    ResourceType.TOOL: Tool,
    ResourceType.TOOL_PROVIDER: ToolProvider,
    # ... 在这里添加您其他的资源模型映射
}


class PermissionChecker:
    """
    一个可依赖的类，用于检查用户是否具有执行特定操作的权限。
    """

    def __init__(self, resource_type: ResourceType, action: ActionType):
        self.resource_type = resource_type
        self.action = action

    async def __call__(
        self,
        request: Request,
        db: SessionDep,
        current_user: User = Depends(CurrentUser),
    ):
        """
        FastAPI 将调用此方法来执行权限检查。
        """
        # 1. 超级用户拥有所有权限
        if current_user.is_superuser:
            logger.debug(f"User {current_user.email} is a superuser. Granting access.")
            return

        # 2. 获取用户的所有权限规则（包含直接角色和组角色）
        user_permissions = await self._get_user_permissions(db, current_user)

        # 3. 遍历权限规则，寻找匹配的规则并检查范围
        for perm in user_permissions:
            # 检查资源和操作是否匹配 (MANAGE代表所有操作)
            is_resource_match = perm.resource.name == self.resource_type.value
            is_action_match = (perm.action.name == self.action.value) or (
                perm.action.name == ActionType.MANAGE
            )

            if is_resource_match and is_action_match:
                # 找到匹配的权限规则，现在检查其范围 (scope)
                has_permission = await self._check_scope(
                    request, db, current_user, perm.scope
                )
                if has_permission:
                    logger.debug(
                        f"Access granted for user {current_user.email} on "
                        f"resource '{self.resource_type.value}' with action '{self.action.value}' "
                        f"via scope '{perm.scope.value}'"
                    )
                    return  # 权限检查通过，允许访问

        # 4. 如果循环结束都没有返回，说明没有找到任何有效的权限规则
        logger.warning(
            f"Access denied for user {current_user.email}. "
            f"Required permission: Action '{self.action.value}' on resource '{self.resource_type.value}'."
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    async def _get_user_permissions(
        self, db: Session, user: User
    ) -> list[RolePermission]:
        """
        获取一个用户所有有效的权限规则列表。
        这包括用户直接拥有的角色权限，以及其所在组（和所有父组）的权限。

        【性能提示】: 这个函数涉及多次数据库查询，是性能热点。
        在生产环境中，强烈建议对此函数的结果进行缓存（例如使用Redis），
        缓存键可以是 user.id，缓存时间可以设置几分钟。
        """
        # 使用 selectinload 预加载关系，减少后续查询
        user = (
            db.query(User)
            .options(
                selectinload(User.roles)
                .selectinload(Role.permissions)
                .selectinload(RolePermission.resource),
                selectinload(User.roles)
                .selectinload(Role.permissions)
                .selectinload(RolePermission.action),
                selectinload(User.groups),
            )
            .filter(User.id == user.id)
            .one()
        )

        # 获取用户直接角色的ID
        role_ids = {role.id for role in user.roles}

        # 获取用户所在组及所有父组的ID
        user_group_ids = {group.id for group in user.groups}
        all_group_ids = set(user_group_ids)

        if user_group_ids:
            # 使用 CTE (Common Table Expression) 递归查询所有父组，性能更佳
            hierarchy_query = db.query(Group.id, Group.parent_id).cte(
                name="hierarchy", recursive=True
            )
            parent_cte = hierarchy_query.alias("parent_cte")
            child_cte = Group.alias("child_cte")

            hierarchy_query = hierarchy_query.union_all(
                db.query(child_cte.id, child_cte.parent_id).where(
                    child_cte.id == parent_cte.c.parent_id
                )
            )

            initial_groups = db.query(hierarchy_query).where(
                hierarchy_query.c.id.in_(user_group_ids)
            )
            for group_row in initial_groups.all():
                all_group_ids.add(group_row.id)

        # 获取这些组关联的所有角色的ID
        if all_group_ids:
            group_roles = (
                db.query(GroupRole).filter(GroupRole.group_id.in_(all_group_ids)).all()
            )
            role_ids.update(gr.role_id for gr in group_roles)

        # 一次性查询所有相关角色的所有权限
        if not role_ids:
            return []

        permissions = (
            db.query(RolePermission)
            .options(
                selectinload(RolePermission.resource),
                selectinload(RolePermission.action),
            )
            .filter(RolePermission.role_id.in_(role_ids))
            .all()
        )

        return permissions

    async def _check_scope(
        self, request: Request, db: Session, user: User, scope: AccessScope
    ) -> bool:
        """
        根据权限范围验证用户是否有权访问资源。
        """
        # 对于 CREATE 操作，没有现成的资源对象，scope检查逻辑会有所不同。
        # 通常在API端点函数内部处理，确保创建的资源归属正确。
        # 此处的依赖项主要检查用户是否“有资格”创建。
        if self.action == ActionType.CREATE:
            # 如果规则允许以任何范围创建，则依赖项检查通过。
            # 具体的归属（owner_id, group_id）应在路由函数中设置。
            return True

        # 对于 Read, Update, Delete 等需要明确资源ID的操作
        if scope == AccessScope.GLOBAL:
            return True  # 全局范围，直接通过

        # 从请求路径中获取资源ID, e.g., /tools/{tool_id} -> 'tool_id'
        resource_id_key = f"{self.resource_type.value.lower()}_id"
        resource_id = request.path_params.get(resource_id_key)

        if not resource_id:
            logger.error(
                f"Could not find '{resource_id_key}' in request path for scope check."
            )
            return False

        model_class = RESOURCE_MODEL_MAP.get(self.resource_type)
        if not model_class:
            logger.error(
                f"No model mapping found for resource type '{self.resource_type.value}'."
            )
            return False

        # 从数据库获取要操作的资源实例
        resource = db.get(model_class, int(resource_id))
        if not resource:
            # 资源不存在，严格来说这不是权限问题，但为了安全，返回False
            return False

        if scope == AccessScope.PERSONAL:
            return hasattr(resource, "owner_id") and resource.owner_id == user.id

        if scope == AccessScope.TEAM:
            if not hasattr(resource, "group_id") or not resource.group_id:
                return False

            # 检查资源的group_id是否在用户的组集合中（包含父组）
            user_groups = (
                db.query(Group)
                .join(UserGroup)
                .filter(UserGroup.user_id == user.id)
                .all()
            )
            user_group_ids_and_parents = set(
                g.id for g in user_groups
            )  # 这里也需要递归获取父组
            # (为简化示例，这里只检查直接组，完整实现应复用_get_user_permissions中的组查询逻辑)
            return resource.group_id in user_group_ids_and_parents

        return False
