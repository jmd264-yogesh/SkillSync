"use client";

import { useState, useRef, useEffect } from "react";
import { sendCopilotMessage } from "@/server/actions/copilot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Send, Bot, User } from "lucide-react";
import { MarkdownMessage } from "@/components/shared/markdown-message";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Who rolls off in the next 3 weeks?",
  "Where am I losing billable hours right now?",
  "Can we take on 2 Data Platform builds starting next month?",
  "Who best fits a new AI project for a fintech client?",
];

export function CopilotChat() {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    const newHistory: Message[] = [...history, { role: "user", content: message }];
    setHistory(newHistory);
    setInput("");
    setLoading(true);

    try {
      const { reply } = await sendCopilotMessage({ history: newHistory });
      setHistory((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${String(e)}. Please try again.` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Suggested questions (shown only when empty) */}
      {history.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full px-3 py-1.5 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[60vh]">
        {history.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-violet-600" />
              </div>
            )}
            <Card className={cn(
              "max-w-[80%] px-4 py-3 border-0 shadow-sm",
              msg.role === "user"
                ? "bg-primary text-white text-sm leading-relaxed"
                : "bg-white text-slate-800",
            )}>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              ) : (
                <MarkdownMessage content={msg.content} />
              )}
            </Card>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-violet-600" />
            </div>
            <Card className="bg-white border-0 shadow-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </Card>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask a resourcing question… (Enter to send, Shift+Enter for newline)"
          className="resize-none min-h-[52px] max-h-32 text-sm"
          rows={2}
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="h-[52px] w-[52px] shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
