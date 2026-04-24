"use client";

import { useEffect, useRef, useState } from "react";
import { RoomData } from "./RoomComponent";
import { db } from "@/src/lib/firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Cast, Loader2 } from "lucide-react";

interface ScreenStreamProps {
  room: RoomData;
  roomId: string;
  userId: string;
}

export function ScreenStream({ room, roomId, userId }: ScreenStreamProps) {
  const isHost = room.hostId === userId;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Desconectado");
  
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const localStream = useRef<MediaStream | null>(null);
  const peerStream = useRef<MediaStream | null>(null);
  const sessionId = useRef(Math.random().toString(36).substring(2, 10));

  useEffect(() => {
    // Sincroniza refs de video na re-renderização
    if (videoRef.current) {
      if (isHost && isStreaming && localStream.current) {
        if (videoRef.current.srcObject !== localStream.current) {
          videoRef.current.srcObject = localStream.current;
        }
      } else if (!isHost && room.streamActive && peerStream.current) {
        if (videoRef.current.srcObject !== peerStream.current) {
          videoRef.current.srcObject = peerStream.current;
        }
      } else if (!isHost && !room.streamActive) {
        videoRef.current.srcObject = null;
      }
    }
  }, [isHost, isStreaming, room.streamActive]);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      localStream.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
      
      setIsStreaming(true);
      setConnectionStatus("Transmitindo...");

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      await updateDoc(doc(db, "rooms", roomId), {
        streamActive: true
      });

    } catch (err) {
      console.error("Erro ao iniciar transmissão", err);
      setError("Permissão negada ou erro ao capturar tela.");
    }
  };

  const stopScreenShare = async () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    localStream.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setConnectionStatus("Parado");
    
    await updateDoc(doc(db, "rooms", roomId), {
      streamActive: false
    });
    
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
  };

  useEffect(() => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    };

    if (isHost) {
      if (!isStreaming) return;

      const peersRef = collection(db, "rooms", roomId, "peers");
      
      const unsubscribe = onSnapshot(peersRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const peerId = change.doc.id;
            if (peerId === userId) return;
            
            console.log("Host detectou um novo espectador:", peerId);
            
            const pc = new RTCPeerConnection(configuration);
            peerConnections.current[peerId] = pc;
            
            const peerCandidatesQueue: RTCIceCandidateInit[] = [];

            if (localStream.current) {
              localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current!);
              });
            }

            pc.onicecandidate = async (event) => {
              if (event.candidate) {
                await addDoc(collection(db, "rooms", roomId, "peers", peerId, "hostCandidates"), event.candidate.toJSON());
              }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await updateDoc(doc(db, "rooms", roomId, "peers", peerId), {
              offer: { type: offer.type, sdp: offer.sdp }
            });

            onSnapshot(doc(db, "rooms", roomId, "peers", peerId), async (docSnap) => {
              const data = docSnap.data();
              if (data?.answer && pc.signalingState !== "closed") {
                if (!pc.currentRemoteDescription) {
                  const answerDescription = new RTCSessionDescription(data.answer);
                  await pc.setRemoteDescription(answerDescription);
                  setConnectionStatus("Conectado a espectadores");
                  
                  peerCandidatesQueue.forEach(candidate => {
                    pc.addIceCandidate(candidate).catch(e => console.error("Erro adicionando candidato em fila:", e));
                  });
                  peerCandidatesQueue.length = 0;
                }
              }
            });

            onSnapshot(collection(db, "rooms", roomId, "peers", peerId, "peerCandidates"), (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                  const candidate = new RTCIceCandidate(change.doc.data());
                  if (pc.remoteDescription) {
                    pc.addIceCandidate(candidate).catch(console.error);
                  } else {
                    peerCandidatesQueue.push(candidate);
                  }
                }
              });
            });

            pc.onconnectionstatechange = () => {
              console.log("Status de conexão do host com", peerId, ":", pc.connectionState);
            };
          }
        });
      });

      return () => {
        unsubscribe();
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
      };
      
    } else {
      if (!room.streamActive) {
        setConnectionStatus("Aguardando o anfitrião iniciar...");
        if (videoRef.current) videoRef.current.srcObject = null;
        peerStream.current = null;
        return;
      }

      const pc = new RTCPeerConnection(configuration);
      let unregistered = false;
      const myPeerId = `${userId}_${sessionId.current}`;
      const peerDocRef = doc(db, "rooms", roomId, "peers", myPeerId);
      const videoRefLocal = videoRef.current;

      const setupViewer = async () => {
        setConnectionStatus("Conectando ao anfitrião...");
        
        const hostCandidatesQueue: RTCIceCandidateInit[] = [];
        
        await setDoc(peerDocRef, { timestamp: new Date(), userId });

        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await addDoc(collection(db, "rooms", roomId, "peers", myPeerId, "peerCandidates"), event.candidate.toJSON());
          }
        };

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            peerStream.current = event.streams[0];
            if (videoRef.current) {
              videoRef.current.srcObject = event.streams[0];
              videoRef.current.play().catch(console.error);
              setConnectionStatus("Sintonizado");
            }
          }
        };

        pc.onconnectionstatechange = () => {
          setConnectionStatus(`Status: ${pc.connectionState}`);
        };

        onSnapshot(peerDocRef, async (docSnap) => {
          if (unregistered) return;
          const data = docSnap.data();
          if (!pc.currentRemoteDescription && data?.offer) {
            const offerDescription = new RTCSessionDescription(data.offer);
            await pc.setRemoteDescription(offerDescription);
            
            hostCandidatesQueue.forEach(candidate => {
              pc.addIceCandidate(candidate).catch(console.error);
            });
            hostCandidatesQueue.length = 0;
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await updateDoc(peerDocRef, {
              answer: { type: answer.type, sdp: answer.sdp }
            });
          }
        });

        onSnapshot(collection(db, "rooms", roomId, "peers", myPeerId, "hostCandidates"), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              if (pc.remoteDescription) {
                pc.addIceCandidate(candidate).catch(console.error);
              } else {
                hostCandidatesQueue.push(candidate);
              }
            }
          });
        });
      };

      setupViewer();

      return () => {
        unregistered = true;
        pc.close();
        if (videoRefLocal) videoRefLocal.srcObject = null;
        peerStream.current = null;
        deleteDoc(peerDocRef).catch(() => {});
      };
    }
  }, [isHost, isStreaming, room.streamActive, roomId, userId]);

  return (
    <div className="w-full h-full relative flex items-center justify-center group bg-[#0A0A0A]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost}
        className="absolute inset-0 w-full h-full object-contain z-10"
      />
      
      {!isStreaming && isHost && (
        <div className="z-20 flex flex-col items-center text-center p-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <Cast className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Iniciar Transmissão</h2>
          <p className="text-white/60 text-sm max-w-sm mb-4 leading-relaxed">
            Selecione a guia ou aplicativo para compartilhar.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-8 max-w-sm text-left">
            <p className="text-white/80 text-xs leading-relaxed">
              <strong className="text-red-400">Aviso para Netflix/Prime Video:</strong> Para evitar tela preta, vá nas configurações do seu navegador e <strong>desative a "Aceleração de Hardware"</strong> e reinicie-o. Para ter áudio na transmissão, sempre compartilhe uma <strong className="text-white">Guia do Chrome / Navegador</strong>.
            </p>
          </div>
          <button 
            onClick={startScreenShare}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)]"
          >
            Escolher Tela / Guia
          </button>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>
      )}

      {!isHost && connectionStatus !== "Sintonizado" && (
        <div className="z-20 flex flex-col items-center p-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl">
           <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
           <p className="text-white/70 font-mono text-sm tracking-widest uppercase text-center max-w-xs">{connectionStatus}</p>
        </div>
      )}

      <div className="absolute top-4 left-4 flex gap-2 z-30">
        {isHost && isStreaming ? (
           <span className="px-3 py-1 bg-red-600 text-[10px] font-bold rounded uppercase tracking-widest shadow-[0_0_10px_rgba(220,38,38,0.5)] animate-pulse">
             Você está ao vivo
           </span>
        ) : !isHost && connectionStatus === "Sintonizado" ? (
           <span className="px-3 py-1 bg-green-600 text-[10px] font-bold rounded uppercase tracking-widest shadow-[0_0_10px_rgba(22,163,74,0.5)]">
             Recebendo Imagem
           </span>
        ) : null}
      </div>
      
      {isHost && isStreaming && (
        <button 
          onClick={stopScreenShare}
          className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
        >
          Parar Transmissão
        </button>
      )}
    </div>
  );
}
