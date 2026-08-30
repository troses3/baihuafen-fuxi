import { useState, useEffect, useCallback, useRef } from 'react';
import initialItems from '../data.json';
import './App.css';

const STORAGE_KEY = 'baihuafen-tracker-data-v2';
const BEST_TIME_KEY = 'baihuafen-match-best-time';

const renderHighlightedText = (text, query) => {
  if (!text) return '';
  if (!query || !query.trim()) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) => {
    return regex.test(part) ? (
      <span key={i} className="search-highlight">
        {part}
      </span>
    ) : (
      part
    );
  });
};

const formatTime = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

function App() {
  const [items, setItems] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('baihuafen-tracker-data');
    const statusMap = {};
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            if (p.id && p.status && p.status !== 'new') {
              statusMap[p.id] = p.status;
            }
          });
        }
      } catch (e) {}
    }
    return initialItems.map(item => ({
      ...item,
      status: statusMap[item.id] || 'new'
    }));
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ known: 0, unknown: 0 });
  const [filter, setFilter] = useState('all'); // 'all', 'known', 'unknown'
  const [isRandom, setIsRandom] = useState(() => {
    return localStorage.getItem('baihuafen-tracker-random') === 'true';
  });
  const [quizMode, setQuizMode] = useState(() => {
    return localStorage.getItem('baihuafen-tracker-quiz-mode') || 'percentToFraction'; // 'percentToFraction', 'fractionToPercent', 'matchGame'
  });
  const [history, setHistory] = useState([]);

  // Input & Answer States for Practice Mode
  const [inputVal, setInputVal] = useState('');
  const [feedbackState, setFeedbackState] = useState('idle'); // 'idle', 'correct', 'revealed'
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Modern UI states and refs
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [calculatedMarginTop, setCalculatedMarginTop] = useState(0);

  // 🎮 Match Elimination Game States
  const [gameTiles, setGameTiles] = useState([]);
  const [drawPileCards, setDrawPileCards] = useState([]); // 扁平化充分打乱的单张卡片池
  const [remainingPairs, setRemainingPairs] = useState(30);
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);
  const [isProcessingMatch, setIsProcessingMatch] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [isGameVictory, setIsGameVictory] = useState(false);
  const [mismatchesCount, setMismatchesCount] = useState(0);
  const [bestRecord, setBestRecord] = useState(() => {
    const saved = localStorage.getItem(BEST_TIME_KEY);
    return saved ? Number(saved) : null;
  });
  const [isNewRecord, setIsNewRecord] = useState(false);

  const headerRef = useRef(null);
  const modeBarRef = useRef(null);
  const mainContentRef = useRef(null);

  // Initialize and start a new match game round with full 30-pair deck
  const startNewGame = useCallback(() => {
    // 1. 获取全部 30 组题目
    const shuffledPool = [...initialItems].sort(() => Math.random() - 0.5);
    const totalPairs = shuffledPool.length;

    // 前 12 组用于初始棋盘（24 张卡片）
    const boardItems = shuffledPool.slice(0, 12);
    // 剩余 18 组用于储备卡片池（36 张卡片）
    const remainingItems = shuffledPool.slice(12);

    const initialBoardTiles = [];
    boardItems.forEach((item) => {
      const fracParts = item.fraction.split('/');
      initialBoardTiles.push({
        id: `f_${item.id}_${Date.now()}_${Math.random()}`,
        pairId: item.id,
        type: 'fraction',
        num: fracParts[0] || '1',
        den: fracParts[1] || item.fraction,
        isMatched: false,
        isMismatching: false,
        isDropping: false,
      });
      initialBoardTiles.push({
        id: `p_${item.id}_${Date.now()}_${Math.random()}`,
        pairId: item.id,
        type: 'percent',
        value: item.percent,
        isMatched: false,
        isMismatching: false,
        isDropping: false,
      });
    });

    // 棋盘初始 24 张卡片充分洗牌打散
    const shuffledBoardTiles = initialBoardTiles.sort(() => Math.random() - 0.5);

    // 储备池 36 张单张卡片彻底打散（打破成对连续排布）
    const reserveCards = [];
    remainingItems.forEach((item) => {
      const fracParts = item.fraction.split('/');
      reserveCards.push({
        id: `f_${item.id}_${Date.now()}_${Math.random()}`,
        pairId: item.id,
        type: 'fraction',
        num: fracParts[0] || '1',
        den: fracParts[1] || item.fraction,
        isMatched: false,
        isMismatching: false,
        isDropping: true,
      });
      reserveCards.push({
        id: `p_${item.id}_${Date.now()}_${Math.random()}`,
        pairId: item.id,
        type: 'percent',
        value: item.percent,
        isMatched: false,
        isMismatching: false,
        isDropping: true,
      });
    });

    // 进行 Fisher-Yates 深度洗牌
    for (let i = reserveCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [reserveCards[i], reserveCards[j]] = [reserveCards[j], reserveCards[i]];
    }

    setGameTiles(shuffledBoardTiles);
    setDrawPileCards(reserveCards);
    setRemainingPairs(totalPairs);
    setSelectedTileIndex(null);
    setIsProcessingMatch(false);
    setTimerSeconds(0);
    setIsGamePaused(false);
    setIsGameVictory(false);
    setMismatchesCount(0);
    setIsNewRecord(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('baihuafen-tracker-random', isRandom);
  }, [isRandom]);

  useEffect(() => {
    localStorage.setItem('baihuafen-tracker-quiz-mode', quizMode);
  }, [quizMode]);

  // Handle Game Timer
  useEffect(() => {
    let timer = null;
    if (quizMode === 'matchGame' && !isGamePaused && !isGameVictory) {
      timer = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [quizMode, isGamePaused, isGameVictory]);

  // Initial random selection for practice mode
  useEffect(() => {
    const isRandomStored = localStorage.getItem('baihuafen-tracker-random') === 'true';
    if (isRandomStored && items.length > 0) {
      const candidateIndices = [];
      items.forEach((item, index) => {
        if (item.status !== 'known') {
          candidateIndices.push(index);
        }
      });

      if (candidateIndices.length > 0) {
        const randIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
        setCurrentIndex(randIndex);
      } else {
        const randIndex = Math.floor(Math.random() * items.length);
        setCurrentIndex(randIndex);
      }
    }
  }, []);

  // Auto initialize game tiles if switching to matchGame
  useEffect(() => {
    if (quizMode === 'matchGame' && gameTiles.length === 0) {
      startNewGame();
    }
  }, [quizMode, gameTiles.length, startNewGame]);

  useEffect(() => {
    if (items.length > 0) {
      const known = items.filter(i => i.status === 'known').length;
      const unknown = items.filter(i => i.status === 'unknown').length;
      setStats({ known, unknown });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items]);

  // Precise Vertical Centering Logic
  useEffect(() => {
    const calculateMargin = () => {
      if (headerRef.current && modeBarRef.current && searchQuery.trim() === '') {
        const headerBottom = headerRef.current.getBoundingClientRect().bottom + window.scrollY;
        const modeBarTop = modeBarRef.current.getBoundingClientRect().top;
        const space = modeBarTop - headerBottom;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const gapPx = 0.75 * rem;

        const mainH = mainContentRef.current ? mainContentRef.current.scrollHeight : 380;
        let margin = (space - mainH) / 2 - gapPx;
        setCalculatedMarginTop(Math.max(0, margin));
      }
    };

    setTimeout(calculateMargin, 40);
    window.addEventListener('resize', calculateMargin);

    const observer = new ResizeObserver(calculateMargin);
    if (headerRef.current) observer.observe(headerRef.current);
    if (modeBarRef.current) observer.observe(modeBarRef.current);
    if (mainContentRef.current) observer.observe(mainContentRef.current);

    return () => {
      window.removeEventListener('resize', calculateMargin);
      observer.disconnect();
    };
  }, [searchQuery, isSearchOpen, isPanelOpen, currentIndex, quizMode, isAnswered, feedbackState, isGameVictory]);

  const currentItem = items[currentIndex];

  const getTargetStr = useCallback((item, mode) => {
    if (!item) return '';
    if (mode === 'percentToFraction') {
      return item.fraction.replace('1/', '').trim();
    } else {
      return item.percent.replace('%', '').trim();
    }
  }, []);

  const targetStr = getTargetStr(currentItem, quizMode);

  // 🎮 Tile Click Matching & Cascading Drop Refill Algorithm
  const handleTileClick = (index) => {
    if (isProcessingMatch || isGamePaused || isGameVictory) return;
    const clickedTile = gameTiles[index];
    if (!clickedTile || clickedTile.isMatched) return;

    if (selectedTileIndex === null) {
      setSelectedTileIndex(index);
      return;
    }

    if (selectedTileIndex === index) {
      setSelectedTileIndex(null);
      return;
    }

    const firstTile = gameTiles[selectedTileIndex];
    const firstIdx = selectedTileIndex;
    const secondIdx = index;

    // Check if matching pair
    if (firstTile.pairId === clickedTile.pairId && firstTile.type !== clickedTile.type) {
      // 🎉 MATCH SUCCESS!
      setIsProcessingMatch(true);

      // 1. Mark both as matched to trigger vanish animation
      const matchedBoard = [...gameTiles];
      matchedBoard[firstIdx] = { ...matchedBoard[firstIdx], isMatched: true };
      matchedBoard[secondIdx] = { ...matchedBoard[secondIdx], isMatched: true };
      setGameTiles(matchedBoard);
      setSelectedTileIndex(null);

      const nextRemaining = remainingPairs - 1;
      setRemainingPairs(nextRemaining);

      // 2. After 220ms, 从打乱的单张卡片池中抽取 2 张互不配对的新卡片掉落下落
      setTimeout(() => {
        if (drawPileCards.length >= 2) {
          let c1 = drawPileCards[0];
          let c2 = drawPileCards[1];
          let remainingPool = drawPileCards.slice(2);

          // 确保新掉落到这两个位置的卡片绝不是同一组配对
          if (c1.pairId === c2.pairId && drawPileCards.length > 2) {
            c2 = drawPileCards[2];
            remainingPool = [drawPileCards[1], ...drawPileCards.slice(3)];
          }

          setDrawPileCards(remainingPool);

          setGameTiles(prevTiles => {
            const refilled = [...prevTiles];
            refilled[firstIdx] = { ...c1, isDropping: true };
            refilled[secondIdx] = { ...c2, isDropping: true };
            return refilled;
          });

          setTimeout(() => {
            setGameTiles(prevTiles => {
              const cleaned = [...prevTiles];
              if (cleaned[firstIdx]) cleaned[firstIdx] = { ...cleaned[firstIdx], isDropping: false };
              if (cleaned[secondIdx]) cleaned[secondIdx] = { ...cleaned[secondIdx], isDropping: false };
              return cleaned;
            });
          }, 350);
        } else if (drawPileCards.length === 1) {
          const c1 = drawPileCards[0];
          setDrawPileCards([]);

          setGameTiles(prevTiles => {
            const refilled = [...prevTiles];
            refilled[firstIdx] = { ...c1, isDropping: true };
            return refilled;
          });

          setTimeout(() => {
            setGameTiles(prevTiles => {
              const cleaned = [...prevTiles];
              if (cleaned[firstIdx]) cleaned[firstIdx] = { ...cleaned[firstIdx], isDropping: false };
              return cleaned;
            });
          }, 350);
        }

        setIsProcessingMatch(false);

        // Check if all 30 pairs are cleared
        if (nextRemaining === 0) {
          setIsGameVictory(true);
          const finalTime = timerSeconds;
          const currentBest = localStorage.getItem(BEST_TIME_KEY);
          if (!currentBest || finalTime < Number(currentBest)) {
            localStorage.setItem(BEST_TIME_KEY, String(finalTime));
            setBestRecord(finalTime);
            setIsNewRecord(true);
          }
        }
      }, 220);

    } else {
      // ❌ MISMATCH!
      const updated = [...gameTiles];
      updated[firstIdx] = { ...updated[firstIdx], isMismatching: true };
      updated[secondIdx] = { ...updated[secondIdx], isMismatching: true };
      setGameTiles(updated);
      setMismatchesCount(prev => prev + 1);
      setIsProcessingMatch(true);

      setTimeout(() => {
        setGameTiles(prevTiles => {
          const reset = [...prevTiles];
          if (reset[firstIdx]) reset[firstIdx] = { ...reset[firstIdx], isMismatching: false };
          if (reset[secondIdx]) reset[secondIdx] = { ...reset[secondIdx], isMismatching: false };
          return reset;
        });
        setSelectedTileIndex(null);
        setIsProcessingMatch(false);
      }, 400);
    }
  };


  const searchMatchedItems = (searchQuery && searchQuery.trim() !== '')
    ? items.filter(item => {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.percent.toLowerCase().includes(q) ||
          item.fraction.toLowerCase().includes(q) ||
          String(item.id).includes(q)
        );
      })
    : [];

  const handleSelectSearchItem = (targetItem) => {
    const targetIndex = items.findIndex(i => i.id === targetItem.id);
    if (targetIndex !== -1) {
      if (quizMode === 'matchGame') {
        setQuizMode('percentToFraction');
      }
      setFilter('all');
      setSearchQuery('');
      setIsSearchOpen(false);
      setCurrentIndex(targetIndex);
      setInputVal('');
      setFeedbackState('idle');
      setIsAnswered(false);
      setIsCorrect(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = useCallback((status) => {
    const updatedItems = [...items];
    if (currentItem) {
      updatedItems[currentIndex].status = status;
    }
    setItems(updatedItems);
    setInputVal('');
    setFeedbackState('idle');
    setIsAnswered(false);
    setIsCorrect(false);
    
    setHistory(prev => [...prev, currentIndex]);

    let nextIndex = currentIndex;
    let activeFilter = filter;
    let candidates = [];
    
    if (filter !== 'all') {
      candidates = updatedItems
        .map((item, index) => ({ status: item.status, index }))
        .filter(item => item.status === filter)
        .map(item => item.index);
      
      if (candidates.length === 0) {
        activeFilter = 'all';
        setFilter('all');
      }
    }
    
    if (activeFilter === 'all') {
      if (isRandom) {
        const candidateIndices = [];
        updatedItems.forEach((item, index) => {
          if (item.status !== 'known') {
            candidateIndices.push(index);
          }
        });
        
        if (candidateIndices.length > 0) {
          let finalCandidates = candidateIndices;
          if (candidateIndices.length > 1) {
            finalCandidates = candidateIndices.filter(idx => idx !== currentIndex);
          }
          nextIndex = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
        } else {
          const allIndices = Array.from({length: items.length}, (_, i) => i);
          const otherIndices = allIndices.filter(idx => idx !== currentIndex);
          nextIndex = otherIndices.length > 0 
            ? otherIndices[Math.floor(Math.random() * otherIndices.length)]
            : 0;
        }
      } else {
        let found = false;
        for (let i = 0; i < items.length; i++) {
          let checkIndex = (currentIndex + 1 + i) % items.length;
          if (updatedItems[checkIndex].status !== 'known') {
            nextIndex = checkIndex;
            found = true;
            break;
          }
        }
        if (!found) {
          nextIndex = (currentIndex + 1) % items.length;
        }
      }
    } else {
      if (isRandom) {
        let finalCandidates = candidates;
        if (candidates.length > 1) {
          finalCandidates = candidates.filter(idx => idx !== currentIndex);
        }
        nextIndex = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
      } else {
        const nextCandidate = candidates.find(idx => idx > currentIndex);
        nextIndex = nextCandidate !== undefined ? nextCandidate : candidates[0];
      }
    }
    
    setCurrentIndex(nextIndex);
  }, [currentIndex, filter, isRandom, items, currentItem]);

  const handlePrev = () => {
    if (history.length > 0) {
      const prevIndex = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentIndex(prevIndex);
      setInputVal('');
      setFeedbackState('idle');
      setIsAnswered(false);
      setIsCorrect(false);
    }
  };

  // Process Numpad Key Press
  const handleKeyPress = useCallback((key) => {
    if (quizMode === 'matchGame') return;
    if (feedbackState === 'correct' || feedbackState === 'revealed') return;

    if (key === '⌫' || key === 'Backspace') {
      setInputVal(prev => prev.slice(0, -1));
      return;
    }

    if (key === '.') {
      setInputVal(prev => {
        if (prev.includes('.')) return prev;
        if (prev === '') return '0.';
        return prev + '.';
      });
      return;
    }

    if (/^[0-9]$/.test(key)) {
      setInputVal(prev => {
        if (prev.length >= 6) return prev;
        return prev + key;
      });
    }
  }, [feedbackState, quizMode]);

  const handleConfirm = useCallback(() => {
    if (quizMode === 'matchGame') return;
    if (isAnswered) {
      handleNext(isCorrect ? 'known' : 'unknown');
      return;
    }

    const checkCorrect = inputVal.trim() === targetStr.trim();
    setIsCorrect(checkCorrect);
    setIsAnswered(true);
    setFeedbackState(checkCorrect ? 'correct' : 'revealed');

    const updatedItems = [...items];
    updatedItems[currentIndex].status = checkCorrect ? 'known' : 'unknown';
    setItems(updatedItems);
  }, [quizMode, isAnswered, isCorrect, inputVal, targetStr, items, currentIndex, handleNext]);

  // Physical Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return;
      }

      if (quizMode === 'matchGame') {
        if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
          setIsGamePaused(prev => !prev);
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === '.' || e.key === 'Decimal') {
        handleKeyPress('.');
      } else if (e.key === 'Backspace') {
        handleKeyPress('⌫');
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quizMode, handleKeyPress, handleConfirm]);

  const handleFilterClick = (targetFilter) => {
    if (filter === targetFilter) {
      setFilter('all');
      return;
    }
    const count = targetFilter === 'known' ? stats.known : stats.unknown;
    if (count === 0) {
      alert(`当前没有处于“${targetFilter === 'known' ? '已掌握' : '未掌握'}”状态的题目！`);
      return;
    }
    const targetIndex = items.findIndex(i => targetFilter === 'known' ? i.status === 'known' : i.status === 'unknown');
    if (targetIndex !== -1) {
      setFilter(targetFilter);
      setCurrentIndex(targetIndex);
      setInputVal('');
      setFeedbackState('idle');
      setIsAnswered(false);
      setIsCorrect(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'known': return 'rgba(16, 185, 129, 0.85)';
      case 'unknown': return 'rgba(239, 68, 68, 0.85)';
      default: return 'rgba(107, 114, 128, 0.8)';
    }
  };

  if (!currentItem) return <div className="loading">加载中...</div>;

  const total = items.length;
  const progress = total > 0 ? ((stats.known) / total) * 100 : 0;
  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="app-container">
      <header className="header" ref={headerRef}>
        <div className="header-nav-bar">
          {/* 左上角：重置当前题库进度 */}
          <button 
            className="header-icon-btn reset-header-btn" 
            title="重置学习进度"
            onClick={() => {
              if(window.confirm('确定要重置所有学习进度吗？')) {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>
          
          {/* 中间：可交互的沉浸指示胶囊 */}
          <button 
            className={`header-meta-pill ${isPanelOpen ? 'active' : ''}`}
            onClick={() => setIsPanelOpen(prev => !prev)}
            title={isPanelOpen ? "收起筛选面板" : "展开掌握度面板"}
          >
            <span className="pill-db-name">🧮 百化分速记</span>
            <span className="pill-divider">·</span>
            <span className="pill-cat-name">
              {quizMode === 'percentToFraction' ? '🎯 百化分' : quizMode === 'fractionToPercent' ? '🔄 分化百' : '🎮 消消乐'}
            </span>
            <span className="pill-progress-text">
              {quizMode === 'matchGame' 
                ? `(剩余 ${remainingPairs} 对)`
                : `(${currentIndex + 1}/${items.length})`
              }
            </span>
            <span className={`pill-chevron ${isPanelOpen ? 'open' : ''}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </button>

          {/* 右上角：搜索按钮 */}
          <button 
            className={`header-icon-btn search-header-btn ${(isSearchOpen || searchQuery) ? 'active' : ''}`} 
            onClick={() => setIsSearchOpen(prev => !prev)} 
            title="搜索百化分数据"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>

        {/* 顶部展开式搜索栏 */}
        {(isSearchOpen || searchQuery.trim() !== '') && (
          <form 
            className="search-bar-box"
            onSubmit={(e) => {
              e.preventDefault();
              e.target.querySelector('input')?.blur();
            }}
          >
            <svg className="search-box-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              enterKeyHint="search"
              autoFocus
              className="search-box-input"
              placeholder={`搜索百分数或分数 (${items.length} 题，如 16.7% 或 1/6)...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-box-clear"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery('');
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery('');
                }}
                title="清空搜索"
              >
                ✕
              </button>
            )}
          </form>
        )}

        {/* 沉浸式下拉抽屉面板 */}
        {isPanelOpen && (
          <div className="progress-container panel-drawer-open">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="stats">
              <button 
                className={`stat-item ${filter === 'known' ? 'active-known' : ''}`}
                onClick={() => handleFilterClick('known')}
                title="只复习已掌握"
              >
                <span className="dot dot-known"></span>
                已掌握: <span className="stat-count">{stats.known}</span>
              </button>
              <button 
                className={`stat-item ${filter === 'unknown' ? 'active-unknown' : ''}`}
                onClick={() => handleFilterClick('unknown')}
                title="只复习未掌握"
              >
                <span className="dot dot-unknown"></span>
                未掌握: <span className="stat-count">{stats.unknown}</span>
              </button>
              <button 
                className={`stat-item ${filter === 'all' ? 'active-all' : ''}`}
                onClick={() => setFilter('all')}
                title="查看全部"
              >
                总计: <span className="stat-count">{total}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="main-content" ref={mainContentRef} style={{ marginTop: `${calculatedMarginTop}px` }}>
        {searchQuery.trim() !== '' ? (
          <div className="search-knowledge-view">
            <div className="search-results-bar">
              <span className="search-count-text">
                共匹配到 <strong>{searchMatchedItems.length}</strong> 条数据
              </span>
              <button className="search-clear-action-btn" onClick={() => setSearchQuery('')}>
                清空搜索
              </button>
            </div>

            {searchMatchedItems.length === 0 ? (
              <div className="empty-state-card">
                <h3>未找到匹配项</h3>
                <p>请尝试搜索其他数值（如 6.7、1/15 等）</p>
                <button className="empty-state-btn" onClick={() => setSearchQuery('')}>
                  清空搜索
                </button>
              </div>
            ) : (
              <div className="knowledge-cards-list">
                {searchMatchedItems.map((item, idx) => (
                  <div key={idx} className="knowledge-card" onClick={() => handleSelectSearchItem(item)}>
                    <div className="knowledge-card-top">
                      <span className="item-index">#{item.id}</span>
                      <span className={`knowledge-status-tag status-tag-${item.status}`}>
                        {item.status === 'known' ? '已掌握' : item.status === 'unknown' ? '未掌握' : '未学'}
                      </span>
                    </div>
                    <div className="search-result-equation">
                      <span className="search-result-percent">
                        {renderHighlightedText(item.percent, searchQuery)}
                      </span>
                      <span className="search-result-equals">≈</span>
                      <span className="search-result-fraction">
                        {renderHighlightedText(item.fraction, searchQuery)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : quizMode === 'matchGame' ? (
          /* =========================================================
             🎮 4x6 消消乐游戏主界面
             ========================================================= */
          <div className="game-board-card">
            <div className="game-top-bar">
              <button 
                className="game-ctrl-btn" 
                onClick={() => setIsGamePaused(prev => !prev)}
                title={isGamePaused ? "继续游戏" : "暂停游戏"}
              >
                {isGamePaused ? '▶' : '⏸'}
              </button>

              <div className="game-timer-badge">
                <span className="game-timer-display">{formatTime(timerSeconds)}</span>
              </div>

              <button 
                className="game-ctrl-btn" 
                onClick={startNewGame}
                title="重新洗牌开局"
              >
                🔄
              </button>
            </div>

            <div className="game-grid-4x6">
              {gameTiles.map((tile, idx) => {
                const isSelected = selectedTileIndex === idx;
                const isMismatch = tile.isMismatching;
                const isMatched = tile.isMatched;
                const isDropping = tile.isDropping;

                let tileClass = `game-tile tile-${tile.type}`;
                if (isSelected) tileClass += ' tile-selected';
                if (isMismatch) tileClass += ' tile-mismatch';
                if (isMatched) tileClass += ' tile-matched';
                if (isDropping) tileClass += ' tile-dropping';

                return (
                  <div
                    key={tile.id || idx}
                    className={tileClass}
                    onClick={() => handleTileClick(idx)}
                  >
                    {tile.type === 'fraction' ? (
                      <div className="math-frac">
                        <span className="frac-num">{tile.num}</span>
                        <span className="frac-line"></span>
                        <span className="frac-den">{tile.den}</span>
                      </div>
                    ) : (
                      <span className="percent-val">{tile.value}</span>
                    )}
                  </div>
                );
              })}
            </div>


            {/* ⏸ 暂停遮罩 */}
            {isGamePaused && (
              <div className="game-modal-overlay">
                <div className="game-modal-card">
                  <div className="modal-icon">⏸️</div>
                  <h3 className="modal-title">游戏已暂停</h3>
                  <p className="modal-subtitle">当前用时：{formatTime(timerSeconds)}</p>
                  <div className="modal-actions">
                    <button className="m-btn-primary" onClick={() => setIsGamePaused(false)}>
                      继续游戏
                    </button>
                    <button className="m-btn-secondary" onClick={startNewGame}>
                      重新开始
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🏆 通关胜利结算弹窗 */}
            {isGameVictory && (
              <div className="game-modal-overlay">
                <div className="game-modal-card">
                  <div className="modal-icon victory-icon">🎉</div>
                  <h3 className="modal-title">恭喜通关！</h3>
                  {isNewRecord && <div className="new-record-badge">✨ 刷新历史最佳纪录！✨</div>}
                  
                  <div className="victory-stats-grid">
                    <div className="v-stat-box">
                      <span className="v-stat-label">本次用时</span>
                      <span className="v-stat-val">{formatTime(timerSeconds)}</span>
                    </div>
                    <div className="v-stat-box">
                      <span className="v-stat-label">失误次数</span>
                      <span className="v-stat-val">{mismatchesCount} 次</span>
                    </div>
                    <div className="v-stat-box" style={{ gridColumn: '1 / -1' }}>
                      <span className="v-stat-label">历史最佳纪录</span>
                      <span className="v-stat-val" style={{ color: '#10b981' }}>
                        {bestRecord ? formatTime(bestRecord) : formatTime(timerSeconds)}
                      </span>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button className="m-btn-primary" onClick={startNewGame}>
                      再来一局
                    </button>
                    <button 
                      className="m-btn-secondary" 
                      onClick={() => setQuizMode('percentToFraction')}
                    >
                      返回速记
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
             📝 百化分经典做题模式
             ========================================================= */
          <>
            <div className="practice-card">
              <div className="card-top-info">
                <span className="item-index">#{currentItem.id}</span>
                {currentItem.status !== 'new' && (
                  <span className="status-badge-inline" style={{ backgroundColor: getStatusColor(currentItem.status) }}>
                    上次标记: {currentItem.status === 'known' ? '已掌握' : '未掌握'}
                  </span>
                )}
              </div>

              <div className="question-display">
                <div className="question-prompt">
                  {quizMode === 'percentToFraction' ? currentItem.percent : currentItem.fraction}
                </div>
                <div className="question-hint">
                  {quizMode === 'percentToFraction' ? '请输入对应的分母' : '请输入对应的百分数'}
                </div>
              </div>

              <div className={`input-display-box ${feedbackState}`}>
                {quizMode === 'percentToFraction' ? (
                  <div className="fraction-input-format">
                    <span className="fraction-numerator">1 / </span>
                    <span className="typed-val">
                      {inputVal || <span className="placeholder">?</span>}
                    </span>
                  </div>
                ) : (
                  <div className="percent-input-format">
                    <span className="typed-val">
                      {inputVal || <span className="placeholder">?</span>}
                    </span>
                    <span className="percent-unit">%</span>
                  </div>
                )}
                
                {feedbackState === 'correct' && <span className="status-icon success-icon">✓</span>}
                {feedbackState === 'revealed' && <span className="status-icon revealed-icon">✗</span>}
              </div>

              {isAnswered && (
                <div className={`revealed-equation ${isCorrect ? 'equation-correct' : 'equation-wrong'}`}>
                  {isCorrect ? '✓ 回答正确！' : '✗ 回答错误'} 正确等式：<strong>{currentItem.percent} = {currentItem.fraction}</strong>
                </div>
              )}
            </div>

            <div className="numpad-container">
              <div className="numpad-grid">
                {numpadKeys.map(key => (
                  <button
                    key={key}
                    className={`numpad-btn ${key === '⌫' ? 'backspace-btn' : ''} ${key === '.' ? 'dot-btn' : ''}`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="numpad-actions">
                <button 
                  className="action-btn prev-btn" 
                  onClick={handlePrev} 
                  disabled={history.length === 0}
                >
                  上一题
                </button>
                <button 
                  className="action-btn clear-btn" 
                  onClick={() => setInputVal('')}
                  disabled={!inputVal || isAnswered}
                >
                  清空
                </button>
                {isAnswered ? (
                  <button 
                    className="action-btn next-btn"
                    onClick={handleConfirm}
                  >
                    下一题 ➜
                  </button>
                ) : (
                  <button 
                    className="action-btn answer-btn"
                    onClick={handleConfirm}
                  >
                    确认
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* 底部悬浮模式栏（极简单层设计） */}
      <nav className="floating-mode-bar" ref={modeBarRef}>
        <button 
          className={`mode-btn ${quizMode === 'percentToFraction' ? 'active' : ''}`} 
          onClick={() => { 
            setQuizMode('percentToFraction'); 
            setInputVal(''); 
            setFeedbackState('idle'); 
            setIsAnswered(false); 
            setIsCorrect(false); 
          }}
        >
          百化分
        </button>
        <button 
          className={`mode-btn ${quizMode === 'fractionToPercent' ? 'active' : ''}`} 
          onClick={() => { 
            setQuizMode('fractionToPercent'); 
            setInputVal(''); 
            setFeedbackState('idle'); 
            setIsAnswered(false); 
            setIsCorrect(false); 
          }}
        >
          分化百
        </button>
        <button 
          className={`mode-btn ${quizMode === 'matchGame' ? 'active' : ''}`} 
          onClick={() => { 
            setQuizMode('matchGame'); 
            if (gameTiles.length === 0) startNewGame(); 
          }}
        >
          🎮 消消乐
        </button>

        <span className="mode-divider"></span>

        {quizMode === 'matchGame' ? (
          <button className="mode-btn random-btn" onClick={startNewGame} title="重新洗牌开局">
            重开
          </button>
        ) : (
          <>
            <button className={`mode-btn random-btn ${!isRandom ? 'active' : ''}`} onClick={() => setIsRandom(false)}>
              顺序
            </button>
            <button className={`mode-btn random-btn ${isRandom ? 'active' : ''}`} onClick={() => setIsRandom(true)}>
              随机
            </button>
          </>
        )}
      </nav>
    </div>
  );
}

export default App;


