"use client";

import { useEffect, useRef, useState } from "react";
import YouTube, { YouTubeProps, YouTubePlayer } from "react-youtube";
import { RoomData } from "./RoomComponent";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { Youtube } from "lucide-react";

interface VideoSyncProps {
  room: RoomData;
  roomId: string;
  userId: string;
}

export function VideoSync({ room, roomId, userId }: VideoSyncProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const isHost = room.hostId === userId;
  
  // Track last known server state to avoid echo updates
  const lastStateRef = useRef({ isPlaying: room.isPlaying, currentTime: room.currentTime });

  const extractYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSetVideo = async () => {
    const id = extractYouTubeId(inputUrl);
    if (!id) return alert("URL inválida");
    await updateDoc(doc(db, "rooms", roomId), {
      videoId: id,
      updatedAt: serverTimestamp(),
    });
  };

  const onPlayerReady: YouTubeProps['onReady'] = (e) => {
    playerRef.current = e.target;
    setIsReady(true);
    
    // Initial sync
    e.target.seekTo(room.currentTime, true);
    if (room.isPlaying) {
      e.target.playVideo();
    } else {
      e.target.pauseVideo();
    }
  };

  // Listen to Server Changes (Effect)
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const player = playerRef.current;
    
    const timeDiff = Math.abs((player.getCurrentTime() || 0) - room.currentTime);
    const stateHasChanged = lastStateRef.current.isPlaying !== room.isPlaying || timeDiff > 2;

    if (stateHasChanged) {
       // Only seek if difference is significant
       if (timeDiff > 2) {
          player.seekTo(room.currentTime, true);
       }
       
       if (room.isPlaying) {
         player.playVideo();
       } else {
         player.pauseVideo();
       }
       
       lastStateRef.current = {
         isPlaying: room.isPlaying,
         currentTime: room.currentTime,
       };
    }
  }, [room.isPlaying, room.currentTime, room.updatedAt, isReady]);

  // Handle Host Player Events
  const handleHostPlay = async (e: any) => {
    if (!isHost) return;
    const time = e.target.getCurrentTime();
    
    if (!lastStateRef.current.isPlaying || Math.abs(lastStateRef.current.currentTime - time) > 1) {
      lastStateRef.current = { isPlaying: true, currentTime: time };
      await updateDoc(doc(db, "rooms", roomId), {
        isPlaying: true,
        currentTime: time,
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleHostPause = async (e: any) => {
    if (!isHost) return;
    const time = e.target.getCurrentTime();
    
    if (lastStateRef.current.isPlaying || Math.abs(lastStateRef.current.currentTime - time) > 1) {
      lastStateRef.current = { isPlaying: false, currentTime: time };
      await updateDoc(doc(db, "rooms", roomId), {
        isPlaying: false,
        currentTime: time,
        updatedAt: serverTimestamp(),
      });
    }
  };

  // Sync intervals for host
  useEffect(() => {
    if (!isHost || !isReady || !playerRef.current) return;
    
    // Periodically update the server with the current time (every 5 seconds) to keep late joiners in sync
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && lastStateRef.current.isPlaying) {
        const time = player.getCurrentTime();
        updateDoc(doc(db, "rooms", roomId), {
          currentTime: time,
          updatedAt: serverTimestamp(),
        });
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isHost, isReady, roomId]);

  // Non-hosts can't control the video
  const handleNonHostStateChange = (e: any) => {
    if (isHost) return;
    
    // If a non-host tries to play/pause, revert them to server state
    const playerState = e.data;
    const PLAYING = 1;
    const PAUSED = 2;
    
    if (playerState === PLAYING && !room.isPlaying) {
      e.target.pauseVideo();
    } else if (playerState === PAUSED && room.isPlaying) {
      e.target.playVideo();
    }
  };

  if (!room.videoId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#0A0A0A]">
        <div className="w-16 h-16 rounded-full bg-red-600/20 flex flex-col items-center justify-center mb-6">
           <Youtube className="w-8 h-8 text-red-500" />
        </div>
        {isHost ? (
          <div className="max-w-md w-full flex flex-col gap-4 text-center">
            <h2 className="text-xl font-bold text-white tracking-tight">Adicionar Vídeo do YouTube</h2>
            <p className="text-sm text-white/50 mb-2">Cole a URL do vídeo que deseja assistir com seus amigos.</p>
            <div className="flex gap-2">
              <input 
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-red-500 transition-shadow"
              />
              <button 
                onClick={handleSetVideo}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-[0_0_20px_rgba(220,38,38,0.3)] shrink-0"
              >
                Carregar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
             <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Aguardando o Anfitrião</h2>
             <p className="text-sm text-white/50">O anfitrião está escolhendo o vídeo...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group bg-black">
      {/* Non-host blocker overlay to prevent them from clicking the player directly */}
      {!isHost && (
        <div className="absolute inset-0 z-10" title="Apenas o anfitrião pode controlar o vídeo." />
      )}
      {isHost && (
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => updateDoc(doc(db, "rooms", roomId), { videoId: "" })}
            className="bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Trocar Vídeo
          </button>
        </div>
      )}
      <YouTube
        videoId={room.videoId}
        opts={{
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: isHost ? 1 : 0,
            modestbranding: 1,
            rel: 0,
            disablekb: isHost ? 0 : 1,
          },
        }}
        onReady={onPlayerReady}
        onPlay={isHost ? handleHostPlay : undefined}
        onPause={isHost ? handleHostPause : undefined}
        onStateChange={handleNonHostStateChange}
        className="absolute inset-0 w-full h-full"
        iframeClassName="w-full h-full object-contain"
      />
    </div>
  );
}
