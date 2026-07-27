import { useEffect, useRef, useState } from 'react';
import { streamDraftAdvice } from '../api/client';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function DraftAssistant({ context }: { context: unknown }) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      for await (const chunk of streamDraftAdvice({ history, context, question })) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="draft-assistant">
      <h4>Draft Assistant</h4>
      <div className="chat-window">
        {messages.length === 0 && (
          <p className="chat-empty">
            Ask things like "who should I draft next?", "should I grab a goalie now?", or
            "compare my top two options at defense."
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            {m.content || (loading && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Ask the draft assistant..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
