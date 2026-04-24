"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/src/features/auth/hooks/useAuth";
import { db } from "@/src/lib/firebase";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { VideoSync } from "./VideoSync";
import { ScreenStream } from "./ScreenStream";
import { Chat } from "./Chat";
import { Copy, Loader2, ArrowLeft, MonitorPlay, Youtube } from "lucide-react";
import Link from "next/link";

export interface RoomData {
  videoId: string;
  sourceType?: 'youtube' | 'stream';
  streamActive?: boolean;
  isPlaying: boolean;
  currentTime: number;
  hostId: string;
  updatedAt: any;
}

export function RoomComponent({ roomId }: { roomId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }

    const roomRef = doc(db, "rooms", roomId);
    
    getDoc(roomRef).then((snapshot) => {
      if (!snapshot.exists()) {
        alert("Sala não encontrada.");
        router.push("/");
      }
    });

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RoomData;
        setRoom({ ...data, sourceType: data.sourceType || 'youtube' });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, user, authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!room || !user) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copiado!");
  };
  
  const isHost = room.hostId === user.uid;

  const changeSource = async (type: 'youtube' | 'stream') => {
    if (!isHost) return;
    await updateDoc(doc(db, "rooms", roomId), { sourceType: type });
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-col h-screen bg-transparent p-4 lg:p-6 gap-4 lg:gap-6 overflow-hidden">
      {/* Top Header */}
      <header className="h-16 px-4 lg:px-8 flex items-center justify-between border border-white/10 rounded-2xl bg-black/40 backdrop-blur-md shadow-2xl shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 hover:bg-white/10 rounded-xl text-white backdrop-blur-sm transition-colors flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tighter">CINE<span className="text-purple-400">SYNC</span></h1>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
            <span className="text-xs font-mono text-white/70 tracking-widest uppercase">Room: {roomId}</span>
          </div>
          <button 
            onClick={handleCopyLink}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-sm font-semibold rounded-lg transition-colors shadow-[0_0_20px_rgba(147,51,234,0.3)] flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Convidar</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-hidden">
        {/* Top: Player */}
        <div className="flex-[2] relative bg-black rounded-2xl border border-white/5 shadow-2xl overflow-hidden group min-h-[40vh]">
          {room.sourceType === 'stream' ? (
             <ScreenStream room={room} roomId={roomId} userId={user.uid} />
          ) : (
             <VideoSync room={room} roomId={roomId} userId={user.uid} />
          )}
        </div>

        {/* Bottom Section: Controls & Chat */}
        <div className="flex-1 min-h-[40vh] lg:h-64 flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Streaming Selection Card */}
          <div className="w-full lg:w-72 bg-white/5 rounded-2xl border border-white/10 p-5 flex flex-col gap-4 backdrop-blur-sm shrink-0 overflow-y-auto">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
              {isHost ? "Selecionar Fonte" : "Fonte Atual"}
            </h3>
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div 
                onClick={() => changeSource('youtube')}
                className={`border rounded-xl flex flex-col items-center justify-center gap-2 p-3 transition-all text-center ${
                  room.sourceType !== 'stream' 
                    ? 'bg-red-600/20 border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]' 
                    : 'bg-white/5 border-white/10 opacity-50 hover:opacity-100 hover:bg-white/10 cursor-pointer'
                } ${!isHost ? 'pointer-events-none' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                  <Youtube className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-bold">YouTube</span>
              </div>
              
              <div 
                onClick={() => changeSource('stream')}
                className={`border rounded-xl flex flex-col items-center justify-center gap-2 p-3 transition-all text-center ${
                  room.sourceType === 'stream' 
                    ? 'bg-purple-600/20 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                    : 'bg-white/5 border-white/10 opacity-50 hover:opacity-100 hover:bg-white/10 cursor-pointer'
                } ${!isHost ? 'pointer-events-none' : ''}`}
                title="Transmita arquivos do PC ou Netflix da sua aba"
              >
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                  <MonitorPlay className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-bold">Transmitir Tela</span>
              </div>
            </div>
            {isHost && (
              <p className="text-[10px] text-white/40 text-center uppercase tracking-widest mt-2 leading-relaxed font-bold">
                * Para ver filme do PC, abra no navegador e transmita a aba.
              </p>
            )}
          </div>

          {/* Chat Container */}
          <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 flex flex-col backdrop-blur-sm shadow-inner overflow-hidden">
            <Chat roomId={roomId} />
          </div>
        </div>
      </div>
    </div>
  );
}
