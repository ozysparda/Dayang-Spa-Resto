import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import toast from 'react-hot-toast';
import { api } from '../services/api';

interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: {
    content: string;
    senderName: string;
    createdAt: string;
  };
  unreadCount: number;
  participants: Array<{
    userId: string;
    username: string;
    name: string;
  }>;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function Chat() {
    const { data: conversationsData, loading, refetch } = useAsyncData<Conversation[]>('/chat/conversations');
  const sendMessage = useAsyncMutation();
  const createConversation = useAsyncMutation();

  const conversations = conversationsData || [];
  const [staff, setStaff] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track whether the chat component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);

  // Ref to the latest fetchMessages so we can trigger an immediate refresh
  // after sending a message without an uncancellable .then() that could
  // resolve after the user navigates away / goes back.
  const fetchMessagesRef = useRef<() => void>(() => {});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // /staff is ADMIN/DEVELOPER-only, so non-admin staff would otherwise get a
  // 403 toast every time they open or navigate back into Chat. Swallow that
  // (and cancellation) error silently; only log unexpected failures.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/staff', { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setStaff(res.data);
      })
      .catch((err: any) => {
        const cancelled =
          err?.name === 'CanceledError' ||
          err?.name === 'AbortError' ||
          err?.code === 'ERR_CANCELED';
        if (!cancelled) {
          console.warn('Staff roster fetch failed:', err?.response?.data?.message || err.message);
        }
      });
    return () => controller.abort();
  }, []);
  
  // Track mount status to prevent state updates after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

    useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    let controller: AbortController | null = null;
    let cancelled = false;

    const fetchMessages = async () => {
      if (cancelled || !mountedRef.current) return;
      controller = new AbortController();
      setMessagesLoading(true);
      try {
        const res = await api.get(`/chat/conversations/${selectedConversation.id}/messages`, {
          signal: controller.signal,
        });
        if (!cancelled && !controller.signal.aborted && mountedRef.current) {
          setMessages(res.data);
        }
      } catch (error: any) {
        const cancelled2 =
          error?.name === 'CanceledError' ||
          error?.name === 'AbortError' ||
          error?.code === 'ERR_CANCELED';
        if (!cancelled2 && !cancelled && mountedRef.current) {
          console.error('Failed to fetch messages:', error);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setMessagesLoading(false);
        }
      }
    };

    fetchMessagesRef.current = fetchMessages;
    fetchMessages();
    scrollToBottom();
    // Live polling: pull in new messages every 5 seconds. The interval and
    // every request are torn down in the cleanup, so back/exit navigation
    // can never fire a setState on an unmounted component.
    const poll = setInterval(fetchMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      controller?.abort();
    };
  }, [selectedConversation?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await sendMessage(
        `/chat/conversations/${selectedConversation.id}/messages`,
        'POST',
        { content: newMessage }
      );
      setNewMessage('');
      // Only refresh if still mounted and have a selected conversation
      if (mountedRef.current && selectedConversation) {
        // Immediate, cancellation-safe refresh. The closure is guarded by the
        // mounted/signal checks inside fetchMessages, so navigating away right
        // after sending can never produce a stray setState.
        fetchMessagesRef.current();
      }
    } catch (error) {
      // Error handled by useAsyncMutation
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const participantIds = Array.from(form.querySelectorAll('input[name="participants"]:checked'))
      .map((input) => (input as HTMLInputElement).value);

    if (participantIds.length === 0) return;

    try {
      const response = await createConversation(
        '/chat/conversations',
        'POST',
        {
          name: '',
          isGroup: false,
          participantIds,
        }
      );
      setShowNewConversation(false);
      refetch();
      if (response) {
        setSelectedConversation(response as Conversation);
        toast.success('Conversation started');
      }
    } catch (error) {
      // Error handled by useAsyncMutation
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Chat</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Conversations List */}
        <div className="card overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <button
              onClick={() => setShowNewConversation(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No conversations</div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">
                        {conv.name || conv.participants?.map(p => p.name).join(', ')}
                      </h3>
                      {conv.lastMessage && (
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {conv.lastMessage.senderName}: {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="lg:col-span-2 card overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b">
                                <h2 className="text-lg font-semibold">
                  {selectedConversation.name || selectedConversation.participants?.map(p => p.name).join(', ')}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="text-center text-gray-500 py-8">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No messages yet</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === selectedConversation.participants?.[0]?.userId ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.senderId === selectedConversation.participants?.[0]?.userId
                            ? 'bg-gray-100'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.senderId === selectedConversation.participants?.[0]?.userId
                              ? 'text-gray-500'
                              : 'text-blue-100'
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="input-field flex-1"
                  />
                  <button type="submit" className="btn-primary">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">New Conversation</h2>
            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Participants
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {staff.map((person) => (
                                        <div key={person.id} className="flex items-center">
                      <input
                        type="checkbox"
                        name="participants"
                        value={person.userId || person.id}
                        id={`participant-${person.id}`}
                        className="mr-2"
                      />
                      <label htmlFor={`participant-${person.id}`} className="text-sm">
                        {person.name} ({person.role})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Start Conversation
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewConversation(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
