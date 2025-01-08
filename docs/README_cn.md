## 📃 Flock (Flexible Low-code Orchestrating Collaborative-agent Kits)

<p align="center">
  <a href="./README_cn.md">简体中文</a> |
  <a href="../README.md">English</a> |
  <a href="./README_ja.md">日本語</a> |
  <a href="#如何开始">快速开始</a>
</p>

> [!TIP]
>
> ### 🎉 最新更新 2025/1/8
>
> - **Human Node（人机协作节点）**: 新增人机协作节点，支持以下关键场景：
>   - 🛠️ 工具调用审核：人工审核、编辑或批准 LLM 请求的工具调用
>   - ✅ LLM 输出验证：人工审核、编辑或批准 LLM 生成的内容
>   - 💡 提供上下文：允许 LLM 主动请求人工输入以获取澄清或补充信息，支持多轮对话

> ### 🎉 最新更新 2024/12/23
>
> - **多模态对话支持**: 新增多模态对话的支持（目前仅支持图片模态，后续会陆续增加对其他模态的支持）！
>   <img src="../assets/gemini.png" alt="multimodal" width="500" />

> ### 🎉 最新更新 2024/12/18
>
> - **If-Else 节点**: 新增 If-Else 节点以支持工作流中的条件逻辑！该节点支持多种条件类型，包括：包含、不包含、开始是、结束是、是、不是、为空、不为空。可以使用 AND/OR 运算符组合多个条件进行复杂的条件判断，让您能够基于数据创建复杂的分支工作流。

> ### 🎉 最新更新 2024/12/7
>
> - **代码执行节点**: 新增 Python 代码执行功能！该节点允许您在工作流中直接编写和执行 Python 代码，支持变量引用和动态数据转换。它非常适合算术运算、数据处理、文本操作等场景，让您能够实现超越预设节点功能的自定义逻辑。

> ### 🎉 最新更新 2024/11/12
>
> - **意图识别节点**: 新增意图识别节点,可以根据预设的类别自动识别用户输入的意图,支持多分类路由!
>   <img src="../assets/intent.png" alt="intent recognition" width="500" />
>
> - **CrewAI 节点支持**: 现在您可以在工作流中使用 CrewAI 的强大多代理功能！轻松创建复杂的代理团队并编排复杂的协作任务。
>   <img src="../assets/crewai.jpg" alt="crewai" width="500"  />

### Flock 是一个基于工作流 workflow 的低代码平台，用于快速构建聊天机器人、RAG 应用和协调多代理团队。它基于 LangChain 和 LangGraph 构建，提供灵活的低代码编排协作代理解决方案，支持聊天机器人、RAG 应用、代理和多代理系统，并具备离线运行能力。

<video src="https://private-user-images.githubusercontent.com/49232224/386539219-5dc96133-72f3-4cc3-9f50-096c38bde715.mp4?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MzE2NjMzNDQsIm5iZiI6MTczMTY2MzA0NCwicGF0aCI6Ii80OTIzMjIyNC8zODY1MzkyMTktNWRjOTYxMzMtNzJmMy00Y2MzLTlmNTAtMDk2YzM4YmRlNzE1Lm1wND9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDExMTUlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQxMTE1VDA5MzA0NFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWVhOWY1NTc1Mjk5YWU1MjZmNmQyNmY3Mzk0YjY2MGYyMzlmZWQ2MTVkMjExODEwNmY3YmMxYTVmNGRhNzMxZWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.69R3pTktxrl8C6tdduABLiRhkhwdfeVO3vlGGTGK4to" data-canonical-src="https://private-user-images.githubusercontent.com/49232224/386539219-5dc96133-72f3-4cc3-9f50-096c38bde715.mp4?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MzE2NjMzNDQsIm5iZiI6MTczMTY2MzA0NCwicGF0aCI6Ii80OTIzMjIyNC8zODY1MzkyMTktNWRjOTYxMzMtNzJmMy00Y2MzLTlmNTAtMDk2YzM4YmRlNzE1Lm1wND9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDExMTUlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQxMTE1VDA5MzA0NFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWVhOWY1NTc1Mjk5YWU1MjZmNmQyNmY3Mzk0YjY2MGYyMzlmZWQ2MTVkMjExODEwNmY3YmMxYTVmNGRhNzMxZWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.69R3pTktxrl8C6tdduABLiRhkhwdfeVO3vlGGTGK4to" controls="controls" muted="muted" class="d-block rounded-bottom-2 border-top width-fit" style="max-height:640px; min-height: 200px">
 </video>

### 🤖️ 概览

<img src="../assets/Overview.png" alt="overview"  />

### 工作流

<img src="../assets/workflow.png" alt="overview"  />

### 节点类型和功能

Flock 的工作流系统由各种类型的节点组成，每种节点都有特定的用途：

