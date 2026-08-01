"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "./LanguageProvider";

// Chat flottant, avant : mounté uniquement sur le Dashboard (app/page.tsx),
// couleurs codées en dur (bg-blue-600/bg-white/text-gray-800, jamais
// compatibles dark mode), texte 100% anglais sans passer par useLanguage(),
// et conversation perdue à chaque rechargement (useChat() sans persistance).
// Désormais monté globalement depuis app/layout.tsx — mêmes pages que
// TopNav (masqué sur les mêmes AUTH_PATHS/admin, voir TopNav.tsx), design
// tokens partagés (bg-surface/text-body/border-line, dark-mode aware), et
// historique rechargé depuis /api/chat/history au montage.
const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export default function FinanceAgent() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    if (AUTH_PATHS.includes(pathname) || pathname.startsWith("/admin")) return;
    fetch("/api/chat/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setInitialMessages(data?.success ? data.messages : []))
      .catch(() => setInitialMessages([]));
  }, [pathname]);

  if (AUTH_PATHS.includes(pathname) || pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center justify-center min-w-[60px]"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute inset-x-4 bottom-20 sm:inset-x-auto sm:right-0 w-4xl sm:w-80 md:w-96 bg-surface rounded-2xl shadow-2xl border border-line flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {initialMessages === null ? (
            <div className="p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : (
            <FinanceAgentPanel initialMessages={initialMessages} />
          )}
        </div>
      )}
    </div>
  );
}

function FinanceAgentPanel({ initialMessages }: { initialMessages: UIMessage[] }) {
  const { t } = useLanguage();
  const { messages, sendMessage, status, error } = useChat({ messages: initialMessages });

  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Smart auto-scroll: only scroll if the user is already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

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
    <>
      <div className="bg-blue-600 p-4 text-white">
        <h3 className="font-bold">{t("financeAgent.title")}</h3>
        <p className="text-xs opacity-80">{t("financeAgent.subtitle")}</p>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 max-h-[60vh] sm:max-h-[600px] overflow-y-scroll p-4 space-y-4 bg-surface-alt/50"
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-subtle">{t("financeAgent.emptyState")}</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] p-3 rounded-2xl text-sm shadow-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-surface text-body border border-line rounded-tl-none"
              }`}
            >
              <div className={`prose prose-sm max-w-none ${m.role === "user" ? "prose-invert" : "dark:prose-invert"}`}>
                {m.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
                    case "reasoning":
                      return (
                        <div key={i} className="text-xs opacity-60 italic mb-2 border-l-2 border-line pl-2">
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
            <div className="bg-surface p-3 rounded-2xl rounded-tl-none border border-line shadow-sm">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce delay-75" />
                <div className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 text-xs text-red-400 bg-red-500/10 rounded-lg mx-4 mb-4 text-center">
            {t("financeAgent.error")} {error.message}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-surface border-t border-line">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface-alt text-body border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={input}
            placeholder={t("financeAgent.placeholder")}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-colors font-medium text-sm flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {t("financeAgent.send")}
          </button>
        </div>
      </form>
    </>
  );
}
