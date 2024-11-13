const translation = {
  addteam: {
    createteam: "Create App",
    editteam: "Edite App",
    apptype: "What type of app do you want?",
    nameandicon: "Icon & Name",
    placeholderapp: "Give your app a name",
    placeholderdescription: "Enter the description of the app",
    description: "Description",
  },
  teamcard: {
    chatbot: {
      title: "Chatbot",
      description: "Basic chatbot app, single agent, can use tools",
    },
    ragbot: {
      title: "Knowledge Base Q&A",
      description:
        "RAG app, retrieves information from knowledge base during each conversation",
    },
    workflow: {
      title: "Work flow",
      description:
        "Organize generative applications in a workflow format to provide more customization capabilities.",
    },
    hagent: {
      title: "Hierarchical Multi-Agent",
      description:
        "Hierarchical type of Multi-Agent, usually used for complex task decomposition and parallel processing",
    },
    sagent: {
      title: "Sequential Multi-Agent",
      description:
        "Sequential type of Multi-Agent, usually used for task decomposition and step-by-step execution",
    },
  },
  teamsetting: {
    debugoverview: "Debug Overview",
    savedeploy: "Deploy",
    name: "Name",
    description: "Description",
    type: "Type",
    role: "Role",
    backstory: "Backstory",
    model: "Model",
    tools: "Tools",
    knowledge: "Knowledge Base",
    chathistory: "Chat History",
  },
  workflow: {
    nodes: {
      start: {
        title: "Start Node",
        initialInput: "Initial Input",
        placeholder: "Enter initial input"
      },
      end: {
        title: "End Node" 
      },
      llm: {
        title: "LLM Node",
        model: "Model",
        temperature: "Temperature",
        systemPrompt: "System Prompt",
        placeholder: "Enter system prompt"
      },
      tool: {
        title: "Tools",
        addTool: "Add Tool",
        searchTools: "Search tools...",
        noTools: "No tools selected",
        added: "Added"
      },
      retrieval: {
        title: "Knowledge Retrieval",
        query: "Query",
        ragMethod: "RAG Method",
        database: "Knowledge Database",
        placeholder: "Enter query",
        selectDatabase: "Select Knowledge Database"
      },
      classifier: {
        title: "Intent Recognition",
        categories: "Categories",
        category: "Category",
        addCategory: "Add Category",
        placeholder: "Enter category name"
      },
      crewai: {
        title: "CrewAI",
        agents: "Agents",
        tasks: "Tasks",
        processType: "Process Type",
        sequential: "Sequential",
        hierarchical: "Hierarchical",
        manager: "Manager Configuration",
        defaultManager: "Default Manager Agent",
        customManager: "Custom Manager Agent"
      }
    },
    common: {
      add: "Add",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      search: "Search",
      noResults: "No results found"
    }
  }
};

export default translation;