1. 输入节点：处理初始输入并将其转换为工作流可处理的格式。
2. LLM 节点：利用大型语言模型进行文本生成和处理。
3. 检索节点：从知识库中获取相关信息。
4. 工具节点：执行特定的任务或操作，扩展工作流功能。
5. 检索工具节点：结合检索能力和工具功能。
6. 意图识别节点：根据预设类别自动识别用户输入意图并路由到不同的处理流程。
7. 回答节点：生成最终答案或输出，整合前序节点的结果。
8. 子图节点：封装完整的子工作流，允许模块化设计。
9. 开始和结束节点：标记工作流的开始和结束。

未来计划添加的节点包括：

- 条件分支节点（If-Else）
- 文件上传节点
- 代码执行节点
- 参数提取节点

这些节点可以组合创建强大而灵活的工作流，适用于各种复杂的业务需求和应用场景。

### 图像工具调用

![image](https://github.com/user-attachments/assets/4097b087-0309-4aab-8be9-a06fdc9d4964)

### 知识检索

![image](https://github.com/user-attachments/assets/836fac80-ab49-4f6b-973c-25ba173149eb)

### Human-in-the-Loop（人工审批或让 LLM 重新思考或寻求人工帮助）

<p>
  <img src="https://github.com/user-attachments/assets/ec53f7de-10cb-4001-897a-2695da9cf6bf" alt="image" style="width: 49%; display: inline-block;">
  <img src="https://github.com/user-attachments/assets/1c7d383d-e6bf-42b8-94ec-9f0c37be19b8" alt="image" style="width: 49%; display: inline-block;">
</p>

本项目受到 [StreetLamb](https://github.com/StreetLamb) 项目及其 [tribe](https://github.com/StreetLamb/tribe) 项目的启发，采用了许多相似的方法和代码。在此基础上 我们引入了一些新的特性和方向。

项目的部分布局参考了 [Lobe-chat](https://github.com/lobehub/lobe-chat)、[Dify](https://github.com/langgenius/dify) 和 [fastgpt](https://github.com/labring/FastGPT)。
它们都是优秀的开源项目，在此表示感谢 🙇‍。

### 👨‍💻 开发技术

项目技术栈：LangChain + LangGraph + React + Next.js + Chakra UI + PostgreSQL

> [!NOTE]
>
> ### 🤖 模型系统
>
> Flock 支持多种模型提供商，并且易于添加新的模型。查看我们的 [模型指南](./docs/Add_New_Model_Providers_Guide.md) 了解支持的模型以及如何添加新的提供商支持。

> ### 🛠️ 工具系统
>
> Flock 内置多种工具，并支持轻松集成自定义工具。查看我们的 [工具指南](./docs/Add_New_Tools_Guide.md) 了解可用工具以及如何添加自己的工具。

### 🏘️ 亮点特性

- 持久化对话：保存并维护聊天历史，使您能够继续之前的对话。
- 可观察性：使用 LangSmith 实时监控和跟踪代理的性能和输出，确保它们高效运行。
- 工具调用：使您的代理能够使用外部工具和 API。
- 检索增强生成：使您的代理能够利用内部知识库进行推理。
- 人机协作：在工具调用前启用人工审批。
- 开源模型：使用开源 LLM 模型，如 llama、Qwen 和 Glm。
- 多租户：管理和支持多个用户和团队。

### 如何开始

#### 1. 准备工作

##### 1.1 克隆代码

git clone https://github.com/Onelevenvy/flock.git

##### 1.2 复制环境配置文件

```bash
cp .env.example .env
```

##### 1.3 生成密钥

.env 文件中的一些环境变量默认值为 changethis。
您必须将它们更改为密钥，要生成密钥，可以运行以下命令：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

复制内容并将其用作密码/密钥。再次运行该命令以生成另一个安全密钥。

##### 1.3 安装 postgres、qdrant、redis

```bash
cd docker
docker compose  --env-file ../.env up -d
```

#### 2.运行后端

##### 2.1 安装基本环境

服务器启动需要 Python 3.10.x。建议使用 pyenv 快速安装 Python 环境。

要安装其他 Python 版本，请使用 pyenv install。

```bash
pyenv install 3.10
```

要切换到 "3.10" Python 环境，请使用以下命令：

```bash
pyenv global 3.10
```

按照以下步骤操作：
导航到 "backend" 目录：

```bash
cd backend
```

激活环境。

```bash
poetry env use 3.10
poetry install
```

##### 2.2 初始化数据

```bash
# 让数据库启动
python /app/app/backend_pre_start.py

# 运行迁移
alembic upgrade head

# 在数库中创建初始数据
python /app/app/initial_data.py
```

##### 2.3 运行 unicorn

```bash
 uvicorn app.main:app --reload --log-level debug
```

##### 2.4 运行 celery（非必需，除非您想使用 rag 功能）

```bash
poetry run celery -A app.core.celery_app.celery_app worker --loglevel=debug
```

#### 3.运行前端

##### 3.1 进入 web 目录并安装依赖

```bash
cd web
pnpm install
```

##### 3.2 启动 web 服务

```bash
cd web
pnpm dev

# 或者 pnpm build 然后 pnpm start
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Onelevenvy/flock&type=Date)](https://star-history.com/#Onelevenvy/flock&Date)
