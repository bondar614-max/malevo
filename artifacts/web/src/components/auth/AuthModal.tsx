import { createContext, useContext, useState, type ReactNode } from "react";
import { X, Mail, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, useAuth, type AuthUser } from "@/lib/auth";

type Mode = "login" | "register";

interface AuthModalCtx {
  open: (mode?: Mode) => void;
  close: () => void;
}

const Ctx = createContext<AuthModalCtx | null>(null);

export function useAuthModal(): AuthModalCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthModalProvider missing");
  return c;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  const open = (m: Mode = "login") => { setMode(m); setIsOpen(true); };
  const close = () => setIsOpen(false);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {isOpen && <AuthModal mode={mode} setMode={setMode} onClose={close} />}
    </Ctx.Provider>
  );
}

function AuthModal({ mode, setMode, onClose }: { mode: Mode; setMode: (m: Mode) => void; onClose: () => void }) {
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login" ? { email, password } : { email, name, password };
      const data = await apiRequest<{ token: string; user: AuthUser }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSession(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#7C3AED] rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#EC4899] rounded-full blur-3xl opacity-20 pointer-events-none" />

        <button onClick={onClose} className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-white" aria-label="Закрыть">
          <X size={20} />
        </button>

        <div className="relative p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              ✨
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {mode === "login" ? "С возвращением!" : "Создать аккаунт"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "login" ? "Войди, чтобы продолжить" : "Зарегистрируйся за 30 секунд"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 bg-secondary rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`py-2 text-sm font-medium rounded-md transition-all ${mode === "login" ? "bg-gradient-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]" : "text-muted-foreground hover:text-white"}`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`py-2 text-sm font-medium rounded-md transition-all ${mode === "register" ? "bg-gradient-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]" : "text-muted-foreground hover:text-white"}`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="auth-name" className="text-white text-sm">Имя</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Как тебя зовут?"
                    className="pl-10 bg-secondary border-border text-white h-11"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="auth-email" className="text-white text-sm">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 bg-secondary border-border text-white h-11"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="auth-password" className="text-white text-sm">Пароль</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "••••••••"}
                  className="pl-10 bg-secondary border-border text-white h-11"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-primary text-white border-0 hover:opacity-90 font-semibold text-base shadow-[0_0_20px_rgba(124,58,237,0.4)]"
            >
              {loading ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>Нет аккаунта? <button type="button" onClick={() => { setMode("register"); setError(null); }} className="text-[#7C3AED] hover:underline font-medium">Зарегистрироваться</button></>
              ) : (
                <>Уже есть аккаунт? <button type="button" onClick={() => { setMode("login"); setError(null); }} className="text-[#7C3AED] hover:underline font-medium">Войти</button></>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
