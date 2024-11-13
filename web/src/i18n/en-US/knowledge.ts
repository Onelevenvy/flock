const translation = {
  test: {
    title: "Recall Test",
    description: "Test knowledge base recall effect based on given query text",
    knowledgeBase: "Knowledge Base",
    searchType: {
      title: "Search Type",
      vector: {
        name: "Vector Search",
        description: "Generate query embeddings and search for text segments with similar vector representations"
      },
      fulltext: {
        name: "Full Text Search", 
        description: "Index all vocabulary in documents to allow users to query any words and return text fragments containing these words"
      },
      hybrid: {
        name: "Hybrid Search",
        description: "Perform both full-text and vector searches, applying reranking steps to select the best results matching user questions from both types of queries"
      },
      placeholder:"Enter your query here"
    },
    settings: {
      title: "Search Settings",
      topK: "Top K",
      scoreThreshold: "Score Threshold",
      ragMethod: "RAG Method",
      methods: {
        adaptive: "Adaptive RAG",
        agentic: "Agentic RAG", 
        corrective: "Corrective RAG",
        self: "Self-RAG"
      }
    },
    results: {
      title: "Retrieved Paragraphs",
      score: "Score"
    },
    actions: {
      search: "Search",
      selectType: "Select Search Type"
    }
  },
  page: {
    title: "Knowledge Base",
    types: {
      all: "All",
      pdf: "PDF",
      excel: "Excel",
      word: "Word",
      ppt: "PowerPoint",
      md: "Markdown",
      web: "Web",
      txt: "Text"
    },
    status: {
      completed: "Completed"
    },
    loading: "Loading knowledge bases...",
    error: "Error loading knowledge bases",
    noDescription: "No description",
    actions: {
      create: "Create Knowledge Base"
    }
  },
  upload: {
    add: {
      title: "Add Upload",
      success: "Upload created successfully"
    },
    edit: {
      title: "Edit Upload",
      success: "Upload updated successfully"
    },
    form: {
      name: {
        label: "Name",
        placeholder: "Please input the knowledge base name",
        pattern: "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$"
      },
      description: {
        label: "Description",
        placeholder: "Please input the knowledge base description",
        default:"useful for when you want to answer queries about the"
      },
      type: {
        label: "Upload Type",
        file: "File",
        web: "Web Page"
      },
      file: {
        label: "File",
        button: "Upload File"
      },
      webUrl: {
        label: "Web Page URL",
        placeholder: "https://example.com",
        error: "Invalid URL format"
      },
      chunkSize: {
        label: "Chunk Size"
      },
      chunkOverlap: {
        label: "Chunk Overlap"
      },
      actions: {
        save: "Save",
        cancel: "Cancel"
      }
    },
    error: {
      generic: "Something went wrong",
      required: "This field is required"
    }
  }
};

export default translation; 