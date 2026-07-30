import { useState, useEffect, useRef } from 'react';
import initialItems from '../data.json';
import './App.css';

const STORAGE_KEY = 'baihuafen-tracker-data-v1';

function App() {
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [stats, setStats] = useState({ known: 0, unsure: 0, unknown: 0 });
  const [filter, setFilter] = useState('all'); // 'all', 'known', 'unsure', 'unknown'
  const [isRandom, setIsRandom] = useState(() => {
    return localStorage.getItem('baihuafen-tracker-random') === 'true';
  });
  const [quizMode, setQuizMode] = useState(() => {
    return localStorage.getItem('baihuafen-tracker-quiz-mode') || 'percentToFraction'; // 'percentToFraction' or 'fractionToPercent'
  });
  const [history, setHistory] = useState([]); // Track navigation history

  useEffect(() => {
    localStorage.setItem('baihuafen-tracker-random', isRandom);
  }, [isRandom]);

  useEffect(() => {
    localStorage.setItem('baihuafen-tracker-quiz-mode', quizMode);
  }, [quizMode]);

  useEffect(() => {
    // Load from local storage or use initial
    const stored = localStorage.getItem(STORAGE_KEY);
    let loadedItems = [];
    if (stored) {
      loadedItems = JSON.parse(stored);
      // Ensure all items are present in case data.json updated
      if (loadedItems.length !== initialItems.length) {
         // Merge logic if needed, but for simplicity, just re-init if lengths differ a lot
         // Actually just stick with stored for now.
      }
    } else {
      loadedItems = initialItems.map(item => ({
        ...item,
        status: 'new' // 'new', 'known', 'unsure', 'unknown'
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedItems));
    }
    
    // In case localstorage was cleared but we have fewer items
    if (loadedItems.length === 0) {
      loadedItems = initialItems.map(item => ({
        ...item,
        status: 'new'
      }));
    }

    setItems(loadedItems);

    // Pick a random starting index if random mode is active on load
    const isRandomStored = localStorage.getItem('baihuafen-tracker-random') === 'true';
    if (isRandomStored && loadedItems.length > 0) {
      // Prioritize items that are not yet marked as 'known'
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
  const cardBackInnerRef = useRef(null);
  const [cardHeight, setCardHeight] = useState('340px');

  useEffect(() => {
    setTimeout(() => {
      if (cardBackInnerRef.current) {
        const contentHeight = cardBackInnerRef.current.scrollHeight;
        setCardHeight(`${Math.max(340, contentHeight)}px`);
      }
    }, 50);
  }, [currentItem, isFlipped, quizMode]);

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
      setIsFlipped(false);
    }
  };

  const handleNext = (status) => {
    const updatedItems = [...items];
    updatedItems[currentIndex].status = status;
    setItems(updatedItems);
    setIsFlipped(false);
    
    // Save to history before navigating
    setHistory(prev => [...prev, currentIndex]);

    // Select next item index
    setTimeout(() => {
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
          alert(`恭喜！你已复习完该类别的所有题目，系统已自动切回“全部”模式。`);
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
        // Filtered mode
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
    }, 300);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (history.length > 0) {
      const prevIndex = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentIndex(prevIndex);
      setIsFlipped(false);
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

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <span>🧮</span>
          <span className="title-text">百化分练习</span>
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
            <button className={`mode-btn ${quizMode === 'percentToFraction' ? 'active' : ''}`} onClick={() => setQuizMode('percentToFraction')}>猜分数</button>
            <button className={`mode-btn ${quizMode === 'fractionToPercent' ? 'active' : ''}`} onClick={() => setQuizMode('fractionToPercent')}>猜百分数</button><span className="mode-divider"></span><button className={`mode-btn ${!isRandom ? 'active' : ''}`} onClick={() => setIsRandom(false)}>顺序</button>
            <button className={`mode-btn ${isRandom ? 'active' : ''}`} onClick={() => setIsRandom(true)}>随机</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className={`card-container ${isFlipped ? 'expanded' : ''}`} style={{ height: cardHeight }} onClick={() => setIsFlipped(!isFlipped)}>
          <div className={`card ${isFlipped ? 'flipped' : ''}`}>
            <div className="card-front" style={{ position: 'relative' }}>
              <h2 className="idiom-word" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
                {quizMode === 'percentToFraction' ? currentItem.percent : currentItem.fraction}
              </h2>

              {currentItem.status !== 'new' && (
                <div className="status-badge" style={{ backgroundColor: getStatusColor(currentItem.status), position: 'absolute', bottom: '20px' }}>
                  上次标记: {currentItem.status === 'known' ? '熟练' : currentItem.status === 'unsure' ? '模糊' : '生疏'}
                </div>
              )}
            </div>
            <div className="card-back">
              <div className="card-back-inner" ref={cardBackInnerRef} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', alignItems: 'center' }}>
                <div className="card-back-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', margin: 0 }}>
                  <h2 className="idiom-word" style={{ color: '#10b981', margin: 0, textAlign: 'center', width: '100%' }}>
                    {quizMode === 'percentToFraction' ? currentItem.fraction : currentItem.percent}
                  </h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`action-buttons ${!isFlipped ? 'hidden' : ''}`}>
          <button className="btn btn-prev" onClick={handlePrev} disabled={history.length === 0}>
            上一题
          </button>
          <button className="btn btn-unknown" onClick={(e) => { e.stopPropagation(); handleNext('unknown'); }}>
            生疏
          </button>
          <button className="btn btn-unsure" onClick={(e) => { e.stopPropagation(); handleNext('unsure'); }}>
            模糊
          </button>
          <button className="btn btn-known" onClick={(e) => { e.stopPropagation(); handleNext('known'); }}>
            熟练
          </button>
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
