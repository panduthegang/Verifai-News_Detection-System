// Import necessary dependencies from React and external libraries
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Loader2, 
  BookOpen, 
  Share2, 
  FileText, 
  Sparkles, 
  Zap, 
  HelpCircle, 
  History, 
  GitCompare, 
  Plus, 
  ArrowLeft, 
  Camera, 
  Newspaper,
  Brain,
  MessageCircle,
  BarChart2
} from 'lucide-react';
import { analyzeText } from '@/utils/newsAnalyzer';
import { AnalysisResult, HistoricalAnalysis } from '@/utils/types';
import { SkeletonResults } from '@/components/SkeletonResults';
import { AnimatedCredibilityMeter } from '@/components/AnimatedCredibilityMeter';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { EducationalResources } from '@/components/EducationalResources';
import { ContentStats } from '@/components/ContentStats';
import { SourceDetails } from '@/components/SourceDetails';
import { HistoryPanel } from '@/components/HistoryPanel';
import { StoryTimeline } from '@/components/StoryTimeline';
import { PatternAnalysis } from '@/components/PatternAnalysis';
import { SimilarityMatrix } from '@/components/SimilarityMatrix';
import { ReportGenerator } from '@/components/ReportGenerator';
import { MobileSidebar } from '@/components/MobileSidebar';
import { VoiceInput } from '@/components/VoiceInput';
import { LandingPage } from './LandingPage';
import { Particles } from '@/components/Particles';
import { UserNav } from '@/components/UserNav';
import { useAuth } from '@/components/AuthProvider';
import {Tooltip} from '@/components/Tooltip';
import { saveAnalysis, getAnalysisHistory, deleteAnalysis } from '@/lib/firestore';
import { DocumentSnapshot } from 'firebase/firestore';

// Define props interface for the HomePage component
interface HomePageProps {
  showLanding?: boolean;
}

