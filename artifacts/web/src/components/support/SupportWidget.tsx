import { useState } from "react";
import { useLocation } from "wouter";
import { LifeBuoy, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, useAuth } from "@/lib/auth";
import { useAuthModal } from "@/components/auth/AuthModal";

type SupportMessage = {
  role: "user" | "assistant" | "admin";
  content: string;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  status: "collecting" | "open" | "answered" | "closed";
  topic: string;
  messages: SupportMessage[];
};

export function SupportWidget() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (location.startsWith("/admin")) return null;

  async function startChat() {
    if (!user) {
      openAuth("login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await apiRequest<SupportTicket>("/support/tickets", { method: "POST" });
      setTicket(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось начать чат");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!ticket || !message.trim()) return;
    const text = message.trim();
    setMessage("");
    setLoading(true);
    setError(null);
    try {
      const updated = await apiRequest<SupportTicket>(`/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setTicket(updated);
    } catch (e) {
      setMessage(text);
      setError(e instanceof Error ? e.message : "Не удалось отправить сообщение");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[#22C55E]/40 bg-[#16A34A] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(34,197,94,0.45)] transition-transform hover:scale-105"
      >
        <LifeBuoy size={18} /> Поддержка
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="font-bold text-white">Поддержка</div>
                <div className="text-xs text-muted-foreground">ИИ уточнит детали и передаст обращение администратору</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-muted-foreground hover:bg-white/5 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {!ticket ? (
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
                  Нажмите «Написать», и ассистент задаст первый вопрос о проблеме.
                </div>
                {error && <div className="text-sm text-red-400">{error}</div>}
                <Button onClick={startChat} disabled={loading} className="w-full bg-gradient-primary text-white border-0">
                  <MessageCircle size={16} className="mr-2" /> {loading ? "Открываем..." : "Написать"}
                </Button>
              </div>
            ) : (
              <div className="flex h-[520px] flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {ticket.messages.map((m, i) => (
                    <div key={`${m.createdAt}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-[#7C3AED] text-white"
                            : m.role === "admin"
                              ? "bg-[#16A34A]/20 text-green-100 border border-[#22C55E]/30"
                              : "bg-secondary text-white border border-border"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {ticket.status === "open" && (
                    <div className="rounded-xl border border-[#22C55E]/30 bg-[#16A34A]/10 p-3 text-xs text-green-200">
                      Обращение передано администратору. Тема: {ticket.topic}
                    </div>
                  )}
                </div>
                <div className="border-t border-border p-4">
                  {error && <div className="mb-2 text-sm text-red-400">{error}</div>}
                  <div className="flex gap-2">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={loading || ticket.status !== "collecting"}
                      placeholder={ticket.status === "collecting" ? "Напишите ответ..." : "Обращение уже отправлено"}
                      rows={2}
                      className="resize-none bg-secondary border-border text-white"
                    />
                    <Button onClick={sendMessage} disabled={loading || !message.trim() || ticket.status !== "collecting"} className="h-auto bg-gradient-primary text-white border-0">
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
