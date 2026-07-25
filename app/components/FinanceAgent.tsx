"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function FinanceAgent() {
  const { messages, sendMessage, status, error } = useChat();

  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Listen for real-time webhook events
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      if (event.data === "refresh") {
        console.log("[SSE] Webhook detected in FinanceAgent");
        // Optional: Trigger a refresh or show a toast
      }
    };

    return () => eventSource.close();
  }, []);

  // Smart auto-scroll: only scroll if the user is already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isOpen) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user is within 100px of the bottom, snap to bottom
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageToSend = input;
    setInput("");

    try {
      await sendMessage({ text: messageToSend });
    } catch (err) {
      console.error("Failed to send message:", err);
      setInput(messageToSend);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center justify-center min-w-[60px]"
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute inset-x-4 bottom-20 sm:inset-x-auto sm:right-0 w-4xl sm:w-80 md:w-96  bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-blue-600 p-4 text-white">
            <h3 className="font-bold">Pro Finance Agent</h3>
            <p className="text-xs opacity-80">AI-Powered Financial Insights</p>
          </div>

          {/* Scrollable Area */}
          <div className="flex-1 max-h-[60vh] sm:max-h-[600px] overflow-y-scroll p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">
                  Ask me anything about your finances!
                </p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] p-3 rounded-2xl text-sm shadow-sm ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                  }`}
                >
                  <div
                    className={`prose prose-sm max-w-none ${m.role === "user" ? "prose-invert" : ""}`}
                  >
                    {m.parts.map((part, i) => {
                      switch (part.type) {
                        case "text":
                          return (
                            <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
                          );
                        case "reasoning":
                          return (
                            <div
                              key={i}
                              className="text-xs opacity-60 italic mb-2 border-l-2 border-gray-200 pl-2"
                            >
                              {part.text}
                            </div>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 text-xs text-red-500 bg-red-50 rounded-lg mx-4 mb-4 text-center">
                Error: {error.message}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 bg-white border-t border-gray-100"
          >
            <div className="flex gap-2">
              <input
                className="flex-1 bg-gray-100 text-black border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={input}
                placeholder="How's my spending?"
                onChange={handleInputChange}
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors font-medium text-sm"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
