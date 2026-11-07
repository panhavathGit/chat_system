import { useMemo, useState } from "react";
import { ConversationItem, useConversationStore } from "@/entities/conversation";
import { selectConversation, loadMoreInbox } from "@/features/select-conversation";
import { useMessageSettingsStore } from "@/features/message-settings";
import { assets, isChatBackend } from "@/shared/config";
import { AssetIcon, IconPill } from "@/shared/ui";

type Props = { open: boolean; onClose: () => void; onExpand: () => void };

export default function ConversationSidebar({ open, onClose, onExpand }: Props) {
  const byId = useConversationStore((state) => state.byId);
  const order = useConversationStore((state) => state.order);
  const selectedId = useConversationStore((state) => state.selectedId);
  const query = useConversationStore((state) => state.query);
  const setQuery = useConversationStore((state) => state.setQuery);
  const inboxPage = useConversationStore((state) => state.inboxPage);
  const inboxTotalPages = useConversationStore((state) => state.inboxTotalPages);
  const openSettings = useMessageSettingsStore((state) => state.setOpen);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasMoreInbox = isChatBackend && inboxTotalPages !== null && inboxPage < inboxTotalPages;

  const handleLoadMore = () => {
    setLoadingMore(true);
    loadMoreInbox().finally(() => setLoadingMore(false));
  };
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return order
      .map((id) => byId[id])
      .filter(
        (conversation) =>
          conversation &&
          !conversation.archived &&
          (conversation.name.toLowerCase().includes(needle) || conversation.preview.toLowerCase().includes(needle)),
      );
  }, [byId, order, query]);

  return (
    <aside className={`message-sidebar ${open ? "panel-open" : ""}`}>
      <div className="sidebar-title">
        <h1>Message</h1>
        <div className="sidebar-actions">
          <IconPill left="moreVert" right="collapse" />
          <button className="settings-hit" onClick={() => openSettings(true)} aria-label="Open message settings" />
          <button className="zoom-hit" onClick={onExpand} aria-label="Open expanded applications workspace" />
        </div>
        <button className="close-mobile" onClick={onClose} aria-label="Close messages">
          ×
        </button>
      </div>
      <label className="sidebar-search">
        <AssetIcon src={assets.icons.search} size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or message"
          aria-label="Search messages"
        />
      </label>
      <div className="conversation-list">
        {visible.length === 0 && <div className="empty-search">No conversations found</div>}
        {visible.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            selected={conversation.id === selectedId}
            onSelect={() => {
              selectConversation(conversation.id);
              onClose();
            }}
          />
        ))}
        {hasMoreInbox && (
          <button className="load-more-inbox" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </aside>
  );
}
