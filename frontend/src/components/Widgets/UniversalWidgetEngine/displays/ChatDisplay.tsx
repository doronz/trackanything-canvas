/**
 * ChatDisplay - Universal Widget System Display Component
 * Renders AI chat interface with streaming responses and conversation history
 */

import { aiChatAPI } from '@/services/api';
import { AppDispatch, RootState } from '@/store';
import { updateWidget } from '@/store/widgetSlice';
import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import {
  ArrowPathIcon,
  DocumentDuplicateIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

// Provider icon URLs
const PROVIDER_ICONS: Record<string, string> = {
  openai: 'https://openai.com/favicon.ico',
  anthropic: 'https://claude.ai/images/claude_app_icon.png',
  gemini: 'https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png',
  ollama: 'https://ollama.com/public/ollama.png',
};

// Provider icon component with fallback
function ProviderIcon({
  provider,
  className = 'w-4 h-4',
}: {
  provider: string;
  className?: string;
}) {
  const [imageError, setImageError] = React.useState(false);
  const iconUrl = PROVIDER_ICONS[provider?.toLowerCase()] || null;

  if (!iconUrl || imageError) {
    // Fallback emoji icons
    const fallbackEmoji =
      {
        openai: '🤖',
        anthropic: '🧠',
        ollama: '🦙',
        gemini: '✨',
      }[provider?.toLowerCase()] || '💬';

    return (
      <span className={className} style={{ fontSize: '1em', lineHeight: '1' }}>
        {fallbackEmoji}
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={`${provider} icon`}
      className={className}
      onError={() => setImageError(true)}
    />
  );
}

interface ChatDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

interface AIChatContent {
  messages: ChatMessage[];
  aiConfigId?: number;
}

function getContentHash(content: AIChatContent | undefined): string {
  return `${content?.messages?.length || 0}-${content?.aiConfigId || 'none'}`;
}

// Function to decode escaped characters and unicode sequences in AI response content
function decodeMessageContent(content: string): string {
  if (!content) return content;

  try {
    // First, replace literal \n sequences with actual newlines
    let decoded = content.replace(/\\n/g, '\n');

    // Replace unicode escape sequences like \ud83d\ude80 with actual unicode characters
    decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Handle other common escape sequences
    decoded = decoded.replace(/\\t/g, '\t');
    decoded = decoded.replace(/\\r/g, '\r');
    decoded = decoded.replace(/\\\\/g, '\\');
    decoded = decoded.replace(/\\"/g, '"');
    decoded = decoded.replace(/\\'/g, "'");

    return decoded;
  } catch (error) {
    console.warn('Failed to decode message content:', error);
    return content;
  }
}

export default function ChatDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: ChatDisplayProps) {
  const dispatch = useDispatch<AppDispatch>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const lastContentHashRef = useRef<string>('');

  const content = widget.content as AIChatContent;
  const [messages, setMessages] = useState<ChatMessage[]>(content?.messages || []);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | undefined>(content?.aiConfigId);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<boolean>(false);
  const [toolSupportStatus, setToolSupportStatus] = useState<any[]>([]);
  const [mcpToolsAvailable, setMcpToolsAvailable] = useState(false);

  const { configs, defaultConfig } = useSelector((state: RootState) => state.aiConfig);

  // Get the currently selected AI config
  const selectedConfig = selectedConfigId
    ? configs.find(c => c.id === selectedConfigId)
    : defaultConfig;

  // Update local state when widget content changes
  useEffect(() => {
    const widgetContent = widget.content as AIChatContent;
    const currentHash = getContentHash(widgetContent);

    if (currentHash !== lastContentHashRef.current) {
      if (widgetContent?.messages) {
        setMessages(widgetContent.messages);
      }
      if (widgetContent?.aiConfigId !== selectedConfigId) {
        setSelectedConfigId(widgetContent.aiConfigId);
      }

      lastContentHashRef.current = currentHash;

      // Mark as initialized after first load to enable saving
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
      }
    }
  }, [widget.content, selectedConfigId]);

  // Save messages to backend - use useRef to avoid circular dependencies
  const saveMessagesRef = useRef<((messagesToSave: ChatMessage[]) => Promise<void>) | null>(null);

  // Update the ref whenever dependencies change
  useEffect(() => {
    saveMessagesRef.current = async (messagesToSave: ChatMessage[]) => {
      // console.log('saveMessages called with:', messagesToSave.length, 'messages')
      const updatedContent: AIChatContent = {
        messages: messagesToSave,
        aiConfigId: selectedConfigId,
      };

      try {
        await dispatch(
          updateWidget({
            id: widget.id,
            data: { content: updatedContent },
          })
        ).unwrap();
        // console.log('Messages saved to database successfully')
      } catch (error) {
        console.error('Failed to save messages to database:', error);
      }
    };
  }, [dispatch, widget.id, selectedConfigId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      // Scroll the container to bottom instead of using scrollIntoView
      // This prevents the canvas from shifting when the widget is outside viewport
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Save messages when pendingSave flag is set (at completion points only)
  useEffect(() => {
    if (pendingSave && isInitializedRef.current && saveMessagesRef.current) {
      console.log('Saving messages due to pendingSave flag:', messages.length);
      saveMessagesRef.current(messages);
      setPendingSave(false);
    }
  }, [pendingSave, messages]);

  // Fetch tool support status and available tools when config changes
  useEffect(() => {
    const fetchToolData = async () => {
      try {
        // Fetch both tool support status and available tools
        const [toolSupportResponse, availableToolsResponse] = await Promise.all([
          aiChatAPI.getToolSupportStatus(),
          aiChatAPI.getAvailableTools(),
        ]);

        // Update tool support status
        setToolSupportStatus(toolSupportResponse.data.configurations);

        // Update MCP tools availability
        setMcpToolsAvailable(
          availableToolsResponse.data.tools && availableToolsResponse.data.tools.length > 0
        );
      } catch (error) {
        console.error('Failed to fetch tool data:', error);
      }
    };

    fetchToolData();
  }, [selectedConfigId]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading || (!selectedConfig && !defaultConfig)) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    // Trigger save for user message (completion point)
    setPendingSave(true);
    setInputText('');
    setIsLoading(true);

    // Create initial empty assistant message for streaming
    const assistantMessageId = uuidv4();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessageId);

    try {
      // Use streaming API
      const streamGenerator = aiChatAPI.streamMessage({
        message: userMessage.content,
        ai_config_id: selectedConfig?.id,
        conversation_history: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      });

      for await (const chunk of streamGenerator) {
        // console.log('chunk', chunk)
        if (chunk.error) {
          // Handle error
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: `Sorry, I encountered an error: ${chunk.error}. Please check your AI configuration and try again.`,
                    isStreaming: false,
                  }
                : msg
            )
          );
          break;
        } else if (chunk.type === 'content' && chunk.content) {
          // Update the assistant message with new content - direct concatenation for real-time streaming
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk.content } : msg
            )
          );
        } else if (chunk.type === 'tool_start' && chunk.tool_name) {
          // Show tool usage indicator
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + `\n\n🔧 Using: ${chunk.tool_name}` }
                : msg
            )
          );
        } else if (chunk.type === 'tool_result' && chunk.result) {
          // Tool execution completed, continue with AI response
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + ` ✓\n\n` } : msg
            )
          );
        } else if (chunk.type === 'tool_error' && chunk.error) {
          // Tool execution failed
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + ` ❌ Error: ${chunk.error}` }
                : msg
            )
          );
          break;
        } else if (chunk.done) {
          // Mark streaming as complete and explicitly save
          setMessages(prev =>
            prev.map(msg => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
          );
          // Trigger save for completed streaming
          setPendingSave(true);
          break;
        }
      }
    } catch (error: any) {
      console.error('Failed to get AI response:', error);

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please check your AI configuration and try again.`,
                isStreaming: false,
              }
            : msg
        )
      );
      // Trigger save for error state
      setPendingSave(true);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation(); // Prevent canvas movement
      sendMessage();
    }
  };

  const retryMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Find the last user message before this assistant message
    let lastUserMessage = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i];
        break;
      }
    }

    if (!lastUserMessage) return;

    // Remove the failed message and everything after it
    setMessages(prev => prev.slice(0, messageIndex));

    // Resend the message
    setIsLoading(true);

    // Create new assistant message for streaming
    const assistantMessageId = uuidv4();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessageId);

    try {
      const streamGenerator = aiChatAPI.streamMessage({
        message: lastUserMessage.content,
        ai_config_id: selectedConfig?.id,
        conversation_history: messages.slice(0, messageIndex).map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      });

      for await (const chunk of streamGenerator) {
        if (chunk.error) {
          // Handle error
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: `Sorry, I encountered an error: ${chunk.error}. Please check your AI configuration and try again.`,
                    isStreaming: false,
                  }
                : msg
            )
          );
          break;
        } else if (chunk.type === 'content' && chunk.content) {
          // Update the assistant message with new content - direct concatenation for real-time streaming
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk.content } : msg
            )
          );
        } else if (chunk.type === 'tool_start' && chunk.tool_name) {
          // Show tool usage indicator
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + `\n\n🔧 Using: ${chunk.tool_name}` }
                : msg
            )
          );
        } else if (chunk.type === 'tool_result' && chunk.result) {
          // Tool execution completed, continue with AI response
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + ` ✓\n\n` } : msg
            )
          );
        } else if (chunk.type === 'tool_error' && chunk.error) {
          // Tool execution failed
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + ` ❌ Error: ${chunk.error}` }
                : msg
            )
          );
          break;
        } else if (chunk.done) {
          // Mark streaming as complete and save
          setMessages(prev =>
            prev.map(msg => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
          );
          // Trigger save for retry completion
          setPendingSave(true);
          break;
        }
      }
    } catch (error: any) {
      console.error('Failed to retry AI response:', error);

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please check your AI configuration and try again.`,
                isStreaming: false,
              }
            : msg
        )
      );
      // Trigger save for retry error
      setPendingSave(true);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleConfigSelect = (configId: number | undefined) => {
    setSelectedConfigId(configId);

    // Save config selection
    const updatedContent: AIChatContent = {
      messages,
      aiConfigId: configId,
    };

    dispatch(
      updateWidget({
        id: widget.id,
        data: { content: updatedContent },
      })
    );
  };

  // Get tool support status for a specific config
  const getToolSupportInfo = (configId?: number) => {
    if (!configId) {
      configId = defaultConfig?.id;
    }

    const status = toolSupportStatus.find(s => s.id === configId);
    return status;
  };

  // Get tool support indicator
  const getToolSupportIndicator = (configId?: number) => {
    if (!mcpToolsAvailable) {
      return null; // No MCP tools available, no need to show indicator
    }

    const status = getToolSupportInfo(configId);
    if (!status) return null;

    const isSupported = status.supports_tools;
    return (
      <span
        className={`ml-1 text-xs ${isSupported ? 'text-green-600' : 'text-red-500'}`}
        title={status.tool_support_note}
      >
        {isSupported ? '🔧' : '⚠️'}
      </span>
    );
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-white"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-end p-3 border-b">
        {/* AI Model Selection */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
              <ProviderIcon
                provider={selectedConfig?.provider || defaultConfig?.provider || ''}
                className="w-3 h-3"
              />
            </div>
            <select
              value={selectedConfigId || ''}
              onChange={e =>
                handleConfigSelect(e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="text-xs border border-gray-300 rounded pl-6 pr-6 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="">Default ({defaultConfig?.model || 'No model'})</option>
              {configs.map(config => (
                <option key={config.id} value={config.id}>
                  {config.name} ({config.model})
                </option>
              ))}
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg
                className="w-3 h-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          {/* Tool support indicator */}
          {getToolSupportIndicator(selectedConfigId)}
        </div>
      </div>

      {/* MCP Tools Warning */}
      {mcpToolsAvailable && !getToolSupportInfo(selectedConfigId)?.supports_tools && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs text-yellow-700">
                MCP tools are available but not supported by this AI provider.
                {getToolSupportInfo(selectedConfigId)?.tool_support_note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm">Start a conversation with AI</p>
            <p className="text-xs mt-1">Type your message below</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`${message.role === 'user' ? 'max-w-[80%]' : 'w-full'} p-3 rounded-lg ${
                  message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <>
                    <div className="prose prose-sm max-w-none prose-gray prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-em:text-inherit prose-code:text-inherit prose-pre:bg-gray-200 prose-pre:text-inherit">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Custom styling for inline code
                          code: ({ node, className, children, ...props }) => {
                            const isInline = !className?.includes('language-');
                            return isInline ? (
                              <code className="bg-gray-200 px-1 py-0.5 rounded text-xs" {...props}>
                                {children}
                              </code>
                            ) : (
                              <code
                                className="block bg-gray-200 p-2 rounded text-xs overflow-x-auto"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          // Custom styling for links
                          a: ({ node, ...props }) => (
                            <a
                              className="text-blue-500 hover:text-blue-600 underline"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                          // Custom styling for lists
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
                          ),
                          // Custom styling for list items to prevent extra spacing
                          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                        }}
                      >
                        {decodeMessageContent(message.content) || ' '}
                      </ReactMarkdown>
                      {message.isStreaming && (
                        <div className="inline-flex items-center ml-1">
                          <div className="w-1 h-4 bg-gray-400 animate-pulse"></div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>

                      {!message.isStreaming && message.content && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => retryMessage(message.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            title="Retry message"
                          >
                            <ArrowPathIcon className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => copyMessage(message.content)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            title="Copy message"
                          >
                            <DocumentDuplicateIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs mt-2 text-blue-100">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-center space-x-2">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading || (!selectedConfig && !defaultConfig)}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
