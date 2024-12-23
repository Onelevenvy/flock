import logging
import os

from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.tools import managed_tools
from app.curd import users
from app.models import ModelProvider, Models, Skill, User, UserCreate

logger = logging.getLogger(__name__)


def get_url():
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "flock123456")
    server = os.getenv("POSTGRES_SERVER", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "flock")
    return f"postgresql+psycopg://{user}:{password}@{server}:{port}/{db}"


engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
# engine = create_engine(get_url())


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/tiangolo/full-stack-fastapi-template/issues/28
def print_skills_info(session: Session) -> None:
    print("\nSkills Information:")
    skills = session.exec(select(Skill).order_by(Skill.id)).all()
    for skill in skills:
        print(f"Skill: {skill.name} (ID: {skill.id})")
        print(f"  Display Name: {skill.display_name}")
        print(f"  Description: {skill.description}")
        # print(f"  Managed: {'Yes' if skill.managed else 'No'}")
        # print(f"  Owner ID: {skill.owner_id}")
        # if skill.input_parameters:
        #     print("  Input Parameters:")
        #     for param, param_type in skill.input_parameters.items():
        #         print(f"    - {param}: {param_type}")
        # if skill.credentials:
        #     print("  Credentials:")
        #     for credential_name, credential_info in skill.credentials.items():
        #         print(f"    - {credential_name}: {credential_info}")
        print()


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # from app.core.engine import engine
    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = users.create_user(session=session, user_create=user_in)

    existing_skills = session.exec(select(Skill)).all()
    existing_skills_dict = {skill.name: skill for skill in existing_skills}

    for skill_name, skill_info in managed_tools.items():
        if skill_name in existing_skills_dict:
            existing_skill = existing_skills_dict[skill_name]

            # 更新非凭证字段
            existing_skill.description = skill_info.description
            existing_skill.display_name = skill_info.display_name
            existing_skill.input_parameters = skill_info.input_parameters

            # 更新凭证结构，但保留现有值
            if existing_skill.credentials is None:
                existing_skill.credentials = {}

            # 添加对 skill_info.credentials 的检查
            if skill_info.credentials:
                for key, value in skill_info.credentials.items():
                    if key not in existing_skill.credentials:
                        # 如果是新的凭证字段，添加它
                        existing_skill.credentials[key] = value
                    else:
                        # 如果凭证字段已存在，只更新类型和描述，保留现有的值
                        existing_value = existing_skill.credentials[key].get("value")
                        existing_skill.credentials[key] = value
                        if existing_value:
                            existing_skill.credentials[key]["value"] = existing_value

            session.add(existing_skill)
        else:
            new_skill = Skill(
                name=skill_name,
                description=skill_info.description,
                managed=True,
                owner_id=user.id,
                display_name=skill_info.display_name,
                input_parameters=skill_info.input_parameters,
                credentials=skill_info.credentials if skill_info.credentials else {},
            )
            session.add(new_skill)

    # 删除不再存在的managed skills
    for skill_name in list(existing_skills_dict.keys()):
        if skill_name not in managed_tools and existing_skills_dict[skill_name].managed:
            session.delete(existing_skills_dict[skill_name])

    session.commit()

    # 打印 skills 信息
    print_skills_info(session)


def init_modelprovider_model_db(session: Session) -> None:
    providers = model_provider_manager.get_all_providers()

    for provider_name in sorted(providers.keys()):
        provider_data = providers[provider_name]

        db_provider = session.exec(
            select(ModelProvider).where(
                ModelProvider.provider_name == provider_data["provider_name"]
            )
        ).first()

        if db_provider:
            db_provider.icon = provider_data["icon"]
            db_provider.description = provider_data["description"]
            if not db_provider.api_key:
                db_provider.set_api_key(provider_data["api_key"])
        else:
            db_provider = ModelProvider(
                provider_name=provider_data["provider_name"],
                base_url=provider_data["base_url"],
                icon=provider_data["icon"],
                description=provider_data["description"],
            )
            db_provider.set_api_key(provider_data["api_key"])
            session.add(db_provider)

        session.flush()

        supported_models = model_provider_manager.get_supported_models(provider_name)
        existing_models = {
            model.ai_model_name: model
            for model in session.exec(
                select(Models).where(Models.provider_id == db_provider.id)
            )
        }

        for model_info in supported_models:
            # 准备元数据
            meta_ = {}
            if "dimension" in model_info:
                meta_["dimension"] = model_info["dimension"]

            if model_info["name"] in existing_models:
                model = existing_models[model_info["name"]]
                model.categories = model_info["categories"]
                model.capabilities = model_info["capabilities"]
                # 更新元数据
                model.meta_ = meta_
            else:
                new_model = Models(
                    ai_model_name=model_info["name"],
                    provider_id=db_provider.id,
                    categories=model_info["categories"],
                    capabilities=model_info["capabilities"],
                    meta_=meta_,  # 添加元数据
                )
                session.add(new_model)

        for model_name in set(existing_models.keys()) - set(
            model["name"] for model in supported_models
        ):
            session.delete(existing_models[model_name])

    session.commit()

    # 打印当前数据库状态
    providers = session.exec(select(ModelProvider).order_by(ModelProvider.id)).all()
    for provider in providers:
        print(f"\nProvider: {provider.provider_name} (ID: {provider.id})")
        # print(f"  Base URL: {provider.base_url}")
        # print(f"  API Key: {'***************'  if provider.api_key else 'None'}")
        # print(f"  Description: {provider.description}")
        models = session.exec(
            select(Models).where(Models.provider_id == provider.id).order_by(Models.id)
        ).all()
        for model in models:
            print(f"\n  - Model: {model.ai_model_name} (ID: {model.id})")
            print(f"    Categories: {', '.join(model.categories)}")
            print(f"    Capabilities: {', '.join(model.capabilities)}")
            print(f"    Metadata: {model.meta_}")
