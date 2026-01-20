
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { EDITING_PRESETS } from './constants';
import { HistoryItem, SubPreset } from './types';

// Augment window to handle the AI Studio integration
declare global {
  interface Window {
    // Making it optional and matching the required interface to avoid conflicts
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [originalMimeType, setOriginalMimeType] = useState<string>('image/png');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [selectedSubPreset, setSelectedSubPreset] = useState<SubPreset | null>(null);
  
  const [customPrompt, setCustomPrompt] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if a key is already available (e.g., if the user already connected in this session)
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (process.env.API_KEY) {
        setIsLoggedIn(true);
        return;
      }
      
      // If we are in the AI Studio environment, check for existing selection
      if (window.aistudio?.hasSelectedApiKey) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) setIsLoggedIn(true);
        } catch (e) {
          console.debug("Standalone mode: aistudio bridge not available yet.");
        }
      }
    };
    checkExistingConnection();
  }, []);

  const handleLogin = async () => {
    setError(null);
    try {
      // Trigger the official Google AI Studio key selection dialog
      if (window.aistudio?.openSelectKey) {
        await window.aistudio.openSelectKey();
        // As per documentation, we assume success after the dialog trigger to proceed
        setIsLoggedIn(true);
      } else {
        // Fallback: If deployed on Netlify/Standalone, we still want to let them in 
        // to use the injected API_KEY if they've provided one or if the platform handles it.
        setIsLoggedIn(true); 
      }
    } catch (err) {
      console.error("Login failed:", err);
      // Proceeding regardless to mitigate race conditions
      setIsLoggedIn(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOriginalMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setEditedImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!image) return;
    setError(null);
    setIsProcessing(true);

    try {
      // Create a fresh instance to ensure we use the current API Key from the project selection
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const base64Data = image.split(',')[1];
      
      const promptText = customPrompt || (selectedSubPreset ? selectedSubPreset.prompt : "Enhance this image.");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: originalMimeType,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const newImage = `data:image/png;base64,${part.inlineData.data}`;
            setEditedImage(newImage);
            
            setHistory(prev => [{
              id: Date.now().toString(),
              original: image,
              edited: newImage,
              prompt: promptText,
              timestamp: Date.now()
            }, ...prev].slice(0, 10));
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        setError("The AI finished but didn't return an image. It might be due to safety filters or an complex prompt.");
      }
    } catch (err: any) {
      console.error("AI processing error:", err);
      if (err.message?.includes("Requested entity was not found") || err.message?.includes("API_KEY")) {
        setError("Account connection expired. Please reconnect your Google Project.");
        setIsLoggedIn(false);
      } else {
        setError("Failed to edit image. Ensure your Google Cloud Project has billing enabled for credits.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
        <div className="max-w-md w-full text-center space-y-8 bg-white p-12 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-gray-100">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-blue-200">G</div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Lens AI</h1>
            <p className="text-gray-500 text-lg font-medium leading-relaxed">Connect your Gmail to use your personal Google AI Studio credits.</p>
          </div>
          
          <div className="space-y-4 pt-4">
            <button 
              onClick={handleLogin} 
              className="w-full flex items-center justify-center px-8 py-5 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all font-bold text-lg shadow-xl active:scale-95"
            >
              <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect with Google
            </button>
            
            <div className="pt-2">
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-500 font-bold hover:underline"
              >
                Learn how Google AI Studio credits work
              </a>
            </div>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">
              {error}
            </div>
          )}
          
          <div className="pt-8 opacity-20 font-black text-[10px] uppercase tracking-[0.2em]">Deployable Version • Gemini 2.5</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      {/* Side Navigation */}
      <aside className="w-full md:w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-screen sticky top-0 z-30 shadow-sm">
        <div className="p-8 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-900 tracking-tighter flex items-center gap-2">
              <span className="bg-black text-white w-8 h-8 flex items-center justify-center rounded-lg text-sm">G</span>
              LENS AI
            </h2>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full border border-green-100">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span className="text-[8px] font-black text-green-700 uppercase">Live</span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-8 overflow-y-auto space-y-6">
          <section>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-2">Presets</h3>
            <div className="space-y-1">
              {EDITING_PRESETS.map((category) => (
                <div key={category.id}>
                  <button
                    onClick={() => setExpandedCategoryId(expandedCategoryId === category.id ? null : category.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                      expandedCategoryId === category.id ? 'bg-white shadow-lg text-blue-600' : 'hover:bg-gray-200/50 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-bold text-sm">{category.label}</span>
                    </div>
                    <svg className={`w-4 h-4 transition-transform ${expandedCategoryId === category.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedCategoryId === category.id && (
                    <div className="pl-4 pr-2 py-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      {category.subPresets.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubPreset(sub);
                            setCustomPrompt('');
                          }}
                          className={`w-full text-left p-3 rounded-xl text-xs font-semibold transition-all ${
                            selectedSubPreset?.id === sub.id 
                              ? 'bg-blue-600 text-white shadow-lg' 
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4 border-t border-gray-200">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-2">Custom Command</h3>
            <textarea
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                setSelectedSubPreset(null);
              }}
              placeholder="e.g. 'Make the background a mountain range'..."
              className="w-full h-32 p-4 text-sm bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none shadow-sm font-medium"
            />
          </section>
        </div>

        <div className="p-6 bg-white border-t border-gray-200">
          <button
            onClick={processImage}
            disabled={!image || isProcessing}
            className={`w-full py-5 rounded-2xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.97] ${
              !image || isProcessing 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-black text-white hover:bg-gray-900 hover:shadow-2xl'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AI Working...
              </span>
            ) : 'EDIT IMAGE'}
          </button>
        </div>
      </aside>

      {/* Workspace */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-white">
        <div className="max-w-7xl mx-auto space-y-12">
          {error && (
            <div className="bg-red-50 border-2 border-red-100 text-red-700 p-6 rounded-[2.5rem] flex items-center justify-between animate-in slide-in-from-top-4 duration-300 shadow-sm">
              <p className="font-bold flex items-center gap-4">
                <span className="bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-[10px]">!</span>
                {error}
              </p>
              <button onClick={() => setError(null)} className="font-black hover:opacity-50 px-2">CLOSE</button>
            </div>
          )}

          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()} 
              className="h-[75vh] border-4 border-dashed border-gray-100 rounded-[4rem] flex flex-col items-center justify-center bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-32 h-32 bg-white rounded-[3rem] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-2xl shadow-blue-100 relative z-10">
                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-gray-900 z-10 tracking-tight">Drop Image Here</h2>
              <p className="text-gray-400 mt-4 text-lg font-medium z-10">Upload a photo to unlock AI editing</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                  <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Input Source</h3>
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-blue-600 font-black bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors">REPLACE</button>
                </div>
                <div className="aspect-square bg-gray-50 rounded-[4rem] overflow-hidden shadow-inner border border-gray-100 p-8 flex items-center justify-center">
                  <img src={image} alt="Original" className="max-w-full max-h-full object-contain rounded-3xl" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                  <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Gemini Enhanced</h3>
                  {editedImage && (
                    <a href={editedImage} download="gemini-edit.png" className="text-[10px] bg-black text-white px-6 py-2 rounded-full font-black hover:bg-gray-800 transition-all active:scale-95 shadow-lg">DOWNLOAD</a>
                  )}
                </div>
                <div className="aspect-square bg-gray-50 rounded-[4rem] overflow-hidden shadow-2xl border border-gray-100 p-8 flex items-center justify-center relative">
                  {isProcessing ? (
                    <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center">
                      <div className="w-20 h-20 border-8 border-gray-100 rounded-full border-t-black animate-spin mb-6 shadow-xl" />
                      <p className="font-black text-gray-900 text-2xl tracking-tight">Enhancing...</p>
                      <p className="text-xs text-gray-400 font-bold mt-2 uppercase tracking-widest animate-pulse">Computing Matrix</p>
                    </div>
                  ) : editedImage ? (
                    <img src={editedImage} alt="Edited" className="max-w-full max-h-full object-contain rounded-3xl animate-in zoom-in-95 fade-in duration-700" />
                  ) : (
                    <div className="text-center opacity-30 px-12">
                      <div className="text-7xl mb-8">💎</div>
                      <p className="text-xl font-black text-gray-800 leading-tight">Ready to transform. Choose a tool to begin.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Activity Strip */}
          {history.length > 0 && (
            <div className="pt-16">
              <div className="flex items-center gap-6 mb-10">
                <h3 className="text-3xl font-black text-gray-900 tracking-tighter">History</h3>
                <div className="h-0.5 flex-1 bg-gray-100 rounded-full"></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10">
                {history.map((item) => (
                  <div key={item.id} className="group relative aspect-square bg-gray-50 rounded-[3rem] overflow-hidden shadow-md hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-black/5">
                    <img src={item.edited} alt="History" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center p-6 text-center">
                      <p className="text-[10px] text-white font-bold leading-tight mb-4 line-clamp-3">"{item.prompt}"</p>
                      <button 
                        onClick={() => setEditedImage(item.edited)}
                        className="bg-white text-gray-900 px-6 py-2 rounded-2xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                      >
                        REVERT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