// HomePage component: Main entry point for the content analysis application
export const HomePage: React.FC<HomePageProps> = ({ showLanding = true }) => {
  // Initialize hooks for translation, authentication, and navigation
  const { t } = useTranslation();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [history, setHistory] = useState<HistoricalAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonTexts, setComparisonTexts] = useState<string[]>([]);
  const [comparisonResults, setComparisonResults] = useState<AnalysisResult[]>([]);
  const [showAnalyzer, setShowAnalyzer] = useState(!showLanding);
  const [showLandingPage, setShowLandingPage] = useState(showLanding);
  const [sparkles, setSparkles] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Pagination state for history
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [lastHistoryDoc, setLastHistoryDoc] = useState<DocumentSnapshot | null>(null);
  
  const navigate = useNavigate();

  // Effect to handle initial page setup and load user history
  useEffect(() => {
    // Check if user prefers to skip landing page
    const skipLanding = localStorage.getItem('skipLanding') === 'true';
    if (skipLanding) {
      setShowLandingPage(false);
      setShowAnalyzer(true);
    }

    // Load analysis history for authenticated user
    if (user) {
      loadHistory(true); // true indicates initial load
    }
  }, [user]);

  // Function to fetch analysis history from Firestore with pagination
  const loadHistory = async (isInitialLoad: boolean = false) => {
    if (!user || !user.uid) return;
    
    setHistoryLoading(true);
    try {
      const pageSize = 10;
      const lastDoc = isInitialLoad ? undefined : lastHistoryDoc;
      
      const { analyses, lastDocument, hasMore } = await getAnalysisHistory(
        user.uid, 
        pageSize, 
        lastDoc || undefined
      );
      
      if (isInitialLoad) {
        setHistory(analyses);
      } else {
        setHistory(prev => [...prev, ...analyses]);
      }
      
      setLastHistoryDoc(lastDocument);
      setHasMoreHistory(hasMore);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error loading history:', error);
      setErrorMessage('Failed to load history. Please try again.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handler to load more history items
  const handleLoadMoreHistory = () => {
    if (!historyLoading && hasMoreHistory) {
      loadHistory(false);
    }
  };

  // Handler to transition from landing page to analyzer
  const handleStartAnalyzing = () => {
    setShowLandingPage(false);
    setShowAnalyzer(true);
    localStorage.setItem('skipLanding', 'true');
  };

  // Effect to generate animated sparkles for visual effect
  useEffect(() => {
    const generateSparkles = () => {
      const newSparkles = [];
      const gridSize = 4;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const horizontalLines = Math.floor(viewportHeight / (gridSize * 16));
      const verticalLines = Math.floor(viewportWidth / (gridSize * 16));
      
      const sparkleCount = Math.floor(Math.random() * 6) + 5;
      
      for (let i = 0; i < sparkleCount; i++) {
        const isHorizontal = Math.random() > 0.5;
        
        if (isHorizontal) {
          const lineIndex = Math.floor(Math.random() * horizontalLines);
          newSparkles.push({
            id: `sparkle-${Date.now()}-${i}`,
            x: Math.random() * viewportWidth,
            y: lineIndex * gridSize * 16,
            size: Math.random() * 4 + 2,
            opacity: Math.random() * 0.5 + 0.5,
            speed: Math.random() * 2 + 1,
            direction: Math.random() > 0.5 ? 1 : -1,
            isHorizontal: true,
          });
        } else {
          const lineIndex = Math.floor(Math.random() * verticalLines);
          newSparkles.push({
            id: `sparkle-${Date.now()}-${i}`,
            x: lineIndex * gridSize * 16,
            y: Math.random() * viewportHeight,
            size: Math.random() * 4 + 2,
            opacity: Math.random() * 0.5 + 0.5,
            speed: Math.random() * 2 + 1,
            direction: Math.random() > 0.5 ? 1 : -1,
            isHorizontal: false,
          });
        }
      }
      
      setSparkles(newSparkles);
    };
    
    generateSparkles();
    const interval = setInterval(generateSparkles, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Effect to animate sparkles movement
  useEffect(() => {
    if (sparkles.length === 0) return;
    
    const animateSparkles = () => {
      setSparkles(prevSparkles => 
        prevSparkles.map(sparkle => {
          if (sparkle.isHorizontal) {
            let newX = sparkle.x + (sparkle.speed * sparkle.direction);
            if (newX < 0 || newX > window.innerWidth) {
              sparkle.direction *= -1;
              newX = sparkle.x + (sparkle.speed * sparkle.direction);
            }
            return { ...sparkle, x: newX };
          } else {
            let newY = sparkle.y + (sparkle.speed * sparkle.direction);
            if (newY < 0 || newY > window.innerHeight) {
              sparkle.direction *= -1;
              newY = sparkle.y + (sparkle.speed * sparkle.direction);
            }
            return { ...sparkle, y: newY };
          }
        })
      );
    };
    
    const animationFrame = requestAnimationFrame(animateSparkles);
    const interval = setInterval(animateSparkles, 50);
    
    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(interval);
    };
  }, [sparkles]);

  // Handler for text input changes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    setCharCount(newText.length);
  };

  // Handler to analyze input text and save results
  const handleAnalysis = async () => {
    if (!text.trim() || !user) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeText(text);
      setResult(analysis);
      
      const newAnalysis: any = {
        timestamp: new Date().toISOString(),
        text,
        result: analysis,
        statistics: analysis.statistics
      };
      
      await saveAnalysis(user.uid, newAnalysis as HistoricalAnalysis);
      // Reload history to get the latest analysis
      await loadHistory(true);
    } catch (error) {
      console.error('Analysis failed:', error);
      setErrorMessage('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handler to add text for comparison mode
  const handleAddComparison = async () => {
    if (!text.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeText(text);
      setComparisonTexts([...comparisonTexts, text]);
      setComparisonResults([...comparisonResults, analysis]);
      setText('');
    } catch (error) {
      console.error('Analysis failed:', error);
      setErrorMessage('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handler to share analysis results via clipboard
  const handleShare = async () => {
    if (!result) return;
    
    const shareText = `
      Content Analysis Results:
      
      Credibility Score: ${result.credibilityScore}/100
      Factual Assessment: ${result.factCheck.isFactual ? '✓ Verified' : '⚠ Unverified'}
      
      Key Findings:
      ${result.factCheck.explanation}
      
      Analysis Details:
      ${result.sentiment ? `- Sentiment: ${result.sentiment.label} (${result.sentiment.score.toFixed(2)})` : ''}
      ${result.readability ? `- Readability: ${result.readability.level} (Score: ${result.readability.score})` : ''}
      ${result.bias ? `- Bias Assessment: ${result.bias.explanation}` : ''}
      
      Generated by Verifai
    `.trim();
    
    try {
      await navigator.clipboard.writeText(shareText);
      alert('Analysis copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      setErrorMessage('Failed to copy analysis to clipboard.');
    }
  };

  // Handler to select a historical analysis
  const handleHistorySelect = (analysis: HistoricalAnalysis) => {
    setText(analysis.text);
    setResult(analysis.result);
    setCharCount(analysis.text.length);
    setShowHistory(false);
  };

  // Handler to delete a historical analysis
  const handleHistoryDelete = async (id: string) => {
    if (!user || !user.uid) {
      setErrorMessage('User not authenticated. Please sign in again.');
      return;
    }
    try {
      console.log(`Attempting to delete analysis with ID: ${id} for user: ${user.uid}`);
      await deleteAnalysis(user.uid, id);
      console.log(`Firestore deletion successful for ID: ${id}`);
      // Reload history after deletion
      await loadHistory(true);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error deleting analysis:', error);
      setErrorMessage('Failed to delete analysis from Firestore. Please try again.');
    }
  };

  // Render the main UI
  return (
    <div className="min-h-screen relative">
      {/* Background layers for visual styling */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950/80" />
      
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#93c5fd_1px,transparent_1px),linear-gradient(to_bottom,#93c5fd_1px,transparent_1px)] bg-[size:4rem_4rem] dark:bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear_gradient(to_bottom,#334155_1px,transparent_1px)] opacity-50 transition-opacity duration-300" />
      
      <div className="fixed inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,#ffffff_0%,rgba(255,255,255,0)_100%)] dark:bg-[radial-gradient(100%_100%_at_50%_0%,rgba(30,41,59,0.5)_0%,rgba(30,41,59,0)_100%)]" />
      
      <div className="fixed inset-0"/>
      
      {/* Sparkle effect layer */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {sparkles.map(sparkle => (
          <div
            key={sparkle.id}
            className="absolute rounded-full bg-blue-400 dark:bg-blue-500 animate-pulse"
            style={{
              left: `${sparkle.x}px`,
              top: `${sparkle.y}px`,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
              opacity: sparkle.opacity,
              boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.size}px rgba(59, 130, 246, 0.5)`,
              transition: 'transform 0.2s linear'
            }}
          />
        ))}
      </div>

      {/* Conditional rendering of landing page or analyzer */}
      {showLandingPage ? (
        <LandingPage onStartAnalyzing={handleStartAnalyzing} />
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen relative z-20"
          >
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-5xl mx-auto">
                {/* Display error messages if any */}
                {errorMessage && (
                  <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive-foreground">
                    {errorMessage}
                  </div>
                )}

                {/* Header with navigation controls */}
                <div className="flex items-center justify-between mb-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAnalyzer(false);
                      setShowLandingPage(true);
                      localStorage.removeItem('skipLanding');
                    }}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('common.back')}
                  </Button>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2">
  {/* History button with notification badge */}
  <Tooltip text={t('Analysis History')}>
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowHistory(!showHistory)}
      className="relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110"
    >
      <History className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
      {history.length > 0 && (
        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
          {history.length}
        </span>
      )}
    </Button>
  </Tooltip>

  {/* Article Analysis */}
  <Tooltip text={t('Article-Analysis')}>
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110"
    >
      <Link to="/media-analysis">
        <Camera className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
      </Link>
    </Button>
  </Tooltip>

  {/* News */}
  <Tooltip text={t('News Analysis')}>
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110"
    >
      <Link to="/news">
        <Newspaper className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
      </Link>
    </Button>
  </Tooltip>

  {/* Social */}
  <Tooltip text={t('Community Feed')}>
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110"
    >
      <Link to="/social">
        <MessageCircle className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
      </Link>
    </Button>
  </Tooltip>

  {/* About */}
  <Tooltip text={t('About Us')}>
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110"
    >
      <Link to="/about">
        <Info className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
      </Link>
    </Button>
  </Tooltip>

  <LanguageSelector />
  <ThemeToggle />
  <UserNav />
</div>
                    {/* Mobile sidebar for smaller screens */}
                    <div className="md:hidden">
                      <MobileSidebar
                        showHistory={showHistory}
                        onHistoryClick={() => setShowHistory(!showHistory)}
                        onBackHome={() => {
                          setShowAnalyzer(false);
                          setShowLandingPage(true);
                          localStorage.removeItem('skipLanding');
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Main title section */}
                <motion.div 
                  className="text-center mb-12"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex justify-center items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                      <Zap className="h-12 w-12 text-primary relative" />
                    </div>
                    <h1 className="text-4xl font-bold text-foreground">
                      {t('header.title')}
                    </h1>
                  </div>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    {t('header.subtitle')}
                  </p>
                </motion.div>

                <div className="space-y-8">
                  {/* History panel */}
                  <AnimatePresence>
                    {showHistory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <HistoryPanel
                          history={history}
                          onSelect={handleHistorySelect}
                          onDelete={handleHistoryDelete}
                          onLoadMore={handleLoadMoreHistory}
                          hasMore={hasMoreHistory}
                          loading={historyLoading}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Text input and analysis controls */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                    <div className="bg-card/50 backdrop-blur-sm rounded-xl shadow-lg p-8 border border-border/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                      <div className="relative">
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/20">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <label 
                                  htmlFor="content" 
                                  className="text-xl font-semibold text-foreground block"
                                >
                                  {t('input.title')}
                                </label>
                                <p className="text-sm text-muted-foreground">
                                  {t('input.subtitle')}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowHelp(!showHelp)}
                              className="hover:bg-primary/10 transition-colors"
                            >
                              <HelpCircle className="h-5 w-5" />
                            </Button>
                          </div>
                          
                          <div className="relative group/input">
                            <div className="absolute -inset-px bg-gradient-to-r from-primary/50 via-primary/25 to-primary/50 rounded-lg opacity-0 group-focus-within/input:opacity-100 blur transition-all duration-500"></div>
                            
                            <div className="relative">
                              <textarea
                                id="content"
                                rows={8}
                                className="w-full px-4 py-3 rounded-lg bg-background/80 backdrop-blur-sm border border-input focus:ring-0 focus:border-primary/50 transition-all duration-300 text-base shadow-sm relative placeholder:text-muted-foreground/50"
                                placeholder={t('input.placeholder')}
                                value={text}
                                onChange={handleTextChange}
                                style={{ resize: 'vertical' }}
                              />
                              
                              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                <VoiceInput
                                  onTranscript={(transcript) => setText(text + ' ' + transcript)}
                                  isListening={isListening}
                                  setIsListening={setIsListening}
                                />
                                <div className="relative">
                                  <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/60 blur-sm rounded-md"></div>
                                  <div className="relative px-2 py-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md border border-border/50">
                                    {charCount} {t('input.characters')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={handleAnalysis}
                            disabled={isAnalyzing || !text.trim()}
                            size="lg"
                            className="relative overflow-hidden group/button"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 group-hover/button:opacity-100 transition-opacity duration-500"></div>
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="animate-spin mr-2" />
                                {t('common.analyzing')}
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                {t('common.analyze')}
                              </>
                            )}
                          </Button>
                          
                          {text.trim() && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setText('');
                                setCharCount(0);
                                setResult(null);
                              }}
                              size="lg"
                              className="group/clear"
                            >
                              <span className="relative">
                                <span className="absolute inset-0 bg-destructive/10 blur opacity-0 group-hover/clear:opacity-100 transition-opacity duration-300"></span>
                                <span className="relative">{t('common.clear')}</span>
                              </span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Comparison mode controls */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between"
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        setComparisonMode(!comparisonMode);
                        if (!comparisonMode) {
                          setComparisonTexts([]);
                          setComparisonResults([]);
                        }
                      }}
                      className="flex items-center gap-2 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <GitCompare className="h-4 w-4" />
                      {comparisonMode ? t('comparison.exit') : t('comparison.start')}
                    </Button>
                    
                    {comparisonMode && (
                      <Button
                        onClick={handleAddComparison}
                        disabled={isAnalyzing || !text.trim()}
                        className="relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Plus className="h-4 w-4 mr-2" />
                        {t('comparison.add')}
                      </Button>
                    )}
                  </motion.div>

                  {/* Comparison mode results */}
                  {comparisonMode && comparisonResults.length > 0 && (
                    <div className="space-y-8">
                      <SimilarityMatrix
                        texts={comparisonTexts}
                        results={comparisonResults}
                      />
                      <StoryTimeline
                        analyses={comparisonTexts.map((text, i) => ({
                          id: `version-${i}`,
                          timestamp: new Date().toISOString(),
                          text,
                          result: comparisonResults[i]
                        }))}
                      />
                      <PatternAnalysis
                        analyses={comparisonTexts.map((text, i) => ({
                          id: `version-${i}`,
                          timestamp: new Date().toISOString(),
                          text,
                          result: comparisonResults[i]
                        }))}
                      />
                    </div>
                  )}

                  {/* Help section */}
                  <AnimatePresence>
                    {showHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-card rounded-xl shadow-lg p-8 border border-border/50">
                          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <BookOpen className="h-6 w-6 text-primary" />
                            {t('help.title')}
                          </h2>
                          <EducationalResources />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Analysis results */}
                  <AnimatePresence mode="wait">
                    {isAnalyzing && (
                      <motion.div
                        key="skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <SkeletonResults />
                      </motion.div>
                    )}
                    {result && !isAnalyzing && (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-card rounded-xl shadow-lg p-8 border border-border/50"
                        id="analysis-results"
                      >
                        <div className="flex justify-between items-start mb-8">
                          <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            {t('results.title')}
                          </h2>
                          <Button variant="outline" size="sm" onClick={handleShare}>
                            <Share2 className="h-4 w-4 mr-2" />
                            {t('results.share')}
                          </Button>
                        </div>

                        <div className="mb-8">
                          <h3 className="text-lg font-semibold mb-4">{t('results.overview')}</h3>
                          <ContentStats statistics={result.statistics} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                          <div className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-lg shadow-sm">
                            <AnimatedCredibilityMeter score={result.credibilityScore} />
                            <p className="text-sm font-medium mt-4 text-center">
                              {result.credibilityScore >= 80 ? t('results.credibility.high') :
                               result.credibilityScore >= 60 ? t('results.credibility.medium') :
                               t('results.credibility.low')}
                            </p>
                          </div>

                          <div className="flex flex-col justify-center">
                            <h3 className="text-lg font-semibold mb-3 flex items-center">
                              <BookOpen className="text-primary mr-2" />
                              {t('results.factCheck.title')}
                            </h3>
                            <div className={`p-4 rounded-lg border ${
                              result.factCheck.isFactual 
                                ? 'bg-success/10 border-success/30 text-success-foreground dark:border-success/50' 
                                : 'bg-destructive/10 border-destructive/30 text-destructive-foreground dark:border-destructive/50'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                {result.factCheck.isFactual ? (
                                  <CheckCircle className="h-5 w-5 text-success" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                )}
                                <span className="font-medium text-foreground">
                                  {result.factCheck.isFactual ? t('results.factCheck.verified') : t('results.factCheck.unverified')}
                                </span>
                              </div>
                              <p className="text-sm text-foreground">
                                {result.factCheck.explanation}
                              </p>
                            </div>
                          </div>
                        </div>

                        {result.factCheck.sources && result.factCheck.sources.length > 0 && (
                          <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-4">{t('results.sources')}</h3>
                            <SourceDetails sources={result.factCheck.sources} />
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {['Warnings', 'Analysis', 'Suggestions'].map((section, index) => (
                            <div key={section} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                              <h3 className="text-lg font-semibold mb-3 flex items-center">
                                {index === 0 && <AlertTriangle className="text-warning mr-2 h-5 w-5" />}
                                {index === 1 && <Info className="text-primary mr-2 h-5 w-5" />}
                                {index === 2 && <Sparkles className="text-primary mr-2 h-5 w-5" />}
                                {t(`results.${section.toLowerCase()}.title`)}
                              </h3>
                              {index === 0 && (
                                <ul className="space-y-2">
                                  {result.warnings.map((warning, i) => (
                                    <li key={i} className="flex items-start text-sm">
                                      <span className="mr-2 text-warning">•</span>
                                      <span className="text-foreground">{warning}</span>
                                    </li>
                                  ))}
                                  {result.warnings.length === 0 && (
                                    <li className="flex items-center text-sm text-success">
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      {t('results.warnings.none')}
                                    </li>
                                  )}
                                </ul>
                              )}
                              {index === 1 && (
                                <div className="space-y-4">
                                  {[
                                    { label: t('results.analysis.sentiment'), value: `${result.sentiment?.label} (${result.sentiment?.score.toFixed(2)})` },
                                    { label: t('results.analysis.readability'), value: `${result.readability?.level} (${t('results.analysis.score')}: ${result.readability?.score})` },
                                    { label: t('results.analysis.bias'), value: result.bias?.explanation }
                                  ].map((item, i) => (
                                    <div key={i}>
                                      <p className="text-sm font-medium flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                                        {item.label}
                                      </p>
                                      <p className="text-sm text-foreground ml-4">
                                        {item.value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {index === 2 && (
                                <ul className="space-y-2">
                                  {result.suggestions.map((suggestion, i) => (
                                    <li key={i} className="flex items-start text-sm">
                                      <span className="mr-2 text-primary">•</span>
                                      <span className="text-foreground">{suggestion}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-border">
                          <h3 className="text-lg font-semibold mb-4">{t('results.export')}</h3>
                          <ReportGenerator result={result} text={text} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};