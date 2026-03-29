import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import * as gameService from '../services/gameService';
import mrMonopolyImg from '../mrMonopoly.png';
import { TokenIcon } from '../utils/monopolyTokens';
import './GameSession.css';

// Monopoly Deluxe property data (UK edition) with house costs
const MONOPOLY_PROPERTIES = [
  { name: 'Old Kent Road', colorGroup: 'brown', price: 60, houseCost: 50 },
  { name: 'Whitechapel Road', colorGroup: 'brown', price: 60, houseCost: 50 },
  { name: 'The Angel Islington', colorGroup: 'lightblue', price: 100, houseCost: 50 },
  { name: 'Euston Road', colorGroup: 'lightblue', price: 100, houseCost: 50 },
  { name: 'Pentonville Road', colorGroup: 'lightblue', price: 120, houseCost: 50 },
  { name: 'Pall Mall', colorGroup: 'pink', price: 140, houseCost: 100 },
  { name: 'Whitehall', colorGroup: 'pink', price: 140, houseCost: 100 },
  { name: 'Northumberland Avenue', colorGroup: 'pink', price: 160, houseCost: 100 },
  { name: 'Bow Street', colorGroup: 'orange', price: 180, houseCost: 100 },
  { name: 'Marlborough Street', colorGroup: 'orange', price: 180, houseCost: 100 },
  { name: 'Vine Street', colorGroup: 'orange', price: 200, houseCost: 100 },
  { name: 'Strand', colorGroup: 'red', price: 220, houseCost: 150 },
  { name: 'Fleet Street', colorGroup: 'red', price: 220, houseCost: 150 },
  { name: 'Trafalgar Square', colorGroup: 'red', price: 240, houseCost: 150 },
  { name: 'Leicester Square', colorGroup: 'yellow', price: 260, houseCost: 150 },
  { name: 'Coventry Street', colorGroup: 'yellow', price: 260, houseCost: 150 },
  { name: 'Piccadilly', colorGroup: 'yellow', price: 280, houseCost: 150 },
  { name: 'Regent Street', colorGroup: 'green', price: 300, houseCost: 200 },
  { name: 'Oxford Street', colorGroup: 'green', price: 300, houseCost: 200 },
  { name: 'Bond Street', colorGroup: 'green', price: 320, houseCost: 200 },
  { name: 'Park Lane', colorGroup: 'darkblue', price: 350, houseCost: 200 },
  { name: 'Mayfair', colorGroup: 'darkblue', price: 400, houseCost: 200 },
  { name: 'Kings Cross Station', colorGroup: 'station', price: 200, houseCost: 0 },
  { name: 'Marylebone Station', colorGroup: 'station', price: 200, houseCost: 0 },
  { name: 'Fenchurch St Station', colorGroup: 'station', price: 200, houseCost: 0 },
  { name: 'Liverpool St Station', colorGroup: 'station', price: 200, houseCost: 0 },
  { name: 'Electric Company', colorGroup: 'utility', price: 150, houseCost: 0 },
  { name: 'Water Works', colorGroup: 'utility', price: 150, houseCost: 0 },
];

const COLOR_GROUP_COLORS = {
  brown: '#8B4513', lightblue: '#87CEEB', pink: '#FF69B4', orange: '#FF8C00',
  red: '#FF0000', yellow: '#FFD700', green: '#008000', darkblue: '#00008B',
  station: '#555555', utility: '#888888',
};

const GROUP_LABELS = {
  brown: 'Brown', lightblue: 'Light Blue', pink: 'Pink', orange: 'Orange',
  red: 'Red', yellow: 'Yellow', green: 'Green', darkblue: 'Dark Blue',
  station: 'Stations', utility: 'Utilities',
};

