"use client";

import { useEffect, useRef, useState } from "react";
import { RoomData } from "./RoomComponent";
import { db } from "@/src/lib/firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { Cast, Loader2, ShieldAlert } from "lucide-react";

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
  
  // Keep references to peer connections
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const localStream = useRef<MediaStream | null>(null);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser", 
        },
        audio: {
          suppressLocalAudioPlayback: false,
        } as any
      });
      
      localStream.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setIsStreaming(true);
      setConnectionStatus("Transmitindo...");

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      // Now that we have a stream, signal readiness to any waiting peers
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
    
    // Clean up connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
  };

  // Full WebRTC Signaling Logic
  useEffect(() => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    if (isHost) {
      // HOST LOGIC
      if (!isStreaming) return;

      const peersRef = collection(db, "rooms", roomId, "peers");
      
      const unsubscribe = onSnapshot(peersRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const peerId = change.doc.id;
            // Ignore ourselves just in case
            if (peerId === userId) return;
            
            console.log("Host viu que um novo Peer se registrou:", peerId);
            
            const pc = new RTCPeerConnection(configuration);
            peerConnections.current[peerId] = pc;

            // Add local stream tracks to connection
            if (localStream.current) {
              localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current!);
              });
            }

            // Listen for ICE candidates and send them to Firebase
            pc.onicecandidate = async (event) => {
              if (event.candidate) {
                await addDoc(collection(db, "rooms", roomId, "peers", peerId, "hostCandidates"), event.candidate.toJSON());
              }
            };

            // Create Offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Send offer
            await updateDoc(doc(db, "rooms", roomId, "peers", peerId), {
              offer: {
                type: offer.type,
                sdp: offer.sdp
              }
            });

            // Listen for Answer
            onSnapshot(doc(db, "rooms", roomId, "peers", peerId), (docSnap) => {
              const data = docSnap.data();
              if (!pc.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.setRemoteDescription(answerDescription);
                setConnectionStatus("Conectado a espectadores");
              }
            });

            // Listen for Peer candidates
            onSnapshot(collection(db, "rooms", roomId, "peers", peerId, "peerCandidates"), (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                  const candidate = new RTCIceCandidate(change.doc.data());
                  pc.addIceCandidate(candidate);
                }
              });
            });

            pc.onconnectionstatechange = () => {
              console.log("Host connection state with", peerId, ":", pc.connectionState);
            };
          }
        });
      });

      return () => unsubscribe();
      
    } else {
      // PEER LOGIC -> Viewer connecting to host
      const pc = new RTCPeerConnection(configuration);
      let unregistered = false;

      const peerDocRef = doc(db, "rooms", roomId, "peers", userId);

      const setupViewer = async () => {
        setConnectionStatus("Conectando ao anfitrião...");
        
        // Register myself as a peer waiting for stream
        await setDoc(peerDocRef, { timestamp: new Date() });

        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await addDoc(collection(db, "rooms", roomId, "peers", userId, "peerCandidates"), event.candidate.toJSON());
          }
        };

        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            setConnectionStatus("Sintonizado");
          }
        };

        pc.onconnectionstatechange = () => {
          setConnectionStatus(`Status: ${pc.connectionState}`);
        };

        // Listen for Host Offer
        onSnapshot(peerDocRef, async (docSnap) => {
          if (unregistered) return;
          const data = docSnap.data();
          if (!pc.currentRemoteDescription && data?.offer) {
            const offerDescription = new RTCSessionDescription(data.offer);
            await pc.setRemoteDescription(offerDescription);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await updateDoc(peerDocRef, {
              answer: {
                type: answer.type,
                sdp: answer.sdp
              }
            });
          }
        });

        // Listen for Host Candidates
        onSnapshot(collection(db, "rooms", roomId, "peers", userId, "hostCandidates"), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate);
            }
          });
        });
      };

      setupViewer();

      return () => {
        unregistered = true;
        pc.close();
        if (videoRef.current) videoRef.current.srcObject = null;
      };
    }
  }, [isHost, isStreaming, roomId, userId]);

  return (
    <div className="w-full h-full relative flex items-center justify-center group bg-[#0A0A0A]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost} // O host nÃ£o precisa ouvir o prÃ³prio Ã¡udio pra nÃ£o dar eco
        className="absolute inset-0 w-full h-full object-contain z-10"
      />
      
      {!isStreaming && isHost && (
        <div className="z-20 flex flex-col items-center text-center p-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <Cast className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Iniciar Transmissão</h2>
          <p className="text-white/60 text-sm max-w-sm mb-8 leading-relaxed">
            Selecione a guia do navegador ou aplicativo para compartilhar. Se for Netflix, lembre-se de compartilhar <b className="text-white">a Guia do Chrome</b> para que o áudio funcione corretamente.
          </p>
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
        <div className="z-20 flex flex-col items-center">
           <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
           <p className="text-white/70 font-mono text-sm tracking-widest uppercase">{connectionStatus}</p>
        </div>
      )}

      {/* Floating Status UI */}
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
