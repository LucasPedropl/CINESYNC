"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/src/features/auth/hooks/useAuth";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Send } from "lucide-react";
import Image from "next/image";

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhoto: string;
  createdAt: any;
}

export function Chat({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    const typingQuery = query(collection(db, "rooms", roomId, "typing"));
    const unsubscribe = onSnapshot(typingQuery, (snapshot) => {
      const users = snapshot.docs
        .filter(d => d.id !== user?.uid)
        .map(d => d.data().userName);
      setTypingUsers(users);
    });

    return () => {
      unsubscribe();
      if (user) {
        deleteDoc(doc(db, "rooms", roomId, "typing", user.uid)).catch(() => {});
      }
    };
  }, [roomId, user?.uid, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleTyping = async () => {
    if (!user) return;
    const typingRef = doc(db, "rooms", roomId, "typing", user.uid);
    await setDoc(typingRef, { 
      userName: user.displayName || "Usuário", 
      updatedAt: serverTimestamp() 
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await deleteDoc(typingRef).catch(() => {});
    }, 3000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const text = newMessage.trim();
      setNewMessage(""); 
      
      // Clear typing status immediately on send
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      await deleteDoc(doc(db, "rooms", roomId, "typing", user.uid)).catch(() => {});

      await addDoc(collection(db, "rooms", roomId, "messages"), {
        text,
        userId: user.uid,
        userName: user.displayName || "Usuário",
        userPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Falha ao enviar mensagem");
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
        {messages.map((msg) => {
          const isMe = user?.uid === msg.userId;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/10 shadow-sm mt-4">
                <Image 
                  src={msg.userPhoto} 
                  alt={msg.userName} 
                  width={32} 
                  height={32} 
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </div>
              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[80%]`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 px-1 ${isMe ? "text-purple-400" : "text-white/60"}`}>
                  {msg.userName} {isMe && <span className="text-[8px] bg-purple-500/20 px-1.5 py-0.5 rounded ml-1">VOCÊ</span>}
                </span>
                <div className={`px-5 py-3 rounded-3xl text-sm shadow-xl backdrop-blur-md ${isMe ? "bg-gradient-to-br from-purple-600/20 to-pink-600/10 text-white border border-purple-500/20 rounded-tr-none" : "bg-white/5 text-white/90 border border-white/10 rounded-tl-none"}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-white/40 text-[10px] font-medium italic animate-pulse px-2">
            <div className="flex gap-1">
              <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce"></span>
            </div>
            {typingUsers.length === 1 ? `${typingUsers[0]} está digitando...` : `${typingUsers.length} pessoas estão digitando...`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/5 bg-transparent shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          <div className="flex-1 bg-black/40 rounded-full px-5 py-3 border border-white/10 flex items-center gap-3 focus-within:border-purple-500/50 transition-all shadow-inner">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Digite uma mensagem..."
              className="bg-transparent outline-none flex-1 text-sm text-white/90 placeholder:text-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 disabled:opacity-30 disabled:hover:bg-purple-600/20 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
          >
            <Send className="w-5 h-5 text-purple-400" />
          </button>
        </form>
      </div>
    </div>
  );
}

