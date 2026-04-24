"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/src/features/auth/hooks/useAuth";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit } from "firebase/firestore";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const text = newMessage.trim();
      setNewMessage(""); // Optimistic clear
      
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
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 mask-fade-top">
        {messages.map((msg) => {
          const isMe = user?.uid === msg.userId;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                <Image 
                  src={msg.userPhoto} 
                  alt={msg.userName} 
                  width={32} 
                  height={32} 
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </div>
              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%]`}>
                <span className={`text-xs font-bold ${isMe ? "text-purple-400" : "text-blue-400"}`}>
                  {msg.userName} {isMe && <span className="text-[9px] bg-purple-500/20 px-1 rounded ml-1 tracking-widest uppercase">Me</span>}
                </span>
                <p className="text-sm text-white/80">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/5 bg-transparent">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          <div className="flex-1 bg-black/40 rounded-xl px-4 py-3 border border-white/10 flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Diga algo..."
              className="bg-transparent outline-none flex-1 text-sm text-white/70 placeholder:text-white/20"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl flex items-center justify-center transition-all shrink-0"
          >
            <Send className="w-5 h-5 text-purple-400" />
          </button>
        </form>
      </div>
    </div>
  );
}
