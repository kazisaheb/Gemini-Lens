
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { EDITING_PRESETS } from './constants';
import { HistoryItem, SubPreset } from './types';

// Fix: Use correct interface for AI Studio window extension
declare global {
  interface Window {
    aistudio: {
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

  // Check authentication status on mount and when window gains focus
  useEffect(() => {
    checkAuth();
    window.addEventListener('focus', checkAuth);
    return () => window.removeEventListener('focus', checkAuth);
  }, []);

  const checkAuth = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          setIsLoggedIn(true);
        }
      } else if (process.env.API_KEY) {
        // Fallback for environments where the key is already injected
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error("Auth check failed", err);
    }
  };

  const handleLogin = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        // Trigger the AI Studio key selection dialog
        await window.aistudio.openSelectKey();
        
        /**
         * RACE CONDITION MITIGATION:
         * Per guidelines, we assume success after triggering the selection to 
         * provide an immediate transition for the user.
         */
        setIsLoggedIn(true);
        
        // Secondary check to verify the key is actually there
        setTimeout(async () => {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey && !process.env.API_KEY) {
            setIsLoggedIn(false);
            setError("No API key was selected. Please try again.");
          }
        }, 1000);
      } catch (err) {
        console.error("Login trigger failed", err);
        setError("Could not open the login dialog. Please refresh and try again.");
      }
    } else {
      // If deployed outside the expected frame, we can't use the selectKey method
      setError("AI Studio connection is only available within the Google AI Studio environment.");
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
      // Create new instance to use the most up-to-date API_KEY from the environment
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
            
            const newHistoryItem: HistoryItem = {
              id: Date.now().toString(),
              original: image,
              edited: newImage,
              prompt: promptText,
              timestamp: Date.now()
            };
            setHistory(prev => [newHistoryItem, ...prev].slice(0, 15));
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        setError("AI did not return an image. It might have been blocked or the prompt was too complex.");
      }
    } catch (err: any) {
      console.error("Processing error:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setError("API Session expired or invalid project. Please re-authenticate.");
        setIsLoggedIn(false);
      } else {
        setError("AI processing failed. Please ensure you have an active billing project selected.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setEditedImage(null);
    setExpandedCategoryId(null);
    setSelectedSubPreset(null);
    setCustomPrompt('');
    setError(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-md w-full text-center space-y-8 bg-gray-50 p-10 rounded-3xl border border-gray-100 shadow-xl">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-blue-200 shadow-lg">G</div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gemini Lens</h1>
            <p className="text-gray-500">Connect your Google AI Studio account to use your won AI credits and start editing.</p>
            {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={handleLogin} 
              className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-lg active:scale-[0.98]"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.176-1.248 1.248-3.216 2.616-7.84 2.616-7.512 0-13.44-6.104-13.44-13.616s5.928-13.616 13.44-13.616c4.056 0 7.104 1.6 9.408 3.792l2.328-2.328c-2.432-2.328-5.744-4.144-11.736-4.144-10.496 0-19 8.504-19 19s8.504 19 19 19c5.68 0 9.968-1.88 13.2-5.232 3.328-3.328 4.384-8.024 4.384-11.792 0-.744-.064-1.464-.176-2.144h-17.408z" />
              </svg>
              Continue with AI Studio
            </button>
            
            <p className="text-[10px] text-gray-400 leading-relaxed">
              This application requires a linked API key from a paid GCP project.<br/>
              Check the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-500 underline">billing docs</a> for more info.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded">G</span>
            Gemini Lens
          </h2>
          <button onClick={() => window.location.reload()} className="text-gray-300 hover:text-gray-600" title="Logout/Reset">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>

        <div className="flex-1 px-4 py-6 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Edit Categories</h3>
            <div className="space-y-2">
              {EDITING_PRESETS.map((category) => (
                <div key={category.id} className="space-y-1">
                  <button
                    onClick={() => setExpandedCategoryId(expandedCategoryId === category.id ? null : category.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      expandedCategoryId === category.id ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-semibold text-sm">{category.label}</span>
                    </div>
                    <svg className={`w-4 h-4 transition-transform ${expandedCategoryId === category.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedCategoryId === category.id && (
                    <div className="pl-10 pr-2 py-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      {category.subPresets.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubPreset(sub);
                            setCustomPrompt('');
                          }}
                          className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-colors ${
                            selectedSubPreset?.id === sub.id 
                              ? 'bg-blue-50 text-blue-700 font-bold' 
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Manual Prompt</h3>
            <textarea
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                setSelectedSubPreset(null);
              }}
              placeholder="Describe your edit in detail..."
              className="w-full h-24 p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {selectedSubPreset && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] uppercase font-bold text-blue-400 tracking-tighter">Selected Tool</p>
              <p className="text-xs font-bold text-blue-700">{selectedSubPreset.label}</p>
            </div>
          )}
          <button
            onClick={processImage}
            disabled={!image || isProcessing}
            className={`w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all ${
              !image || isProcessing 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            {isProcessing ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Apply Magic Edit'}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-10">
          
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center justify-between animate-in fade-in zoom-in">
              <p className="text-sm font-semibold">⚠️ {error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="h-[70vh] border-2 border-dashed border-gray-200 rounded-[3rem] flex flex-col items-center justify-center bg-white hover:bg-blue-50/20 transition-all cursor-pointer group shadow-sm">
              <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Start with an image</h2>
              <p className="text-gray-400 mt-2">Upload a photo to unlock the AI toolkit</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-gray-500 uppercase tracking-widest text-xs">Source</h3>
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 font-bold hover:underline">Change Image</button>
                </div>
                <div className="aspect-square bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 p-4">
                  <img src={image} alt="Original" className="w-full h-full object-contain rounded-2xl" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-gray-500 uppercase tracking-widest text-xs">Result</h3>
                  {editedImage && (
                    <a href={editedImage} download="gemini-edit.png" className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-bold hover:bg-blue-700 transition-colors">Download Final</a>
                  )}
                </div>
                <div className="aspect-square bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 p-4 relative">
                  {isProcessing ? (
                    <div className="absolute inset-0 z-10 animate-shimmer flex flex-col items-center justify-center text-gray-500">
                      <div className="w-16 h-16 border-4 border-blue-50 rounded-full border-t-blue-600 animate-spin mb-4 shadow-lg" />
                      <p className="font-bold text-gray-700">Gemini is processing...</p>
                      <p className="text-xs text-gray-400 mt-1 italic">Generating masterpiece pixels</p>
                    </div>
                  ) : editedImage ? (
                    <img src={editedImage} alt="Edited" className="w-full h-full object-contain rounded-2xl animate-in zoom-in duration-700" />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">✨</div>
                      <p className="max-w-[200px] text-sm font-medium">Your edited image will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced History */}
          {history.length > 0 && (
            <div className="pt-20 border-t border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900">Your Edit History</h3>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{history.length} versions</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {history.map((item) => (
                  <div key={item.id} className="group relative aspect-square bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all cursor-pointer border border-gray-100 hover:-translate-y-1">
                    <img src={item.edited} alt="History" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gray-900/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center p-4 text-center">
                      <p className="text-[10px] text-gray-300 mb-4 line-clamp-3 italic leading-tight">"{item.prompt}"</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditedImage(item.edited); }}
                          className="bg-white text-gray-900 p-2 rounded-lg hover:bg-blue-500 hover:text-white transition-colors shadow-lg"
                          title="Restore to Canvas"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <a 
                          href={item.edited} 
                          download={`edit-${item.id}.png`}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                          title="Download Image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </a>
                      </div>
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
