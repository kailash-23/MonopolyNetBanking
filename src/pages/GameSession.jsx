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

// Define property board order for sorting
const PROPERTY_ORDER = new Map(MONOPOLY_PROPERTIES.map((property, index) => [property.name, index]));

/* ====== Simple Amount Input ====== */
function AmountInput({ value, onChange, max, min = 1 }) {
  const handleInputChange = (val) => {
    // Allow empty input
    if (val === '' || val === '-') {
      onChange(val);
      return;
    }
    const num = parseInt(val) || 0;
    if (num <= 0) {
      onChange('');
      return;
    }
    const clamped = Math.max(min || 1, Math.min(num, max || 99999));
    onChange(String(clamped));
  };

  return (
    <div className="amount-picker">
      <div className="type-input-area">
        <div className="wheel-input-wrapper">
          <span className="wheel-currency">£</span>
          <input
            type="number"
            className="wheel-text-input"
            value={value}
            onChange={e => handleInputChange(e.target.value)}
            autoFocus
            placeholder=""
            min={min || 1}
            max={max}
          />
        </div>
      </div>
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
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeProperty, setTradeProperty] = useState(null);
  const [tradeBuyerId, setTradeBuyerId] = useState('');
  const [tradeAmount, setTradeAmount] = useState('');
  const [expandedPropCard, setExpandedPropCard] = useState(null);
  
  // Trade modal state - additional
  const [tradeBuyerMenuOpen, setTradeBuyerMenuOpen] = useState(false);
  const [tradeWaiting, setTradeWaiting] = useState(false);
  const [tradeRequestId, setTradeRequestId] = useState(null);
  const [tradeResult, setTradeResult] = useState(null);
  
  // Approval modal timer
  const [approvalTimer, setApprovalTimer] = useState(15);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const approvalTimerRef = useRef();

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

  // Approval modal logic for buyer (with timer for property trades)
  useEffect(() => {
    const myApproval = pendingApprovals.find(r => (r.approver?._id || r.approver) === user._id);
    if (myApproval) {
      setApprovalRequest(myApproval);
      setShowApprovalModal(true);
      if (myApproval.type === 'property_trade') {
        setApprovalTimer(15);
        if (approvalTimerRef.current) clearInterval(approvalTimerRef.current);
        approvalTimerRef.current = setInterval(() => {
          setApprovalTimer(prev => {
            if (prev <= 1) {
              clearInterval(approvalTimerRef.current);
              handleApproveRequest(myApproval._id, false); // auto-reject
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      setShowApprovalModal(false);
      setApprovalRequest(null);
      setApprovalTimer(15);
      if (approvalTimerRef.current) clearInterval(approvalTimerRef.current);
    }
    // eslint-disable-next-line
  }, [pendingApprovals, user._id]);

  // Seller: watch for trade result
  useEffect(() => {
    if (!tradeWaiting || !tradeRequestId) return;
    const req = pendingApprovals.find(r => r._id === tradeRequestId);
    if (req && req.status !== 'pending') {
      setTradeResult({ status: req.status, message: req.status === 'approved' ? 'Buyer accepted your offer!' : req.status === 'denied' ? 'Buyer rejected your offer.' : 'Request ended.' });
      setTradeWaiting(false);
      setTradeRequestId(null);
      setTimeout(() => {
        setShowTradeModal(false);
        setTradeResult(null);
      }, 3000);
    }
  }, [pendingApprovals, tradeWaiting, tradeRequestId]);

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
  const handleTransfer = useCallback(async () => {
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
  }, [selectedPlayer, amount, gameId, description, user._id]);

  const handleBankTransaction = useCallback(async () => {
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
  }, [amount, bankAction, gameId, description, user._id, hasPendingBankRequest]);

  const handleCollectGo = useCallback(async () => {
    if (hasPendingGoRequest) { setError('You already have a pending GO request'); return; }
    try { soundService.playClick(); const data = await gameService.requestGoSalary(gameId);
      setHasPendingGoRequest(true); if (data.pendingApprovals) setPendingApprovals(data.pendingApprovals);
    } catch (err) { setError(err.message); }
  }, [gameId, hasPendingGoRequest]);

  const handleApproveRequest = useCallback(async (requestId, approved) => {
    try { soundService.playClick();
      const data = await gameService.approveRequest(gameId, requestId, approved);
      if (data.players) setGame(prev => ({ ...prev, players: data.players }));
      if (data.pendingApprovals) setPendingApprovals(data.pendingApprovals);
      if (approved) soundService.playSuccess();
    } catch (err) { setError(err.message); }
  }, [gameId]);

  const openTradeModal = useCallback((propertyName) => {
    setTradeProperty(propertyName);
    setTradeAmount('');
    setTradeBuyerId('');
    setShowTradeModal(true);
  }, []);

  const closeTradeModal = useCallback(() => {
    setShowTradeModal(false);
    setTradeProperty(null);
    setTradeBuyerId('');
    setTradeBuyerMenuOpen(false);
    setTradeAmount('');
    setTradeWaiting(false);
    setTradeResult(null);
  }, []);

  const handleRequestPropertyTrade = async () => {
    if (!tradeProperty || !tradeBuyerId || !tradeAmount || parseInt(tradeAmount, 10) <= 0) {
      setError('Choose a buyer and valid amount for the property trade');
      return;
    }
    try {
      setIsProcessing(true);
      soundService.playClick();
      const data = await gameService.requestPropertyTrade(gameId, tradeProperty, tradeBuyerId, parseInt(tradeAmount, 10));
      if (data.pendingApprovals) {
        setPendingApprovals(data.pendingApprovals);
        const req = data.pendingApprovals.find(r => r.type === 'property_trade' && (r.player?._id || r.player) === user._id && r.propertyName === tradeProperty && r.status === 'pending');
        if (req) {
          setTradeRequestId(req._id);
          setTradeWaiting(true);
        }
      }
      soundService.playSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const buildSummaryData = (extra = {}) => ({
    gameName: game.name, gameCode: game.code,
    players: game.players.map(p => ({
      name: p.user?.displayName || p.user?.username, avatar: p.user?.avatar,
      balance: p.balance, color: p.color, properties: p.properties || [],
      isYou: (p.user?._id || p.user) === user._id,
    })).sort((a, b) => calculateNetWorth(b) - calculateNetWorth(a)),
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

  const openPropertyTradeModal = (propertyName) => {
    setTradeProperty(propertyName);
    setTradeAmount('');
    setTradeBuyerId('');
    setShowTradeModal(true);
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

  // Group owned properties by category, sorted by board order
  const groupedMyProperties = useMemo(() => {
    const props = currentPlayer?.properties || [];
    const groups = {};
    props.forEach(p => {
      if (!groups[p.colorGroup]) groups[p.colorGroup] = [];
      groups[p.colorGroup].push(p);
    });
    // Sort properties within each group by board order
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) => (PROPERTY_ORDER.get(a.name) ?? 999) - (PROPERTY_ORDER.get(b.name) ?? 999));
    });
    // Sort groups by first property's board position
    const sortedGroups = {};
    Object.entries(groups)
      .sort(([, aProps], [, bProps]) => (PROPERTY_ORDER.get(aProps[0].name) ?? 999) - (PROPERTY_ORDER.get(bProps[0].name) ?? 999))
      .forEach(([group, props]) => {
        sortedGroups[group] = props;
      });
    return sortedGroups;
  }, [currentPlayer?.properties]);

  // Calculate player net worth: balance + property values + house values
  const calculateNetWorth = (player) => {
    let netWorth = player.balance || 0;
    (player.properties || []).forEach(prop => {
      const propData = MONOPOLY_PROPERTIES.find(p => p.name === prop.name);
      if (propData) {
        if (prop.mortgaged) {
          // Mortgaged properties are valued at their mortgage amount
          netWorth += Math.floor(propData.price / 2);
        } else {
          // Unmortgaged properties: add property value + house values
          netWorth += propData.price;
          // Add house values (each house is worth the house cost)
          netWorth += (prop.houses || 0) * (propData.houseCost || 0);
          // Note: Hotels are typically represented as 5 houses, so they're already counted
        }
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
    const sortedPlayers = [...(game?.players || [])].sort((a, b) => calculateNetWorth(b) - calculateNetWorth(a));
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
                    {player.token && <TokenIcon token={player.token} size={14} color="#333" />}
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

      {/* Header - Minimized */}
      <header className="session-header">
        <div className="header-left"></div>
        <div className="header-center"></div>
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
          </div>
        </div>
        <div className="balance-amount">{formatMoney(currentPlayer?.balance)}</div>
        <div className="balance-meta">
          <span>{currentPlayer?.properties?.length || 0} properties</span>
          <span className="meta-dot">•</span>
          <span>{currentPlayer?.properties?.reduce((h, p) => h + (p.houses || 0), 0) || 0} houses</span>
        </div>
      </div>

      {/* Recent Transactions Preview */}
      {(game?.transactions?.length || 0) > 0 && (
        <div className="recent-transactions-preview">
          <div className="recent-header">
            <span className="recent-title">Recent Activity</span>
            <button className="see-all-btn" onClick={() => document.querySelector('.stats-section')?.scrollIntoView({ behavior: 'smooth' })}>See all</button>
          </div>
          <div className="recent-list">
            {(game?.transactions || []).slice().reverse().slice(0, 3).map((tx, idx) => {
              const fromPlayer = game?.players?.find(p => String(p.user?._id || p.user) === String(tx.from));
              const toPlayer = game?.players?.find(p => String(p.user?._id || p.user) === String(tx.to));
              const txFromId = tx.from ? String(tx.from) : null;
              const txToId = tx.to ? String(tx.to) : null;
              const userId = String(user._id);
              const isIncoming = txToId === userId;
              const isOutgoing = txFromId === userId;
              const fromName = tx.from ? (fromPlayer?.user?.displayName || fromPlayer?.user?.username || 'Unknown') : 'Bank';
              const toName = tx.to ? (toPlayer?.user?.displayName || toPlayer?.user?.username || 'Unknown') : 'Bank';
              
              let icon = '💸';
              if (tx.type === 'go_salary') icon = '🎯';
              else if (tx.type === 'bank_receive' || tx.type === 'bank_pay') icon = '🏦';
              else if (tx.type === 'property_purchase') icon = '🏘';
              else if (tx.type === 'rent') icon = '🏠';
              else if (tx.type === 'rent') icon = '🏠';
              
              return (
                <div key={idx} className={`recent-item ${isIncoming ? 'incoming' : ''} ${isOutgoing ? 'outgoing' : ''}`}>
                  <span className="recent-icon">{icon}</span>
                  <div className="recent-info">
                    <span className="recent-parties">
                      {`${fromName} → ${toName}`}
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

      {/* ======= Actions Section ======= */}
      <div className="actions-section">
          <div className="quick-actions">
            <button className={`quick-action collect-go ${hasPendingGoRequest ? 'pending' : ''}`} onClick={handleCollectGo} disabled={hasPendingGoRequest}>
              <div className="qa-icon go-icon">
                <span className="go-pound">£</span>
              </div>
              <span className="qa-label">{hasPendingGoRequest ? 'Pending...' : 'Collect GO'}</span>
              <span className="qa-amount">+£{game?.goSalary || 200}</span>
            </button>
            <button className="quick-action bank" onClick={() => { soundService.playClick(); setAmount('-'); setShowBankModal(true); }}>
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
                    {player.token ? (
                      <span className="player-avatar-token"><TokenIcon token={player.token} size={32} color="#555" /></span>
                    ) : (
                      player.user?.avatar ? <img src={player.user.avatar} alt="" /> :
                      <span>{getInitials(player.user?.displayName || player.user?.username)}</span>
                    )}
                  </div>
                  <div className="player-details">
                    <span className="player-name">
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

      {/* ======= Properties Section ======= */}
      <div className="properties-section">
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
                                    <button className="pca-btn mortgage" onClick={() => handleMortgage(prop.name, 'mortgage')}>
                                      Mortgage £{mortgageVal}
                                    </button>
                                  )}
                                  {prop.mortgaged && (
                                    <button className="pca-btn unmortgage" onClick={() => handleMortgage(prop.name, 'unmortgage')}>
                                      Unmortgage £{Math.floor((propData?.price || 0) * 0.55)}
                                    </button>
                                  )}
                                  <button className="pca-btn sell" onClick={() => openPropertyTradeModal(prop.name)} disabled={prop.mortgaged}>
                                    Offer to Player
                                  </button>
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

      {/* ======= Stats Section ======= */}
      <div className="stats-section">
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
            {[...(game?.players || [])].sort((a, b) => calculateNetWorth(b) - calculateNetWorth(a)).map((player, idx) => {
              const isYou = (player.user?._id || player.user) === user._id;
              const netWorth = calculateNetWorth(player);
              return (
                <div key={idx} className={`leaderboard-row ${isYou ? 'is-you' : ''}`}>
                  <span className="lb-rank">{idx === 0 ? '👑' : `#${idx + 1}`}</span>
                  <div className="lb-player">
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
                      {player.token && <span className="player-token-icon"><TokenIcon token={player.token} size={16} color="#555" /> </span>}
                      <span className="ownership-player-name">
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
              <AmountInput value={amount} onChange={setAmount} max={currentPlayer?.balance || 0} />
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
              <AmountInput value={amount} onChange={setAmount} max={bankAction === 'pay' ? (currentPlayer?.balance || 0) : 10000} />
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

      {/* Trade Modal */}
      {showTradeModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal trade-modal" style={{ maxWidth: 420, padding: 0 }}>
            <div className="modal-header">
              <h2>Offer {tradeProperty}</h2>
            </div>
            <div className="modal-body">
              {tradeWaiting ? (
                <div className="trade-waiting">
                  <p>Waiting for buyer to respond...</p>
                  <div className="spinner" style={{ margin: '16px auto' }}></div>
                  {tradeResult && <div className={`trade-result ${tradeResult.status}`}>{tradeResult.message}</div>}
                </div>
              ) : (
                <>
                  <div className="trade-buyer-row">
                    <span>Buyer</span>
                    <div className="trade-buyer-select" onClick={() => setTradeBuyerMenuOpen(!tradeBuyerMenuOpen)}>
                      {tradeBuyerId ? (
                        <>
                          <span className="trade-buyer-avatar">{otherPlayers.find(p => (p.user?._id || p.user) === tradeBuyerId)?.user?.displayName?.[0] || 'B'}</span>
                          <span>{otherPlayers.find(p => (p.user?._id || p.user) === tradeBuyerId)?.user?.displayName || otherPlayers.find(p => (p.user?._id || p.user) === tradeBuyerId)?.user?.username}</span>
                          <span className="trade-buyer-balance">£{otherPlayers.find(p => (p.user?._id || p.user) === tradeBuyerId)?.balance || 0}</span>
                        </>
                      ) : <span>Select buyer</span>}
                      <span className="trade-buyer-caret">▼</span>
                    </div>
                    {tradeBuyerMenuOpen && (
                      <div className="trade-buyer-menu">
                        {otherPlayers.map(player => (
                          <div key={player.user?._id || player.user} className="trade-buyer-menu-item" onClick={() => { setTradeBuyerId(player.user?._id || player.user); setTradeBuyerMenuOpen(false); }}>
                            <span className="trade-buyer-avatar">{player.user?.displayName?.[0] || 'P'}</span>
                            <span>{player.user?.displayName || player.user?.username}</span>
                            <span className="trade-buyer-balance">£{player.balance}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="trade-amount-row">
                    <span>£</span>
                    <input type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} min={1} placeholder="Amount" />
                  </div>
                  <div className="trade-note-row">
                    <input type="text" value={`Property trade request for ${tradeProperty}`} disabled />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {tradeWaiting ? (
                <button className="btn-secondary" onClick={closeTradeModal}>Close</button>
              ) : (
                <>
                  <button className="btn-secondary" onClick={closeTradeModal}>Cancel</button>
                  <button className="btn-primary" onClick={handleRequestPropertyTrade} disabled={isProcessing}>Request £{tradeAmount || ''}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && approvalRequest && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal approval-modal" style={{ maxWidth: 420, padding: 0 }}>
            <div className="modal-header">
              <h2>Approve Request</h2>
            </div>
            <div className="modal-body">
              {approvalRequest.type === 'property_trade' && (
                <>
                  <p><b>Property Trade Offer</b></p>
                  <p><b>From:</b> {approvalRequest.player?.displayName || approvalRequest.player?.username}</p>
                  <p><b>Property:</b> {approvalRequest.propertyName}</p>
                  <p><b>Amount:</b> £{approvalRequest.amount}</p>
                  <p>Do you want to accept this trade? If you accept, the property and money will be exchanged instantly.</p>
                  <div style={{marginTop: 8, color: '#c00', fontWeight: 'bold'}}>Time left: {approvalTimer}s</div>
                </>
              )}
              {approvalRequest.type === 'bank_receive' && (
                <>
                  <p><b>Bank Receive</b></p>
                  <p><b>From:</b> Bank</p>
                  <p><b>Amount:</b> £{approvalRequest.amount}</p>
                  <p>Approve to receive this amount from the bank.</p>
                </>
              )}
              {approvalRequest.type === 'go_salary' && (
                <>
                  <p><b>Collect GO</b></p>
                  <p><b>Amount:</b> £{approvalRequest.amount}</p>
                  <p>Approve to collect your GO salary.</p>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => handleApproveRequest(approvalRequest._id, false)}>Reject</button>
              <button className="btn-primary" onClick={() => handleApproveRequest(approvalRequest._id, true)}>Accept</button>
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
