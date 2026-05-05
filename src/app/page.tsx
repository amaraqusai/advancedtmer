"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Play, Pause, Square, Camera, Loader2, CheckCircle2, AlertCircle, History, Bell, Settings2, Users, Trophy, User as UserIcon } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  duration: string;
  status: 'verified' | 'failed' | 'missed';
}

interface User {
  id: string;
  name: string;
  groupId: string | null;
  totalStudySeconds: number;
}

interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: User[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studyUser');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [userNameInput, setUserNameInput] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(0); 
  
  const [trackingMode, setTrackingMode] = useState<'camera' | 'manual'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('trackingMode') as 'camera' | 'manual') || 'camera';
    }
    return 'camera';
  });
  const [showVerification, setShowVerification] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{success: boolean, message: string} | null>(null);
  const [studyLog, setStudyLog] = useState<LogEntry[]>([]);
  
  // Reference Photos
  const [refAllowed, setRefAllowed] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('refAllowed');
    return null;
  });
  const [refRejected, setRefRejected] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('refRejected');
    return null;
  });
  const [isSettingRefs, setIsSettingRefs] = useState(false);

  // Verification Timeout Logic
  const [verifyTimeLeft, setVerifyTimeLeft] = useState(180); 
  const webcamRef = useRef<Webcam>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours > 0 ? hours.toString().padStart(2, '0') + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const addLogEntry = useCallback((status: 'verified' | 'failed' | 'missed', duration: string) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toLocaleTimeString(),
      duration: duration,
      status
    };
    setStudyLog(prev => [newEntry, ...prev].slice(0, 10));
  }, []);

  const fetchGroup = useCallback(async (groupId: string | null) => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/groups?groupId=${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch (e) { console.error("Leaderboard sync failed", e); }
  }, []);

  const syncTime = useCallback(async (userId: string, seconds: number) => {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, additionalSeconds: seconds }),
      });
    } catch (e) { console.error("Sync failed", e); }
  }, []);

  const triggerVerification = useCallback(() => {
    if (notificationSound.current) {
      notificationSound.current.play().catch(e => console.error("Audio play failed", e));
    }
    setShowVerification(true);
    setVerifyTimeLeft(180);
  }, []);

  const handleMissedVerification = useCallback(() => {
    addLogEntry('missed', formatTime(time));
    setIsActive(false);
    setShowVerification(false);
    alert("Verification missed! Timer stopped.");
  }, [addLogEntry, formatTime, time]);

  const captureAndVerify = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsAnalyzing(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageSrc,
          referenceAllowed: refAllowed,
          referenceRejected: refRejected
        }),
      });

      const data = await response.json();
      if (response.ok && data.isStudying) {
        setVerificationResult({ success: true, message: data.reason || 'Verified!' });
        addLogEntry('verified', formatTime(time));
        setTimeout(() => {
          setShowVerification(false);
          setVerificationResult(null);
        }, 2000);
      } else {
        setVerificationResult({ success: false, message: data.reason || data.error || 'Not studying.' });
        addLogEntry('failed', formatTime(time));
      }
    } catch (error) {
      console.error("Verification error", error);
      setVerificationResult({ success: false, message: 'Analysis failed.' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [webcamRef, refAllowed, refRejected, time, addLogEntry, formatTime]);

  const handleManualVerify = useCallback(() => {
    addLogEntry('verified', formatTime(time));
    setVerificationResult({ success: true, message: "Manual check-in confirmed!" });
    setTimeout(() => {
      setShowVerification(false);
      setVerificationResult(null);
    }, 1500);
  }, [addLogEntry, formatTime, time]);

  // Load Initial Data
  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    
    if (user?.groupId) {
      setTimeout(() => fetchGroup(user.groupId), 0);
    }
  }, [fetchGroup, user?.groupId]);

  // Auto-capture in camera mode when modal opens
  useEffect(() => {
    if (showVerification && trackingMode === 'camera' && !isAnalyzing && !verificationResult) {
      const timer = setTimeout(() => {
        captureAndVerify();
      }, 2000); // Wait 2s for camera to warm up then auto-capture
      return () => clearTimeout(timer);
    }
  }, [showVerification, trackingMode, isAnalyzing, verificationResult, captureAndVerify]);

  // Periodic Leaderboard Sync
  useEffect(() => {
    if (user?.groupId) {
      const interval = setInterval(() => fetchGroup(user.groupId), 30000); // Sync leaderboard every 30s
      return () => clearInterval(interval);
    }
  }, [user?.groupId, fetchGroup]);

  // Main Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && !showVerification) {
      interval = setInterval(() => {
        setTime((prev) => {
          const nextTime = prev + 1;
          if (nextTime > 0 && nextTime % 60 === 0 && user) {
            syncTime(user.id, 60); // Sync every minute
          }
          if (nextTime > 0 && nextTime % (intervalMinutes * 60) === 0) {
            triggerVerification();
          }
          return nextTime;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, intervalMinutes, showVerification, user, syncTime, triggerVerification]);

  useEffect(() => {
    let countdown: NodeJS.Timeout | null = null;
    if (showVerification) {
      countdown = setInterval(() => {
        setVerifyTimeLeft((prev) => {
          if (prev <= 1) {
            handleMissedVerification();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (countdown) clearInterval(countdown); };
  }, [showVerification, handleMissedVerification]);

  const handleLogin = async () => {
    if (!userNameInput.trim()) return;
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userNameInput }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      localStorage.setItem('studyUser', JSON.stringify(data));
      if (data.groupId) fetchGroup(data.groupId);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim() || !user) return;
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: groupNameInput, userId: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setGroup(data);
      const updatedUser = { ...user, groupId: data.id };
      setUser(updatedUser);
      localStorage.setItem('studyUser', JSON.stringify(updatedUser));
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCodeInput.trim() || !user) return;
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', inviteCode: inviteCodeInput.toUpperCase(), userId: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setGroup(data);
      const updatedUser = { ...user, groupId: data.id };
      setUser(updatedUser);
      localStorage.setItem('studyUser', JSON.stringify(updatedUser));
    }
  };

  if (!user) {
    return (
      <div className="container">
        <h1>Welcome Student!</h1>
        <p>Enter your name to start your study session.</p>
        <div className="login-screen">
          <input 
            type="text" 
            placeholder="Your Name" 
            value={userNameInput} 
            onChange={(e) => setUserNameInput(e.target.value)}
            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}
          />
          <button className="primary" onClick={handleLogin} style={{ width: '100%' }}>
            Let&apos;s Go!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <UserIcon size={18} /> {user.name}
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Logout</button>
      </div>
      
      <h1>Study Timer</h1>
      
      <div className="timer-display">
        {formatTime(time)}
      </div>

      <div className="controls">
        <button className="primary" onClick={() => setIsActive(!isActive)}>
          {isActive ? <Pause size={20} /> : <Play size={20} />}
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button className="secondary" onClick={() => { setIsActive(false); setTime(0); setShowVerification(false); }} disabled={time === 0 && !isActive}>
          <Square size={20} /> Reset
        </button>
      </div>

      <div className="settings-group">
        <label>
          Tracking Mode
          <select 
            value={trackingMode} 
            onChange={(e) => {
              const mode = e.target.value as 'camera' | 'manual';
              setTrackingMode(mode);
              localStorage.setItem('trackingMode', mode);
            }}
            disabled={isActive}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }}
          >
            <option value="camera">AI Camera (ML Verification)</option>
            <option value="manual">Manual Button (Check-in)</option>
          </select>
        </label>
        <label>
          Check Every (Minutes)
          <input type="number" min="1" value={intervalMinutes} onChange={(e) => setIntervalMinutes(Math.max(1, parseInt(e.target.value) || 1))} disabled={isActive} />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
          <button className="secondary" onClick={() => triggerVerification()} style={{ flex: 1 }}>
            <Bell size={16} /> Test
          </button>
          {trackingMode === 'camera' && (
            <button className="secondary" onClick={() => setIsSettingRefs(!isSettingRefs)} style={{ flex: 1 }}>
              <Settings2 size={16} /> AI Setup
            </button>
          )}
        </div>
      </div>

      {isSettingRefs && (
        <div className="reference-setup">
          <h3>AI Reference Setup</h3>
          <div className="webcam-container" style={{ maxHeight: '180px' }}><Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" /></div>
          <div className="reference-grid">
            <div className="ref-box">
              <strong>Good Study</strong>
              {refAllowed ? <img src={refAllowed} className="ref-preview" alt="Allowed reference" /> : <div className="ref-placeholder">No sample</div>}
              <button className="primary" onClick={() => {
                const img = webcamRef.current?.getScreenshot();
                if(img) { setRefAllowed(img); localStorage.setItem('refAllowed', img); }
              }} style={{ padding: '0.5rem', fontSize: '0.8rem' }}><Camera size={14} /> Capture</button>
            </div>
            <div className="ref-box">
              <strong>Distracted</strong>
              {refRejected ? <img src={refRejected} className="ref-preview" alt="Rejected reference" /> : <div className="ref-placeholder">No sample</div>}
              <button className="secondary" onClick={() => {
                const img = webcamRef.current?.getScreenshot();
                if(img) { setRefRejected(img); localStorage.setItem('refRejected', img); }
              }} style={{ padding: '0.5rem', fontSize: '0.8rem' }}><Camera size={14} /> Capture</button>
            </div>
          </div>
        </div>
      )}

      {!group ? (
        <div className="study-log" style={{ marginTop: '2rem' }}>
          <h3><Users size={18} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Join a Group</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Invite Code" 
                value={inviteCodeInput} 
                onChange={(e) => setInviteCodeInput(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}
              />
              <button className="primary" onClick={handleJoinGroup}>Join</button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
              <input 
                type="text" 
                placeholder="Group Name" 
                value={groupNameInput} 
                onChange={(e) => setGroupNameInput(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}
              />
              <button className="secondary" onClick={handleCreateGroup}>Create Group</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="leaderboard">
          <h3>
            <span><Trophy size={18} style={{verticalAlign: 'middle', marginRight: '8px'}}/> {group.name}</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Code: {group.inviteCode}</span>
          </h3>
          <div className="invite-box">Invite friends using code: {group.inviteCode}</div>
          <div className="leaderboard-list">
            {group.members.map((member, i) => (
              <div key={member.id} className="leaderboard-item" style={member.id === user.id ? { border: '2px solid var(--primary)' } : {}}>
                <span className="leaderboard-rank">#{i + 1}</span>
                <span className="leaderboard-name">{member.name} {member.id === user.id && '(You)'}</span>
                <span style={{ fontWeight: 700 }}>{formatTime(member.totalStudySeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {studyLog.length > 0 && (
        <div className="study-log">
          <h3><History size={18} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Local Session Log</h3>
          {studyLog.map(log => (
            <div key={log.id} className="log-item">
              <span>{log.timestamp}</span>
              <span className="log-time">{log.duration}</span>
              <span className={`log-status status-${log.status === 'verified' ? 'success' : 'error'}`}>{log.status}</span>
            </div>
          ))}
        </div>
      )}

      {showVerification && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Focus Check!</h2>
            <div className="countdown-text">Time left: {Math.floor(verifyTimeLeft / 60)}:{(verifyTimeLeft % 60).toString().padStart(2, '0')}</div>
            
            {trackingMode === 'camera' ? (
              <>
                <div className="webcam-container" style={{ marginTop: '1rem' }}><Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" /></div>
                <button className="primary" onClick={captureAndVerify} disabled={isAnalyzing || (verificationResult?.success)} style={{ width: '100%', marginBottom: '1rem' }}>
                  {isAnalyzing ? <><Loader2 className="spinner" size={20} /> AI is deciding...</> : <><Camera size={20} /> Capture Now</>}
                </button>
                {!isAnalyzing && !verificationResult && <p style={{ fontSize: '0.8rem', marginTop: '-0.5rem' }}>Auto-capturing in a moment...</p>}
              </>
            ) : (
              <div style={{ margin: '2rem 0' }}>
                <p>Are you still there and studying?</p>
                <button className="primary" onClick={handleManualVerify} disabled={verificationResult?.success} style={{ width: '100%', padding: '1.5rem', fontSize: '1.2rem' }}>
                  <CheckCircle2 size={24} /> I am here and studying!
                </button>
              </div>
            )}

            {verificationResult && (
              <div className={`status-badge ${verificationResult.success ? 'status-success' : 'status-error'}`}>
                {verificationResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {verificationResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
