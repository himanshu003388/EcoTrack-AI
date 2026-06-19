import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../main';
import { MessageSquareText, Send, Sparkles, User } from 'lucide-react';

interface ChatMessage {
  id: number;
  sender: 'user' | 'coach';
  text: string;
  insights?: string[] | undefined;
  suggestions?: string[] | undefined;
}

export const Coach: React.FC = () => {
  const { token, user } = useAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return (): void => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setMessages([
        {
          id: 1,
          sender: 'coach',
          text: `Hello, ${user.username}! I am your AI Eco Coach.\n\nI can analyze your carbon logs, recommend simple actions, explain your footprint, and help you find savings. What would you like help with today?`,
          suggestions: [
            'How can I reduce transport emissions?',
            'Give me 3 simple actions to try today',
            'Analyze my carbon logs stats',
            'What is the biggest impact I can make?'
          ]
        }
      ]);
    }
  }, [user]);

  const scrollToBottom = (): void => {
    try {
      if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      // scrollIntoView may not be available in all environments
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string): Promise<void> => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text: textToSend
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: textToSend })
      });
      const data = (await res.json()) as { reply: string; insights?: string[]; suggestions?: string[] };
      if (res.ok) {
        const coachMsg: ChatMessage = {
          id: Date.now() + 1,
          sender: 'coach',
          text: data.reply,
          insights: data.insights,
          suggestions: data.suggestions
        };
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setMessages(prev => [...prev, coachMsg]);
          setLoading(false);
        }, 600);
      } else {
        throw new Error('Chat failed');
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'coach',
          text: "I'm having trouble connecting to the network right now. Please make sure you are logged in or try again in a moment!"
        }
      ]);
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void handleSendMessage(inputMessage);
  };

  return (
    <section className="flex flex-col min-h-[calc(100dvh-8rem)] bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[32px] shadow-sm overflow-hidden transition-colors duration-200" aria-label="AI Eco Coach Chat">
      <header className="px-6 py-4 bg-white dark:bg-forest-900 border-b border-slate-100 dark:border-forest-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-500 text-white shadow-md shadow-forest-500/10">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display font-bold text-slate-800 dark:text-white">Eco Coach AI</h2>
            <span className="text-[10px] font-bold text-forest-600 dark:text-forest-400 uppercase tracking-wider flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
              Active Sustainability Expert
            </span>
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-forest-950/30"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
              msg.sender === 'user' ? 'bg-slate-200 dark:bg-forest-700 text-slate-600 dark:text-slate-300' : 'bg-forest-500 text-white'
            }`} aria-hidden="true">
              {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>

            <div className="space-y-3">
              <div className={`p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-line shadow-sm border ${
                msg.sender === 'user'
                  ? 'bg-forest-500 text-white border-forest-600 rounded-tr-none'
                  : 'bg-white dark:bg-forest-800 text-slate-800 dark:text-slate-200 border-slate-100 dark:border-forest-700 rounded-tl-none'
              }`}>
                {msg.text}
              </div>

              {msg.insights && msg.insights.length > 0 && (
                <div className="space-y-1.5 pl-2" role="list" aria-label="Insights">
                  {msg.insights.map((ins, idx) => (
                    <div key={idx} className="flex gap-1.5 items-start text-[11px] font-semibold text-slate-500 dark:text-slate-400" role="listitem">
                      <span className="text-forest-500 shrink-0" aria-hidden="true">✦</span>
                      <p>{ins}</p>
                    </div>
                  ))}
                </div>
              )}

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1.5" role="group" aria-label="Suggested topics">
                  {msg.suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => { void handleSendMessage(sug); }}
                      className="px-3.5 py-1.5 bg-white dark:bg-forest-800 hover:bg-forest-50 dark:hover:bg-forest-700 border border-slate-200/60 dark:border-forest-700 hover:border-forest-200 dark:hover:border-forest-600 text-slate-600 dark:text-slate-300 hover:text-forest-700 dark:hover:text-forest-300 rounded-full text-xs font-semibold transition-all duration-200 shadow-sm"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-[75%]" aria-label="Coach is typing" role="status">
            <div className="h-8 w-8 rounded-full bg-forest-500 text-white shrink-0 flex items-center justify-center" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="p-4 bg-white dark:bg-forest-800 border border-slate-100 dark:border-forest-700 rounded-3xl rounded-tl-none flex items-center gap-1.5 shadow-sm" aria-hidden="true">
              <span className="h-2 w-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
              <span className="h-2 w-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="h-2 w-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
            <span className="sr-only">Eco Coach is generating a response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="p-4 bg-white dark:bg-forest-900 border-t border-slate-100 dark:border-forest-800">
        <form onSubmit={handleSubmit} className="flex gap-2" role="form" aria-label="Message input">
          <label htmlFor="coach-input" className="sr-only">Ask your Eco Coach a question</label>
          <input
            id="coach-input"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask your Eco Coach a question..."
            className="flex-1 px-4 py-3 border border-slate-200 dark:border-forest-700 rounded-2xl text-sm focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500 bg-white dark:bg-forest-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            disabled={loading}
            aria-disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="p-3 bg-forest-500 hover:bg-forest-600 text-white rounded-2xl transition-colors disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </footer>
    </section>
  );
};
