import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversationStore, useSelectedConversation } from "@/entities/conversation";
import {
  MessageBubble,
  TypingBubble,
  useConversationMessages,
  useHasOlderMessages,
  useMessageStore,
} from "@/entities/message";
import { ChatSearchBar, filterByQuery, useChatSearchStore } from "@/features/search-in-chat";
import { MessageComposer, retryMessage, useComposerStore } from "@/features/send-message";
import { loadOlderMessages } from "@/features/select-conversation";
import { assets, features, isChatBackend } from "@/shared/config";
import { AssetIcon, IconButton, notify, Icon } from "@/shared/ui";
import { useCustomerCallStore } from "@/features/customer-call";
import HandoffCard from "./HandoffCard";

const PRESENCE = {
  "needs-human": "active • awaiting human response",
  ai: "active • handled by AI assistant",
  assigned: "active • handling",
} as const;

export default function ChatWindow({
  onOpenContext,
  onOpenMedia,
}: {
  onOpenContext: () => void;
  onOpenMedia: () => void;
}) {
  const conversation = useSelectedConversation();
  const messages = useConversationMessages(conversation?.id ?? null);
  const hasOlder = useHasOlderMessages(conversation?.id ?? null);
  const typing = useMessageStore((state) => (conversation ? state.typing[conversation.id] : undefined));
  const { query, toggle } = useChatSearchStore();
  const setDraft = useComposerStore((state) => state.setDraft);
  const [showMore, setShowMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const visible = useMemo(() => filterByQuery(messages, query, (message) => message.text), [messages, query]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [visible.length, typing, conversation?.id]);

  // "Load older" triggered by an IntersectionObserver on the top sentinel
  const handleLoadOlder = useCallback(async () => {
    if (!conversation || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    try {
      await loadOlderMessages(conversation.id);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversation, loadingOlder, hasOlder]);

  useEffect(() => {
    if (!isChatBackend || !topSentinelRef.current) return;
    const sentinel = topSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) void handleLoadOlder(); },
      { threshold: 1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadOlder]);

  useEffect(() => {
    if (!showMore) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !actionsRef.current?.contains(event.target as Node))
        setShowMore(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [showMore]);

  if (!conversation)
    return (
      <section className="active-chat">
        <div className="empty-search">Select a conversation to start chatting</div>
      </section>
    );

  const firstName = conversation.name.split(" ")[0];
  const menuAction = (action: "markUnreadLocally" | "assignToMeLocally" | "archiveLocally", text: string) => () => {
    useConversationStore.getState()[action](conversation.id);
    notify(text);
    setShowMore(false);
  };

  return (
    <section className="active-chat">
      <header className="chat-header">
        <div className="chat-identity">
          <img src={conversation.avatar || undefined} alt="" />
          <div>
            <div className="identity-line">
              <h2>{conversation.name}</h2>
              {conversation.urgent && <span className="priority-pill">Priority</span>}
              {conversation.unread > 0 && <span className="message-pill">{conversation.unread} messages</span>}
            </div>
            <p>
              <Icon src={assets.icons.online} alt="" /> {PRESENCE[conversation.handoff]}
            </p>
          </div>
        </div>
        <div className="chat-actions" ref={actionsRef}>
          <IconButton icon={assets.icons.chatSearch} size={24} label="Search conversation" onClick={toggle} />
          <button
            onClick={() => useCustomerCallStore.getState().start(conversation)}
            aria-label={`Call ${conversation.name}`}
          >
            <AssetIcon src={assets.icons.phone} />
          </button>
          <button
            onClick={() => setShowMore((current) => !current)}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={showMore}
          >
            <AssetIcon src={assets.icons.more} size={16} />
          </button>
          <button className="context-trigger" onClick={onOpenContext} aria-label="Open customer details">
            i
          </button>
          {showMore && (
            <div className="more-menu" role="menu">
              <button onClick={menuAction("markUnreadLocally", "Conversation marked unread")}>Mark as unread</button>
              <button onClick={menuAction("assignToMeLocally", "Conversation assigned to you")}>Assign to me</button>
              <button onClick={menuAction("archiveLocally", "Conversation archived")}>Archive conversation</button>
              <button
                onClick={() => {
                  onOpenMedia();
                  setShowMore(false);
                }}
              >
                Media & files
              </button>
            </div>
          )}
        </div>
      </header>

      <ChatSearchBar />
      <div className="chat-stream" aria-live="polite">
        {/* Sentinel: when visible, load the next older page */}
        {isChatBackend && <div ref={topSentinelRef} />}
        {isChatBackend && hasOlder && (
          <div className="load-older">
            {loadingOlder ? (
              <span>Loading…</span>
            ) : (
              <button type="button" onClick={handleLoadOlder}>Load older messages</button>
            )}
          </div>
        )}
        <div className="today-pill">Today</div>
        {hasQuery && visible.length === 0 && <div className="empty-search">No messages match "{trimmedQuery}"</div>}
        {visible.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            showReadReceipts
            onRetry={(failed) => retryMessage(failed.conversationId, failed.id)}
          />
        ))}
        {typing === "customer" && <TypingBubble />}
        <div ref={endRef} />
      </div>

      <div className="chat-input-area">
        {conversation.handoff === "needs-human" && (
          <HandoffCard
            conversationId={conversation.id}
            onRegenerateDraft={() =>
              setDraft(
                conversation.id,
                `Hi ${firstName}, I'm reviewing your request and will confirm the updated schedule shortly.`,
              )
            }
          />
        )}
        {/* "You're handling" badge is step-2 UX — hidden in step 1 */}
        {features.step2 && conversation.handoff === "assigned" && (
          <div className="takeover-confirmation">You're now handling this conversation.</div>
        )}
        <MessageComposer conversationId={conversation.id} />
      </div>
    </section>
  );
}
