import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useAuth, apiRequest, type AuthUser } from "@/lib/auth";
import { User as UserIcon, Wallet, ImageIcon, LogOut, Save, KeyRound, Images } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoCarousel } from "@/components/PhotoCarousel";

interface OrderRow {
  id: string;
  status: string;
  amount: number;
  sourcePhotoUrl: string | null;
  anchorPhotoUrl: string | null;
  resultPhotos: string[];
  createdAt: string;
  completedAt: string | null;
  styleId: string | null;
  styleTitle: string | null;
  stylePreview: string | null;
  serviceKey: string | null;
  serviceTitle: string | null;
  servicePreview: string | null;
  locationId: string | null;
  locationName: string | null;
}

type Tab = "profile" | "balance" | "orders";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "В очереди", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  processing: { label: "Обработка", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  awaiting_approval: { label: "Ожидает подтверждения", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  success: { label: "Готово", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  completed: { label: "Готово", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  failed: { label: "Ошибка", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, token, logout, updateUser, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    if (!loading && !token) setLocation("/");
  }, [loading, token, setLocation]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <div className="pt-28 pb-20">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          {/* Top profile card */}
          <div className="relative bg-card border border-border rounded-2xl p-6 md:p-8 mb-8 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#7C3AED] rounded-full blur-3xl opacity-15 pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 w-40 h-40 bg-[#EC4899] rounded-full blur-3xl opacity-10 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center text-3xl font-bold text-white shadow-[0_0_25px_rgba(124,58,237,0.5)]">
                {(user.name || user.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
                  {user.name || "Привет!"}
                </h1>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">С нами с {formatDate(user.createdAt)}</p>
              </div>
              <div className="flex flex-row md:flex-col gap-3 md:text-right">
                <div className="px-4 py-3 rounded-xl bg-secondary border border-border min-w-[140px]">
                  <div className="text-xs text-muted-foreground">Баланс</div>
                  <div className="text-xl font-bold text-white">{user.balance.toFixed(2)} ₽</div>
                </div>
                <Button variant="ghost" onClick={() => { logout(); setLocation("/"); }} className="text-muted-foreground hover:text-white">
                  <LogOut size={16} className="mr-2" /> Выйти
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-border">
            {(
              [
                { id: "profile", label: "Профиль", icon: UserIcon },
                { id: "balance", label: "Баланс", icon: Wallet },
                { id: "orders", label: "Мои генерации", icon: ImageIcon },
              ] as Array<{ id: Tab; label: string; icon: typeof UserIcon }>
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.id ? "border-[#7C3AED] text-white" : "border-transparent text-muted-foreground hover:text-white"
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "profile" && <ProfileTab user={user} onUpdated={updateUser} />}
          {tab === "balance" && <BalanceTab user={user} />}
          {tab === "orders" && <OrdersTab />}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function ProfileTab({ user, onUpdated }: { user: AuthUser; onUpdated: (u: AuthUser) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true); setInfoMsg(null);
    try {
      const updated = await apiRequest<AuthUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name, email }),
      });
      onUpdated(updated);
      setInfoMsg({ kind: "ok", text: "Данные сохранены" });
    } catch (err) {
      setInfoMsg({ kind: "err", text: err instanceof Error ? err.message : "Ошибка" });
    } finally { setSavingInfo(false); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPwd(true); setPwdMsg(null);
    try {
      await apiRequest<AuthUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword(""); setNewPassword("");
      setPwdMsg({ kind: "ok", text: "Пароль обновлён" });
    } catch (err) {
      setPwdMsg({ kind: "err", text: err instanceof Error ? err.message : "Ошибка" });
    } finally { setSavingPwd(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={saveInfo} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserIcon size={18} /> Личные данные</h3>
        <div>
          <Label className="text-white text-sm">Имя</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-secondary border-border text-white" />
        </div>
        <div>
          <Label className="text-white text-sm">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-secondary border-border text-white" />
        </div>
        {infoMsg && (
          <div className={`text-sm rounded-lg p-3 border ${infoMsg.kind === "ok" ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-red-400 bg-red-500/10 border-red-500/30"}`}>{infoMsg.text}</div>
        )}
        <Button type="submit" disabled={savingInfo} className="bg-gradient-primary text-white border-0">
          <Save size={16} className="mr-2" /> {savingInfo ? "Сохранение..." : "Сохранить"}
        </Button>
      </form>

      <form onSubmit={savePassword} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2"><KeyRound size={18} /> Смена пароля</h3>
        <div>
          <Label className="text-white text-sm">Текущий пароль</Label>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 bg-secondary border-border text-white" autoComplete="current-password" />
        </div>
        <div>
          <Label className="text-white text-sm">Новый пароль</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} className="mt-1 bg-secondary border-border text-white" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground mt-1">Минимум 6 символов</p>
        </div>
        {pwdMsg && (
          <div className={`text-sm rounded-lg p-3 border ${pwdMsg.kind === "ok" ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-red-400 bg-red-500/10 border-red-500/30"}`}>{pwdMsg.text}</div>
        )}
        <Button type="submit" disabled={savingPwd || !currentPassword || !newPassword} className="bg-gradient-primary text-white border-0">
          <Save size={16} className="mr-2" /> {savingPwd ? "..." : "Обновить пароль"}
        </Button>
      </form>
    </div>
  );
}

function BalanceTab({ user }: { user: AuthUser }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-2xl p-6 md:col-span-2 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#7C3AED] rounded-full blur-3xl opacity-20" />
        <div className="relative">
          <div className="text-sm text-muted-foreground mb-2">Текущий баланс</div>
          <div className="text-5xl font-bold text-white mb-1">{user.balance.toFixed(2)} <span className="text-2xl text-muted-foreground">₽</span></div>
          <div className="text-sm text-muted-foreground">Всего потрачено: <span className="text-white">{user.totalSpent.toFixed(2)} ₽</span></div>
          <Link href="/styles">
            <Button className="mt-6 bg-gradient-primary text-white border-0 shadow-[0_0_20px_rgba(124,58,237,0.4)]">
              Пополнить и сгенерировать →
            </Button>
          </Link>
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6">
        <h4 className="font-bold text-white mb-3">Как это работает?</h4>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• Выбери стиль из каталога</li>
          <li>• Стоимость одной генерации списывается с баланса</li>
          <li>• Результат сохраняется в разделе «Мои генерации»</li>
        </ul>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ title: string; photos: string[] } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await apiRequest<OrderRow[]>("/auth/me/orders")); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!rows) return <div className="text-muted-foreground">Загрузка...</div>;
  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center">
        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Ещё нет генераций</h3>
        <p className="text-sm text-muted-foreground mb-6">Выбери стиль и создай свою первую AI-фотографию</p>
        <Link href="/styles"><Button className="bg-gradient-primary text-white border-0">Перейти в каталог стилей</Button></Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((o) => {
          const status = STATUS_LABELS[o.status] ?? { label: o.status, cls: "bg-secondary border-border text-muted-foreground" };
          const preview = o.resultPhotos[0] || o.anchorPhotoUrl || o.servicePreview || o.stylePreview;
          const title = o.serviceTitle ?? o.styleTitle ?? "Удалено";
          const subtitle = o.locationName ? `Локация: ${o.locationName}` : null;
          const hasPhotos = o.resultPhotos.length > 0;
          const openLightbox = () => hasPhotos && setLightbox({ title, photos: o.resultPhotos });
          return (
            <div key={o.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={openLightbox}
                disabled={!hasPhotos}
                aria-label={hasPhotos ? `Открыть фото заказа «${title}»` : title}
                className="aspect-[4/3] bg-secondary relative block w-full group disabled:cursor-default"
              >
                {preview ? <img src={preview} alt={title} className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon /></div>
                )}
                <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded border ${status.cls}`}>{status.label}</span>
                {o.serviceKey && (
                  <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-[#7C3AED]/30 border border-[#7C3AED]/50 text-white uppercase tracking-wider">Услуга</span>
                )}
                {hasPhotos && o.resultPhotos.length > 1 && (
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-white">
                    <Images size={12} /> {o.resultPhotos.length} фото
                  </span>
                )}
              </button>
              <div className="p-4 flex-1 flex flex-col">
                <div className="font-semibold text-white truncate">{title}</div>
                {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
                <div className="text-xs text-muted-foreground mt-1">{formatDate(o.createdAt)}</div>
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="text-sm text-white">{o.amount.toFixed(2)} ₽</span>
                  {o.status === "awaiting_approval" && o.serviceKey === "wb-photoshoot" ? (
                    <Link href={`/service/wb-photoshoot?order=${o.id}`}>
                      <button type="button" className="text-xs text-[#7C3AED] hover:underline">
                        Проверить кадр
                      </button>
                    </Link>
                  ) : hasPhotos && (
                    <button type="button" onClick={openLightbox} className="text-xs text-[#7C3AED] hover:underline">
                      {o.resultPhotos.length > 1 ? "Смотреть все фото" : "Открыть"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-white">{lightbox?.title}</DialogTitle>
          </DialogHeader>
          {lightbox && <PhotoCarousel photos={lightbox.photos} aspectClassName="aspect-[3/4]" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
