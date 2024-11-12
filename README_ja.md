## 📃 Flock (Flexible Low-code Orchestrating Collaborative-agent Kits)

<p align="center">
  <a href="./README_cn.md">简体中文</a> |
  <a href="./README.md">English</a> |
  <a href="./README_ja.md">日本語</a> |
  <a href="#how-to-get-started">始め方</a>
</p>

> [!TIP]
>
> ### 🎉 最新アップデート
>
> **CrewAI ノードのサポート**: ワークフローで CrewAI の強力なマルチエージェント機能を活用できるようになりました！洗練されたエージェントチームを作成し、複雑な協調タスクを簡単に編成できます。
> <img src="assets/crewai.jpg" alt="crewai" width="500"  />

### LangChain、LangGraph、およびその他のフレームワークに基づいたチャットボット、RAG、エージェント、およびマルチエージェントアプリケーションプロジェクトで、オープンソースであり、オフライン展開が可能です。
<video src="https://private-user-images.githubusercontent.com/49232224/374006908-309ab01e-8a29-4764-b470-dbedea8d8622.mp4?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjgyNjg4MzEsIm5iZiI6MTcyODI2ODUzMSwicGF0aCI6Ii80OTIzMjIyNC8zNzQwMDY5MDgtMzA5YWIwMWUtOGEyOS00NzY0LWI0NzAtZGJlZGVhOGQ4NjIyLm1wND9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDEwMDclMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQxMDA3VDAyMzUzMVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTJiMGZiZjU3MGIyMWZkZDRkNjI3MmU5MzA1YTZhNmRlODVkZTcxYWI1MjYxMGM2ODU0NzM3OWVkN2MxNTk2MmEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.j-kXuux_wfe2bK2VW77TY53mTqj9iYn7kyuxwwwNQQw" data-canonical-src="https://private-user-images.githubusercontent.com/49232224/374006908-309ab01e-8a29-4764-b470-dbedea8d8622.mp4?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MjgyNjg4MzEsIm5iZiI6MTcyODI2ODUzMSwicGF0aCI6Ii80OTIzMjIyNC8zNzQwMDY5MDgtMzA5YWIwMWUtOGEyOS00NzY0LWI0NzAtZGJlZGVhOGQ4NjIyLm1wND9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDEwMDclMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQxMDA3VDAyMzUzMVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTJiMGZiZjU3MGIyMWZkZDRkNjI3MmU5MzA1YTZhNmRlODVkZTcxYWI1MjYxMGM2ODU0NzM3OWVkN2MxNTk2MmEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.j-kXuux_wfe2bK2VW77TY53mTqj9iYn7kyuxwwwNQQw" controls="controls" muted="muted" class="d-block rounded-bottom-2 border-top width-fit" style="max-height:640px; min-height: 200px">
</video>

![alt text](assets/login.jpg)

### 🤖️ 概要

![alt text](assets/image.png)

#### ワークフロー

