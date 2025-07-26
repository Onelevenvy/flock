import functools
from typing import Any, Callable

from fastapi import Depends

# 从之前的模块导入所需内容
from app.db.rbac import ActionType, ResourceType
from app.db.utils.dependencies import PermissionChecker


def require_permission(resource_type: ResourceType, action: ActionType) -> Callable:
    """
    一个装饰器工厂，用于创建权限检查装饰器。

    用法:
        @router.get(...)
        @require_permission(ResourceType.TOOL, ActionType.READ)
        def my_route_function(...):
            ...
    """
    # 1. 在装饰器被定义时，就创建好一个 PermissionChecker 的依赖项实例
    permission_dependency = Depends(PermissionChecker(resource_type, action))

    def decorator(func: Callable) -> Callable:
        # 2. `decorator` 是真正的装饰器，它接收一个函数 (您的路由函数)
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # 3. `wrapper` 是最终替换您路由函数的函数。
            #    我们在这里注入并执行权限检查。
            #    FastAPI 会处理 Depends()，如果检查失败，会直接抛出 HTTPException。
            #    我们用 `_` 接收结果，因为我们只关心它是否成功执行，不关心返回值。
            _ = kwargs.pop("permission_check", None)  # 从kwargs中移除，避免传给原始函数

            # 4. 如果权限检查通过，依赖项会正常返回，代码会继续执行到这里。
            #    现在可以安全地调用原始的路由函数了。
            return await func(*args, **kwargs)

        # === 关键步骤：动态修改 wrapper 的签名 ===
        # 我们需要告诉 FastAPI，wrapper 函数有一个额外的、它需要注入的依赖。
        from inspect import Parameter, signature

        original_sig = signature(func)

        # 检查原始函数是否已经接受了我们的依赖项的 kwargs 名称
        if "permission_check" in original_sig.parameters:
            # 如果用户在函数签名中手动添加了它，我们就不再添加
            new_sig = original_sig
        else:
            # 创建新的参数
            params = list(original_sig.parameters.values())
            perm_param = Parameter(
                "permission_check",
                Parameter.KEYWORD_ONLY,
                default=permission_dependency,
            )
            params.append(perm_param)
            new_sig = original_sig.replace(parameters=params)

        # 将新的签名赋给 wrapper 函数
        wrapper.__signature__ = new_sig

        return wrapper

    return decorator
