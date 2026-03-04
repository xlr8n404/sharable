'use client';

import { BottomNav } from '@/components/BottomNav';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { MessageCircle, ArrowLeft, Send, MoreVertical, Trash2, UserPlus, Home, Sun, Moon } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public';

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  user1: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
  user2: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

export default function MessagesPage() {
  const isHeaderVisible = useScrollDirection();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'request' | 'suggestions'>('inbox');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [messagedUsers, setMessagedUsers] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const getAvatarUrl = (avatarPath: string | null | undefined, name: string) => {
    if (avatarPath) return `${SUPABASE_STORAGE_URL}/avatars/${avatarPath}`;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Force Light Mode removed - making it dynamic
  
  // Get current user ID and profile from session
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (profile) setCurrentUserProfile(profile);
          return;
        }

        const response = await fetch('/api/auth/session');
        const data = await response.json();
        if (data.user && data.user.id) {
          setUserId(data.user.id);
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          if (profile) setCurrentUserProfile(profile);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
        setLoading(false);
      }
    };
    getSession();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch conversations
  const fetchConversations = useCallback(async (showLoading = false) => {
    if (!userId) return;
    try {
      if (showLoading) setLoading(true);
      const response = await fetch(`/api/conversations?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      setConversations(data.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userId]);

    useEffect(() => {
      if (!userId) return;
      fetchConversations(true);

      const channel = supabase
        .channel('conversations_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchConversations())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [userId, fetchConversations]);

    // Fetch suggestions when tab is selected
    useEffect(() => {
      if (activeTab !== 'suggestions' || !userId) return;
      const fetchSuggestions = async () => {
        setSuggestionsLoading(true);
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .neq('id', userId)
            .limit(30);
          setSuggestions(data || []);
        } catch (e) {
          console.error(e);
        } finally {
          setSuggestionsLoading(false);
        }
      };
      fetchSuggestions();
    }, [activeTab, userId]);

    const handleFollow = async (targetId: string) => {
      if (!userId) return;
      if (followedUsers.has(targetId)) {
        await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
        setFollowedUsers(prev => { const s = new Set(prev); s.delete(targetId); return s; });
      } else {
        await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
        setFollowedUsers(prev => new Set([...prev, targetId]));
      }
    };

    const handleMessageUser = async (targetId: string) => {
      if (!userId) return;
      try {
        const existing = conversations.find(c =>
          (c.user1_id === userId && c.user2_id === targetId) ||
          (c.user2_id === userId && c.user1_id === targetId)
        );
        if (existing) {
          setSelectedConversation(existing);
          return;
        }
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user1_id: userId, user2_id: targetId }),
        });
        if (!res.ok) throw new Error('Failed to create conversation');
        const data = await res.json();
        await fetchConversations(false);
        setSelectedConversation(data.data);
        setMessagedUsers(prev => new Set([...prev, targetId]));
      } catch (e) {
        toast.error('Failed to start conversation');
      }
    };

    // Mark messages as read
  const markAsRead = async (conversationId: string) => {
    if (!userId) return;
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
      });
      setConversations(prev =>
        prev.map(conv => conv.id === conversationId ? { ...conv, unread_count: 0 } : conv)
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string, showLoading = false) => {
    try {
      if (showLoading) setMessagesLoading(true);
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`);
      const data = await response.json();
      if (data.data) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      if (showLoading) setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedConversation.id, true);
    markAsRead(selectedConversation.id);

    const channel = supabase
      .channel(`room:${selectedConversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, () => {
        fetchMessages(selectedConversation.id);
        markAsRead(selectedConversation.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || !selectedConversation || !userId) return;

    setMessageText('');

    try {
      setSending(true);
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          sender_id: userId,
          content: trimmedMessage,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setMessageText(trimmedMessage);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    try {
      const response = await fetch(`/api/conversations?id=${selectedConversation.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete conversation');
      toast.success('Conversation deleted');
      setSelectedConversation(null);
      fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
    setShowMenu(false);
  };

  const getOtherUser = (conv: Conversation) => {
    return conv.user1_id === userId ? conv.user2 : conv.user1;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
        {!selectedConversation ? (
          <>
            {/* Header for Chat List - 64px (approx 64dp) */}
                <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4 bg-background border-b border-border">
                    <h1 className="text-xl font-bold font-[family-name:var(--font-syne)]">Chats</h1>
                </header>

            {/* Tab Navigation - Pill buttons below header */}
            <div className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm px-4 py-4">
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => setActiveTab('inbox')}
                  className={`flex-1 py-3 rounded-full text-base font-bold transition-all ${
                    activeTab === 'inbox'
                      ? 'bg-foreground text-background shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => setActiveTab('request')}
                  className={`flex-1 py-3 rounded-full text-base font-bold transition-all ${
                    activeTab === 'request'
                      ? 'bg-foreground text-background shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  Requests
                </button>
                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`flex-1 py-3 rounded-full text-base font-bold transition-all ${
                    activeTab === 'suggestions'
                      ? 'bg-foreground text-background shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  Suggestions
                </button>
              </div>
            </div>

            <main className="max-w-xl mx-auto pt-36 pb-24 px-4">
              {loading ? (
                <Loader />
              ) : activeTab === 'suggestions' ? (
                suggestionsLoading ? (
                  <Loader />
                ) : (
                    <div className="space-y-1">
                      {suggestions.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleMessageUser(user.id)}
                          className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted transition-all cursor-pointer group"
                        >
                          <img
                            src={getAvatarUrl(user.avatar_url, user.full_name)}
                            alt={user.full_name}
                            className="w-14 h-14 rounded-full object-cover border border-border flex-shrink-0 group-hover:scale-105 transition-transform"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base truncate">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                          </div>
                          <Link
                            href={`/user/${user.username}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-6 py-2 rounded-full text-sm font-bold bg-foreground text-background hover:opacity-90 transition-all flex-shrink-0"
                          >
                            Profile
                          </Link>
                        </div>
                      ))}
                    {suggestions.length === 0 && (
                      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                          <UserPlus size={24} strokeWidth={1.5} className="text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">No suggestions</h3>
                        <p className="text-muted-foreground max-w-[240px]">Check back later for people you might know.</p>
                      </div>
                    )}
                  </div>
                )
              ) : activeTab === 'request' ? (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <MessageCircle size={24} strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No requests</h3>
                  <p className="text-muted-foreground max-w-[240px]">Message requests will appear here when you receive them.</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <MessageCircle size={24} strokeWidth={1.5} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No messages yet</h3>
                  <p className="text-muted-foreground max-w-[240px]">When you start a conversation, it will appear here.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => {
                    const otherUser = getOtherUser(conv);
                    const isLastFromMe = conv.last_message?.sender_id === userId;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-muted transition-colors text-left rounded-2xl"
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={getAvatarUrl(otherUser.avatar_url, otherUser.full_name)}
                            alt={otherUser.full_name}
                            className="w-14 h-14 rounded-full object-cover border border-border"
                          />
                          {conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-background">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-base truncate">{otherUser.full_name}</h4>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {conv.last_message ? formatTime(conv.last_message.created_at) : ''}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                            {isLastFromMe && 'You: '}
                            {conv.last_message?.content || 'No messages yet'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
                </main>
                <BottomNav />
              </>
          ) : (
        /* Chat Detail View */
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* Top Bar 64dp */}
            <header className="h-16 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="p-2 -ml-2 text-foreground hover:bg-accent rounded-full transition-colors"
                >
                  <ArrowLeft size={24} strokeWidth={1.5} />
                </button>
                <div className="relative">
                  <img
                    src={getAvatarUrl(getOtherUser(selectedConversation).avatar_url, getOtherUser(selectedConversation).full_name)}
                    alt={getOtherUser(selectedConversation).full_name}
                    className="w-10 h-10 rounded-full object-cover border border-border"
                  />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-base leading-tight">{getOtherUser(selectedConversation).full_name}</h3>
                  <span className="text-[10px] text-green-500 font-medium tracking-wider">ONLINE</span>
                </div>
              </div>
              
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button 
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors"
                    >
                      <MoreVertical size={24} strokeWidth={1.5} />
                    </button>
                  
                  <AnimatePresence>
                    {showMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                          <button
                            onClick={handleDeleteConversation}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={18} />
                            <span className="font-medium">Delete conversation</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </header>

          {/* Messages container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {messagesLoading && messages.length === 0 ? (
              <Loader />
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <MessageCircle size={28} strokeWidth={1.5} />
                </div>
                <p className="font-bold text-lg text-foreground mb-1">No messages yet</p>
                <p className="text-sm">Send a message to start the conversation with {getOtherUser(selectedConversation).full_name}</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.sender_id === userId;
                const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;
                
                return (
                  <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 rounded-[20px] text-sm break-words ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-muted text-foreground rounded-tl-none border border-border/50'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>

            {/* Bottom Bar 64dp */}
            <footer className="h-20 flex items-center gap-3 px-4 pb-safe bg-background border-t border-border">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex-shrink-0">
              <img 
                src={getAvatarUrl(currentUserProfile?.avatar_url, currentUserProfile?.full_name || 'User')} 
                alt="Me" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full flex items-center px-4 py-1.5 border border-border">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder-muted-foreground h-7"
                />
              </div>
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  sending || !messageText.trim()
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                }`}
              >
                {sending ? <Loader centered={false} className="text-current" /> : <Send size={18} strokeWidth={2} />}
              </button>
            </form>
          </footer>
        </div>
      )}
    </div>
  );
}
