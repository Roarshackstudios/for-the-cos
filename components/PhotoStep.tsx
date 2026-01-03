import React, { useRef, useState } from 'react';

interface PhotoStepProps {
  onPhotoSelected: (base64: string) => void;
}

const PhotoStep: React.FC<PhotoStepProps> = ({ onPhotoSelected }) => {
  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Camera failed!");
      setUseCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setUseCamera(false);
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        stopCamera();
        onPhotoSelected(dataUrl);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onPhotoSelected(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-16">
      {!useCamera ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl">
          <button 
            onClick={startCamera}
            className="flex flex-col items-center justify-center p-20 bg-[#e21c23] text-white border-8 border-black shadow-[15px_15px_0px_#660000] hover:scale-105 hover:-translate-y-2 transition-all group"
          >
            <div className="w-32 h-32 rounded-full bg-black flex items-center justify-center mb-8 border-4 border-white">
                <i className="fa-solid fa-camera text-6xl text-[#fde910]"></i>
            </div>
            <span className="font-comic text-5xl uppercase italic tracking-wider">TAKE A PHOTO!</span>
            <p className="text-lg font-bold uppercase mt-4 opacity-70">USE YOUR DEVICE LENS</p>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-20 bg-[#fde910] text-black border-8 border-black shadow-[15px_15px_0px_#660000] hover:scale-105 hover:-translate-y-2 transition-all group"
          >
            <div className="w-32 h-32 rounded-full bg-black flex items-center justify-center mb-8 border-4 border-white">
                <i className="fa-solid fa-file-export text-6xl text-[#e21c23]"></i>
            </div>
            <span className="font-comic text-5xl uppercase italic tracking-wider">UPLOAD HERO!</span>
            <p className="text-lg font-bold uppercase mt-4 opacity-70">SELECT FROM LIBRARY</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-3xl bg-white border-8 border-black shadow-[25px_25px_0px_#660000] overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full aspect-[3/4] object-cover border-b-8 border-black"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-8 border-[#e21c23] rounded-full opacity-40 pointer-events-none animate-pulse"></div>
          
          <div className="flex justify-center space-x-12 p-10">
            <button 
              onClick={stopCamera}
              className="action-btn-red text-2xl !bg-zinc-800"
            >
              CANCEL
            </button>
            <button 
              onClick={takePhoto}
              className="action-btn-yellow text-4xl transform scale-125 animate-kaboom"
            >
              SNAP!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoStep;