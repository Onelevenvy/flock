import { Box, Button } from "@chakra-ui/react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaRegStopCircle } from "react-icons/fa";
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "react-query";

import { useFlowState } from "@/hooks/graphs/useFlowState";
import useChatMessageStore from "@/stores/chatMessageStore";
import useChatTeamIdStore from "@/stores/chatTeamIDStore";
import useWorkflowStore from "@/stores/workflowStore";

import {
  type ApiError,
  type ChatResponse,
  GraphsService,
  type InterruptDecision,
  OpenAPI,
  type OpenAPIConfig,
  type TeamChat,
  type ThreadCreate,
  type ThreadUpdate,
  ThreadsService,
} from "../../client";
import type { ApiRequestOptions } from "../../client/core/ApiRequestOptions";
import {
  getHeaders,
  getQueryString,
  getRequestBody,
} from "../../client/core/request";
import useCustomToast from "../../hooks/useCustomToast";
import MessageInput from "../MessageInput";
import MessageBox from "./MessageBox";
import { v4 } from "uuid";

const getUrl = (config: OpenAPIConfig, options: ApiRequestOptions): string => {
  const encoder = config.ENCODE_PATH || encodeURI;

  const path = options.url
    .replace("{api-version}", config.VERSION)
    .replace(/{(.*?)}/g, (substring: string, group: string) => {
      // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
      if (options.path?.hasOwnProperty(group)) {
        return encoder(String(options.path[group]));
      }

      return substring;
    });

  const url = `${config.BASE}${path}`;

  if (options.query) {
    return `${url}${getQueryString(options.query)}`;
  }

  return url;
};

