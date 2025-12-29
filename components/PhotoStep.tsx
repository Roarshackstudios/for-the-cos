
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
      alert("Could not access camera. Please check permissions.");
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-orbitron font-bold tracking-widest text-blue-500">INITIATE COSPLAY</h2>
        <p className="text-gray-400 max-w-md mx-auto">Upload your masterpiece or capture your moment to begin the transformation.</p>
      </div>

      {!useCamera ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button 
            onClick={startCamera}
            className="flex flex-col items-center justify-center p-12 bg-zinc-900 border-2 border-dashed border-blue-500/30 rounded-3xl hover:border-blue-500 hover:bg-zinc-800 transition-all group"
          >
            <i className="fa-solid fa-camera text-5xl mb-4 text-blue-500 group-hover:scale-110 transition-transform"></i>
            <span className="font-semibold text-xl">Camera</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-12 bg-zinc-900 border-2 border-dashed border-purple-500/30 rounded-3xl hover:border-purple-500 hover:bg-zinc-800 transition-all group"
          >
            <i className="fa-solid fa-upload text-5xl mb-4 text-purple-500 group-hover:scale-110 transition-transform"></i>
            <span className="font-semibold text-xl">Upload</span>
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
        <div className="relative w-full max-w-xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-blue-500/50">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full aspect-[3/4] object-cover"
          />
          <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-6">
            <button 
              onClick={stopCamera}
              className="p-4 bg-zinc-900/80 rounded-full hover:bg-zinc-800 transition-colors"
            >
              <i className="fa-solid fa-times text-xl"></i>
            </button>
            <button 
              onClick={takePhoto}
              className="p-6 bg-blue-600 rounded-full hover:bg-blue-500 shadow-lg glow-effect transition-transform active:scale-95"
            >
              <i className="fa-solid fa-camera text-2xl"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoStep;
