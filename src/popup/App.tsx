import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from './components/Header.js';
import { StatusBanner } from './components/StatusBanner.js';
import { ScanForm } from './components/ScanForm.js';
import { ProgressView } from './components/ProgressView.js';
import { ResultsView } from './components/ResultsView.js';
import { LoginForm } from './components/LoginForm.js';
import { AnalysisSpinner } from './components/AnalysisSpinner.js';
import { MatchResultsView } from './components/MatchResultsView.js';
import { storage } from '../shared/storage.js';
import { getAuthToken, getCurrentUser, logout } from '../shared/auth.js';
import { SUPPORTED_LINKEDIN_PATTERNS, DEFAULT_TARGET_POSTS } from '../shared/constants.js';
import { extractQueryFromUrl } from '../shared/utils.js';
import type {
  ExtractorState,
  ExtensionMessage,
  ProgressUpdateMessage,
  ScanProgress,
  AuthUser,
  MatchResults,
  RawHiringPost,
} from '../shared/types.js';

export const App: React.FC = () => {
  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Tab & LinkedIn context
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [isSupportedPage, setIsSupportedPage] = useState<boolean>(true);
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [targetCount, setTargetCount] = useState<number>(DEFAULT_TARGET_POSTS);

  // Scraper Progress State
  const [progress, setProgress] = useState<ScanProgress>({
    state: 'idle',
    targetCount: DEFAULT_TARGET_POSTS,
    postsDiscovered: 0,
    postsScanned: 0,
    postsMatched: 0,
    posts: [],
  });

  // AI Matching State
  const [activeView, setActiveView] = useState<'scraper' | 'matches'>('scraper');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);

  // Track if AI analysis should immediately run when scraping finishes
  const autoAnalyzeRef = useRef<boolean>(false);

  // Check persisted auth session and listen to changes (e.g. auto logout when refresh token expires)
  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const user = await getCurrentUser();
        setAuthToken(token);
        setCurrentUser(user);

        const savedMatches = await storage.getMatchResults();
        if (savedMatches) {
          setMatchResults(savedMatches);
        }
      } catch (err) {
        console.warn('[HireFlow] Failed to initialize auth session:', err);
      } finally {
        setIsAuthLoading(false);
      }
    })();

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const handleStorageChange = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName === 'local') {
          if ('jwtToken' in changes) {
            setAuthToken((changes.jwtToken.newValue as string) || null);
          }
          if ('currentUser' in changes) {
            setCurrentUser((changes.currentUser.newValue as AuthUser) || null);
          }
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  // Verify active tab URL and communicate with content script
  const verifyCurrentTab = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      setIsSupportedPage(true);
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url) {
        setIsSupportedPage(false);
        return;
      }

      setActiveTabId(tab.id);
      const url = tab.url;

      const query = extractQueryFromUrl(url);
      if (query) {
        setActiveQuery(query);
      }

      const isMatchingUrl =
        url.includes('linkedin.com') &&
        SUPPORTED_LINKEDIN_PATTERNS.some((pattern) => url.includes(pattern));

      if (!isMatchingUrl) {
        setIsSupportedPage(false);
        return;
      }

      setIsSupportedPage(true);

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'CHECK_PAGE_SUPPORT',
        });
        if (response && response.payload) {
          setIsSupportedPage(response.payload.isSupported);
          if (response.payload.query) {
            setActiveQuery(response.payload.query);
          }
        }
      } catch {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
          });
        } catch (injectionErr) {
          console.warn('[HireFlow] Script injection error:', injectionErr);
        }
      }
    } catch (err) {
      console.warn('[HireFlow] Error checking tab:', err);
      setIsSupportedPage(false);
    }
  }, []);

  // Load saved settings and last scan status from storage
  useEffect(() => {
    (async () => {
      const savedTarget = await storage.getTargetCount(DEFAULT_TARGET_POSTS);
      setTargetCount(savedTarget);

      const savedProgress = await storage.getProgress();
      const savedPosts = await storage.getSavedPosts();

      if (savedProgress) {
        setProgress({
          ...savedProgress,
          posts: savedPosts.length > 0 ? savedPosts : savedProgress.posts,
        });
      } else if (savedPosts.length > 0) {
        setProgress({
          state: 'complete',
          targetCount: savedTarget,
          postsDiscovered: savedPosts.length,
          postsScanned: savedPosts.length,
          postsMatched: savedPosts.length,
          posts: savedPosts,
        });
      }

      await verifyCurrentTab();
    })();
  }, [verifyCurrentTab]);

  // Execute AI Matching Batch via Background Worker
  const triggerAiBatchMatching = useCallback(
    async (postsToAnalyze: RawHiringPost[]) => {
      if (postsToAnalyze.length === 0) {
        setAnalysisError('No posts available to analyze. Please scrape LinkedIn results first.');
        return;
      }

      setIsAnalyzing(true);
      setAnalysisError(null);

      const payload = {
        source: 'linkedin',
        extractedAt: new Date().toISOString(),
        searchUrl: progress.activeUrl || 'https://www.linkedin.com/search/results/content/',
        searchQuery: activeQuery || progress.activeQuery || undefined,
        totalScanned: progress.postsScanned || postsToAnalyze.length,
        totalMatched: postsToAnalyze.length,
        posts: postsToAnalyze,
      };

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          const response = await chrome.runtime.sendMessage({
            action: 'PROCESS_SCRAPED_JOBS',
            payload,
          });

          if (response?.success && response.results) {
            setMatchResults(response.results);
            setActiveView('matches');
            await storage.setMatchResults(response.results);
          } else {
            throw new Error(response?.error || 'Worker service failed to complete matching.');
          }
        } else {
          throw new Error('Chrome extension runtime is not accessible.');
        }
      } catch (err) {
        console.error('[HireFlow] AI Batch Matching error:', err);
        setAnalysisError(err instanceof Error ? err.message : 'AI matching failed');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [activeQuery, progress.activeQuery, progress.activeUrl, progress.postsScanned]
  );

  // Listen for real-time progress messages from content script
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const messageListener = (message: ExtensionMessage) => {
      if (message.action === 'PROGRESS_UPDATE') {
        const update = (message as ProgressUpdateMessage).payload;
        setProgress(update);

        // If autoAnalyze was requested and scrape reached completion, trigger AI analysis!
        if (update.state === 'complete' && autoAnalyzeRef.current) {
          autoAnalyzeRef.current = false;
          if (update.posts && update.posts.length > 0) {
            triggerAiBatchMatching(update.posts);
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [triggerAiBatchMatching]);

  const handleStartExtraction = async (selectedCount: number, andAnalyze = false) => {
    setTargetCount(selectedCount);
    await storage.setTargetCount(selectedCount);
    autoAnalyzeRef.current = Boolean(andAnalyze);
    setActiveView('scraper');

    if (!activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) setActiveTabId(tab.id);
    }

    const tabIdToUse = activeTabId;
    if (!tabIdToUse && typeof chrome !== 'undefined') {
      alert('Could not detect active LinkedIn tab. Please refresh the page.');
      return;
    }

    const initialProgress: ScanProgress = {
      state: 'preparing',
      targetCount: selectedCount,
      postsDiscovered: 0,
      postsScanned: 0,
      postsMatched: 0,
      posts: [],
      activeQuery,
    };
    setProgress(initialProgress);
    await storage.setProgress(initialProgress);

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && tabIdToUse) {
        chrome.tabs.sendMessage(tabIdToUse, {
          action: 'START_EXTRACTION',
          payload: { targetCount: selectedCount },
        }).catch((err) => {
          console.error('[HireFlow] Send start extraction failed:', err);
          setProgress((prev) => ({
            ...prev,
            state: 'error',
            errorMessage: 'Failed to communicate with LinkedIn page. Please reload the tab.',
          }));
        });
      }
    } catch (err) {
      console.error('[HireFlow] Error starting scan:', err);
      setProgress((prev) => ({
        ...prev,
        state: 'error',
        errorMessage: err instanceof Error ? err.message : 'Scan start error',
      }));
    }
  };

  const handleStopExtraction = async () => {
    autoAnalyzeRef.current = false;
    if (typeof chrome !== 'undefined' && chrome.tabs && activeTabId) {
      try {
        await chrome.tabs.sendMessage(activeTabId, {
          action: 'STOP_EXTRACTION',
        });
      } catch (err) {
        console.warn('[HireFlow] Stop request message failed:', err);
      }
    }
    setProgress((prev) => ({ ...prev, state: 'stopped' }));
  };

  const handleClearResults = async () => {
    await storage.clearAllResults();
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        await chrome.runtime.sendMessage({ action: 'CLEAR_RESULTS' });
      } catch {
        // Ignored
      }
    }
    setMatchResults(null);
    setProgress({
      state: 'idle',
      targetCount,
      postsDiscovered: 0,
      postsScanned: 0,
      postsMatched: 0,
      posts: [],
    });
  };

  const handleNewScan = () => {
    setActiveView('scraper');
    setProgress((prev) => ({
      ...prev,
      state: 'idle',
    }));
  };

  const handleOpenLinkedIn = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({
        url: 'https://www.linkedin.com/search/results/content/?keywords=hiring',
      });
    } else {
      window.open('https://www.linkedin.com/search/results/content/?keywords=hiring', '_blank');
    }
  };

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    setAuthToken(token);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await logout();
    setAuthToken(null);
    setCurrentUser(null);
  };

  // Loading spinner during initial storage read
  if (isAuthLoading) {
    return (
      <div className="popup-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="ai-spinner-container">
          <div className="ai-pulse-ring"></div>
        </div>
      </div>
    );
  }

  // View 1: Unauthenticated -> Login Form
  if (!authToken) {
    return (
      <div className="popup-container">
        <Header hasResults={false} onClear={handleClearResults} />
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // View 2: Authenticated Scraper / AI Matcher
  const currentState: ExtractorState = progress.state;
  const isScanning =
    currentState === 'preparing' ||
    currentState === 'scanning' ||
    currentState === 'loading_more';
  const isDoneOrStopped =
    currentState === 'complete' ||
    currentState === 'stopped';
  const hasResults = progress.posts.length > 0 || matchResults !== null;

  return (
    <div className="popup-container">
      <Header
        hasResults={hasResults}
        onClear={handleClearResults}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Navigation Tabs (if matches or posts exist) */}
      {(progress.posts.length > 0 || matchResults !== null) && !isScanning && !isAnalyzing && (
        <div className="app-tab-bar">
          <button
            type="button"
            className={`app-tab-btn ${activeView === 'scraper' ? 'active' : ''}`}
            onClick={() => setActiveView('scraper')}
          >
            Scraped Posts ({progress.posts.length})
          </button>
          <button
            type="button"
            className={`app-tab-btn ${activeView === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveView('matches')}
            disabled={!matchResults}
          >
            AI Matches ({matchResults?.totalRelevantJobs ?? matchResults?.matchedJobs?.length ?? 0})
          </button>
        </div>
      )}

      {/* Active AI Analysis Spinner */}
      {isAnalyzing ? (
        <AnalysisSpinner
          message="Matching posts against your candidate portfolio (AI analysis in progress)..."
          totalPosts={progress.posts.length}
        />
      ) : analysisError ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <StatusBanner
            type="error"
            message="AI Matching Failed"
            details={analysisError}
          />
          <button
            onClick={() => setAnalysisError(null)}
            className="btn-secondary"
            style={{ width: '100%' }}
          >
            Dismiss
          </button>
        </div>
      ) : activeView === 'matches' && matchResults ? (
        <MatchResultsView
          results={matchResults}
          totalScanned={progress.postsScanned}
          onBackToScraper={() => setActiveView('scraper')}
          onNewScan={handleNewScan}
        />
      ) : !isSupportedPage && !isScanning ? (
        <StatusBanner
          type="unsupported"
          message="Open a LinkedIn post search page to start extracting hiring opportunities."
          onOpenLinkedIn={handleOpenLinkedIn}
        />
      ) : currentState === 'error' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <StatusBanner
            type="error"
            message="Something went wrong while scanning LinkedIn."
            details={progress.errorMessage}
          />
          <button onClick={handleNewScan} className="btn-secondary" style={{ width: '100%' }}>
            Back to Scanner
          </button>
        </div>
      ) : isScanning ? (
        <ProgressView
          progress={progress}
          onStop={handleStopExtraction}
        />
      ) : isDoneOrStopped ? (
        <ResultsView
          progress={progress}
          onNewScan={handleNewScan}
          onAnalyzeBatch={() => triggerAiBatchMatching(progress.posts)}
        />
      ) : (
        <ScanForm
          initialCount={targetCount}
          activeQuery={activeQuery}
          onStart={handleStartExtraction}
        />
      )}
    </div>
  );
};
