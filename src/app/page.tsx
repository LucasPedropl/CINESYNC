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
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
          <p className="text-sm text-white/50 tracking-widest uppercase">Carregando</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-lg flex flex-col items-center bg-white/[0.03] backdrop-blur-[30px] border border-white/10 p-12 rounded-[32px] shadow-2xl">
          <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-red-500 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.4)] mb-8">
            <LogInIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-black mb-4 tracking-tighter text-white">CINE<span className="text-purple-400">SYNC</span></h1>
          <p className="text-white/60 mb-10 text-center text-lg leading-relaxed">
            Assista YouTube e transmita sua tela perfeitamente sincronizada com seus amigos.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-4 rounded-full font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            INICIAR SESSÃO COM GOOGLE
          </button>
          <p className="text-[10px] text-white/40 mt-10 text-center uppercase tracking-widest leading-relaxed">
            * Para Netflix e Prime Video, recomendamos transmitir a guia do navegador.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateRoom = async () => {
    setIsCreating(true);
    
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        videoId: "",
        sourceType: "youtube",
        streamActive: false,
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
      <div className="text-center mb-12 animate-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-5xl font-black mb-2 tracking-tighter">
          Bem-vindo, <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-red-400">{user.displayName?.split(" ")[0]}</span>
        </h1>
        <p className="text-white/60 text-lg">O que vamos assistir hoje?</p>
      </div>
      
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[32px] flex flex-col gap-6 backdrop-blur-[30px] hover:bg-white/[0.04] transition-colors group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-transparent opacity-50"></div>
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Plus className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              Criar Nova Sala
            </h2>
            <p className="text-white/50 leading-relaxed font-light">Seja o anfitrião. Crie uma sala, escolha o conteúdo e compartilhe o link com seus amigos.</p>
          </div>
          <div className="mt-auto pt-4">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold tracking-widest uppercase text-sm py-4 rounded-full transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] active:scale-[0.98]"
            >
              {isCreating ? "CRIANDO..." : "CRIAR SALA"}
            </button>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[32px] flex flex-col gap-6 backdrop-blur-[30px] hover:bg-white/[0.04] transition-colors group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-red-500 to-transparent opacity-50"></div>
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Search className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              Entrar em Sala
            </h2>
            <p className="text-white/50 leading-relaxed font-light">Cole o ID da sala enviado por um amigo para participar imediatamente da sessão.</p>
          </div>
          <div className="mt-auto pt-4 flex flex-col gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: abCDeFgHIJ123"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-full px-6 py-4 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={!roomIdInput.trim()}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 border border-white/5 text-white font-bold tracking-widest uppercase text-sm py-4 rounded-full transition-all active:scale-[0.98]"
            >
              ENTRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
