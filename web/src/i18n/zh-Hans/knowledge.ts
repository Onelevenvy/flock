const translation = {
  test: {
    title: "召回测试",
    description: "基于给定的查询文本测试知识库的召回效果",
    knowledgeBase: "知识库",
    searchType: {
      title: "搜索类型",
      vector: {
        name: "向量检索",
        description: "通过生成查询嵌入并查询与其向量表示最相似的文本分段",
      },
      fulltext: {
        name: "全文检索",
        description:
          "索引文档中的所有词汇，从而允许用户查询任意词汇，并返回包含这些词汇的文本片段",
      },
      hybrid: {
        name: "混合检索",
        description:
          "同时执行全文检索和向量检索，并应用重排序步骤，从两类查询结果中选择匹配用户问题的最佳结果",
      },
      placeholder: "请输入你的查询",
    },
    settings: {
      title: "检索设置",
      topK: "Top K",
      scoreThreshold: "相似度阈值",
      ragMethod: "RAG方法",
      methods: {
        adaptive: "自适应RAG",
        agentic: "代理式RAG",
        corrective: "校正式RAG",
        self: "自我RAG",
      },
    },
    results: {
      title: "召回段落",
      score: "相似度",
      noResults: "未找到结果",
    },
    actions: {
      search: "搜索",
      selectType: "选择搜索类型",
    },
  },
  page: {
    title: "知识库",
    types: {
      all: "全部",
      pdf: "PDF文档",
      excel: "Excel表格",
      word: "Word文档",
      ppt: "PPT演示",
      md: "Markdown",
      web: "网页",
      txt: "文本",
    },
    status: {
      completed: "已完成",
    },
    loading: "正在加载知识库...",
    error: "加载知识库失败",
    noDescription: "暂无描述",
    actions: {
      create: "创建知识库",
    },
  },
  upload: {
    add: {
      title: "添加上传",
      success: "上传创建成功",
    },
    edit: {
      title: "编辑上传",
      success: "上传更新成功",
    },
    form: {
      name: {
        label: "名称",
        placeholder: "请输入知识库名称",
        pattern: "名称必须符合格式: ^[a-zA-Z0-9_-]{1,64}$",
      },
      description: {
        label: "描述",
        placeholder: "请输入知识库描述",
        default: "useful for when you want to answer queries about the",
      },
      type: {
        label: "上传类型",
        file: "文件",
        web: "网页",
      },
      file: {
        label: "文件",
        button: "上传文件",
      },
      webUrl: {
        label: "网页URL",
        placeholder: "https://example.com",
        error: "URL格式无效",
      },
      chunkSize: {
        label: "分块大小",
      },
      chunkOverlap: {
        label: "分块重叠",
      },
      actions: {
        save: "保存",
        cancel: "取消",
      },
    },
    error: {
      generic: "出现错误",
      required: "此字段为必填项",
    },
  },
};

export default translation;
