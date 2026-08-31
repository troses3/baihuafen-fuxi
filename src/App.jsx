import { useState, useEffect, useCallback, useRef } from 'react';
import initialItems from '../data.json';
import './App.css';
import { triggerHaptic } from './utils/haptics';

const STORAGE_KEY = 'baihuafen-tracker-data-v2';
const BEST_TIME_KEY = 'baihuafen-match-best-time';
const RANKED_LEADERBOARD_KEY = 'baihuafen-ranked-leaderboard';
const MATCH_SUBMODE_KEY = 'baihuafen-match-submode';

const getRankTier = (score) => {
  if (score >= 9500) return { name: '最强王者', icon: '🌌', color: '#db2777', badgeClass: 'tier-apex' };
  if (score >= 8500) return { name: '百化分宗师', icon: '👑', color: '#7e22ce', badgeClass: 'tier-grandmaster' };
  if (score >= 7500) return { name: '璀璨钻石', icon: '💎', color: '#0e7490', badgeClass: 'tier-diamond' };
  if (score >= 6500) return { name: '荣耀黄金', icon: '🥇', color: '#b45309', badgeClass: 'tier-gold' };
  if (score >= 5000) return { name: '秩序白银', icon: '🥈', color: '#475569', badgeClass: 'tier-silver' };
  return { name: '坚韧青铜', icon: '🥉', color: '#991b1b', badgeClass: 'tier-bronze' };
};

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
  const currentItem = items[currentIndex] || items[0] || null;
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

  // 🎮 Match Elimination Game States (4-Column Vertical Gravity)
  const [matchSubMode, setMatchSubMode] = useState(() => {
    return localStorage.getItem(MATCH_SUBMODE_KEY) || 'practice'; // 'practice' | 'ranked'
  });
  const [gameColumns, setGameColumns] = useState([[], [], [], []]); // 4 列垂直立柱栈
  const [drawPilePairs, setDrawPilePairs] = useState([]); // 按对存储的储备池 (18对)
  const [remainingPairs, setRemainingPairs] = useState(30);
  const [selectedTile, setSelectedTile] = useState(null); // { colIdx: number, tileId: string } | null
  const [isProcessingMatch, setIsProcessingMatch] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [isGameVictory, setIsGameVictory] = useState(false);
  const [mismatchesCount, setMismatchesCount] = useState(0);
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [hintedTileIds, setHintedTileIds] = useState([]); // [id1, id2] 提示高亮
  const [isFormulaSheetOpen, setIsFormulaSheetOpen] = useState(false); // 📖 百化分速查表弹窗
  
  // ⚡ 竞技排位积分系统 states
  const [rankedScore, setRankedScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [floatingScores, setFloatingScores] = useState([]);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState(() => {
    try {
      const saved = localStorage.getItem(RANKED_LEADERBOARD_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastGameResult, setLastGameResult] = useState(null);
  const lastMatchTimeRef = useRef(0);

  // 🐍 能量贪吃蛇 (Snake Runner) States
  const [snakeScore, setSnakeScore] = useState(0);
  const [snakeHighScore, setSnakeHighScore] = useState(() => {
    const saved = localStorage.getItem('baihuafen-snake-highscore');
    return saved ? Number(saved) : 0;
  });
  const [snakeLives, setSnakeLives] = useState(3);
  const [snakeCombo, setSnakeCombo] = useState(0);
  const [snakeMaxCombo, setSnakeMaxCombo] = useState(0);
  const [snakeEatenCount, setSnakeEatenCount] = useState(0);
  const [snakeTarget, setSnakeTarget] = useState(null);
  const [snakeFoods, setSnakeFoods] = useState([]);
  const [snakeBody, setSnakeBody] = useState([
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
  ]);
  const [snakeDir, setSnakeDir] = useState({ x: 1, y: 0 });
  const [isSnakePaused, setIsSnakePaused] = useState(false);
  const [isSnakeGameOver, setIsSnakeGameOver] = useState(false);
  const [isSnakeNewRecord, setIsSnakeNewRecord] = useState(false);
  const [snakeFloatingScores, setSnakeFloatingScores] = useState([]);

  const [bestRecord, setBestRecord] = useState(() => {
    const saved = localStorage.getItem(BEST_TIME_KEY);
    return saved ? Number(saved) : null;
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const timerRef = useRef(0);

  const headerRef = useRef(null);
  const modeBarRef = useRef(null);
  const mainContentRef = useRef(null);

  // 工具函数：根据 data item 创建一对 [fraction卡, percent卡] (纯净无衬线现代字体)
  const makeTilePair = (item) => {
    const fracParts = item.fraction.split('/');
    const fracTile = {
      id: `f_${item.id}_${Date.now()}_${Math.random()}`,
      pairId: item.id,
      type: 'fraction',
      num: fracParts[0] || '1',
      den: fracParts[1] || item.fraction,
      isMatched: false,
      isMismatching: false,
      isDropping: false,
    };
    const pctTile = {
      id: `p_${item.id}_${Date.now()}_${Math.random()}`,
      pairId: item.id,
      type: 'percent',
      value: item.percent,
      isMatched: false,
      isMismatching: false,
      isDropping: false,
    };
    return [fracTile, pctTile];
  };

  // Initialize and start a new match game round with 4 vertical gravity columns
  const startNewGame = useCallback(() => {
    // 1. 全部 30 组题目 Fisher-Yates 深度洗牌
    const pool = [...initialItems];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const totalPairs = pool.length;

    // 前 12 组（24 张卡片）分入 4 根立柱，每列 6 张
    const boardItems = pool.slice(0, 12);
    const reserveItems = pool.slice(12); // 18 组储备题目

    const boardTiles = boardItems.flatMap(item => makeTilePair(item));
    for (let i = boardTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [boardTiles[i], boardTiles[j]] = [boardTiles[j], boardTiles[i]];
    }

    // 均分到 4 列 (每列 6 张)
    const col0 = boardTiles.slice(0, 6);
    const col1 = boardTiles.slice(6, 12);
    const col2 = boardTiles.slice(12, 18);
    const col3 = boardTiles.slice(18, 24);

    // 储备池按对存储 (18 对完整题目，确保屏幕上永远 100% 每张卡片都有答案在场)
    const reservePairs = reserveItems.map(item => {
      const [frac, pct] = makeTilePair(item);
      return { frac, pct };
    });

    setGameColumns([col0, col1, col2, col3]);
    setDrawPilePairs(reservePairs);
    setRemainingPairs(totalPairs);
    setSelectedTile(null);
    setIsProcessingMatch(false);
    setTimerSeconds(0);
    timerRef.current = 0;
    setIsGamePaused(false);
    setIsGameVictory(false);
    setMismatchesCount(0);
    setHintsRemaining(3);
    setHintedTileIds([]);
    setIsNewRecord(false);
    setRankedScore(0);
    setComboCount(0);
    setMaxCombo(0);
    setConsecutiveErrors(0);
    setFloatingScores([]);
    setLastGameResult(null);
    lastMatchTimeRef.current = 0;
  }, []);

  useEffect(() => {
    localStorage.setItem(MATCH_SUBMODE_KEY, matchSubMode);
  }, [matchSubMode]);

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
        setTimerSeconds(prev => {
          timerRef.current = prev + 1;
          return prev + 1;
        });
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
    if (quizMode === 'matchGame' && gameColumns.every(col => col.length === 0)) {
      startNewGame();
    }
  }, [quizMode, gameColumns, startNewGame]);

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
  }, [quizMode, currentItem, feedbackState, searchQuery, isPanelOpen]);

  const getTargetStr = useCallback((item, mode) => {
    if (!item) return '';
    if (mode === 'percentToFraction') {
      return item.fraction.replace('1/', '').trim();
    } else {
      return item.percent.replace('%', '').trim();
    }
  }, []);

  const targetStr = getTargetStr(currentItem, quizMode);

  // 🎮 4列垂直下落物理消除与重力补牌算法 (Column Vertical Gravity Match)
  const handleTileClick = (colIdx, clickedTile) => {
    if (isProcessingMatch || isGamePaused || isGameVictory) return;
    if (!clickedTile || clickedTile.isMatched) return;

    // 清除当前的提示高亮
    if (hintedTileIds.length > 0) {
      setHintedTileIds([]);
    }

    if (selectedTile === null) {
      triggerHaptic('light');
      setSelectedTile({ colIdx, tileId: clickedTile.id });
      return;
    }

    // 点击同一个卡片取消选中
    if (selectedTile.tileId === clickedTile.id) {
      triggerHaptic('light');
      setSelectedTile(null);
      return;
    }

    const firstColIdx = selectedTile.colIdx;
    const firstTile = gameColumns[firstColIdx]?.find(t => t.id === selectedTile.tileId);
    if (!firstTile) {
      setSelectedTile(null);
      return;
    }

    const secondColIdx = colIdx;
    const secondTile = clickedTile;

    // 检查是否配对成功 (相同 pairId 且 类型不同)
    if (firstTile.pairId === secondTile.pairId && firstTile.type !== secondTile.type) {
      // 🎉 配对消除成功！
      triggerHaptic('success');
      setIsProcessingMatch(true);

      // ⚡ 竞技模式计分与连击
      if (matchSubMode === 'ranked') {
        const now = Date.now();
        const timeDiff = lastMatchTimeRef.current > 0 ? (now - lastMatchTimeRef.current) / 1000 : 999;
        lastMatchTimeRef.current = now;

        const newCombo = comboCount + 1;
        if (newCombo >= 3) {
          triggerHaptic('combo');
        }
        // 阶梯连击奖励
        let comboBonus = 0;
        if (newCombo >= 10) comboBonus = 220;
        else if (newCombo >= 5) comboBonus = 160;
        else if (newCombo >= 2) comboBonus = (newCombo - 1) * 40;

        // 极速与神速反应判断
        let speedBonus = 0;
        let speedLabel = '';
        if (timeDiff <= 1.1) {
          speedBonus = 80;
          speedLabel = '⚡⚡神速';
        } else if (timeDiff <= 1.6) {
          speedBonus = 40;
          speedLabel = '⚡极速';
        }

        const earned = 100 + comboBonus + speedBonus;

        setRankedScore(prev => prev + earned);
        setComboCount(newCombo);
        setMaxCombo(prev => Math.max(prev, newCombo));
        setConsecutiveErrors(0);

        let floatText = `+${earned}`;
        if (newCombo >= 2 && speedLabel) floatText = `+${earned} ${speedLabel} x${newCombo}!`;
        else if (newCombo >= 2) floatText = `+${earned} 🔥连击 x${newCombo}!`;
        else if (speedLabel) floatText = `+${earned} ${speedLabel}!`;

        const fid = `${now}_${Math.random()}`;
        setFloatingScores(prev => [...prev.slice(-3), { id: fid, text: floatText, type: 'plus' }]);
        setTimeout(() => {
          setFloatingScores(prev => prev.filter(f => f.id !== fid));
        }, 1100);
      }

      // 1. 标记消除动画
      setGameColumns(prevCols => {
        return prevCols.map((col, cIdx) => {
          if (cIdx === firstColIdx || cIdx === secondColIdx) {
            return col.map(t => {
              if (t.id === firstTile.id || t.id === secondTile.id) {
                return { ...t, isMatched: true };
              }
              return t;
            });
          }
          return col;
        });
      });
      setSelectedTile(null);

      const nextRemaining = remainingPairs - 1;
      setRemainingPairs(nextRemaining);

      // 2. 220ms 后执行重力下落与从顶部平滑补牌
      setTimeout(() => {
        setDrawPilePairs(prevPairs => {
          const hasReserve = prevPairs.length > 0;
          const pair = hasReserve ? prevPairs[0] : null;
          const remainingDeck = hasReserve ? prevPairs.slice(1) : [];

          setGameColumns(prevCols => {
            // 先过滤掉被消除的卡片（该列上方卡片自动顺滑跌落）
            let newCols = prevCols.map(col => {
              return col.filter(t => t.id !== firstTile.id && t.id !== secondTile.id);
            });

            // 如果储备池还有牌，执行「8卡 3D 翻转置换打散」机制：
            // 1. 全盘随机挑选 6 个分布在不同列和深度的坐标 (locs)
            // 2. 将这 6 个坐标原本的旧卡片 + 储备池新的一对卡片 (共 8 张卡片) 放到一起全局深度打乱
            // 3. 将打乱后的前 6 张放回这 6 个坐标，后 2 张补入有空位的列顶部（全部带上 isFlipping: true 动效）
            // 4. 8 张卡片同时在 4 根立柱中触发丝滑 3D 翻转，全盘 1/3 的卡片都在动，眼睛完全分不清谁是新牌！
            if (hasReserve && pair) {
              const swap = Math.random() > 0.5;
              const card1 = swap ? pair.pct : pair.frac;
              const card2 = swap ? pair.frac : pair.pct;

              // 收集场上所有现存的有效卡片坐标
              const activeLocs = [];
              newCols.forEach((col, cIdx) => {
                col.forEach((tile, rIdx) => {
                  activeLocs.push({ cIdx, rIdx, tile });
                });
              });

              // 深度打乱抽取至多 6 个坐标
              for (let i = activeLocs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [activeLocs[i], activeLocs[j]] = [activeLocs[j], activeLocs[i]];
              }
              const numToPick = Math.min(6, activeLocs.length);
              const chosenLocs = activeLocs.slice(0, numToPick);
              const oldTiles = chosenLocs.map(l => l.tile);

              // 组成 8 张卡片的动态打散池 (2 张新牌 + 6 张旧牌)
              const poolToShuffle = [card1, card2, ...oldTiles];
              for (let i = poolToShuffle.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [poolToShuffle[i], poolToShuffle[j]] = [poolToShuffle[j], poolToShuffle[i]];
              }

              // 1. 将打乱后的前 numToPick 张卡片置入选中的 chosenLocs
              for (let i = 0; i < chosenLocs.length; i++) {
                const loc = chosenLocs[i];
                newCols[loc.cIdx][loc.rIdx] = { ...poolToShuffle[i], isFlipping: true };
              }

              // 2. 收集所有可用的空槽位
              const freeSlots = [];
              for (let c = 0; c < 4; c++) {
                const needed = 6 - newCols[c].length;
                for (let k = 0; k < needed; k++) {
                  freeSlots.push(c);
                }
              }

              // 3. 将打散池剩余的 2 张卡片补入空槽
              const remainingTiles = poolToShuffle.slice(numToPick);
              if (freeSlots.length >= 2 && remainingTiles.length >= 2) {
                newCols[freeSlots[0]] = [{ ...remainingTiles[0], isFlipping: true }, ...newCols[freeSlots[0]]];
                newCols[freeSlots[1]] = [{ ...remainingTiles[1], isFlipping: true }, ...newCols[freeSlots[1]]];
              } else if (freeSlots.length >= 1 && remainingTiles.length >= 1) {
                newCols[freeSlots[0]] = [{ ...remainingTiles[0], isFlipping: true }, ...newCols[freeSlots[0]]];
              }

              // 380ms 后清除 isFlipping 动效标记
              setTimeout(() => {
                setGameColumns(curCols => {
                  return curCols.map(col => col.map(t => ({ ...t, isFlipping: false })));
                });
              }, 380);
            }

            return newCols;
          });

          return remainingDeck;
        });

        setIsProcessingMatch(false);

        // 检查通关
        if (nextRemaining === 0) {
          triggerHaptic('celebration');
          setIsGameVictory(true);
          const finalTime = timerRef.current;
          
          if (matchSubMode === 'ranked') {
            let timeBonus = 100;
            if (finalTime <= 20) timeBonus = 2000;
            else if (finalTime <= 28) timeBonus = 1500;
            else if (finalTime <= 36) timeBonus = 1000;
            else if (finalTime <= 48) timeBonus = 600;
            else if (finalTime <= 65) timeBonus = 300;

            setRankedScore(currentBaseScore => {
              const finalTotalScore = currentBaseScore + timeBonus;
              const accuracy = Math.round((30 / (30 + mismatchesCount)) * 100);
              const tier = getRankTier(finalTotalScore);

              const newEntry = {
                id: `${Date.now()}_${Math.random()}`,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                score: finalTotalScore,
                baseScore: currentBaseScore,
                timeBonus,
                timeSeconds: finalTime,
                maxCombo: maxCombo,
                accuracy,
                mismatches: mismatchesCount,
                rankTier: tier.name,
              };

              let updatedLeaderboard = [];
              try {
                const s = localStorage.getItem(RANKED_LEADERBOARD_KEY);
                const list = s ? JSON.parse(s) : [];
                updatedLeaderboard = [...list, newEntry]
                  .sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds)
                  .slice(0, 10);
              } catch {
                updatedLeaderboard = [newEntry];
              }

              localStorage.setItem(RANKED_LEADERBOARD_KEY, JSON.stringify(updatedLeaderboard));
              setLeaderboardData(updatedLeaderboard);

              const rankIndex = updatedLeaderboard.findIndex(e => e.id === newEntry.id) + 1;
              const isTop1 = rankIndex === 1;
              setIsNewRecord(isTop1);
              setLastGameResult({ ...newEntry, rankIndex });

              return finalTotalScore;
            });
          } else {
            // 练习模式
            const currentBest = localStorage.getItem(BEST_TIME_KEY);
            if (!currentBest || finalTime < Number(currentBest)) {
              localStorage.setItem(BEST_TIME_KEY, String(finalTime));
              setBestRecord(finalTime);
              setIsNewRecord(true);
            }
          }
        }
      }, 220);

    } else {
      // ❌ MISMATCH 错选抖动与严厉连错惩罚
      triggerHaptic('error');
      if (matchSubMode === 'ranked') {
        setComboCount(0);
        const nextErrors = consecutiveErrors + 1;
        setConsecutiveErrors(nextErrors);

        let penalty = 80;
        let penaltyText = '-80 匹配错误';
        if (nextErrors === 2) {
          penalty = 160;
          penaltyText = '-160 ⚠️ 连错惩罚!';
        } else if (nextErrors >= 3) {
          penalty = 280;
          penaltyText = `-280 🚨 ${nextErrors}连错重罚!`;
        }

        setRankedScore(prev => Math.max(0, prev - penalty));

        const now = Date.now();
        const fid = `${now}_${Math.random()}`;
        setFloatingScores(prev => [...prev.slice(-3), { id: fid, text: penaltyText, type: 'minus' }]);
        setTimeout(() => {
          setFloatingScores(prev => prev.filter(f => f.id !== fid));
        }, 1200);
      }

      setGameColumns(prevCols => {
        return prevCols.map((col, cIdx) => {
          if (cIdx === firstColIdx || cIdx === secondColIdx) {
            return col.map(t => {
              if (t.id === firstTile.id || t.id === secondTile.id) {
                return { ...t, isMismatching: true };
              }
              return t;
            });
          }
          return col;
        });
      });
      setMismatchesCount(prev => prev + 1);
      setTimeout(() => {
        setGameColumns(prevCols => {
          return prevCols.map(col => col.map(t => ({ ...t, isMismatching: false })));
        });
        setSelectedTile(null);
        setIsProcessingMatch(false);
      }, 380);
    }
  };

  // 💡 提示功能：找出棋盘上当前存在的一对相同题目并呼吸高亮
  const handleUseHint = () => {
    if (hintsRemaining <= 0 || isGamePaused || isGameVictory || isProcessingMatch) return;
    triggerHaptic('hint');
    const allTiles = gameColumns.flat().filter(t => !t.isMatched);
    
    // 寻找配对
    for (let i = 0; i < allTiles.length; i++) {
      for (let j = i + 1; j < allTiles.length; j++) {
        if (allTiles[i].pairId === allTiles[j].pairId && allTiles[i].type !== allTiles[j].type) {
          setHintedTileIds([allTiles[i].id, allTiles[j].id]);
          setHintsRemaining(prev => prev - 1);
          setTimeout(() => {
            setHintedTileIds([]);
          }, 4000);
          return;
        }
      }
    }
  };

  // =========================================================
  // 🐍 能量贪吃蛇模式 (Snake Runner) Core Logic
  // =========================================================
  const canvasRef = useRef(null);
  const snakeDirRef = useRef({ x: 1, y: 0 });
  const nextDirRef = useRef({ x: 1, y: 0 });
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const snakeFoodsRef = useRef([]);
  const snakeTargetRef = useRef(null);
  const snakeBodyRef = useRef([]);
  const lastStepTimeRef = useRef(performance.now());
  const stepDurationRef = useRef(200);

  const generateSnakeFoodsAndTarget = useCallback((currentBody) => {
    const targetItem = initialItems[Math.floor(Math.random() * initialItems.length)];
    const isPromptFrac = Math.random() > 0.5;
    const promptText = isPromptFrac ? targetItem.fraction : targetItem.percent;
    const promptType = isPromptFrac ? 'fraction' : 'percent';
    const correctValue = isPromptFrac ? targetItem.percent : targetItem.fraction;
    const correctType = isPromptFrac ? 'percent' : 'fraction';

    const distractors = [];
    const pool = initialItems.filter(i => i.id !== targetItem.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let k = 0; k < 3 && k < pool.length; k++) {
      distractors.push(isPromptFrac ? pool[k].percent : pool[k].fraction);
    }

    const foodLabels = [
      { value: correctValue, isCorrect: true, id: `f_cor_${Date.now()}` },
      ...distractors.map((d, idx) => ({ value: d, isCorrect: false, id: `f_dis_${idx}_${Date.now()}` }))
    ];

    for (let i = foodLabels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [foodLabels[i], foodLabels[j]] = [foodLabels[j], foodLabels[i]];
    }

    const GRID = 12;
    const occupied = new Set((currentBody || []).map(b => `${b.x},${b.y}`));
    const newFoods = [];

    foodLabels.forEach(fl => {
      let tries = 0;
      let x = 0;
      let y = 0;
      while (tries < 100) {
        x = Math.floor(Math.random() * GRID);
        y = Math.floor(Math.random() * GRID);
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          newFoods.push({ ...fl, x, y });
          break;
        }
        tries++;
      }
    });

    const result = {
      target: {
        item: targetItem,
        promptText,
        promptType,
        correctValue,
        correctType,
      },
      foods: newFoods,
    };

    snakeFoodsRef.current = newFoods;
    snakeTargetRef.current = result.target;
    return result;
  }, []);

  const startNewSnakeGame = useCallback(() => {
    const initialBody = [
      { x: 6, y: 6, prevX: 6, prevY: 6 },
      { x: 5, y: 6, prevX: 5, prevY: 6 },
      { x: 4, y: 6, prevX: 4, prevY: 6 },
    ];
    const initialDir = { x: 1, y: 0 };
    const { target, foods } = generateSnakeFoodsAndTarget(initialBody);

    snakeBodyRef.current = initialBody;
    setSnakeBody(initialBody);
    setSnakeDir(initialDir);
    snakeDirRef.current = initialDir;
    nextDirRef.current = initialDir;
    setSnakeTarget(target);
    setSnakeFoods(foods);
    setSnakeScore(0);
    setSnakeLives(3);
    setSnakeCombo(0);
    setSnakeMaxCombo(0);
    setSnakeEatenCount(0);
    setSnakeFloatingScores([]);
    setIsSnakePaused(false);
    setIsSnakeGameOver(false);
    setIsSnakeNewRecord(false);
    lastStepTimeRef.current = performance.now();
  }, [generateSnakeFoodsAndTarget]);

  const changeSnakeDirection = useCallback((newDir) => {
    const current = snakeDirRef.current;
    if (newDir.x === -current.x && newDir.y === -current.y) return;
    nextDirRef.current = newDir;
    triggerHaptic('tap');
  }, []);

  // 60FPS Snake Tick Loop (Continuous smooth physics clock)
  useEffect(() => {
    let interval = null;
    if (quizMode === 'snakeGame' && !isSnakePaused && !isSnakeGameOver) {
      const tickSpeed = 200;
      stepDurationRef.current = tickSpeed;

      interval = setInterval(() => {
        lastStepTimeRef.current = performance.now();

        setSnakeBody(prevBody => {
          if (!prevBody || prevBody.length === 0) return prevBody;
          const currentDir = nextDirRef.current;
          snakeDirRef.current = currentDir;
          setSnakeDir(currentDir);

          const head = prevBody[0];
          const GRID = 12;
          const nextX = (head.x + currentDir.x + GRID) % GRID;
          const nextY = (head.y + currentDir.y + GRID) % GRID;

          // 1. 自咬检测
          const isSelfBite = prevBody.some((seg, idx) => idx > 0 && seg.x === nextX && seg.y === nextY);
          if (isSelfBite) {
            triggerHaptic('error');
            setSnakeLives(prevLives => {
              const nextLives = prevLives - 1;
              if (nextLives <= 0) {
                setIsSnakeGameOver(true);
              }
              return Math.max(0, nextLives);
            });
            return prevBody;
          }

          // 2. 食物碰撞检测 (使用同步 snakeFoodsRef)
          const currentFoods = snakeFoodsRef.current || [];
          const eatenFood = currentFoods.find(f => f.x === nextX && f.y === nextY);

          if (eatenFood) {
            if (eatenFood.isCorrect) {
              // 🎯 吞噬正确能量球！
              triggerHaptic('success');

              setSnakeCombo(prevCombo => {
                const nextCombo = prevCombo + 1;
                setSnakeMaxCombo(m => Math.max(m, nextCombo));
                const earned = 100 + (nextCombo - 1) * 40;

                setSnakeScore(prevScore => {
                  const newScore = prevScore + earned;
                  const high = Number(localStorage.getItem('baihuafen-snake-highscore') || 0);
                  if (newScore > high) {
                    localStorage.setItem('baihuafen-snake-highscore', String(newScore));
                    setSnakeHighScore(newScore);
                    setIsSnakeNewRecord(true);
                  }
                  return newScore;
                });

                const fid = `${Date.now()}_${Math.random()}`;
                const floatText = nextCombo >= 2 ? `+${earned} 🔥x${nextCombo}!` : `+${earned} 🎯!`;
                setSnakeFloatingScores(prev => [...prev.slice(-3), { id: fid, text: floatText, type: 'plus' }]);
                setTimeout(() => {
                  setSnakeFloatingScores(prev => prev.filter(f => f.id !== fid));
                }, 1000);

                return nextCombo;
              });

              setSnakeEatenCount(c => c + 1);

              // 蛇身变长
              const newBody = [
                { x: nextX, y: nextY, prevX: head.x, prevY: head.y },
                ...prevBody.map((seg, idx) => ({
                  x: idx === 0 ? head.x : prevBody[idx - 1].x,
                  y: idx === 0 ? head.y : prevBody[idx - 1].y,
                  prevX: seg.x,
                  prevY: seg.y,
                }))
              ];

              snakeBodyRef.current = newBody;

              // 刷新下一组目标与食物
              const { target: newTarget, foods: newFoods } = generateSnakeFoodsAndTarget(newBody);
              setSnakeTarget(newTarget);
              setSnakeFoods(newFoods);

              return newBody;

            } else {
              // ❌ 误吞错误干扰球
              triggerHaptic('error');
              setSnakeCombo(0);
              setSnakeLives(prevLives => {
                const nextLives = prevLives - 1;
                if (nextLives <= 0) {
                  setIsSnakeGameOver(true);
                }
                return Math.max(0, nextLives);
              });

              const fid = `${Date.now()}_${Math.random()}`;
              setSnakeFloatingScores(prev => [...prev.slice(-3), { id: fid, text: '-1 ❤️ 误吞!', type: 'minus' }]);
              setTimeout(() => {
                setSnakeFloatingScores(prev => prev.filter(f => f.id !== fid));
              }, 1000);

              const newBody = [
                { x: nextX, y: nextY, prevX: head.x, prevY: head.y },
                ...prevBody.slice(0, -1).map((seg, idx) => ({
                  x: idx === 0 ? head.x : prevBody[idx - 1].x,
                  y: idx === 0 ? head.y : prevBody[idx - 1].y,
                  prevX: seg.x,
                  prevY: seg.y,
                }))
              ];

              snakeBodyRef.current = newBody;

              // 错误球在其他空闲位置重新刷新
              const filtered = currentFoods.filter(f => f.id !== eatenFood.id);
              const occupied = new Set(newBody.map(b => `${b.x},${b.y}`));
              currentFoods.forEach(f => occupied.add(`${f.x},${f.y}`));
              let rx = Math.floor(Math.random() * 12);
              let ry = Math.floor(Math.random() * 12);
              while (occupied.has(`${rx},${ry}`)) {
                rx = Math.floor(Math.random() * 12);
                ry = Math.floor(Math.random() * 12);
              }
              const updatedFoods = [...filtered, { ...eatenFood, x: rx, y: ry }];
              snakeFoodsRef.current = updatedFoods;
              setSnakeFoods(updatedFoods);

              return newBody;
            }
          }

          // 正常平滑步进
          const newBody = [
            { x: nextX, y: nextY, prevX: head.x, prevY: head.y },
            ...prevBody.slice(0, -1).map((seg, idx) => ({
              x: idx === 0 ? head.x : prevBody[idx - 1].x,
              y: idx === 0 ? head.y : prevBody[idx - 1].y,
              prevX: seg.x,
              prevY: seg.y,
            }))
          ];

          snakeBodyRef.current = newBody;
          return newBody;
        });
      }, tickSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [quizMode, isSnakePaused, isSnakeGameOver, generateSnakeFoodsAndTarget]);

  // 60FPS Canvas Animation Loop (Smooth Lerp + Neutral Answer Food Badges)
  useEffect(() => {
    if (quizMode !== 'snakeGame') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const render = (time) => {
      const dpr = window.devicePixelRatio || 2;
      const displayWidth = canvas.clientWidth || 340;
      const displayHeight = canvas.clientHeight || 340;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);

      const GRID = 12;
      const cellSize = displayWidth / GRID;

      // 棋盘背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      ctx.fillStyle = '#f8fafc';
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }

      // 绘制 4 颗能量食物药丸卡片 (完全统一的视觉样式，杜绝剧透答案！)
      const foods = snakeFoodsRef.current || [];
      foods.forEach(food => {
        const centerX = food.x * cellSize + cellSize / 2;
        const centerY = food.y * cellSize + cellSize / 2;
        const pillW = cellSize * 0.90;
        const pillH = cellSize * 0.72;
        const pillX = centerX - pillW / 2;
        const pillY = centerY - pillH / 2;

        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.06)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 7);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${food.value.length >= 5 ? 10 : 11.5}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = '#1e293b';
        ctx.fillText(food.value, centerX, centerY + 0.5);
        ctx.restore();
      });

      // 60FPS 平滑插值蛇身 (Smooth Lerp Interpolation)
      const elapsed = time - lastStepTimeRef.current;
      const progress = isSnakePaused || isSnakeGameOver ? 1 : Math.min(1, Math.max(0, elapsed / (stepDurationRef.current || 200)));
      const body = snakeBodyRef.current || [];
      const dir = snakeDirRef.current || { x: 1, y: 0 };

      if (body.length > 0) {
        body.forEach((seg, idx) => {
          let curX = seg.x;
          let curY = seg.y;
          let pX = seg.prevX !== undefined ? seg.prevX : curX;
          let pY = seg.prevY !== undefined ? seg.prevY : curY;

          // 穿墙平滑保护 (跨边缘不插值)
          if (Math.abs(curX - pX) > 1) pX = curX;
          if (Math.abs(curY - pY) > 1) pY = curY;

          const interpX = pX + (curX - pX) * progress;
          const interpY = pY + (curY - pY) * progress;

          const x = interpX * cellSize + 2;
          const y = interpY * cellSize + 2;
          const size = cellSize - 4;
          const radius = idx === 0 ? size / 2.2 : size / 3.2;

          ctx.save();
          if (idx === 0) {
            ctx.fillStyle = '#2563eb';
            ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
            ctx.shadowBlur = 6;
          } else {
            const ratio = idx / body.length;
            ctx.fillStyle = `rgb(${Math.floor(59 + ratio * 30)}, ${Math.floor(130 + ratio * 35)}, ${Math.floor(246 - ratio * 20)})`;
          }

          ctx.beginPath();
          ctx.roundRect(x, y, size, size, radius);
          ctx.fill();
          ctx.restore();

          // 蛇头眼睛
          if (idx === 0) {
            const eyeOffset = size * 0.22;
            const eyeRadius = size * 0.13;
            const pupilRadius = size * 0.065;
            const centerX = interpX * cellSize + cellSize / 2;
            const centerY = interpY * cellSize + cellSize / 2;

            let eye1X = centerX, eye1Y = centerY, eye2X = centerX, eye2Y = centerY;
            if (dir.x === 1) {
              eye1X = centerX + eyeOffset; eye1Y = centerY - eyeOffset;
              eye2X = centerX + eyeOffset; eye2Y = centerY + eyeOffset;
            } else if (dir.x === -1) {
              eye1X = centerX - eyeOffset; eye1Y = centerY - eyeOffset;
              eye2X = centerX - eyeOffset; eye2Y = centerY + eyeOffset;
            } else if (dir.y === 1) {
              eye1X = centerX - eyeOffset; eye1Y = centerY + eyeOffset;
              eye2X = centerX + eyeOffset; eye2Y = centerY + eyeOffset;
            } else if (dir.y === -1) {
              eye1X = centerX - eyeOffset; eye1Y = centerY - eyeOffset;
              eye2X = centerX + eyeOffset; eye2Y = centerY - eyeOffset;
            }

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
            ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(eye1X + dir.x * 1.5, eye1Y + dir.y * 1.5, pupilRadius, 0, Math.PI * 2);
            ctx.arc(eye2X + dir.x * 1.5, eye2Y + dir.y * 1.5, pupilRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [quizMode, isSnakePaused, isSnakeGameOver]);

  // Touch Swipe & Tap Handlers for Snake
  const handleArenaTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleArenaTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 20) {
      // 扫动手势 (Swipe)
      if (absDx > absDy) {
        if (dx > 0) changeSnakeDirection({ x: 1, y: 0 });
        else changeSnakeDirection({ x: -1, y: 0 });
      } else {
        if (dy > 0) changeSnakeDirection({ x: 0, y: 1 });
        else changeSnakeDirection({ x: 0, y: -1 });
      }
    } else {
      // 点击转向 (Tap relative to head)
      const canvas = canvasRef.current;
      if (canvas && snakeBody && snakeBody.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const tapX = touch.clientX - rect.left;
        const tapY = touch.clientY - rect.top;
        const GRID = 12;
        const cellSize = rect.width / GRID;
        const head = snakeBody[0];
        const headX = head.x * cellSize + cellSize / 2;
        const headY = head.y * cellSize + cellSize / 2;
        const diffX = tapX - headX;
        const diffY = tapY - headY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 0) changeSnakeDirection({ x: 1, y: 0 });
          else changeSnakeDirection({ x: -1, y: 0 });
        } else {
          if (diffY > 0) changeSnakeDirection({ x: 0, y: 1 });
          else changeSnakeDirection({ x: 0, y: -1 });
        }
      }
    }
  };

  // Snake Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (quizMode !== 'snakeGame' || isSnakePaused || isSnakeGameOver) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        changeSnakeDirection({ x: 0, y: -1 });
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        changeSnakeDirection({ x: 0, y: 1 });
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        changeSnakeDirection({ x: -1, y: 0 });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        changeSnakeDirection({ x: 1, y: 0 });
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsSnakePaused(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quizMode, isSnakePaused, isSnakeGameOver, changeSnakeDirection]);

  // Auto initialize snakeGame if needed
  useEffect(() => {
    if (quizMode === 'snakeGame' && (!snakeTarget || snakeFoods.length === 0)) {
      startNewSnakeGame();
    }
  }, [quizMode, snakeTarget, snakeFoods.length, startNewSnakeGame]);


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
    triggerHaptic('light');
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
      triggerHaptic('light');
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

    triggerHaptic('light');

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
      triggerHaptic('light');
      handleNext(isCorrect ? 'known' : 'unknown');
      return;
    }

    const checkCorrect = inputVal.trim() === targetStr.trim();
    setIsCorrect(checkCorrect);
    setIsAnswered(true);
    setFeedbackState(checkCorrect ? 'correct' : 'revealed');

    if (checkCorrect) {
      triggerHaptic('success');
    } else {
      triggerHaptic('error');
    }

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
    triggerHaptic('optionSelect');
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
              triggerHaptic('dangerReset');
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
            onClick={() => {
              triggerHaptic('menuToggle');
              setIsPanelOpen(prev => !prev);
            }}
            title={isPanelOpen ? "收起筛选面板" : "展开掌握度面板"}
          >
            <span className="pill-db-name">🧮 百化分速记</span>
            <span className="pill-divider">·</span>
            <span className="pill-cat-name">
              {quizMode === 'percentToFraction' ? '🎯 百化分' : quizMode === 'fractionToPercent' ? '🔄 分化百' : quizMode === 'matchGame' ? '🎮 消消乐' : '🐍 贪吃蛇'}
            </span>
            <span className="pill-progress-text">
              {quizMode === 'matchGame' 
                ? `(剩余 ${remainingPairs} 对)`
                : quizMode === 'snakeGame'
                ? `(⚡ ${snakeScore})`
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
            onClick={() => {
              triggerHaptic('menuToggle');
              setIsSearchOpen(prev => !prev);
            }} 
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
                  triggerHaptic('clear');
                  setSearchQuery('');
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerHaptic('clear');
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
                onClick={() => {
                  triggerHaptic('optionSelect');
                  setFilter('all');
                }}
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
             🎮 4x6 消消乐游戏主界面（练习模式 + 竞技模式）
             ========================================================= */
          <div className="game-board-card">
            {/* 顶部分段子模式切换栏 */}
            <div className="match-submode-pill-bar">
              <button 
                className={`submode-pill-btn ${matchSubMode === 'practice' ? 'active' : ''}`}
                onClick={() => {
                  if (matchSubMode !== 'practice') {
                    triggerHaptic('modeSwitch');
                    setMatchSubMode('practice');
                    localStorage.setItem(MATCH_SUBMODE_KEY, 'practice');
                    startNewGame();
                  }
                }}
              >
                🌱 休闲练习
              </button>
              <button 
                className={`submode-pill-btn ${matchSubMode === 'ranked' ? 'active' : ''}`}
                onClick={() => {
                  if (matchSubMode !== 'ranked') {
                    triggerHaptic('modeSwitch');
                    setMatchSubMode('ranked');
                    localStorage.setItem(MATCH_SUBMODE_KEY, 'ranked');
                    startNewGame();
                  }
                }}
              >
                ⚡ 巅峰竞技
              </button>
            </div>

            <div className="game-top-bar">
              {matchSubMode === 'ranked' ? (
                <>
                  <div className="topbar-left-col">
                    <div className="ranked-score-wrapper">
                      <div className="game-score-badge">
                        <span className="score-icon">⚡</span>
                        <span className="score-num">{rankedScore.toLocaleString()}</span>
                      </div>

                      {comboCount >= 2 && (
                        <div className="game-combo-badge">
                          🔥x{comboCount}
                        </div>
                      )}

                      {/* 飘字积分浮动动效 */}
                      <div className="floating-score-container">
                        {floatingScores.map(f => (
                          <div key={f.id} className={`floating-score-item float-${f.type}`}>
                            {f.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="topbar-center-col">
                    <div className="game-timer-badge">
                      <span className="game-timer-display">{formatTime(timerSeconds)}</span>
                    </div>
                  </div>

                  <div className="topbar-right-col">
                    <button 
                      className="game-ctrl-btn" 
                      onClick={() => {
                        triggerHaptic('dangerReset');
                        startNewGame();
                      }}
                      title="重新开始"
                    >
                      <svg className="ctrl-svg-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="topbar-left-col">
                    <button 
                      className="game-ctrl-btn" 
                      onClick={() => {
                        triggerHaptic('menuToggle');
                        setIsGamePaused(prev => !prev);
                      }}
                      title={isGamePaused ? "继续游戏" : "暂停游戏"}
                    >
                      {isGamePaused ? (
                        <svg className="ctrl-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <svg className="ctrl-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="topbar-center-col">
                    <div className="game-timer-badge">
                      <span className="game-timer-display">{formatTime(timerSeconds)}</span>
                    </div>
                  </div>

                  <div className="topbar-right-col">
                    <button 
                      className="game-ctrl-btn" 
                      onClick={() => {
                        triggerHaptic('dangerReset');
                        startNewGame();
                      }}
                      title="重新洗牌开局"
                    >
                      <svg className="ctrl-svg-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 4 列垂直立柱下落消除网格 (Column Vertical Gravity Stacks) */}
            <div className="game-columns-container">
              {gameColumns.map((column, colIdx) => (
                <div key={colIdx} className="game-col-stack">
                  {column.map((tile) => {
                    const isSelected = selectedTile?.tileId === tile.id;
                    const isMismatch = tile.isMismatching;
                    const isMatched = tile.isMatched;
                    const isFlipping = tile.isFlipping;
                    const isHinted = hintedTileIds.includes(tile.id);

                    let tileClass = `game-tile tile-${tile.type}`;
                    if (isSelected) tileClass += ' tile-selected';
                    if (isMismatch) tileClass += ' tile-mismatch';
                    if (isMatched) tileClass += ' tile-matched';
                    if (isFlipping) tileClass += ' tile-flipping';
                    if (isHinted) tileClass += ' tile-hint-pulse';

                    return (
                      <div
                        key={tile.id}
                        className={tileClass}
                        onClick={() => handleTileClick(colIdx, tile)}
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
              ))}
            </div>

            {/* ⏸ 暂停遮罩 */}
            {isGamePaused && (
              <div className="game-modal-overlay">
                <div className="game-modal-card">
                  <div className="modal-icon svg-modal-icon">
                    <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="10" y1="15" x2="10" y2="9" />
                      <line x1="14" y1="15" x2="14" y2="9" />
                    </svg>
                  </div>
                  <h3 className="modal-title">游戏已暂停</h3>
                  <p className="modal-subtitle">当前用时：{formatTime(timerSeconds)}</p>
                  <div className="modal-actions">
                    <button className="m-btn-primary" onClick={() => {
                      triggerHaptic('menuToggle');
                      setIsGamePaused(false);
                    }}>
                      继续游戏
                    </button>
                    <button className="m-btn-secondary" onClick={() => {
                      triggerHaptic('dangerReset');
                      startNewGame();
                    }}>
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
                  <h3 className="modal-title">
                    {matchSubMode === 'ranked' ? '竞技挑战完成！' : '恭喜通关！'}
                  </h3>

                  {matchSubMode === 'ranked' && lastGameResult ? (
                    <>
                      {isNewRecord && <div className="new-record-badge">🏆 创下新历史高分纪录！</div>}
                      
                      <div className="ranked-victory-score-box">
                        <span className="ranked-score-label">总最终积分</span>
                        <span className="ranked-score-val">{rankedScore.toLocaleString()}</span>
                        <div className={`rank-tier-pill ${getRankTier(rankedScore).badgeClass}`}>
                          {getRankTier(rankedScore).icon} {getRankTier(rankedScore).name}
                        </div>
                      </div>

                      <div className="victory-stats-grid">
                        <div className="v-stat-box">
                          <span className="v-stat-label">⏱️ 通关用时</span>
                          <span className="v-stat-val">{formatTime(lastGameResult.timeSeconds)}</span>
                        </div>
                        <div className="v-stat-box">
                          <span className="v-stat-label">⚡ 极速加成</span>
                          <span className="v-stat-val" style={{ color: '#f59e0b' }}>+{lastGameResult.timeBonus}</span>
                        </div>
                        <div className="v-stat-box">
                          <span className="v-stat-label">🔥 最高连击</span>
                          <span className="v-stat-val">x{lastGameResult.maxCombo}</span>
                        </div>
                        <div className="v-stat-box">
                          <span className="v-stat-label">🎯 准确率</span>
                          <span className="v-stat-val">{lastGameResult.accuracy}%</span>
                        </div>
                      </div>

                      <div className="modal-actions">
                        <button className="m-btn-primary" onClick={startNewGame}>
                          再战一局 ⚡
                        </button>
                        <button className="m-btn-secondary" onClick={() => setIsLeaderboardOpen(true)}>
                          查看排行榜 🏆
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : quizMode === 'snakeGame' ? (
          /* =========================================================
             🐍 能量贪吃蛇游戏主界面 (Snake Runner)
             ========================================================= */
          <div className="game-board-card snake-board-card">
            {/* 顶部状态栏：得分/连击/生命值/目标/重新开局 */}
            <div className="game-top-bar">
              <div className="topbar-left-col">
                <button 
                  className="game-ctrl-btn" 
                  onClick={() => {
                    triggerHaptic('menuToggle');
                    setIsSnakePaused(prev => !prev);
                  }}
                  title={isSnakePaused ? "继续游戏" : "暂停游戏"}
                >
                  {isSnakePaused ? (
                    <svg className="ctrl-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="ctrl-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  )}
                </button>

                <div className="ranked-score-wrapper">
                  <div className="game-score-badge">
                    <span className="score-icon">⚡</span>
                    <span className="score-num">{snakeScore.toLocaleString()}</span>
                  </div>

                  {snakeCombo >= 2 && (
                    <div className="game-combo-badge">
                      🔥x{snakeCombo}
                    </div>
                  )}

                  <div className="snake-lives-pill">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <span key={idx} className={`life-heart ${idx < snakeLives ? 'active' : 'lost'}`}>
                        ❤️
                      </span>
                    ))}
                  </div>

                  <div className="floating-score-container">
                    {snakeFloatingScores.map(f => (
                      <div key={f.id} className={`floating-score-item float-${f.type}`}>
                        {f.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="topbar-center-col">
                {snakeTarget && (
                  <div className="snake-target-pill">
                    <span className="target-pill-label">🎯 目标</span>
                    <span className="target-pill-val">{snakeTarget.promptText}</span>
                  </div>
                )}
              </div>

              <div className="topbar-right-col">
                <button 
                  className="game-ctrl-btn" 
                  onClick={() => {
                    triggerHaptic('dangerReset');
                    startNewSnakeGame();
                  }}
                  title="重新开局"
                >
                  <svg className="ctrl-svg-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 60FPS Canvas 渲染竞技场 */}
            <div 
              className="snake-arena-wrapper"
              onTouchStart={handleArenaTouchStart}
              onTouchEnd={handleArenaTouchEnd}
            >
              <canvas ref={canvasRef} className="snake-canvas" />
            </div>

            {/* 底部操作提示 */}
            <div className="snake-hint-bar">
              <span className="hint-pill">👆 屏幕任意滑动 / 轻触转向</span>
            </div>

            {/* ⏸ 暂停遮罩 */}
            {isSnakePaused && (
              <div className="game-modal-overlay">
                <div className="game-modal-card">
                  <div className="modal-icon svg-modal-icon">
                    <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="10" y1="15" x2="10" y2="9" />
                      <line x1="14" y1="15" x2="14" y2="9" />
                    </svg>
                  </div>
                  <h3 className="modal-title">游戏已暂停</h3>
                  <p className="modal-subtitle">当前得分：{snakeScore.toLocaleString()}</p>
                  <div className="modal-actions">
                    <button className="m-btn-primary" onClick={() => {
                      triggerHaptic('menuToggle');
                      setIsSnakePaused(false);
                    }}>
                      继续游戏
                    </button>
                    <button className="m-btn-secondary" onClick={() => {
                      triggerHaptic('dangerReset');
                      startNewSnakeGame();
                    }}>
                      重新开始
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 💀 Game Over 结算弹窗 */}
            {isSnakeGameOver && (
              <div className="game-modal-overlay">
                <div className="game-modal-card">
                  <div className="modal-icon">🐍</div>
                  <h3 className="modal-title">贪吃蛇挑战结算</h3>
                  {isSnakeNewRecord && <div className="new-record-badge">🏆 创下新历史高分纪录！</div>}

                  <div className="ranked-victory-score-box">
                    <span className="ranked-score-label">最终得分</span>
                    <span className="ranked-score-val">{snakeScore.toLocaleString()}</span>
                  </div>

                  <div className="victory-stats-grid">
                    <div className="v-stat-box">
                      <span className="v-stat-label">🎯 吞噬正确</span>
                      <span className="v-stat-val">{snakeEatenCount} 个</span>
                    </div>
                    <div className="v-stat-box">
                      <span className="v-stat-label">🔥 最高连击</span>
                      <span className="v-stat-val">x{snakeMaxCombo}</span>
                    </div>
                    <div className="v-stat-box" style={{ gridColumn: '1 / -1' }}>
                      <span className="v-stat-label">历史最高纪录</span>
                      <span className="v-stat-val" style={{ color: '#10b981' }}>
                        {snakeHighScore ? `${snakeHighScore.toLocaleString()} 分` : `${snakeScore.toLocaleString()} 分`}
                      </span>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button className="m-btn-primary" onClick={startNewSnakeGame}>
                      再来一局 🐍
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

      {/* 📖 百化分速查表弹窗 (Formula Sheet Modal) */}
      {isFormulaSheetOpen && (
        <div className="sheet-modal-overlay" onClick={() => setIsFormulaSheetOpen(false)}>
          <div className="sheet-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sheet-modal-header">
              <h3 className="sheet-modal-title">📖 百化分对照速查表</h3>
              <button className="sheet-close-btn" onClick={() => setIsFormulaSheetOpen(false)}>✕</button>
            </div>
            <div className="sheet-modal-body">
              <div className="sheet-grid">
                {initialItems.map(item => (
                  <div key={item.id} className="sheet-item-card">
                    <span className="sheet-frac">{item.fraction}</span>
                    <span className="sheet-eq">≈</span>
                    <span className="sheet-pct">{item.percent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🏆 本地排行榜弹窗 (Leaderboard Modal) */}
      {isLeaderboardOpen && (
        <div className="sheet-modal-overlay" onClick={() => setIsLeaderboardOpen(false)}>
          <div className="sheet-modal-card leaderboard-card" onClick={e => e.stopPropagation()}>
            <div className="sheet-modal-header">
              <h3 className="sheet-modal-title">🏆 巅峰竞技排行榜 (Top 10)</h3>
              <button className="sheet-close-btn" onClick={() => setIsLeaderboardOpen(false)}>✕</button>
            </div>
            <div className="sheet-modal-body">
              {leaderboardData.length === 0 ? (
                <div className="empty-state-card" style={{ padding: '2.5rem 1rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
                  <h3>暂无巅峰竞技战绩</h3>
                  <p>切换到「巅峰竞技」模式完成一局，即可上榜！</p>
                  <button 
                    className="empty-state-btn" 
                    onClick={() => {
                      setIsLeaderboardOpen(false);
                      setMatchSubMode('ranked');
                      localStorage.setItem(MATCH_SUBMODE_KEY, 'ranked');
                      startNewGame();
                    }}
                  >
                    开始巅峰挑战
                  </button>
                </div>
              ) : (
                <div className="leaderboard-list">
                  {leaderboardData.map((rec, idx) => {
                    const tier = getRankTier(rec.score);
                    return (
                      <div key={rec.id || idx} className={`leaderboard-item ${idx < 3 ? `top-${idx + 1}` : ''}`}>
                        <div className="lb-rank-col">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </div>
                        <div className="lb-info-col">
                          <div className="lb-main-row">
                            <span className="lb-score-text">{rec.score.toLocaleString()} 分</span>
                            <span className={`rank-tier-badge-sm ${tier.badgeClass}`}>
                              {tier.icon} {tier.name}
                            </span>
                          </div>
                          <div className="lb-sub-row">
                            <span>⏱️ {formatTime(rec.timeSeconds)}</span>
                            <span>🔥 x{rec.maxCombo || 0} 连击</span>
                            <span>🎯 {rec.accuracy || 100}%</span>
                            <span className="lb-date">{rec.dateStr}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="leaderboard-footer-actions">
                    <button 
                      className="clear-lb-btn"
                      onClick={() => {
                        if (window.confirm('确定要清空全部巅峰排行榜历史记录吗？')) {
                          localStorage.removeItem(RANKED_LEADERBOARD_KEY);
                          setLeaderboardData([]);
                        }
                      }}
                    >
                      清空历史战绩
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部悬浮模式栏（极简单层设计） */}
      <nav className="floating-mode-bar" ref={modeBarRef}>
        {quizMode === 'matchGame' ? (
          <>
            {matchSubMode === 'practice' ? (
              <button 
                className={`mode-btn hint-btn ${hintsRemaining <= 0 ? 'disabled' : ''}`} 
                onClick={handleUseHint}
                title="提示一组配对"
              >
                💡 提示 <span className="hint-count-badge">{hintsRemaining}</span>
              </button>
            ) : (
              <button 
                className="mode-btn leaderboard-btn" 
                onClick={() => {
                  triggerHaptic('menuToggle');
                  setIsLeaderboardOpen(true);
                }}
                title="查看巅峰排行榜"
              >
                🏆 排行榜
              </button>
            )}
            <button 
              className="mode-btn sheet-btn" 
              onClick={() => {
                triggerHaptic('menuToggle');
                setIsFormulaSheetOpen(true);
              }}
              title="查看百化分对照表"
            >
              📖 百化分表
            </button>
            <span className="mode-divider"></span>
            <button 
              className="mode-btn exit-game-btn" 
              onClick={() => {
                triggerHaptic('modeSwitch');
                setQuizMode('percentToFraction');
              }}
              title="退出游戏模式"
            >
              退出
            </button>
          </>
        ) : quizMode === 'snakeGame' ? (
          <>
            <button 
              className="mode-btn sheet-btn" 
              onClick={() => {
                triggerHaptic('menuToggle');
                setIsFormulaSheetOpen(true);
              }}
              title="查看百化分对照表"
            >
              📖 百化分表
            </button>
            <span className="mode-divider"></span>
            <button 
              className="mode-btn exit-game-btn" 
              onClick={() => {
                triggerHaptic('modeSwitch');
                setQuizMode('percentToFraction');
              }}
              title="退出游戏模式"
            >
              退出
            </button>
          </>
        ) : (
          <>
            <button 
              className={`mode-btn ${quizMode === 'percentToFraction' ? 'active' : ''}`} 
              onClick={() => { 
                triggerHaptic('modeSwitch');
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
                triggerHaptic('modeSwitch');
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
                triggerHaptic('modeSwitch');
                setQuizMode('matchGame'); 
                if (gameColumns.every(col => col.length === 0)) startNewGame(); 
              }}
            >
              🎮 消消乐
            </button>
            <button 
              className={`mode-btn ${quizMode === 'snakeGame' ? 'active' : ''}`} 
              onClick={() => { 
                triggerHaptic('modeSwitch');
                setQuizMode('snakeGame'); 
                if (!snakeTarget || snakeFoods.length === 0) startNewSnakeGame(); 
              }}
            >
              🐍 贪吃蛇
            </button>

            <span className="mode-divider"></span>

            <button 
              className={`mode-btn random-btn ${!isRandom ? 'active' : ''}`} 
              onClick={() => {
                triggerHaptic('optionSelect');
                setIsRandom(false);
              }}
            >
              顺序
            </button>
            <button 
              className={`mode-btn random-btn ${isRandom ? 'active' : ''}`} 
              onClick={() => {
                triggerHaptic('optionSelect');
                setIsRandom(true);
              }}
            >
              随机
            </button>
          </>
        )}
      </nav>
    </div>
  );
}

export default App;