/* ====== Amount Picker Component with Tabs ====== */
function ScrollWheelPicker({ value, onChange, max, min = 1, step = 1 }) {
  const ITEM_HEIGHT = 44;
  const VISIBLE = 5;
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isScrollingRef = useRef(false);
  const [mode, setMode] = useState('scroll'); // 'scroll' or 'type'
  const [visualIndex, setVisualIndex] = useState(0);
  const inputRef = useRef(null);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Generate values: [min, min+step, min+2*step, ...] up to max
  const values = useMemo(() => {
    const vals = [];
    const start = min || 1;
    for (let i = start; i <= (max || 10000); i += step) {
      vals.push(i);
    }
    return vals;
  }, [max, min, step]);

  const minVal = min || 1;
  const selectedIndex = useMemo(() => {
    const idx = values.indexOf(parseInt(value) || minVal);
    return idx >= 0 ? idx : 0;
  }, [values, value, minVal]);

  // Scroll to selected on mount / value change
  useEffect(() => {
    if (containerRef.current && !isScrollingRef.current) {
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
      setVisualIndex(selectedIndex);
    }
  }, [selectedIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    // Update visual index immediately for responsive feedback
    const idx = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(idx, values.length - 1));
    setVisualIndex(clampedIdx);
    
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollTo({ top: clampedIdx * ITEM_HEIGHT, behavior: 'smooth' });
      onChange(String(values[clampedIdx]));
      isScrollingRef.current = false;
    }, 80);
  };

  const handleInputChange = (val) => {
    const num = parseInt(val) || 0;
    const clamped = Math.max(0, Math.min(num, max || 99999));
    onChange(String(clamped));
  };

  const handleInputBlur = () => {
    const num = parseInt(value) || 0;
    if (num < minVal) {
      onChange(String(minVal));
    }
  };

  return (
    <div className="amount-picker">
      <div className="picker-tabs">
        <button className={`picker-tab ${mode === 'scroll' ? 'active' : ''}`} onClick={() => setMode('scroll')}>
          Scroll
        </button>
        <button className={`picker-tab ${mode === 'type' ? 'active' : ''}`} onClick={() => setMode('type')}>
          Type
        </button>
      </div>
      
      {mode === 'type' ? (
        <div className="type-input-area">
          <div className="wheel-input-wrapper">
            <span className="wheel-currency">£</span>
            <input
              ref={inputRef}
              type="number"
              className="wheel-text-input"
              value={value}
              onChange={e => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              autoFocus
              placeholder={String(minVal)}
              min={minVal}
              max={max}
            />
          </div>
        </div>
      ) : (
        <div className="scroll-wheel-picker">
          <div className="wheel-arrows">
            <span className="wheel-arrow">▶</span>
            <span className="wheel-arrow">◀</span>
          </div>
          <div className="wheel-fade wheel-fade-top" />
          <div className="wheel-fade wheel-fade-bottom" />
          <div
            className="wheel-scroll"
            ref={containerRef}
            onScroll={handleScroll}
            style={{ height: ITEM_HEIGHT * VISIBLE }}
          >
            <div style={{ height: ITEM_HEIGHT * 2 }} />
            {values.map((v, i) => {
              const isSelected = i === visualIndex;
              return (
                <div key={i} className={`wheel-item ${isSelected ? 'selected' : ''}`} style={{ height: ITEM_HEIGHT }}
                  onClick={() => {
                    containerRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: 'smooth' });
                    setVisualIndex(i);
                    onChange(String(v));
                  }}>
                  £{v.toLocaleString()}
                </div>
              );
            })}
            <div style={{ height: ITEM_HEIGHT * 2 }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== Main Component ====== */
function GameSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams();
  const user = authService.getCurrentUser();

  const [game, setGame] = useState(location.state?.game || null);
  const [isLoading, setIsLoading] = useState(!location.state?.game);
  const [error, setError] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bankAction, setBankAction] = useState('receive');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [hasPendingGoRequest, setHasPendingGoRequest] = useState(false);
  const [hasPendingBankRequest, setHasPendingBankRequest] = useState(false);

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleTimeRemaining, setIdleTimeRemaining] = useState(null);
  const [idleEnded, setIdleEnded] = useState(false);
  const lastUserActivityRef = useRef(Date.now());

  const [showLeaveSummary, setShowLeaveSummary] = useState(false);
  const [leaveSummaryData, setLeaveSummaryData] = useState(null);

  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [activeTab, setActiveTab] = useState('actions');
  const [expandedPropCard, setExpandedPropCard] = useState(null);

  // Get game ID (handles both _id and id from API)
  const gameId = game?._id || game?.id;

  // ---- Data loading ----
  const loadGame = useCallback(async () => {
    try { setIsLoading(true); const data = await gameService.getGame(code); setGame(data.game); setError(''); }
    catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [code]);

  const refreshInBackground = useCallback(async () => {
    try {
      const data = await gameService.getGame(code);
      setGame(prevGame => {
        if (!prevGame) return data.game;
        const prevStr = JSON.stringify(prevGame.players);
        const newStr = JSON.stringify(data.game.players);
        const statusChanged = prevGame.status !== data.game.status;
        const pendingChanged = JSON.stringify(prevGame.pendingApprovals) !== JSON.stringify(data.game.pendingApprovals);
        const txChanged = (prevGame.transactions?.length || 0) !== (data.game.transactions?.length || 0);
        if (prevStr !== newStr || statusChanged || pendingChanged || txChanged) return data.game;
        return prevGame;
      });
      const pending = data.game.pendingApprovals?.filter(r => r.status === 'pending') || [];
      setPendingApprovals(pending);
      setHasPendingGoRequest(pending.some(r => (r.player?._id || r.player) === user?._id && r.type === 'go_salary'));
      setHasPendingBankRequest(pending.some(r => (r.player?._id || r.player) === user?._id && r.type === 'bank_receive'));
    } catch (err) { console.warn('Background refresh failed:', err.message); }
  }, [code, user?._id]);

  useEffect(() => { if (!game && code) loadGame(); }, [game, code, loadGame]);

  useEffect(() => {
    if (!game) return;

    if (game.status === 'waiting') {
      navigate(`/lobby/${game.code || code}`, { state: { game }, replace: true });
      return;
    }

    const isParticipant = game.players?.some((player) => String(player.user?._id || player.user) === String(user?._id));
    if (!isParticipant) {
      setError('You are not part of this game session.');
      navigate('/dashboard', { replace: true });
    }
  }, [game, code, navigate, user?._id]);

  useEffect(() => {
    if (game && game.status === 'in_progress') {
      const interval = setInterval(refreshInBackground, 2000);
      return () => clearInterval(interval);
    }
  }, [game, refreshInBackground]);

  // Track activity
  useEffect(() => {
    if (!gameId || game?.status !== 'in_progress') return;
    const handleActivity = () => { lastUserActivityRef.current = Date.now(); };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    const activityInterval = setInterval(async () => {
      if (Date.now() - lastUserActivityRef.current < 5 * 60 * 1000) {
        try { await gameService.updateActivity(gameId); } catch { /* silent */ }
      }
    }, 5 * 60 * 1000);
    return () => { events.forEach(e => window.removeEventListener(e, handleActivity)); clearInterval(activityInterval); };
  }, [gameId, game?.status]);

  // Check idle
  useEffect(() => {
    if (!gameId || game?.status !== 'in_progress') return;
    const checkIdle = async () => {
      try {
        const data = await gameService.checkIdleStatus(gameId);
        if (data.gameEnded && data.endReason === 'idle_timeout') { setIdleEnded(true); setShowIdleWarning(false); return; }
        if (data.remainingMs && data.remainingMs <= 5 * 60 * 1000) { setIdleTimeRemaining(data.remainingMs); setShowIdleWarning(true); }
        else { setShowIdleWarning(false); setIdleTimeRemaining(null); }
      } catch { /* silent */ }
    };
    checkIdle();
    const idleCheck = setInterval(checkIdle, 30000);
    return () => clearInterval(idleCheck);
  }, [gameId, game?.status]);

  // Handle browser back button - show leave confirmation
  useEffect(() => {
    const handlePopState = (e) => {
      e.preventDefault();
      // Show end game confirmation instead of directly leaving
      setShowEndConfirm(true);
      // Push state back so they stay on page
      window.history.pushState({ inGame: true }, '');
    };

    // Push a state to history so we can intercept back
    window.history.pushState({ inGame: true }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleStayActive = async () => {
    try { await gameService.updateActivity(gameId); setShowIdleWarning(false); setIdleTimeRemaining(null); lastUserActivityRef.current = Date.now(); soundService.playClick(); }
    catch (err) { setError(err.message); }
  };

  if (!user) return <Navigate to="/" replace />;

  const isHost = game?.host?._id === user._id || game?.host === user._id;
  const currentPlayer = game?.players?.find(p => (p.user?._id || p.user) === user._id);

  // ---- Handlers ----
  const handleTransfer = async () => {
    if (!selectedPlayer || !amount || parseInt(amount) <= 0) return;
    const transferAmount = parseInt(amount);
    const recipientId = selectedPlayer.user?._id || selectedPlayer.user;
    setGame(prev => ({ ...prev, players: prev.players.map(p => {
      const pid = p.user?._id || p.user;
      if (pid === user._id) return { ...p, balance: p.balance - transferAmount };
      if (pid === recipientId) return { ...p, balance: p.balance + transferAmount };
      return p;
    })}));
    setShowTransferModal(false); setSelectedPlayer(null); setAmount(''); setDescription('');
    soundService.playSuccess();
    try {
      setIsProcessing(true);
      const data = await gameService.transferMoney(gameId, recipientId, transferAmount, 'transfer',
        description || `Transfer to ${selectedPlayer.user?.displayName || selectedPlayer.user?.username}`);
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) { setError(err.message); refreshInBackground(); }
    finally { setIsProcessing(false); }
  };

  const handleBankTransaction = async () => {
    if (!amount || parseInt(amount) <= 0) return;
    const transactionAmount = parseInt(amount);
    if (bankAction === 'receive') {
      if (hasPendingBankRequest) { setError('You already have a pending bank receive request'); return; }
      setShowBankModal(false); setAmount(''); soundService.playClick();
      try {
        const data = await gameService.requestBankReceive(gameId, transactionAmount, description || 'Received from bank');
        setHasPendingBankRequest(true); if (data.pendingApprovals) setPendingApprovals(data.pendingApprovals);
        setDescription('');
      } catch (err) { setError(err.message); }
      return;
    }
    setGame(prev => ({ ...prev, players: prev.players.map(p => {
      if ((p.user?._id || p.user) === user._id) return { ...p, balance: p.balance - transactionAmount };
      return p;
    })}));
    setShowBankModal(false); setAmount(''); setDescription(''); soundService.playSuccess();
    try {
      setIsProcessing(true);
      const data = await gameService.transferMoney(gameId, null, transactionAmount, 'bank_pay', description || 'Paid to bank');
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) { setError(err.message); refreshInBackground(); }
    finally { setIsProcessing(false); }
  };

  const handleCollectGo = async () => {
    if (hasPendingGoRequest) { setError('You already have a pending GO request'); return; }
    try { soundService.playClick(); const data = await gameService.requestGoSalary(gameId);
      setHasPendingGoRequest(true); if (data.pendingApprovals) setPendingApprovals(data.pendingApprovals);
    } catch (err) { setError(err.message); }
  };

  const handleApproveRequest = async (requestId, approved) => {
    try { soundService.playClick();
      const data = await gameService.approveRequest(gameId, requestId, approved);
      if (data.players) setGame(prev => ({ ...prev, players: data.players }));
      if (data.pendingApprovals) setPendingApprovals(data.pendingApprovals);
      if (approved) soundService.playSuccess();
    } catch (err) { setError(err.message); }
  };

  const buildSummaryData = (extra = {}) => ({
    gameName: game.name, gameCode: game.code,
    players: game.players.map(p => ({
      name: p.user?.displayName || p.user?.username, avatar: p.user?.avatar,
      balance: p.balance, color: p.color, properties: p.properties || [],
      isYou: (p.user?._id || p.user) === user._id,
    })).sort((a, b) => b.balance - a.balance),
    wasHost: isHost,
    totalTransactions: game.transactions?.length || 0,
    gameDuration: game.startedAt ? Math.floor((Date.now() - new Date(game.startedAt).getTime()) / 60000) : 0,
    ...extra,
  });

  const handleEndGame = async () => {
    try { soundService.playClick(); await gameService.endGame(gameId);
      setLeaveSummaryData(buildSummaryData({ endedManually: true }));
      setShowEndConfirm(false); setShowLeaveSummary(true);
    } catch (err) { setError(err.message); }
  };

  const handleSaveGame = async () => {
    try { soundService.playSuccess(); await gameService.saveGame(gameId);
      setLeaveSummaryData(buildSummaryData({ wasSaved: true }));
      setShowEndConfirm(false); setShowLeaveSummary(true);
    } catch (err) { setError(err.message); }
  };

  const handleLeaveGame = async () => {
    try { soundService.playClick(); const result = await gameService.leaveGame(gameId);
      if (result.gameInfo?.wasInProgress) {
        setLeaveSummaryData({ gameName: result.gameInfo.name, gameCode: result.gameInfo.code,
          players: result.gameInfo.players.map(p => ({ name: p.displayName, balance: p.balance, color: p.color })),
          wasHost: isHost, leftGame: true });
        setShowEndConfirm(false); setShowLeaveSummary(true);
      } else { navigate('/dashboard'); }
    } catch (err) { setError(err.message); }
  };

  const handleCloseSummary = () => { setShowLeaveSummary(false); navigate('/dashboard'); };

  // Property handlers
  const handleBuyProperty = async (property) => {
    try { soundService.playClick();
      const data = await gameService.buyProperty(gameId, property.name, property.colorGroup, property.price);
      setGame(prev => ({ ...prev, players: data.players })); soundService.playSuccess();
    } catch (err) { setError(err.message); }
  };

  const handleSellProperty = async (propertyName) => {
    const prop = MONOPOLY_PROPERTIES.find(p => p.name === propertyName);
    try { soundService.playClick();
      const data = await gameService.sellProperty(gameId, propertyName, prop ? Math.floor(prop.price / 2) : 0);
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) { setError(err.message); }
  };

  const handleManageHouse = async (propertyName, action) => {
    try { soundService.playClick();
      const prop = MONOPOLY_PROPERTIES.find(p => p.name === propertyName);
      const cost = prop?.houseCost || 0;
      const data = await gameService.manageHouse(gameId, propertyName, action, cost);
      setGame(prev => ({ ...prev, players: data.players }));
      if (action === 'add') soundService.playSuccess();
    } catch (err) { setError(err.message); }
  };

  const handleMortgage = async (propertyName, action) => {
    const prop = MONOPOLY_PROPERTIES.find(p => p.name === propertyName);
    const mortgageValue = prop ? Math.floor(prop.price / 2) : 0;
    const unmortgageCost = prop ? Math.floor(prop.price * 0.55) : 0;
    try { soundService.playClick();
      const data = await gameService.mortgageProperty(gameId, propertyName, action, action === 'mortgage' ? mortgageValue : unmortgageCost);
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) { setError(err.message); }
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  const formatMoney = (amt) => `£${amt?.toLocaleString() || 0}`;
  const otherPlayers = game?.players?.filter(p => (p.user?._id || p.user) !== user._id) || [];

  const allOwnedProperties = useMemo(() => {
    const owned = new Map();
    game?.players?.forEach(p => {
      p.properties?.forEach(prop => {
        owned.set(prop.name, { ...prop, owner: p.user?.displayName || p.user?.username, ownerColor: p.color, ownerId: p.user?._id || p.user });
      });
    });
    return owned;
  }, [game?.players]);

  const ownershipByPlayer = useMemo(() => {
    return (game?.players || []).map((player) => ({
      id: player.user?._id || player.user,
      name: player.user?.displayName || player.user?.username,
      color: player.color,
      token: player.token,
      properties: player.properties || [],
    }));
  }, [game?.players]);

  const availableProperties = useMemo(() => MONOPOLY_PROPERTIES.filter(p => !allOwnedProperties.has(p.name)), [allOwnedProperties]);

  // Group owned properties by category
  const groupedMyProperties = useMemo(() => {
    const props = currentPlayer?.properties || [];
    const groups = {};
    props.forEach(p => {
      if (!groups[p.colorGroup]) groups[p.colorGroup] = [];
      groups[p.colorGroup].push(p);
    });
    return groups;
  }, [currentPlayer?.properties]);

  // Calculate player net worth: balance + property values + house values
  const calculateNetWorth = (player) => {
    let netWorth = player.balance || 0;
    (player.properties || []).forEach(prop => {
      const propData = MONOPOLY_PROPERTIES.find(p => p.name === prop.name);
      if (propData) {
        netWorth += propData.price; // Add property value
        netWorth += (prop.houses || 0) * (propData.houseCost || 0); // Add house values
        if (prop.mortgaged) netWorth -= Math.floor(propData.price / 2); // Subtract mortgage loss
      }
    });
    return netWorth;
  };

  // Calculate player stats with detailed breakdown
  const calculatePlayerStats = (player) => {
    let spent = 0, propertyValue = 0, housesValue = 0;
    (player.properties || []).forEach(prop => {
      const propData = MONOPOLY_PROPERTIES.find(p => p.name === prop.name);
      if (propData) {
        propertyValue += propData.price;
        housesValue += (prop.houses || 0) * (propData.houseCost || 0);
        spent += propData.price + ((prop.houses || 0) * (propData.houseCost || 0));
      }
    });
    return { netWorth: calculateNetWorth(player), propertyValue, housesValue, spent };
  };

  const gameStats = useMemo(() => {
    if (!game) return null;
    const playerStats = game.players?.map(p => calculatePlayerStats(p)) || [];
    return {
      totalMoney: game.players?.reduce((s, p) => s + p.balance, 0) || 0,
      totalProperties: game.players?.reduce((s, p) => s + (p.properties?.length || 0), 0) || 0,
      totalHouses: game.players?.reduce((s, p) => s + (p.properties?.reduce((h, pr) => h + (pr.houses || 0), 0) || 0), 0) || 0,
      duration: game.startedAt ? Math.floor((Date.now() - new Date(game.startedAt).getTime()) / 60000) : 0,
      totalTransactions: game.transactions?.length || 0,
      playerStats,
      topNetWorth: Math.max(...playerStats.map(s => s.netWorth)),
    };
  }, [game]);

  // --- RENDER ---
  if (isLoading) {
    return (
      <div className="game-session">
        <div className="bg-blob bg-blob--pink"></div><div className="bg-blob bg-blob--beige"></div><div className="bg-blob bg-blob--purple"></div>
        <div className="loading-container"><div className="spinner"></div><p>Loading game...</p></div>
      </div>
    );
  }

  // Game ended / idle — full summary screen
  if ((game?.status === 'finished' || idleEnded) && !showLeaveSummary) {
    const isIdleTimeout = idleEnded || game?.endReason === 'idle_timeout';
    const isSaved = game?.endReason === 'saved';
    const sortedPlayers = [...(game?.players || [])].sort((a, b) => b.balance - a.balance);
    return (
      <div className="game-session">
        <div className="bg-blob bg-blob--pink"></div><div className="bg-blob bg-blob--beige"></div><div className="bg-blob bg-blob--purple"></div>
        <div className="game-ended-full">
          <div className="ended-hero">
            <img src={mrMonopolyImg} alt="" className="ended-mascot" />
            <h1>{isSaved ? '💾 Game Saved' : isIdleTimeout ? '⏸ Game Paused' : '🏁 Game Over'}</h1>
            <p className="ended-subtitle">
              {isSaved ? 'Your game has been saved. Resume anytime from your dashboard.'
                : isIdleTimeout ? 'Game paused due to 30 minutes of inactivity.' : 'Thanks for playing!'}
            </p>
            <span className="ended-game-name">{game?.name} • {game?.code}</span>
          </div>
          <div className="ended-standings">
            <h3>Final Standings</h3>
            {sortedPlayers.map((player, idx) => {
              const isYou = (player.user?._id || player.user) === user?._id;
              return (
                <div key={idx} className={`ended-player-row ${isYou ? 'is-you' : ''} ${idx === 0 ? 'winner' : ''}`}>
                  <span className="ended-rank">{idx === 0 ? '👑' : `#${idx + 1}`}</span>
                  <div className="ended-player-avatar">
                    {player.user?.avatar ? <img src={player.user.avatar} alt="" /> :
                      <span>{getInitials(player.user?.displayName || player.user?.username)}</span>}
                    <div className={`mini-dot ${player.color}`}></div>
                  </div>
                  <div className="ended-player-info">
                    <span className="ended-player-name">
                      {player.user?.displayName || player.user?.username}
                      {isYou && <span className="you-tag">You</span>}
                    </span>
                    <span className="ended-player-props">
                      {player.properties?.length || 0} properties • {player.properties?.reduce((h, p) => h + (p.houses || 0), 0) || 0} houses
                    </span>
                  </div>
                  <span className="ended-player-balance">{formatMoney(player.balance)}</span>
                </div>
              );
            })}
          </div>
          {game?.startedAt && (
            <div className="ended-stats-grid">
              <div className="ended-stat"><span className="ended-stat-value">{Math.floor((Date.now() - new Date(game.startedAt).getTime()) / 60000)} min</span><span className="ended-stat-label">Duration</span></div>
              <div className="ended-stat"><span className="ended-stat-value">{game.transactions?.length || 0}</span><span className="ended-stat-label">Transactions</span></div>
              <div className="ended-stat"><span className="ended-stat-value">{game.players?.reduce((s, p) => s + (p.properties?.length || 0), 0) || 0}</span><span className="ended-stat-label">Properties</span></div>
              <div className="ended-stat"><span className="ended-stat-value">{game.players?.length}</span><span className="ended-stat-label">Players</span></div>
            </div>
          )}
          <button className="ended-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-session">
      <div className="bg-blob bg-blob--pink"></div><div className="bg-blob bg-blob--beige"></div><div className="bg-blob bg-blob--purple"></div>

      {/* Header */}
      <header className="session-header">
        <div className="header-left"><span className="game-code-badge">{game?.code}</span></div>
        <div className="header-center">
          <img src={mrMonopolyImg} alt="" className="header-logo" />
          <span className="header-title">{game?.name}</span>
        </div>
        <button className="menu-btn" onClick={() => { soundService.playClick(); setShowEndConfirm(true); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </header>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-header">
          <span className="balance-label">Your Balance</span>
          <div className="balance-identity">
            {currentPlayer?.token && <span className="balance-token"><TokenIcon token={currentPlayer.token} size={32} color="#fff" /></span>}
            <div className={`color-dot ${currentPlayer?.color}`}></div>
          </div>
        </div>
        <div className="balance-amount">{formatMoney(currentPlayer?.balance)}</div>
        <div className="balance-meta">
          <span>{currentPlayer?.properties?.length || 0} properties</span>
          <span className="meta-dot">•</span>
          <span>{currentPlayer?.properties?.reduce((h, p) => h + (p.houses || 0), 0) || 0} houses</span>
        </div>
      </div>

      {/* Recent Transactions Preview - only show when NOT on stats tab */}
      {activeTab !== 'stats' && (game?.transactions?.length || 0) > 0 && (
        <div className="recent-transactions-preview">
          <div className="recent-header">
            <span className="recent-title">Recent Activity</span>
            <button className="see-all-btn" onClick={() => setActiveTab('stats')}>See all</button>
          </div>
          <div className="recent-list">
            {(game?.transactions || []).slice().reverse().slice(0, 3).map((tx, idx) => {
              const fromPlayer = game?.players?.find(p => String(p.user?._id || p.user) === String(tx.from));
              const toPlayer = game?.players?.find(p => String(p.user?._id || p.user) === String(tx.to));
              const isBankTx = tx.type === 'bank_pay' || tx.type === 'bank_receive' || tx.type === 'go_salary';
              
              // For bank transactions, check type; for player transactions, check IDs
              const isIncoming = isBankTx 
                ? (tx.type === 'bank_receive' || tx.type === 'go_salary') && String(tx.to?._id || tx.to) === String(user._id)
                : String(tx.to?._id || tx.to) === String(user._id);
              const isOutgoing = isBankTx 
                ? tx.type === 'bank_pay' && String(tx.from?._id || tx.from) === String(user._id)
                : String(tx.from?._id || tx.from) === String(user._id);
              
              let icon = '💸';
              if (tx.type === 'go_salary') icon = '🎯';
              else if (tx.type === 'bank_receive' || tx.type === 'bank_pay') icon = '🏦';
              else if (tx.type === 'rent') icon = '🏠';
              
              return (
                <div key={idx} className={`recent-item ${isIncoming ? 'incoming' : ''} ${isOutgoing ? 'outgoing' : ''}`}>
                  <span className="recent-icon">{icon}</span>
                  <div className="recent-info">
                    <span className="recent-parties">
                      {isBankTx 
                        ? (tx.type === 'bank_pay' ? `${fromPlayer?.user?.displayName || 'You'} → Bank` : `Bank → ${toPlayer?.user?.displayName || 'You'}`)
                        : `${fromPlayer?.user?.displayName || '?'} → ${toPlayer?.user?.displayName || '?'}`}
                    </span>
                  </div>
                  <span className={`recent-amount ${isIncoming ? 'positive' : ''} ${isOutgoing ? 'negative' : ''}`}>
                    {isIncoming ? '+' : isOutgoing ? '-' : ''}£{tx.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="session-tabs">
        {['actions', 'properties', 'stats'].map(tab => (
          <button key={tab} className={`session-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'actions' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 8l-8 8M8 8l8 8"/></svg>}
            {tab === 'properties' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            {tab === 'stats' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ======= Actions Tab ======= */}
      {activeTab === 'actions' && (
        <div className="tab-content">
          <div className="quick-actions">
            <button className={`quick-action collect-go ${hasPendingGoRequest ? 'pending' : ''}`} onClick={handleCollectGo} disabled={hasPendingGoRequest}>
              <div className="qa-icon go-icon">
                <span className="go-pound">£</span>
              </div>
              <span className="qa-label">{hasPendingGoRequest ? 'Pending...' : 'Collect GO'}</span>
              <span className="qa-amount">+£{game?.goSalary || 200}</span>
            </button>
            <button className="quick-action bank" onClick={() => { soundService.playClick(); setAmount('1'); setShowBankModal(true); }}>
              <div className="qa-icon bank-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18"/><path d="M3 10h18"/><path d="M12 3l9 7H3l9-7z"/><path d="M5 10v11"/><path d="M19 10v11"/><path d="M9 10v11"/><path d="M15 10v11"/>
                </svg>
              </div>
              <span className="qa-label">Bank</span>
            </button>
          </div>

          {/* Pending Approvals */}
          {pendingApprovals.filter(r => (r.approver?._id || r.approver) === user._id).length > 0 && (
            <div className="pending-requests-section">
              <h3>Pending Requests</h3>
              <div className="pending-requests-list">
                {pendingApprovals.filter(r => (r.approver?._id || r.approver) === user._id).map(request => (
                  <div key={request._id} className="pending-request-item">
                    <div className="request-player-info">
                      <div className="request-avatar">
                        {request.player?.avatar ? <img src={request.player.avatar} alt="" /> :
                          <span>{getInitials(request.player?.displayName || request.player?.username)}</span>}
                      </div>
                      <div className="request-details">
                        <span className="request-player-name">{request.player?.displayName || request.player?.username}</span>
                        <span className="request-amount">{request.type === 'go_salary' ? 'Collect GO' : 'Bank Receive'} +£{request.amount}</span>
                        {request.description && <span className="request-description">{request.description}</span>}
                      </div>
                    </div>
                    <div className="request-actions">
                      <button className="btn-approve" onClick={() => handleApproveRequest(request._id, true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button className="btn-deny" onClick={() => handleApproveRequest(request._id, false)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pay a Player */}
          <div className="players-section">
            <h3>Pay a Player</h3>
            <div className="players-list">
              {otherPlayers.map((player, index) => (
                <button key={player.user?._id || index} className="player-row"
                  onClick={() => { soundService.playClick(); setSelectedPlayer(player); setAmount('1'); setShowTransferModal(true); }}>
                  <div className="player-avatar">
                    {player.user?.avatar ? <img src={player.user.avatar} alt="" /> :
                      <span>{getInitials(player.user?.displayName || player.user?.username)}</span>}
                    <div className={`color-dot ${player.color}`}></div>
                  </div>
                  <div className="player-details">
                    <span className="player-name">
                      {player.token && <span className="player-token-icon"><TokenIcon token={player.token} size={18} color="#555" /> </span>}
                      {player.user?.displayName || player.user?.username}
                    </span>
                    <span className="player-balance">{formatMoney(player.balance)}</span>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======= Properties Tab ======= */}
      {activeTab === 'properties' && (
        <div className="tab-content">
          <div className="my-properties-section">
            <div className="section-header-row">
              <h3>My Properties ({currentPlayer?.properties?.length || 0})</h3>
              <button className="buy-property-btn" onClick={() => setShowPropertyModal(true)}>+ Buy</button>
            </div>

            {currentPlayer?.properties?.length > 0 ? (
              <div className="property-groups-container">
                {Object.entries(groupedMyProperties).map(([group, props]) => (
                  <div key={group} className="property-group-section">
                    <div className="group-label-row">
                      <div className="group-dot" style={{ background: COLOR_GROUP_COLORS[group] }}></div>
                      <span className="group-label-text">{GROUP_LABELS[group] || group}</span>
                      <span className="group-count">{props.length}</span>
                    </div>
                    <div className="property-carousel">
                      <div className="carousel-track">
                        {props.map((prop, idx) => {
                          const propData = MONOPOLY_PROPERTIES.find(mp => mp.name === prop.name);
                          const mortgageVal = propData ? Math.floor(propData.price / 2) : 0;
                          const isExpanded = expandedPropCard === prop.name;
                          return (
                            <div key={idx} className={`prop-card ${prop.mortgaged ? 'mortgaged' : ''} ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => setExpandedPropCard(isExpanded ? null : prop.name)}>
                              <div className="prop-card-color" style={{ background: COLOR_GROUP_COLORS[prop.colorGroup] }}></div>
                              <div className="prop-card-body">
                                <span className="prop-card-name">{prop.name}</span>
                                <span className="prop-card-price">{formatMoney(propData?.price)}</span>
                                {prop.mortgaged && <span className="mortgage-badge">MORTGAGED</span>}
                                {!prop.mortgaged && (
                                  <div className="prop-card-houses">
                                    {prop.houses === 5 ? <span className="hotel-icon">🏨</span> :
                                      prop.houses > 0 ? [...Array(prop.houses)].map((_, i) => <span key={i} className="house-icon">🏠</span>) :
                                      <span className="no-dev">No houses</span>}
                                  </div>
                                )}
                              </div>
                              {isExpanded && (
                                <div className="prop-card-actions" onClick={e => e.stopPropagation()}>
                                  {!prop.mortgaged && (
                                    <>
                                      {(() => { const propData = MONOPOLY_PROPERTIES.find(p => p.name === prop.name); return <button className="pca-btn add" onClick={() => handleManageHouse(prop.name, 'add')} disabled={prop.houses >= 5 || currentPlayer.balance < (propData?.houseCost || 0)}>+🏠 £{propData?.houseCost || 0}</button>; })()}
                                      {prop.houses > 0 && <button className="pca-btn remove" onClick={() => handleManageHouse(prop.name, 'remove')}>-🏠</button>}
                                      <button className="pca-btn mortgage" onClick={() => handleMortgage(prop.name, 'mortgage')}>
                                        Mortgage £{mortgageVal}
                                      </button>
                                    </>
                                  )}
                                  {prop.mortgaged && (
                                    <button className="pca-btn unmortgage" onClick={() => handleMortgage(prop.name, 'unmortgage')}>
                                      Unmortgage £{Math.floor((propData?.price || 0) * 0.55)}
                                    </button>
                                  )}
                                  <button className="pca-btn sell" onClick={() => handleSellProperty(prop.name)}>Sell £{mortgageVal}</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-properties">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <p>No properties yet</p>
                <span>Buy properties when you land on them</span>
                <button className="buy-property-btn lg" onClick={() => setShowPropertyModal(true)}>Browse Properties</button>
              </div>
            )}
          </div>

          {otherPlayers.some(p => (p.properties?.length || 0) > 0) && (
            <div className="other-properties-section">
              <h3>Other Players' Properties</h3>
              {otherPlayers.filter(p => (p.properties?.length || 0) > 0).map((player, idx) => (
                <div key={idx} className="other-player-props">
                  <div className="other-player-header">
                    <div className={`mini-dot ${player.color}`}></div>
                    <span>{player.token && <span className="player-token-icon"><TokenIcon token={player.token} size={16} color="#555" /> </span>}{player.user?.displayName || player.user?.username}</span>
                    <span className="prop-count">{player.properties.length}</span>
                  </div>
                  <div className="other-props-carousel">
                    {player.properties.map((prop, pidx) => (
                      <div key={pidx} className={`other-prop-chip ${prop.mortgaged ? 'mortgaged' : ''}`}>
                        <div className="chip-color" style={{ background: COLOR_GROUP_COLORS[prop.colorGroup] || '#ccc' }}></div>
                        <span>{prop.name}</span>
                        {prop.mortgaged && <span className="chip-mort">M</span>}
                        {!prop.mortgaged && prop.houses > 0 && <span className="chip-houses">{prop.houses === 5 ? '🏨' : `${prop.houses}🏠`}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======= Stats Tab ======= */}
      {activeTab === 'stats' && (
        <div className="tab-content">
          <div className="game-stats-section">
            <h3>Game Overview</h3>
            <div className="stats-grid">
              <div className="stat-card"><span className="stat-icon">⏱</span><span className="stat-value">{gameStats?.duration || 0} min</span><span className="stat-label">Duration</span></div>
              <div className="stat-card"><span className="stat-icon">💰</span><span className="stat-value">£{gameStats?.totalMoney?.toLocaleString()}</span><span className="stat-label">Total Money</span></div>
              <div className="stat-card"><span className="stat-icon">🏠</span><span className="stat-value">{gameStats?.totalProperties}</span><span className="stat-label">Properties</span></div>
              <div className="stat-card"><span className="stat-icon">📊</span><span className="stat-value">{gameStats?.totalTransactions}</span><span className="stat-label">Transactions</span></div>
            </div>
          </div>

          <div className="leaderboard-section">
            <h3>Player Resources</h3>
            {[...(game?.players || [])].sort((a, b) => b.balance - a.balance).map((player, idx) => {
              const isYou = (player.user?._id || player.user) === user._id;
              const netWorth = player.balance + (player.properties?.reduce((sum, p) => {
                const propData = MONOPOLY_PROPERTIES.find(mp => mp.name === p.name);
                return sum + (propData?.price || 0) * (p.mortgaged ? 0.5 : 1);
              }, 0) || 0);
              return (
                <div key={idx} className={`leaderboard-row ${isYou ? 'is-you' : ''}`}>
                  <span className="lb-rank">{idx === 0 ? '👑' : `#${idx + 1}`}</span>
                  <div className="lb-player">
                    <div className={`mini-dot ${player.color}`}></div>
                    <div className="lb-player-info">
                      <span className="lb-name">{player.token && <span className="player-token-icon"><TokenIcon token={player.token} size={18} color="#555" /> </span>}{player.user?.displayName || player.user?.username}{isYou && <span className="you-tag">You</span>}</span>
                      <div className="lb-details">
                        <span>💵 {formatMoney(player.balance)}</span>
                        <span>🏠 {player.properties?.length || 0}</span>
                        <span>🏘 {player.properties?.reduce((h, p) => h + (p.houses || 0), 0) || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="lb-value">
                    <span className="lb-net-worth">{formatMoney(Math.round(netWorth))}</span>
                    <span className="lb-net-label">Net Worth</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ownership-section">
            <h3>Property Ownership</h3>
            {ownershipByPlayer.length === 0 && (
              <div className="ownership-empty">No players in this session yet.</div>
            )}
            {ownershipByPlayer.map((player, idx) => {
              const isYou = String(player.id) === String(user._id);
              return (
                <div key={player.id || idx} className="ownership-player-card">
                  <div className="ownership-player-header">
                    <div className="ownership-player-left">
                      <div className={`mini-dot ${player.color}`}></div>
                      <span className="ownership-player-name">
                        {player.token && <span className="player-token-icon"><TokenIcon token={player.token} size={16} color="#555" /> </span>}
                        {player.name}
                        {isYou && <span className="you-tag">You</span>}
                      </span>
                    </div>
                    <span className="ownership-count">{player.properties.length} properties</span>
                  </div>

                  {player.properties.length > 0 ? (
                    <div className="ownership-chips">
                      {player.properties.map((prop, propIdx) => (
                        <span key={`${player.id || idx}-${prop.name}-${propIdx}`} className={`ownership-chip ${prop.mortgaged ? 'mortgaged' : ''}`}>
                          <span className="ownership-chip-color" style={{ background: COLOR_GROUP_COLORS[prop.colorGroup] || '#ccc' }}></span>
                          {prop.name}
                          {prop.mortgaged && <span className="ownership-chip-mort">M</span>}
                          {!prop.mortgaged && prop.houses > 0 && (
                            <span className="ownership-chip-houses">{prop.houses === 5 ? '🏨' : `${prop.houses}🏠`}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="ownership-empty">No properties owned.</div>
                  )}
                </div>
              );
            })}
          </div>

          {game?.transactions?.length > 0 && (
            <div className="transactions-section">
              <h3>All Transactions</h3>
              <div className="transactions-scroll-container">
                {[...(game.transactions || [])].reverse().map((txn, idx) => {
                  const fromPlayer = game?.players?.find(p => String(p.user?._id || p.user) === String(txn.from?._id || txn.from));
                  const toPlayer = game?.players?.find(p => String(p.user?._id || p.user) === String(txn.to?._id || txn.to));
                  const isBankTx = txn.type === 'bank_pay' || txn.type === 'bank_receive' || txn.type === 'go_salary';
                  
                  // For bank transactions, check type; for player transactions, check IDs
                  const isIncoming = isBankTx 
                    ? (txn.type === 'bank_receive' || txn.type === 'go_salary') && String(txn.to?._id || txn.to) === String(user._id)
                    : String(txn.to?._id || txn.to) === String(user._id);
                  const isOutgoing = isBankTx 
                    ? txn.type === 'bank_pay' && String(txn.from?._id || txn.from) === String(user._id)
                    : String(txn.from?._id || txn.from) === String(user._id);
                  
                  let icon = '💸';
                  if (txn.type === 'go_salary') icon = '🎯';
                  else if (txn.type === 'bank_receive' || txn.type === 'bank_pay') icon = '🏦';
                  else if (txn.type === 'rent') icon = '🏠';
                  else if (txn.type === 'purchase') icon = '🛒';
                  
                  const amountClass = isIncoming ? 'positive' : isOutgoing ? 'negative' : '';
                  
                  return (
                    <div key={idx} className={`transaction-row ${amountClass}`}>
                      <div className={`txn-icon ${txn.type}`}>{icon}</div>
                      <div className="txn-info">
                        <span className="txn-desc">
                          {isBankTx 
                            ? (txn.type === 'bank_pay' 
                                ? `${fromPlayer?.user?.displayName || 'Player'} → Bank` 
                                : `Bank → ${toPlayer?.user?.displayName || 'Player'}`)
                            : `${fromPlayer?.user?.displayName || '?'} → ${toPlayer?.user?.displayName || '?'}`}
                        </span>
                        <span className="txn-time">{new Date(txn.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <span className={`txn-amount ${amountClass}`}>
                        {isIncoming ? '+' : isOutgoing ? '-' : ''}£{txn.amount?.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div className="error-toast">{error}<button onClick={() => setError('')}>×</button></div>}

      {/* Transfer Modal — Scroll Wheel Picker */}
      {showTransferModal && selectedPlayer && (
        <div className="modal-overlay" onClick={() => { setShowTransferModal(false); setSelectedPlayer(null); }}>
          <div className="modal transfer-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Pay {selectedPlayer.user?.displayName || selectedPlayer.user?.username}</h2>
              <button className="modal-close" onClick={() => { setShowTransferModal(false); setSelectedPlayer(null); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="recipient-info">
                <div className="recipient-avatar">
                  {selectedPlayer.user?.avatar ? <img src={selectedPlayer.user.avatar} alt="" /> :
                    <span>{getInitials(selectedPlayer.user?.displayName)}</span>}
                </div>
                <span>Their balance: {formatMoney(selectedPlayer.balance)}</span>
              </div>
              <ScrollWheelPicker value={amount} onChange={setAmount} max={currentPlayer?.balance || 0} step={1} />
              <div className="form-group">
                <label>Note (optional)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Rent, trade, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowTransferModal(false); setSelectedPlayer(null); }}>Cancel</button>
              <button className="btn-primary" onClick={handleTransfer}
                disabled={!amount || parseInt(amount) <= 0 || parseInt(amount) > (currentPlayer?.balance || 0) || isProcessing}>
                {isProcessing ? 'Sending...' : `Pay ${formatMoney(parseInt(amount) || 0)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Modal — Scroll Wheel Picker */}
      {showBankModal && (
        <div className="modal-overlay" onClick={() => setShowBankModal(false)}>
          <div className="modal bank-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bank Transaction</h2>
              <button className="modal-close" onClick={() => setShowBankModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bank-tabs">
                <button className={`bank-tab ${bankAction === 'receive' ? 'active' : ''}`} onClick={() => setBankAction('receive')}>Receive</button>
                <button className={`bank-tab ${bankAction === 'pay' ? 'active' : ''}`} onClick={() => setBankAction('pay')}>Pay</button>
              </div>
              <ScrollWheelPicker value={amount} onChange={setAmount} max={bankAction === 'pay' ? (currentPlayer?.balance || 0) : 10000} step={1} />
              <div className="form-group">
                <label>Reason (optional)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder={bankAction === 'receive' ? 'Property sale, chance card, etc.' : 'Tax, fine, purchase, etc.'} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBankModal(false)}>Cancel</button>
              <button className={`btn-primary ${bankAction === 'pay' ? 'pay' : 'receive'}`}
                onClick={handleBankTransaction}
                disabled={!amount || parseInt(amount) <= 0 || (bankAction === 'pay' && parseInt(amount) > (currentPlayer?.balance || 0)) || isProcessing || (bankAction === 'receive' && hasPendingBankRequest)}>
                {isProcessing ? 'Processing...' :
                  bankAction === 'receive'
                    ? (hasPendingBankRequest ? 'Request Pending...' : `Request ${formatMoney(parseInt(amount) || 0)}`)
                    : `Pay ${formatMoney(parseInt(amount) || 0)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Property Modal */}
      {showPropertyModal && (
        <div className="modal-overlay" onClick={() => setShowPropertyModal(false)}>
          <div className="modal property-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Buy Property</h2>
              <button className="modal-close" onClick={() => setShowPropertyModal(false)}>×</button>
            </div>
            <div className="modal-body property-list-body">
              <div className="buy-balance-hint">Your balance: {formatMoney(currentPlayer?.balance)}</div>
              {availableProperties.length > 0 ? (
                <div className="property-buy-list">
                  {Object.entries(availableProperties.reduce((groups, prop) => {
                    if (!groups[prop.colorGroup]) groups[prop.colorGroup] = [];
                    groups[prop.colorGroup].push(prop);
                    return groups;
                  }, {})).map(([group, props]) => (
                    <div key={group} className="property-group">
                      <div className="property-group-header">
                        <div className="group-color-bar" style={{ background: COLOR_GROUP_COLORS[group] || '#ccc' }}></div>
                        <span className="group-name">{GROUP_LABELS[group] || group}</span>
                      </div>
                      {props.map((prop, idx) => (
                        <div key={idx} className="property-buy-item">
                          <div className="property-buy-info">
                            <span className="property-buy-name">{prop.name}</span>
                            <span className="property-buy-price">{formatMoney(prop.price)}</span>
                          </div>
                          <button className="property-buy-btn" onClick={() => handleBuyProperty(prop)}
                            disabled={(currentPlayer?.balance || 0) < prop.price}>
                            {(currentPlayer?.balance || 0) < prop.price ? 'Can\'t afford' : 'Buy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="all-properties-owned"><p>All properties have been purchased!</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Idle Warning */}
      {showIdleWarning && (
        <div className="modal-overlay idle-warning-overlay">
          <div className="modal idle-warning-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header warning-header"><h2>⚠️ Inactivity Warning</h2></div>
            <div className="modal-body">
              <p className="warning-text">This game will end due to inactivity in{' '}
                <strong>{idleTimeRemaining ? `${Math.floor(idleTimeRemaining / 60000)}:${String(Math.floor((idleTimeRemaining % 60000) / 1000)).padStart(2, '0')}` : '5:00'}</strong>
              </p>
              <p className="warning-subtext">Click below to keep the game active.</p>
              <button className="btn-primary stay-active-btn" onClick={handleStayActive}>Keep Game Active</button>
            </div>
          </div>
        </div>
      )}

      {/* Game Menu */}
      {showEndConfirm && (
        <div className="modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Game Menu</h2><button className="modal-close" onClick={() => setShowEndConfirm(false)}>×</button></div>
            <div className="modal-body">
              <button className="menu-action" onClick={handleLeaveGame}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Leave Game
              </button>
              {isHost && (
                <button className="menu-action save" onClick={handleSaveGame}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save Game
                  <span className="menu-action-hint">Resume later from dashboard</span>
                </button>
              )}
              {isHost && (
                <button className="menu-action danger" onClick={handleEndGame}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                  End Game for Everyone
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Summary */}
      {showLeaveSummary && leaveSummaryData && (
        <div className="modal-overlay summary-overlay">
          <div className="modal summary-modal" onClick={e => e.stopPropagation()}>
            <div className="summary-header">
              <h2>{leaveSummaryData.wasSaved ? '💾 Game Saved' : '🏁 Game Summary'}</h2>
              <span className="summary-game-name">{leaveSummaryData.gameName}</span>
            </div>
            <div className="summary-body">
              {leaveSummaryData.wasSaved && <p className="summary-note saved">✅ Game saved successfully! Resume anytime from your dashboard.</p>}
              {leaveSummaryData.gameDuration > 0 && (
                <div className="summary-stats-row">
                  <div className="summary-stat"><span className="summary-stat-val">{leaveSummaryData.gameDuration} min</span><span className="summary-stat-lbl">Duration</span></div>
                  <div className="summary-stat"><span className="summary-stat-val">{leaveSummaryData.totalTransactions}</span><span className="summary-stat-lbl">Transactions</span></div>
                  <div className="summary-stat"><span className="summary-stat-val">{leaveSummaryData.players?.length}</span><span className="summary-stat-lbl">Players</span></div>
                </div>
              )}
              <h3>Final Standings</h3>
              <div className="standings-list">
                {leaveSummaryData.players.map((player, idx) => (
                  <div key={idx} className={`standing-row ${player.isYou ? 'is-you' : ''}`}>
                    <span className="standing-rank">{idx === 0 ? '👑' : `#${idx + 1}`}</span>
                    <div className={`standing-color ${player.color}`}></div>
                    <div className="standing-info">
                      <span className="standing-name">{player.name}{player.isYou && <span className="you-badge">You</span>}</span>
                      {player.properties?.length > 0 && <span className="standing-props">{player.properties.length} properties</span>}
                    </div>
                    <span className="standing-balance">£{player.balance?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {leaveSummaryData.wasHost && !leaveSummaryData.endedManually && !leaveSummaryData.wasSaved && (
                <p className="summary-note">💾 Game has been saved. Resume from dashboard.</p>
              )}
            </div>
            <div className="summary-footer"><button className="btn-primary" onClick={handleCloseSummary}>Back to Dashboard</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameSession;
