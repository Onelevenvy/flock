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
        placeholder: "Enter initial input",
      },
      end: {
        title: "End Node",
      },
      llm: {
        title: "LLM Node",
        model: "Model",
        temperature: "Temperature",
        systemPrompt: "System Prompt",
        placeholder: "Enter system prompt",
      },
      tool: {
        title: "Tools",
        addTool: "Add Tool",
        searchTools: "Search tools...",
        noTools: "No tools selected",
        added: "Added",
      },
      retrieval: {
        title: "Knowledge Retrieval",
        query: "Query",
        ragMethod: "RAG Method",
        database: "Knowledge Database",
        placeholder: "Enter query",
        selectDatabase: "Select Knowledge Database",
        loading: "Loading knowledge bases...",
        error: "Error loading knowledge bases",
        addKB: "Add KB",
        removeKB: "Remove knowledge base",
        noKB: "No knowledge base selected",
        searchKB: "Search knowledge bases...",
        added: "Added",
        noDescription: "No description",
        noResults: "No knowledge bases found",
      },
      classifier: {
        title: "Intent Recognition",
        model: "Model",
        categories: "Categories",
        category: "Category",
        addCategory: "Add Category",
        placeholder: "Enter category name",
      },
      crewai: {
        model: "Model",
        title: "CrewAI",
        agents: "Agents",
        tasks: "Tasks",
        processType: "Process Type",
        sequential: "Sequential",
        hierarchical: "Hierarchical",
        manager: "Manager Configuration",
        defaultManager: "Default Manager Agent",
        customManager: "Custom Manager Agent",
        addTaskDisabledMessage:
          "Add agents and configure manager (for hierarchical) first",
        addTaskMessage: "Add new task",
        agentModal: {
          title: "Configure Agent",
          name: "Agent Name",
          role: "Role",
          goal: "Goal",
          backstory: "Backstory",
          allowDelegation: "Allow Delegation",
          tools: "Tools",
          addTool: "Add Tool",
          namePlaceholder: "Enter a unique agent name",
          rolePlaceholder: "e.g., Research Specialist",
          goalPlaceholder: "Agent's primary objective",
          backstoryPlaceholder: "Agent's background and expertise",
          uniqueNameError: "Agent name must be unique",
        },
        taskModal: {
          title: "Task Configuration",
          name: "Task Name",
          description: "Description",
          assignAgent: "Assign Agent",
          expectedOutput: "Expected Output",
          namePlaceholder: "Enter a unique task name",
          descriptionPlaceholder: "Task description",
          expectedOutputPlaceholder: "Expected output format or description",
          selectAgent: "Select agent",
          uniqueNameError: "Task name must be unique",
          editTitle: "Edit Task",
          addTitle: "Add Task",
        },
      },
      ifelse: {
        operators: {
          contains: "Contains",
          notContains: "Not Contains",
          startWith: "Starts With",
          endWith: "Ends With",
          equal: "Is",
          notEqual: "Is Not",
          empty: "Is Empty",
          notEmpty: "Is Not Empty"
        }
      }
    },
    common: {
      add: "Add",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      search: "Search",
      noResults: "No results found",
    },
    flowVisualizer: {
      tooltips: {
        showMinimap: "Show Minimap",
        hideMinimap: "Hide Minimap",
        autoLayout: "Auto Layout",
        help: "Keyboard Shortcuts",
      },
      shortcuts: {
        title: "Shortcuts",
        edgeType: "Change Edge Type",
        delete: "Delete",
        info: {
          title: "Information",
          solidLine: "Solid Line: Normal Connection",
          dashedLine: "Dashed Line: Conditional Connection",
        },
      },
      zoom: "Zoom",
      debug: {
        title: "Debug",
        loading: "Loading...",
        error: "Error",
        preview: "Debug Preview",
      },
      actions: {
        debug: "Debug",
        deploy: "Deploy",
        apiKey: "API Key",
        save: "Save",
        saving: "Saving...",
      },
      contextMenu: {
        delete: "Delete Node",
        error: {
          title: "Cannot Delete Node",
          description: "Cannot delete {type} node.",
        },
      },
    },
    nodeMenu: {
      title: "Nodes",
      plugins: "Plugins",
      loading: "Loading tools...",
      error: "Error loading tools",
    },
    variableSelector: {
      availableVariables: "Available Variables",
      noVariables: "No variables available",
      placeholder: "Write here. Use '/' to insert variables.",
    },
  },
};

export default translation;
