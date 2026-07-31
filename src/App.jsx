import { useState, useEffect, useCallback } from 'react';
import initialItems from '../data.json';
import './App.css';

const STORAGE_KEY = 'baihuafen-tracker-data-v2';

function App() {
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ known: 0, unsure: 0, unknown: 0 });
  const [filter, setFilter] = useState('all'); // 'all', 'known', 'unsure', 'unknown'
  const [isRandom, setIsRandom] = useState(() => {
    return localStorage.getItem('baihuafen-tracker-random') === 'true';
  });
  const [quizMode, setQuizMode] = useState(() => {
    return localStorage.getItem('baihuafen-tracker-quiz-mode') || 'percentToFraction'; // 'percentToFraction' or 'fractionToPercent'
  });
  const [history, setHistory] = useState([]);

  // Input & Answer States
  const [inputVal, setInputVal] = useState('');
  const [feedbackState, setFeedbackState] = useState('idle'); // 'idle', 'correct', 'revealed'

  useEffect(() => {
    localStorage.setItem('baihuafen-tracker-random', isRandom);
  }, [isRandom]);

  useEffect(() => {
    localStorage.setItem('baihuafen-tracker-quiz-mode', quizMode);
  }, [quizMode]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let loadedItems = [];
    if (stored) {
      loadedItems = JSON.parse(stored);
    } else {
      loadedItems = initialItems.map(item => ({
        ...item,
        status: 'new'
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedItems));
    }
    
    if (loadedItems.length === 0) {
      loadedItems = initialItems.map(item => ({
        ...item,
        status: 'new'
      }));
    }

    setItems(loadedItems);

    const isRandomStored = localStorage.getItem('baihuafen-tracker-random') === 'true';
    if (isRandomStored && loadedItems.length > 0) {
      const candidateIndices = [];
      loadedItems.forEach((item, index) => {
        if (item.status !== 'known') {
          candidateIndices.push(index);
        }
      });

      if (candidateIndices.length > 0) {
        const randIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
        setCurrentIndex(randIndex);
      } else {
        const randIndex = Math.floor(Math.random() * loadedItems.length);
        setCurrentIndex(randIndex);
      }
    }
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      const known = items.filter(i => i.status === 'known').length;
      const unsure = items.filter(i => i.status === 'unsure').length;
      const unknown = items.filter(i => i.status === 'unknown').length;
      setStats({ known, unsure, unknown });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items]);

  const currentItem = items[currentIndex];

  // Calculate target string to match
  // e.g. percentToFraction: 6.7% -> 1/15 => target is "15"
  // e.g. fractionToPercent: 1/15 -> 6.7% => target is "6.7"
  const getTargetStr = useCallback((item, mode) => {
    if (!item) return '';
    if (mode === 'percentToFraction') {
      return item.fraction.replace('1/', '').trim();
    } else {
      return item.percent.replace('%', '').trim();
    }
  }, []);

  const targetStr = getTargetStr(currentItem, quizMode);

  const handleNext = useCallback((status) => {
    const updatedItems = [...items];
    if (currentItem) {
      updatedItems[currentIndex].status = status;
    }
    setItems(updatedItems);
    setInputVal('');
    setFeedbackState('idle');
    
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
    }
  };

  // Process Numpad Key Press
  const handleKeyPress = useCallback((key) => {
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
  }, [feedbackState]);

  const handleConfirm = useCallback(() => {
    if (feedbackState === 'revealed') {
      handleNext('unknown');
      return;
    }

    if (inputVal.trim() === targetStr.trim()) {
      handleNext('known');
    } else {
      setFeedbackState('revealed');
      const updatedItems = [...items];
      updatedItems[currentIndex].status = 'unknown';
      setItems(updatedItems);
    }
  }, [feedbackState, inputVal, targetStr, items, currentIndex, handleNext]);

  // Physical Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [handleKeyPress, handleConfirm]);

  const handleShowAnswer = () => {
    setFeedbackState('revealed');
    setInputVal(targetStr);
    const updatedItems = [...items];
    updatedItems[currentIndex].status = 'unknown';
    setItems(updatedItems);
  };

  const handleFilterClick = (targetFilter) => {
    if (filter === targetFilter) {
      setFilter('all');
      return;
    }
    const count = targetFilter === 'known' ? stats.known :
                  targetFilter === 'unsure' ? stats.unsure :
                  targetFilter === 'unknown' ? stats.unknown : 0;
    if (count === 0) {
      alert(`当前没有处于“${targetFilter === 'known' ? '已掌握' : targetFilter === 'unsure' ? '模糊' : '生疏'}”状态的题目！`);
      return;
    }
    const targetIndex = items.findIndex(i => i.status === targetFilter);
    if (targetIndex !== -1) {
      setFilter(targetFilter);
      setCurrentIndex(targetIndex);
      setInputVal('');
      setFeedbackState('idle');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'known': return 'rgba(16, 185, 129, 0.8)';
      case 'unsure': return 'rgba(245, 158, 11, 0.8)';
      case 'unknown': return 'rgba(239, 68, 68, 0.8)';
      default: return 'rgba(107, 114, 128, 0.8)';
    }
  };

  if (!currentItem) return <div className="loading">加载中...</div>;

  const total = items.length;
  const progress = ((stats.known) / total) * 100;

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <span>🧮</span>
          <span className="title-text">百化分速记</span>
        </h1>
        <div className="progress-container">
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
              className={`stat-item ${filter === 'unsure' ? 'active-unsure' : ''}`}
              onClick={() => handleFilterClick('unsure')}
              title="只复习模糊"
            >
              <span className="dot dot-unsure"></span>
              模糊: <span className="stat-count">{stats.unsure}</span>
            </button>
            <button 
              className={`stat-item ${filter === 'unknown' ? 'active-unknown' : ''}`}
              onClick={() => handleFilterClick('unknown')}
              title="只复习生疏"
            >
              <span className="dot dot-unknown"></span>
              生疏: <span className="stat-count">{stats.unknown}</span>
            </button>
            <button 
              className={`stat-item ${filter === 'all' ? 'active-all' : ''}`}
              onClick={() => setFilter('all')}
              title="查看全部"
            >
              总计: <span className="stat-count">{total}</span>
            </button>
          </div>
          <div className="mode-toggle">
            <button 
              className={`mode-btn ${quizMode === 'percentToFraction' ? 'active' : ''}`} 
              onClick={() => { setQuizMode('percentToFraction'); setInputVal(''); setFeedbackState('idle'); }}
            >
              看百分数打分母
            </button>
            <button 
              className={`mode-btn ${quizMode === 'fractionToPercent' ? 'active' : ''}`} 
              onClick={() => { setQuizMode('fractionToPercent'); setInputVal(''); setFeedbackState('idle'); }}
            >
              看分数打百分数
            </button>
            <span className="mode-divider"></span>
            <button className={`mode-btn ${!isRandom ? 'active' : ''}`} onClick={() => setIsRandom(false)}>顺序</button>
            <button className={`mode-btn ${isRandom ? 'active' : ''}`} onClick={() => setIsRandom(true)}>随机</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Main Prompt Card */}
        <div className="practice-card">
          <div className="card-top-info">
            <span className="item-index">#{currentItem.id}</span>
            {currentItem.status !== 'new' && (
              <span className="status-badge" style={{ backgroundColor: getStatusColor(currentItem.status) }}>
                {currentItem.status === 'known' ? '熟练' : currentItem.status === 'unsure' ? '模糊' : '生疏'}
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

          {/* Typing Display Box */}
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
            {feedbackState === 'revealed' && <span className="status-icon revealed-icon">!</span>}
          </div>

          {/* Full Equation Display when revealed */}
          {feedbackState === 'revealed' && (
            <div className="revealed-equation">
              正确等式：<strong>{currentItem.percent} = {currentItem.fraction}</strong>
            </div>
          )}
        </div>

        {/* Numpad Keyboard */}
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
              disabled={!inputVal}
            >
              清空
            </button>
            {feedbackState === 'revealed' ? (
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

        <div className="controls">
          <button className="btn-text" onClick={() => {
            if(window.confirm('确定要重置所有学习进度吗？')) {
              localStorage.removeItem(STORAGE_KEY);
              window.location.reload();
            }
          }}>
            <svg className="reset-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span className="reset-text">重置进度</span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