const ChatMain = ({ isPlayground }: { isPlayground?: boolean }) => {
  const queryClient = useQueryClient();
  const navigate = useRouter();
  const searchParams = useSearchParams();
  const threadId = searchParams.get("threadId");
  const { t } = useTranslation();
  const { teamId } = useChatTeamIdStore();
  const { setActiveNodeName } = useWorkflowStore();

  // 从 graphData 中获取初始节点和边
  const { data: graphData, isLoading: isGraphLoading } = useQuery(
    ["graph", teamId],
    () => GraphsService.readGraphs({ teamId })
  );

  const initialNodes = graphData?.data[0]?.config?.nodes || [];
  const initialEdges = graphData?.data[0]?.config?.edges || [];

  const { nodes } = useFlowState(initialNodes, initialEdges);

  const [imageData, setImageData] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    searchParams.get("threadId")
  );
  const showToast = useCustomToast();
  const [input, setInput] = useState("");
  const { messages, setMessages } = useChatMessageStore();
  const [isStreaming, setIsStreaming] = useState(false);

  const [isInterruptible, setIsInterruptible] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelUpdateRef = useRef<(() => void) | null>(null);

  useQuery(
    ["thread", threadId],
    () =>
      ThreadsService.readThread({
        teamId: teamId,
        id: threadId!,
      }),
    {
      // Only run the query if messages state is empty and threadId is not null or undefined.
      enabled: !!threadId,
      refetchOnWindowFocus: false,
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;

        showToast("Something went wrong.", `${errDetail}`, "error");
        // if fail, then remove it from search params and delete existing messages
        if (isPlayground) {
          navigate.push(`/playground?teamId=${teamId}`);
          setMessages([]);
        } else {
          navigate.push(`/teams/${teamId}`);
          setMessages([]);
        }
      },
      onSuccess: (data) => {
        // if thread changed, then show new thread's messages
        if (!threadId || threadId === currentThreadId) return;
        setMessages([]);
        setCurrentThreadId(threadId);
        for (const message of data.messages) {
          processMessage(message);
        }
      },
    }
  );

  const createThread = async (data: ThreadCreate) => {
    const thread = await ThreadsService.createThread({
      teamId: teamId,
      requestBody: data,
    });

    return thread.id;
  };
  const createThreadMutation = useMutation(createThread, {
    onSuccess: (threadId) => {
      setCurrentThreadId(threadId);
      if (isPlayground) {
        navigate.push(`/playground?teamId=${teamId}&threadId=${threadId}`);
      } else {
        navigate.push(`/teams/${teamId}?threadId=${threadId}`);
      }
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      showToast("Unable to create thread", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries(["threads", teamId]);
    },
  });

  const updateThread = async (data: ThreadUpdate): Promise<string> => {
    if (!threadId) throw new Error("Thread ID is not available");

    return new Promise((resolve, reject) => {
      const cancelablePromise = ThreadsService.updateThread({
        teamId: teamId,
        id: threadId,
        requestBody: data,
      });

      cancelablePromise.then((thread) => resolve(thread.id)).catch(reject);
      cancelUpdateRef.current = () => cancelablePromise.cancel();
    });
  };

  const updateThreadMutation: UseMutationResult<
    string,
    ApiError,
    ThreadUpdate
  > = useMutation<string, ApiError, ThreadUpdate>(updateThread, {
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      // showToast("Unable to update thread.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries(["threads", teamId]);
    },
  });

  const processMessage = (response: ChatResponse) => {
    setMessages((prevMessages: ChatResponse[]) => {
      const messageIndex = prevMessages.findIndex(
        (msg) => msg.id === response.id
      );

      if (messageIndex !== -1) {
        return prevMessages.map((msg, index) =>
          index === messageIndex
            ? {
                ...msg,
                content: (msg.content ?? "") + (response.content ?? ""),
                tool_output: response.tool_output,
              }
            : msg
        );
      }

      return [...prevMessages, response];
    });

    let activeNode = nodes.find((node) => node.id === response.name);

    if (!activeNode) {
      activeNode = nodes.find(
        (node) =>
          node.type === "tool" &&
          node.data.tools &&
          Array.isArray(node.data.tools) &&
          node.data.tools.includes(response.name)
      );
    }

    if (activeNode) {
      setActiveNodeName(response.name);
      // 5秒后重置高亮节点
      // setTimeout(() => {
      //   setActiveNodeName(null);
      // }, 5000);
    }
  };

  const stream = async (id: number, threadId: string, data: TeamChat) => {
    const controller = new AbortController();

    abortControllerRef.current = controller;
    const signal = controller.signal;

    const requestOptions = {
      method: "POST" as const,
      url: "/api/v1/teams/{id}/stream/{threadId}",
      path: {
        id,
        threadId,
      },
      body: data,
      mediaType: "application/json",
      errors: {
        422: "Validation Error",
      },
    };
    const url = getUrl(OpenAPI, requestOptions);
    const body = getRequestBody(requestOptions);
    const headers = await getHeaders(OpenAPI, requestOptions);

    const streamPromise = fetchEventSource(url, {
      method: requestOptions.method,
      headers,
      body: JSON.stringify(body),
      signal,
      onmessage(message) {
        const response: ChatResponse = JSON.parse(message.data);

        processMessage(response);
      },
    });

    const threadUpdateData: ThreadUpdate = {
      query: data.messages[0].content,
    };

    const updatePromise = updateThreadMutation.mutateAsync(threadUpdateData);

    setIsInterruptible(true);

    try {
      await Promise.all([streamPromise, updatePromise]);
    } finally {
      setIsInterruptible(false);
    }
  };

  const interruptStreamAndUpdate = useCallback(() => {
    abortControllerRef.current?.abort();
    cancelUpdateRef.current?.();
    setIsInterruptible(false);

    setMessages((prev) => [
      ...prev,
      {
        type: "ai",
        // id: self.crypto.randomUUID(),
        id: v4(),
        content: t("chat.chatMain.interruptinfo"),
        name: "system",
      },
    ]);
  }, [setMessages, t]);

  const chatTeam = async (data: TeamChat) => {
    // Create a new thread or update current thread with most recent user query
    const query = data.messages;
    let currentThreadId: string | null = threadId;

    if (!threadId) {
      currentThreadId = await createThreadMutation.mutateAsync({
        query: query[0].content,
      });
    } else {
      try {
        currentThreadId = await updateThreadMutation.mutateAsync({
          query: query[0].content,
        });
      } catch (error) {
        console.error("Failed to update thread:", error);

        // showToast("Failed to update thread", "", "error");
        return;
      }
    }

    if (!currentThreadId) {
      // showToast("Something went wrong.", "Unable to obtain thread id", "error");
      return;
    }

    setMessages((prev: ChatResponse[]) => [
      ...prev,
      {
        type: "human",
        // id: self.crypto.randomUUID(),
        id: v4(),
        content: data.messages[0].content,
        img: imageData,
        name: "user",
      },
    ]);

    await stream(teamId, currentThreadId, data);
  };

  const mutation = useMutation(chatTeam, {
    onMutate: () => {
      setIsStreaming(true);
      setIsInterruptible(true);
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      // showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSuccess: () => {
      // showToast("Streaming completed", "", "success");
    },
    onSettled: () => {
      setIsStreaming(false);
      setIsInterruptible(false);
    },
  });

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      mutation.mutate({ messages: [{ type: "human", content: input }] });
      setInput("");
      setImageData("");
    },
    [input, mutation]
  );

  const newChatHandler = useCallback(() => {
    const path = isPlayground
      ? `/playground?teamId=${teamId}`
      : `/teams/${teamId}`;

    navigate.push(path);
    setMessages([]);
  }, [isPlayground, teamId, navigate, setMessages]);

  /**
   * Submit the interrupt decision and optional tool message
   */
  const onResumeHandler = useCallback(
    (decision: InterruptDecision, tool_message?: string | null) => {
      mutation.mutate({
        messages: [
          {
            type: "human",
            content: tool_message || decision,
          },
        ],
        interrupt: { decision, tool_message },
      });
    },
    [mutation]
  );

  return (
    <Box
      height="full"
      maxH="full"
      w="full"
      maxW="full"
      display="flex"
      flexDirection="column"
      position="relative"
    >
      <Box
        p={2}
        overflowY="auto"
        overflowX="hidden"
        h="full"
        maxH="full"
        w="full"
        maxW="full"
        sx={{
          scrollBehavior: 'auto',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'gray.200',
            borderRadius: '24px',
          },
        }}
      >
        {messages.map((message, index) => (
          <MessageBox
            key={index}
            message={message}
            onResume={onResumeHandler}
            isPlayground={isPlayground}
          />
        ))}
      </Box>
      <Box display={"flex"} justifyContent={"center"} mt="2">
        {isInterruptible && (
          <Button
            leftIcon={<FaRegStopCircle />}
            bg={"transparent"}
            border={"1px solid #f7fafc"}
            boxShadow="0 0 10px rgba(0,0,0,0.2)"
            onClick={interruptStreamAndUpdate}
            borderRadius={"lg"}
            size={"sm"}
          >
            {t("chat.chatMain.abort")}
          </Button>
        )}
      </Box>
      <MessageInput
        input={input}
        setInput={setInput}
        onSubmit={onSubmit}
        isStreaming={isStreaming}
        newChatHandler={newChatHandler}
        imageData={imageData}
        setImageData={setImageData}
      />
    </Box>
  );
};

export default ChatMain;