![image](https://github.com/user-attachments/assets/a4e33565-7acf-45d9-8e82-5a740cd88344)
![image](https://github.com/user-attachments/assets/4d5874f1-aeb0-47c5-b907-21878a2fa4d9)

### ノードタイプと機能

Flock のワークフローシステムは、様々なタイプのノードで構成されており、それぞれが特定の目的を果たします：

1. 入力ノード：初期入力を処理し、ワークフローが扱える形式に変換します。
2. LLM ノード：大規模言語モデルを利用してテキスト生成と処理を行います。
3. 検索ノード：知識ベースから関連情報を取得します。
4. ツールノード：特定のタスクや操作を実行し、ワークフローの機能を拡張します。
5. 検索ツールノード：検索機能とツール機能を組み合わせます。
6. 回答ノード：前のノードの結果を統合し、最終的な回答や出力を生成します。
7. サブグラフノード：完全なサブワークフロ ��� をカプセル化し、モジュラー設計を可能にします。
8. 開始と終了ノード：ワークフローの開始と終了を示します。

将来計画されているノードには以下が含まれます：

- 意図認識ノード
- 条件分岐ノード（If-Else）
- ファイルアップロードノード
- コード実行ノード
- パラメータ抽出ノード

これらのノードを組み合わせることで、様々な複雑なビジネスニーズやアプリケーションシナリオに適した強力で柔軟なワークフローを作成できます。

#### 画像

![image](https://github.com/user-attachments/assets/4097b087-0309-4aab-8be9-a06fdc9d4964)

#### ヒューマン・イン・ザ・ループ（人間の承認または LLM の再考または人間への助けを求める）

<p>
  <img src="https://github.com/user-attachments/assets/ec53f7de-10cb-4001-897a-2695da9cf6bf" alt="image" style="width: 49%; display: inline-block;">
  <img src="https://github.com/user-attachments/assets/1c7d383d-e6bf-42b8-94ec-9f0c37be19b8" alt="image" style="width: 49%; display: inline-block;">
</p>

Flock は、大規模言語モデル（LLM）アプリケーションを開発するためのオープンソースプラットフォームを目指しています。これは、LangChain と LangGraph の概念を利用した LLM ベースのアプリケーションです。チャットボット、RAG アプリケーション、エージェント、およびマルチエージェントシステムをサポートする LLMOps ソリューションのスイートを作成し、オフライン操作の機能を備えることを目指しています。

[StreetLamb](https://github.com/StreetLamb)プロジェクトおよびその[tribe](https://github.com/StreetLamb/tribe)プロジェクトに触発され、Flock は多くのアプローチとコードを採用しています。この基盤の上に、新しい機能と方向性を導入しています。

このプロジェクトのレイアウトの一部は、[Lobe-chat](https://github.com/lobehub/lobe-chat)、[Dify](https://github.com/langgenius/dify)、および[fastgpt](https://github.com/labring/FastGPT)を参考にしています。これらはすべて優れたオープンソースプロジェクトであり、感謝しています 🙇‍。

### 👨‍💻 開発

プロジェクトの技術スタック：LangChain + LangGraph + React + Next.js + Chakra UI + PostgreSQL

> [!NOTE]
>
> ### 🛠️ ツールシステム
>
> Flock には様々な組み込みツールが付属しており、カスタムツールの簡単な統合をサポートしています。利用可能なツールと独自のツールの追加方法については、[ツールガイド](Add_New_Tools_Guide.md)をご覧ください。

> ### 🤖 モデルシステム
>
> Flock は様々なモデルプロバイダーをサポートしており、新しいプロバイダーの追加も容易です。サポートされているモデルと新しいプロバイダーの追加方法については、[モデルガイド](Add_New_Model_Providers_Guide.md)をご覧ください。

### 💡 ロードマップ

1 アプリ

- [x] チャットボット
- [x] シンプル RAG
- [x] 階層エージェント
- [x] シーケンシャルエージェント
- [x] ワークフロー
- [ ] CrewAI 統合 ---進行中
- [ ] さらに多くのマルチエージェント

2 モデル

- [x] OpenAI
- [x] ZhipuAI
- [x] Siliconflow
- [x] Ollama
- [x] Qwen
- [ ] Xinference

3 その他

- [x] ツール呼び出し
- [x] I18n
- [ ] Langchain テンプレート

### 🏘️ ハイライト

- 永続的な会話：チャット履歴を保存および維持し、会話を続けることができます。
- 可観測性：LangSmith を使用してエージェントのパフォーマンスと出力をリアルタイムで監視および追跡し、効率的に動作するようにします。
- ツール呼び出し：エージェントが外部ツールや API を利用できるようにします。
- 検索強化生成：エージェントが内部知識ベースを利用して推論できるようにします。
- ヒューマン・イン・ザ・ループ：ツール呼び出し前に人間の承認を有効にします。
- オープンソースモデル：llama、Qwen、Glm などのオープンソース LLM モデルを使用します。
- マルチテナンシー：複数のユーザーとチームを管理およびサポートします。

### 始め方

#### 1. 準備

##### 1.1 コードをクローン

git clone https://github.com/Onelevenvy/flock.git

##### 1.2 環境設定ファイルをコピー

```bash
cp .env.example .env
```

##### 1.3 秘密鍵を生成

.env ファイルのいくつかの環境変数には、デフォルト値として changethis が設定されています。
これらを秘密鍵に変更する必要があります。秘密鍵を生成するには、次のコマンドを実行します：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

内容をコピーしてパスワード/秘密鍵として使用します。もう一度実行して別の安全な鍵を生成します。

##### 1.3 postgres、qdrant、redis をインストール

```bash
cd docker
docker compose  --env-file ../.env up -d
```

#### 2. バックエンドを実行

##### 2.1 基本環境のインストール

サーバーの起動には Python 3.10.x が必要です。Python 環境を迅速にインストールするには、pyenv を使用することをお勧めします。

追加の Python ージョンをインストールするには、pyenv install を使用します。

```bash
pyenv install 3.10
```

"3.10" Python 環境に切り替えるには、次のコマンドを使用します：

```bash
pyenv global 3.10
```

次の手順に従います：
"backend"ディレクトリに移動します：

```bash
cd backend
```

環境をアクティブにします。

```bash
poetry env use 3.10
poetry install
```

##### 2.2 初期データの設定

```bash
# DBを起動させる
python /app/app/backend_pre_start.py

# マイグレーションを実行
alembic upgrade head

# DBに初期データを作成
python /app/app/initial_data.py
```

##### 2.3 unicorn を実行

```bash
 uvicorn app.main:app --reload --log-level debug
```

##### 2.4 celery を実行（rag 機能を使用する場合のみ）

```bash
poetry run celery -A app.core.celery_app.celery_app worker --loglevel=debug
```

#### 3. フロントエンドを実行

##### 3.1 web ディレクトリに移動して依存関係をインストール

```bash
cd web
pnpm install
```

##### 3.2 web サービスを起動

```bash
cd web
pnpm dev

# または pnpm build してから pnpm start
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Onelevenvy/flock&type=Date)](https://star-history.com/#Onelevenvy/flock&Date)
