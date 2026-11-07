import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { aiAvailable, mascotPublicUrl } from "@/lib/chat-data";
import { getChatSettingsForAdmin, listTopicsForAdmin } from "@/lib/admin-chat";
import AdminTabs from "../AdminTabs";
import ChatSettingsForm from "./ChatSettingsForm";
import MascotUpload from "./MascotUpload";
import TopicsEditor from "./TopicsEditor";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminChatPage() {
  await requireAdmin("/admin/chat");
  const [settings, topics] = await Promise.all([getChatSettingsForAdmin(), listTopicsForAdmin()]);
  const mascotUrl = settings.mascotPath ? mascotPublicUrl(settings.mascotPath) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <AdminTabs active="chat" />
      <p className="eyebrow text-muted">Staff only</p>
      <h1 className="display mt-2 text-5xl">Shop assistant</h1>
      <div className="measure mt-6 text-ink" />
      <p className="mt-6 max-w-prose text-sm text-muted">
        A friendly assistant at the bottom-right of the shop that answers questions about ordering, paying, delivery and
        returns and sends customers to the right page. It is off until you switch it on. The Guided engine is free and
        only says what you wrote here (plus live facts such as the delivery fee); it hides anything that needs a feature
        you have not switched on. Chats are never stored.
      </p>

      <section className="mt-8">
        <h2 className="display text-2xl">Mascot picture</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">Upload your own picture, or keep the built-in panda.</p>
        <MascotUpload hasCustom={settings.mascotPath !== null} />
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Settings</h2>
        <div className="mt-4">
          <ChatSettingsForm settings={settings} mascotUrl={mascotUrl} aiKeySet={aiAvailable()} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Questions and answers</h2>
        <div className="mt-4 max-w-3xl">
          <TopicsEditor topics={topics.topics} isDefault={topics.isDefault} />
        </div>
      </section>
    </div>
  );
}
