"use client";

import { useAuth } from "@/src/features/auth/hooks/useAuth";
import { LogIn, Plus, LogInIcon, Search } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function extractYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function Home() {
  const { user, signInWithGoogle, loading } = useAuth();
  const [videoUrl, setVideoUrl] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)] mb-6">
          <LogInIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tighter text-white">CINE<span className="text-purple-400">SYNC</span></h1>
        <p className="text-white/60 mb-8 max-w-md text-center">
          Assista YouTube sincronizado com seus amigos. Para começar, faça login com sua conta do Google.
        </p>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-500 transition-colors shadow-[0_0_20px_rgba(147,51,234,0.3)]"
        >
          <LogIn className="w-5 h-5" />
          Entrar com Google
        </button>
        <p className="text-[10px] text-white/40 mt-8 max-w-xs text-center uppercase tracking-widest leading-relaxed">
          * Atualmente suportamos apenas YouTube devido às rigorosas políticas de DRM da Netflix, Prime Video e Disney+.
        </p>
      </div>
    );
  }

  const handleCreateRoom = async () => {
    setIsCreating(true);
    
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        videoId: "",
        sourceType: "youtube",
        isPlaying: false,
        currentTime: 0,
        hostId: user.uid,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      
      router.push(`/room/${roomRef.id}`);
    } catch (error) {
      console.error("Erro ao criar sala:", error);
      alert("Erro ao criar sala.");
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!roomIdInput.trim()) return alert("Insira o ID da sala.");
    router.push(`/room/${roomIdInput.trim()}`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 tracking-tighter">Olá, <span className="text-purple-400">{user.displayName}</span></h1>
      
      <div className="w-full max-w-md space-y-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 backdrop-blur-sm">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-purple-400" />
            Criar Nova Sala
          </h2>
          <p className="text-sm text-white/50 mb-2">Crie uma sala e convide seus amigos. Você poderá escolher o que assistir lá dentro.</p>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
          >
            {isCreating ? "Criando..." : "Criar Sala"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-[10px] tracking-widest uppercase font-bold text-white/30">
            <span className="bg-[#050505] px-2 relative z-10">Ou</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 backdrop-blur-sm">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Search className="w-5 h-5 text-blue-400" />
            Entrar em uma Sala
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ID da Sala"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <button
              onClick={handleJoinRoom}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-[0_0_20px_rgba(37,99,235,0.3)]"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
