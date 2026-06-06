import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  History, 
  Clock, 
  Compass, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  X, 
  Download, 
  Copy, 
  Plus, 
  Activity, 
  Wifi, 
  WifiOff, 
  ExternalLink, 
  Trash2,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { io } from 'socket.io-client';
import AiImageLoader from './components/AiImageLoader';
import './App.css';

// Preset suggestions for users to click and run
const PRESET_PROMPTS = [
  "Cyberpunk neon street at night, heavy rain, glowing signs, reflections, cinematic lighting",
  "A majestic dragon perched on top of a snow-covered mountain peak, cinematic, high-detail",
  "Chibi astronaut floating in space playing an electric guitar, pastel planets, whimsical digital art",
  "Hyper-detailed steampunk pocket watch with intricate brass gears, resting on velvet, macro shot"
];

function App() {
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // History stored in localStorage
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('aethergen_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse history from localStorage', e);
      return [];
    }
  });

  // UI States
  const [selectedImage, setSelectedImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Real-time task logs accumulated from the backend
  const [taskLogs, setTaskLogs] = useState([]);

  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // Connect to Socket.IO namespace on mount
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001/tasks';
    console.log(`Connecting to Socket.IO tasks namespace at: ${socketUrl}`);
    
    const socket = io(socketUrl, {
      reconnectionAttempts: 5,
      timeout: 10000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      setError(null);
      console.log('Successfully connected to tasks Socket.IO namespace');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      console.log('Disconnected from tasks Socket.IO namespace');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setSocketConnected(false);
    });

    socket.on('task-progress', (data) => {
      console.log('Received progress update from socket:', data);
      
      setActiveTask((prev) => {
        if (prev && prev.taskId === data.taskId) {
          // Append dynamic log message from backend if not already added
          setTaskLogs((prevLogs) => {
            const exists = prevLogs.some((log) => log.message === data.message);
            if (exists) return prevLogs;
            return [...prevLogs, {
              message: data.message,
              progress: data.progress,
              status: data.status,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }];
          });

          // If task complete, add to history (handled by another useEffect)
          return {
            ...prev,
            status: data.status,
            progress: data.progress,
            message: data.message,
            resultUrl: data.resultUrl || prev.resultUrl
          };
        }
        return prev;
      });
    });

    return () => {
      if (socket) socket.close();
    };
  }, []);

  // Update generation elapsed timer
  useEffect(() => {
    if (activeTask && activeTask.status !== 'completed' && activeTask.status !== 'failed') {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTask?.taskId, activeTask?.status]);

  // Handle active task completion state transitions
  useEffect(() => {
    if (activeTask && activeTask.status === 'completed' && activeTask.resultUrl) {
      // Append completed image to gallery list
      setHistory((prev) => {
        const alreadyExists = prev.some(item => item.taskId === activeTask.taskId);
        if (alreadyExists) return prev;

        const newGalleryItem = {
          taskId: activeTask.taskId,
          prompt: activeTask.prompt,
          resultUrl: activeTask.resultUrl,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
        };
        const updated = [newGalleryItem, ...prev];
        localStorage.setItem('aethergen_history', JSON.stringify(updated));
        return updated;
      });

      // Clear the active task monitor after 1 second to show final completed loader state
      const completionTimer = setTimeout(() => {
        setActiveTask(null);
        setIsGenerating(false);
        setPromptText('');
      }, 1000);

      return () => clearTimeout(completionTimer);
    }
  }, [activeTask?.status, activeTask?.resultUrl]);

  // Initiate backend generation trigger
  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!promptText.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setElapsedTime(0);

    // Reset real-time task logs from backend
    setTaskLogs([]);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    
    try {
      const response = await fetch(`${apiUrl}/api/images/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: promptText.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server rejected generation request');
      }

      const { taskId, status } = data;

      // Set initial task details locally
      setActiveTask({
        taskId,
        status: status || 'queued',
        progress: 10,
        message: data.message || 'Queued in generation server.',
        prompt: promptText.trim(),
        startTime: Date.now(),
        resultUrl: null,
      });

      // Command Socket to register/join this room
      if (socketRef.current && socketConnected) {
        console.log(`Emitting join-task for taskId: ${taskId}`);
        socketRef.current.emit('join-task', taskId);
      } else {
        console.warn('Socket not connected; updates might be delayed until reconnection');
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to connect to backend server. Is it running?');
      setIsGenerating(false);
    }
  };

  // Clear prompt text area
  const clearInput = () => {
    setPromptText('');
  };

  // Handle Preset Click
  const handlePresetSelect = (preset) => {
    if (isGenerating) return;
    setPromptText(preset);
  };

  // Copy prompt text helper
  const copyPromptToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clear all images in localStorage history
  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear your generation history? This action is permanent.')) {
      setHistory([]);
      localStorage.removeItem('aethergen_history');
    }
  };

  // Select steps classes based on current progress percentage
  const getStepStatusClass = (minProgress, maxProgress) => {
    if (!activeTask) return 'step-item';
    const currentProgress = activeTask.progress;
    
    if (currentProgress >= maxProgress) {
      return 'step-item completed';
    } else if (currentProgress >= minProgress && currentProgress < maxProgress) {
      return 'step-item active';
    }
    return 'step-item';
  };

  // Calculate SVG stroke offset for radial progress bar
  const strokeDashoffset = activeTask 
    ? 377 - (377 * activeTask.progress) / 100 
    : 377;

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="container header-container">
          <div className="brand">
            <div className="brand-icon">
              <Sparkles size={20} color="#fff" />
            </div>
            <span className="brand-logo-text">AetherGen</span>
          </div>

          <div className="badge-container">
            <div className="status-badge">
              <span className={`status-dot ${socketConnected ? 'connected' : 'disconnected'}`}></span>
              <span>{socketConnected ? 'Real-time Live' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ flexGrow: 1, position: 'relative', zIndex: 5 }}>
        
        {/* Intro */}
        <section className="hero">
          <h1>Real-time AI Canvas</h1>
          <p>
            Unleash your imagination. Enter a prompt to watch the diffusion model compile, upscale, and detail your creation live using Socket.IO updates.
          </p>
        </section>

        {/* Workspace Layout */}
        <section className="studio-grid">
          
          {/* Form console */}
          <div className="card">
            <h2 className="panel-title">
              <Compass size={18} color="#8b5cf6" />
              Generator Console
            </h2>

            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <textarea
                  className="prompt-textarea"
                  placeholder="Describe the image you want to generate in detail..."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  disabled={isGenerating}
                />
                <div className="textarea-footer">
                  <span>{promptText.length} characters</span>
                </div>
              </div>

              {/* Preset suggestion pills */}
              <div className="preset-section">
                <span className="preset-label">Need inspiration? Try these:</span>
                <div className="presets-container">
                  {PRESET_PROMPTS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      className="preset-chip"
                      onClick={() => handlePresetSelect(preset)}
                      disabled={isGenerating}
                    >
                      {preset.substring(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Error warning */}
              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Trigger */}
              <button
                type="submit"
                className="btn-generate"
                disabled={!promptText.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Generating in Background...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Synthesize Image
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Realtime Live State Monitor */}
          <div className="card">
            <h2 className="panel-title">
              <Activity size={18} color="#06b6d4" />
              Live Process Monitor
            </h2>

            <div className={`monitor-container ${activeTask ? 'active' : ''}`}>
              {!activeTask ? (
                /* Empty state */
                <div className="empty-monitor-state">
                  <div className="empty-icon-wrapper">
                    <ImageIcon size={32} />
                  </div>
                  <h3>No generation active</h3>
                  <p style={{ fontSize: '13px' }}>
                    Type a prompt and press Synthesize to view real-time diffusion denoising steps.
                  </p>
                </div>
              ) : (
                /* Live progress state */
                <div className="active-progress-panel">
                  
                  <div className="progress-header">
                    <span className="task-id-badge">ID: {activeTask.taskId.substring(0, 8)}...</span>
                    <span className="time-elapsed">
                      <Clock size={14} />
                      {elapsedTime}s elapsed
                    </span>
                  </div>

                  {/* Render the dynamic wave loader directly */}
                  <AiImageLoader 
                    progress={activeTask.progress} 
                    message={activeTask.message} 
                  />



                </div>
              )}
            </div>
          </div>

        </section>

        {/* Gallery History */}
        <section className="gallery-section">
          <div className="section-header">
            <h2 className="section-title">Studio Library</h2>
            <button 
              className="clear-btn" 
              onClick={clearHistory}
              disabled={history.length === 0}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={14} />
                Reset Library
              </span>
            </button>
          </div>

          {history.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)'
            }}>
              <ImageIcon size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3>Library is empty</h3>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>Your successfully completed generations will appear here.</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {history.map((item) => (
                <div key={item.taskId} className="gallery-card">
                  <div className="img-wrapper">
                    <img 
                      src={item.resultUrl} 
                      alt={item.prompt} 
                      className="gallery-img"
                      loading="lazy"
                    />
                    
                    {/* Hover actions */}
                    <div className="gallery-overlay">
                      <div className="overlay-actions">
                        <button 
                          className="action-btn"
                          title="Open Image"
                          onClick={() => setSelectedImage(item)}
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button 
                          className="action-btn"
                          title="Copy Prompt"
                          onClick={() => copyPromptToClipboard(item.prompt, item.taskId)}
                        >
                          {copiedId === item.taskId ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                        </button>
                        <a 
                          href={item.resultUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          download={`generation-${item.taskId}.jpg`}
                          className="action-btn"
                          title="Download Image"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="gallery-card-content">
                    <p className="gallery-card-prompt" title={item.prompt}>
                      {item.prompt}
                    </p>
                    <div className="gallery-card-meta">
                      <span>{item.date}</span>
                      <span>{item.createdAt}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Lightbox Zoom Overlay */}
      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelectedImage(null)}>
              <X size={18} />
            </button>

            <div className="lightbox-img-wrapper">
              <img src={selectedImage.resultUrl} alt={selectedImage.prompt} className="lightbox-img" />
            </div>

            <div className="lightbox-info">
              <p className="lightbox-prompt">{selectedImage.prompt}</p>
              
              <div className="lightbox-metadata">
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span>Generated on: {selectedImage.date} at {selectedImage.createdAt}</span>
                  <span>ID: {selectedImage.taskId.substring(0, 12)}...</span>
                </div>
                
                <div className="lightbox-action-row">
                  <button 
                    className="clear-btn" 
                    onClick={() => copyPromptToClipboard(selectedImage.prompt, 'lightbox')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {copiedId === 'lightbox' ? (
                      <>
                        <Check size={14} color="#10b981" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copy Prompt
                      </>
                    )}
                  </button>
                  
                  <a 
                    href={selectedImage.resultUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={`generation-${selectedImage.taskId}.jpg`}
                    className="btn-generate"
                    style={{ padding: '8px 16px', fontSize: '13px', width: 'auto', gap: '6px', margin: 0, boxShadow: 'none' }}
                  >
                    <Download size={14} />
                    Download File
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spin style keyframe helper injected locally for simple setup */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default App;
