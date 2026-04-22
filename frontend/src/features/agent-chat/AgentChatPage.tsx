import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  VStack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
  Textarea,
  Text,
  Spacer,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { DetailCard } from "../../components/operations/DetailCard";
import {
  createAgentSession,
  getSessionDetail,
  listAgentSessions,
  sendMessage,
  updateSessionTitle,
} from "./api";
import { ChatMessage, SessionSummary, SessionDetail } from "./types";
import { formatDateTime } from "../../lib/format";

export const AgentChatPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const agentIdNum = agentId ? parseInt(agentId, 10) : null;
  if (!agentIdNum) {
    return <ErrorPanel title="Invalid agent" message="Agent ID is missing." />;
  }

  const initialSessionId = searchParams.get("sessionId");
  const viewMode = (searchParams.get("view") || "chat") as "chat" | "history";

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);

  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const result = await listAgentSessions(agentIdNum);
      setSessions(result);
      if (!currentSessionId && result.length === 0) {
        const newSession = await createAgentSession(agentIdNum);
        setCurrentSessionId(newSession.session_id);
        setSessions([newSession]);
      }
    } catch (error) {
      toast({
        title: "Failed to load sessions",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSessionDetail = async (sessionId: string) => {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const detail = await getSessionDetail(sessionId);
      setSessionDetail(detail);
      setTitleDraft(detail.title || "");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to load session");
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [agentIdNum]);

  useEffect(() => {
    if (currentSessionId) {
      void loadSessionDetail(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionDetail?.messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentSessionId) return;

    const content = messageInput;
    setMessageInput("");
    setSendingMessage(true);

    try {
      await sendMessage(currentSessionId, content);
      await loadSessionDetail(currentSessionId);
      
      if (!sessionDetail?.title && sessionDetail?.messages.length === 0) {
        const newTitle = content.substring(0, 50) + (content.length > 50 ? "..." : "");
        await updateSessionTitle(currentSessionId, newTitle);
        await loadSessionDetail(currentSessionId);
      }
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateNewSession = async () => {
    try {
      const newSession = await createAgentSession(agentIdNum);
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.session_id);
    } catch (error) {
      toast({
        title: "Failed to create session",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    }
  };

  const handleUpdateTitle = async () => {
    if (!currentSessionId) return;
    try {
      await updateSessionTitle(currentSessionId, titleDraft || null);
      await loadSessionDetail(currentSessionId);
      await loadSessions();
      setEditingTitle(false);
      toast({
        title: "Title updated",
        status: "success",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Failed to update title",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 3000,
      });
    }
  };

  return (
    <Flex direction="column" height="100vh" bg="surface.primary">
      <Box p={6} borderBottom="1px solid" borderColor="border.soft">
        <PageHeader
          title="Agent Chat"
          description="Chat with your agent and review conversation history"
        />
      </Box>

      <Flex flex="1" overflow="hidden">
        {/* Sidebar */}
        <Box
          width="300px"
          borderRight="1px solid"
          borderColor="border.soft"
          display={{ base: "none", lg: "flex" }}
          flexDirection="column"
          overflowY="auto"
        >
          <VStack align="stretch" spacing={0} p={4}>
            <Button onClick={handleCreateNewSession} colorScheme="brand" mb={4}>
              New chat
            </Button>

            <Text fontSize="xs" fontWeight="700" color="text.secondary" mb={2}>
              RECENT SESSIONS
            </Text>

            {sessionsLoading ? (
              <Text color="text.secondary" fontSize="sm">Loading...</Text>
            ) : sessions.length === 0 ? (
              <Text color="text.secondary" fontSize="sm">No sessions yet</Text>
            ) : (
              sessions.map((session) => (
                <Button
                  key={session.session_id}
                  onClick={() => setCurrentSessionId(session.session_id)}
                  variant={currentSessionId === session.session_id ? "solid" : "ghost"}
                  justifyContent="flex-start"
                  textAlign="left"
                  whiteSpace="normal"
                  height="auto"
                  py={2}
                  mb={2}
                >
                  <VStack align="start" spacing={0} width="100%">
                    <Text fontSize="sm" fontWeight="600">
                      {session.title || "Untitled"}
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      {formatDateTime(session.created_at)}
                    </Text>
                  </VStack>
                </Button>
              ))
            )}
          </VStack>
        </Box>

        {/* Main Chat Area */}
        <Flex flex="1" flexDirection="column" overflow="hidden">
          {sessionLoading ? (
            <Box flex="1" display="flex" alignItems="center" justifyContent="center">
              <LoadingPanel label="Loading session..." />
            </Box>
          ) : sessionError ? (
            <Box flex="1" display="flex" alignItems="center" justifyContent="center">
              <ErrorPanel title="Error" message={sessionError} />
            </Box>
          ) : !sessionDetail ? (
            <Box flex="1" display="flex" alignItems="center" justifyContent="center">
              <EmptyPanel
                title="No session selected"
                description="Select a session from the sidebar or create a new one to get started."
              />
            </Box>
          ) : (
            <>
              {/* Session Header */}
              <Box borderBottom="1px solid" borderColor="border.soft" p={4}>
                <HStack justify="space-between">
                  <VStack align="start" spacing={0}>
                    {editingTitle ? (
                      <HStack>
                        <Input
                          size="sm"
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          placeholder="Session title"
                          width="200px"
                        />
                        <Button size="sm" onClick={handleUpdateTitle}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingTitle(false)}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    ) : (
                      <HStack>
                        <Text fontWeight="700">
                          {sessionDetail.title || "Untitled Session"}
                        </Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setEditingTitle(true)}
                        >
                          Rename
                        </Button>
                      </HStack>
                    )}
                    <Text fontSize="xs" color="text.secondary">
                      {sessionDetail.messages.length} messages
                    </Text>
                  </VStack>
                  <HStack>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/sessions?agentId=${agentIdNum}&sessionId=${sessionDetail.session_id}`)}
                    >
                      View in Sessions
                    </Button>
                  </HStack>
                </HStack>
              </Box>

              {/* Chat / History Views */}
              <Tabs variant="soft-rounded" colorScheme="brand" flex="1" display="flex" flexDirection="column">
                <TabList px={4} pt={4}>
                  <Tab>Chat</Tab>
                  <Tab>History</Tab>
                </TabList>

                <TabPanels flex="1" display="flex" flexDirection="column">
                  {/* Chat Tab */}
                  <TabPanel flex="1" display="flex" flexDirection="column" overflow="hidden">
                    <VStack flex="1" align="stretch" spacing={4} overflow="hidden">
                      {/* Messages */}
                      <VStack
                        flex="1"
                        align="stretch"
                        spacing={3}
                        overflowY="auto"
                        px={2}
                      >
                        {sessionDetail.messages.length === 0 ? (
                          <Flex
                            flex="1"
                            alignItems="center"
                            justifyContent="center"
                            color="text.secondary"
                          >
                            <Text>No messages yet. Start the conversation!</Text>
                          </Flex>
                        ) : (
                          sessionDetail.messages.map((msg) => (
                            <DetailCard
                              key={msg.id}
                              title={msg.role === "user" ? "You" : "Agent"}
                              subtitle={formatDateTime(msg.created_at)}
                            >
                              <Text>{msg.content}</Text>
                            </DetailCard>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </VStack>

                      {/* Message Composer */}
                      <VStack align="stretch" spacing={2} px={2} pb={2}>
                        <Textarea
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                          placeholder="Type your message... (Shift+Enter for new line)"
                          minH="80px"
                          disabled={sendingMessage}
                        />
                        <HStack justify="flex-end">
                          <Button
                            onClick={handleSendMessage}
                            isLoading={sendingMessage}
                            isDisabled={!messageInput.trim()}
                            colorScheme="brand"
                          >
                            Send
                          </Button>
                        </HStack>
                      </VStack>
                    </VStack>
                  </TabPanel>

                  {/* History Tab */}
                  <TabPanel flex="1" overflowY="auto">
                    <VStack align="stretch" spacing={3}>
                      {sessionDetail.messages.length === 0 ? (
                        <EmptyPanel
                          title="No messages"
                          description="No conversation history for this session yet."
                        />
                      ) : (
                        sessionDetail.messages.map((msg) => (
                          <DetailCard
                            key={msg.id}
                            title={msg.role === "user" ? "User Message" : "Assistant Response"}
                            subtitle={formatDateTime(msg.created_at)}
                          >
                            <VStack align="start" spacing={2}>
                              <Text>{msg.content}</Text>
                              {msg.metadata && (
                                <Box
                                  p={2}
                                  bg="surface.secondary"
                                  borderRadius="sm"
                                  width="100%"
                                  fontSize="xs"
                                  color="text.secondary"
                                >
                                  <Text>Metadata: {msg.metadata}</Text>
                                </Box>
                              )}
                            </VStack>
                          </DetailCard>
                        ))
                      )}
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
};
