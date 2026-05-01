// Import React hooks, router, animations, date formatting, translation, and Firebase utilities
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { 
  Newspaper,
  Globe,
  Clock,
  ExternalLink,
  Share2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  ArrowLeft,
  Info,
  Camera,
  Languages,
  Brain,
  BarChart2,
  Home,
  ArrowRight,
  MessageCircle,
  Loader2,
  Image as ImageIcon,
  Tag,
  Volume2,
  VolumeX,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { MobileSidebar } from '@/components/MobileSidebar';
import { analyzeText } from '@/utils/newsAnalyzer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { UserNav } from '@/components/UserNav';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import { 
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {Tooltip} from '@/components/Tooltip.tsx';

// Define interface for NewsItem data structure
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  content?: string;
  contentSnippet?: string;
  source: string;
  credibilityScore?: number;
  isFactual?: boolean;
  warnings?: string[];
  thumbnail?: string;
  category?: string;
}

// Define interface for SpeechState to manage text-to-speech functionality
interface SpeechState {
  isPlaying: boolean;
  currentArticleId: string | null;
}

// Define RSS feeds with their URLs, names, icons, and categories
const RSS_FEEDS = [
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    name: 'NY Times',
    icon: '📰',
    category: 'International'
  },
  {
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    name: 'BBC News',
    icon: '🌍',
    category: 'International'
  },
  {
    url: 'https://www.theguardian.com/world/rss',
    name: 'The Guardian',
    icon: '🦉',
    category: 'International'
  },
  {
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    name: 'Al Jazeera',
    icon: '🌐',
    category: 'International'
  },
  {
    url: 'https://www.france24.com/en/rss',
    name: 'France 24',
    icon: '🇫🇷',
    category: 'International'
  },
  {
    url: 'https://feeds.feedburner.com/ndtvnews-top-stories',
    name: 'NDTV',
    icon: '🛡️',
    category: 'Indian'
  },
  {
    url: 'https://www.thehindu.com/news/national/feeder/default.rss',
    name: 'The Hindu',
    icon: '🏛️',
    category: 'Indian'
  },
  {
    url: 'https://indianexpress.com/feed/',
    name: 'Indian Express',
    icon: '📰',
    category: 'Indian'
  },
  {
    url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
    name: 'Times of India',
    icon: '🗞️',
    category: 'Indian'
  }
];

// Fallback CORS proxies (used only if rss2json fails)
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.org/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// Primary: rss2json.com API endpoint (returns pre-parsed JSON, no CORS issues)
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Function to infer news category based on title and content keywords
const inferCategory = (title: string, content: string): string => {
  const text = (title + ' ' + content).toLowerCase();
  if (text.includes('politics') || text.includes('election') || text.includes('government')) return 'Politics';
  if (text.includes('sport') || text.includes('tennis') || text.includes('football') || text.includes('cricket')) return 'Sports';
  if (text.includes('tech') || text.includes('technology') || text.includes('ai') || text.includes('software')) return 'Technology';
  if (text.includes('business') || text.includes('economy') || text.includes('finance')) return 'Business';
  if (text.includes('health') || text.includes('medical') || text.includes('disease')) return 'Health';
  return 'General';
};

// Strip HTML tags from a string
const stripHtml = (html: string): string =>
  html.replace(/<\/?[^>]+(>|$)/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

// Fetch feed via rss2json.com (primary, fastest, no CORS issues, returns JSON)
async function fetchViaRss2Json(feedUrl: string, signal?: AbortSignal): Promise<NewsItem[]> {
  const response = await fetch(`${RSS2JSON_API}${encodeURIComponent(feedUrl)}`, { signal });
  if (!response.ok) throw new Error(`rss2json HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== 'ok') throw new Error('rss2json returned error status');

  return (data.items || []).map((item: any) => {
    const contentSnippet = stripHtml(item.description || item.content || '') || 'No content available';
    const thumbnail = item.thumbnail || item.enclosure?.link || '';
    const title = item.title || 'No title available';
    return {
      title,
      link: item.link || '#',
      pubDate: item.pubDate || new Date().toISOString(),
      content: item.content || '',
      contentSnippet,
      source: '',
      thumbnail,
      category: inferCategory(title, contentSnippet),
    };
  });
}

// Fallback: Fetch via CORS proxy + parse XML
async function fetchViaCorProxy(feedUrl: string, signal?: AbortSignal): Promise<NewsItem[]> {
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(feedUrl);
      const response = await fetch(proxyUrl, { signal });
      if (!response.ok) continue;
      const xmlText = await response.text();
      return parseRSS(xmlText);
    } catch {
      continue;
    }
  }
  throw new Error('All CORS proxies failed');
}

// Fetch a single feed with rss2json primary and CORS-proxy fallback
async function fetchFeed(feedUrl: string): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // Try rss2json first (fast, reliable, no CORS)
    const items = await fetchViaRss2Json(feedUrl, controller.signal);
    if (items.length > 0) return items;
    // If rss2json returned empty, try fallback
    return await fetchViaCorProxy(feedUrl, controller.signal);
  } catch {
    // rss2json failed, try CORS proxies
    try {
      return await fetchViaCorProxy(feedUrl, controller.signal);
    } catch {
      throw new Error('All fetch methods failed');
    }
  } finally {
    clearTimeout(timeout);
  }
}

// Parse RSS feed XML into NewsItem objects (fallback parser)
function parseRSS(xml: string): NewsItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML parsing failed: ' + parseError.textContent);
    }

    const items = Array.from(doc.querySelectorAll('item, entry'));

    return items.map(item => {
      const title = item.querySelector('title')?.textContent || 'No title available';
      const link = item.querySelector('link')?.textContent ||
                  item.querySelector('link')?.getAttribute('href') || '#';
      const pubDate = item.querySelector('pubDate, published')?.textContent ||
                     new Date().toISOString();
      const content = item.querySelector('content\\:encoded, description, summary')?.textContent || '';
      const contentSnippet = stripHtml(content) || 'No content available';
      const thumbnail = item.querySelector('media\\:content, enclosure')?.getAttribute('url') || '';
      const category = inferCategory(title, contentSnippet);

      return {
        title,
        link,
        pubDate,
        content,
        contentSnippet,
        source: '',
        thumbnail,
        category,
      };
    });
  } catch (error) {
    console.error('RSS parsing error:', error);
    return [];
  }
}

// Skeleton component for loading state of news cards
const NewsCardSkeleton = () => (
  <div className="relative bg-background/95 border border-border/20 rounded-lg p-6 h-full shadow-lg hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-primary/20 rounded animate-pulse" />
        <div className="h-4 w-32 bg-primary/20 rounded animate-pulse" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/20 rounded-full animate-pulse" />
        <div className="w-8 h-8 bg-primary/20 rounded-full animate-pulse" />
      </div>
    </div>
    <div className="mb-4">
      <div className="w-full h-48 bg-primary/20 rounded-md animate-pulse" />
    </div>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-4 h-4 bg-primary/20 rounded animate-pulse" />
      <div className="h-4 w-24 bg-primary/20 rounded animate-pulse" />
    </div>
    <div className="space-y-2 mb-4">
      <div className="h-7 w-full bg-primary/20 rounded animate-pulse" />
      <div className="h-7 w-3/4 bg-primary/20 rounded animate-pulse" />
    </div>
    <div className="space-y-2 mb-6">
      <div className="h-4 w-full bg-primary/20 rounded animate-pulse" />
      <div className="h-4 w-full bg-primary/20 rounded animate-pulse" />
      <div className="h-4 w-2/3 bg-primary/20 rounded animate-pulse" />
    </div>
    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/20">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-primary/20 rounded animate-pulse" />
        <div className="h-4 w-24 bg-primary/20 rounded animate-pulse" />
      </div>
      <div className="h-8 w-24 bg-primary/20 rounded animate-pulse" />
    </div>
  </div>
);

// Define animation variants for news cards
const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  hover: { 
    y: -5,
    transition: { duration: 0.2 }
  }
};

// Custom select component for source and category filtering
const ModernSelect = ({ value, onChange, options, placeholder, ariaLabel }) => (
  <div className="relative group min-w-[180px]">
    <div className="absolute inset-0 bg-primary/10 rounded-xl blur transition-all duration-300 group-hover:bg-primary/20" />
    <select
      value={value}
      onChange={onChange}
      className="relative h-12 w-full rounded-xl border-2 border-primary/20 bg-background/95 backdrop-blur-md px-4 shadow-lg transition-all duration-300 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary text-lg appearance-none cursor-pointer pl-10"
      aria-label={ariaLabel}
    >
      <option value="all">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.icon} {option.label}
        </option>
      ))}
    </select>
    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <Globe className="h-5 w-5 text-primary/70" />
    </div>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="h-5 w-5 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

// NewsPage component: Fetches, displays, and analyzes news articles with filtering and pagination
const NewsPage: React.FC = () => {
  // Initialize hooks for translation, authentication, and state management
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingArticles, setAnalyzingArticles] = useState<Set<string>>(new Set());
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [sparkles, setSparkles] = useState([]);
  const [speechState, setSpeechState] = useState<SpeechState>({
    isPlaying: false,
    currentArticleId: null
  });
  const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());
  const [savedArticlesData, setSavedArticlesData] = useState<NewsItem[]>([]);
  const [showSavedArticles, setShowSavedArticles] = useState(false);
  const itemsPerPage = 8;

  // Fetch saved articles from Firestore and listen for updates
  useEffect(() => {
    if (!user) return;

    const savedArticlesRef = collection(db, 'users', user.uid, 'savedArticles');
    const q = query(savedArticlesRef, orderBy('savedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const savedUrls = new Set<string>();
      const savedData: NewsItem[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        savedUrls.add(data.url);
        savedData.push({
          title: data.title,
          link: data.url,
          pubDate: data.savedAt?.toDate().toISOString() || new Date().toISOString(),
          contentSnippet: data.content,
          source: data.source,
          thumbnail: data.thumbnail,
          category: inferCategory(data.title, data.content || ''),
        });
      });
      setSavedArticles(savedUrls);
      setSavedArticlesData(savedData);
    });

    return () => unsubscribe();
  }, [user]);

  // Handler to save or unsave an article to/from Firestore
  const handleSaveArticle = async (article: NewsItem) => {
    if (!user) return;

    try {
      const savedArticlesRef = collection(db, 'users', user.uid, 'savedArticles');
      
      if (savedArticles.has(article.link)) {
        const q = query(savedArticlesRef, where('url', '==', article.link));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
      } else {
        await addDoc(savedArticlesRef, {
          url: article.link,
          title: article.title,
          source: article.source,
          content: article.contentSnippet,
          thumbnail: article.thumbnail,
          savedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error saving/unsaving article:', error);
      alert('Error saving article.');
    }
  };

  // Handler for text-to-speech functionality
  const speak = (text: string, articleId: string) => {
    window.speechSynthesis.cancel();

    if (speechState.isPlaying && speechState.currentArticleId === articleId) {
      window.speechSynthesis.cancel();
      setSpeechState({ isPlaying: false, currentArticleId: null });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') ||
      voice.name.includes('Natural') ||
      voice.name.includes(i18n.language === 'hi' ? 'Hindi' :
                         i18n.language === 'gu' ? 'Gujarati' :
                         i18n.language === 'mr' ? 'Marathi' : 'English')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      setSpeechState({ isPlaying: false, currentArticleId: null });
    };

    window.speechSynthesis.speak(utterance);
    setSpeechState({ isPlaying: true, currentArticleId: articleId });
  };

  // Generate animated sparkles for visual effect
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

  // Animate sparkles movement across the viewport
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

  // Fetch news from all RSS feeds and handle errors
  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    setFailedSources([]);
    setIsRefreshing(true);
    const allNews: NewsItem[] = [];
    const failed: string[] = [];
    const seenLinks = new Set<string>();

    try {
      await Promise.all(RSS_FEEDS.map(async feed => {
        try {
          const items = await fetchFeed(feed.url);
          
          if (items.length === 0) {
            throw new Error('No items found in feed');
          }
          
          const newsWithSource = items
            .filter(item => {
              if (seenLinks.has(item.link)) {
                return false;
              }
              seenLinks.add(item.link);
              return true;
            })
            .map(item => ({
              ...item,
              source: feed.name
            }));
          
          allNews.push(...newsWithSource);
        } catch (feedError) {
          console.error(`Error fetching ${feed.name}:`, feedError);
          failed.push(feed.name);
        }
      }));

      if (allNews.length === 0) {
        setError('Unable to fetch news from any sources. Please try again later.');
      } else {
        allNews.sort((a, b) => 
          new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
        );
        setNews(allNews);
      }
      
      if (failed.length > 0) {
        setFailedSources(failed);
      }
    } catch (err) {
      setError('Failed to fetch news. Please try again later.');
      console.error('News fetch error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Fetch news on mount and refresh every 5 minutes
  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Analyze article content for credibility and factuality
  const analyzeArticle = async (article: NewsItem) => {
    if (analyzingArticles.has(article.link)) return;
    setAnalyzingArticles(prev => new Set(prev).add(article.link));
    
    try {
      const textToAnalyze = article.contentSnippet || article.title;
      const analysis = await analyzeText(textToAnalyze);
      
      setNews(prevNews => 
        prevNews.map(item => 
          item.link === article.link 
            ? {
                ...item,
                credibilityScore: analysis.credibilityScore,
                isFactual: analysis.factCheck.isFactual,
                warnings: analysis.warnings
              }
            : item
        )
      );
      setSavedArticlesData(prevData =>
        prevData.map(item =>
          item.link === article.link
            ? {
                ...item,
                credibilityScore: analysis.credibilityScore,
                isFactual: analysis.factCheck.isFactual,
                warnings: analysis.warnings
              }
            : item
        )
      );
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzingArticles(prev => {
        const newSet = new Set(prev);
        newSet.delete(article.link);
        return newSet;
      });
    }
  };

  // Handler to share an article via native share or social media
  const shareArticle = (article: NewsItem) => {
    const shareText = `${article.title} - ${article.source}`;
    const shareUrl = article.link;

    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: shareText,
        url: shareUrl,
      }).catch(err => console.error('Share failed:', err));
    } else {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

      const shareWindow = window.open('', '_blank', 'width=600,height=400');
      shareWindow.document.write(`
        <html>
          <body style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>Share this article</h2>
            <p><a href="${twitterUrl}" target="_blank">Share on Twitter</a></p>
            <p><a href="${whatsappUrl}" target="_blank">Share on WhatsApp</a></p>
            <p><a href="${facebookUrl}" target="_blank">Share on Facebook</a></p>
            <p><a href="#" onclick="window.close()">Close</a></p>
          </body>
        </html>
      `);
    }
  };

  // Filter news based on source, category, and search query
  const filteredNews = showSavedArticles
    ? savedArticlesData
    : news.filter(item => {
        const matchesSource = selectedSource === 'all' || item.source === selectedSource;
        const matchesCategory = selectedCategory === 'all' || 
          RSS_FEEDS.find(feed => feed.name === item.source)?.category === selectedCategory;
        const matchesSearch = !searchQuery || 
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.contentSnippet?.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSource && matchesCategory && matchesSearch;
      });

  const displayedNews = filteredNews;

  // Remove duplicate news items based on link
  const uniqueNews = Array.from(
    new Map(displayedNews.map(item => [item.link, item])).values()
  );

  // Paginate news items
  const paginatedNews = uniqueNews.slice(0, page * itemsPerPage);
  const hasMore = paginatedNews.length < uniqueNews.length;

  // Define options for category and source filters
  const categoryOptions = [
    { value: 'all', label: 'All Categories', icon: '🌐' },
    { value: 'International', label: 'International', icon: '🌍' },
    { value: 'Indian', label: 'Indian', icon: '🇮🇳' },
  ];

  const sourceOptions = RSS_FEEDS
    .filter(feed => selectedCategory === 'all' || feed.category === selectedCategory)
    .map(feed => ({
      value: feed.name,
      label: feed.name,
      icon: feed.icon
    }));

  // Render the main UI
  return (
    <div className="min-h-screen relative">
      {/* Background layers for visual styling */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950/80" />
      
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#93c5fd_1px,transparent_1px),linear-gradient(to_bottom,#93c5fd_1px,transparent_1px)] bg-[size:4rem_4rem] dark:bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear_gradient(to_bottom,#334155_1px,transparent_1px)] opacity-75 transition-opacity duration-300" />
      
      <div className="fixed inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,#ffffff_0%,rgba(255,255,255,0)_100%)] dark:bg-[radial-gradient(100%_100%_at_50%_0%,rgba(30,41,59,0.5)_0%,rgba(30,41,59,0)_100%)]" />
      
      <div className="fixed inset-0" />
      
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

      <div className="container mx-auto px-4 py-8 relative z-20">
        <div className="max-w-7xl mx-auto">
<div className="flex items-center justify-between mb-8">
  <Button
    variant="ghost"
    asChild
    className="flex items-center gap-2"
  >
    <Link to="/dashboard">
      <ArrowLeft className="h-4 w-4" />
      {t('common.back')}
    </Link>
  </Button>
  
  <div className="flex items-center gap-4">
    <div className="hidden md:flex items-center gap-2">
      {/* Saved Articles */}
      <Tooltip text={t('Saved Articles')}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSavedArticles(!showSavedArticles)}
          className={cn(
            "relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110",
            showSavedArticles && "text-primary"
          )}
        >
          {showSavedArticles ? (
            <BookmarkCheck className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
          ) : (
            <Bookmark className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
          )}
          {savedArticles.size > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
              {savedArticles.size}
            </span>
          )}
        </Button>
      </Tooltip>

      {/* Home */}
      <Tooltip text={t('Content Analyzer')}>
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="relative group hover:bg-primary/10 transition-transform duration-200 transform hover:scale-110"
        >
          <Link to="/dashboard">
            <Home className="h-5 w-5 transition-colors duration-200 group-hover:text-primary" />
          </Link>
        </Button>
      </Tooltip>

      {/* Article-Analysis */}
      <Tooltip text={t('Article Analysis')}>
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

      {/* Community Feed */}
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

      {/* About Us */}
      <Tooltip text={t('About us')}>
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

      <ThemeToggle />
      <UserNav />
    </div>
              {/* Mobile sidebar for smaller screens */}
              <div className="md:hidden">
                <MobileSidebar
                  showHistory={false}
                  onHistoryClick={() => {}}
                  showSavedArticles={showSavedArticles}
                  onSavedArticlesClick={() =>
                    setShowSavedArticles(!showSavedArticles)}
                  savedArticlesCount={savedArticles.size}
                />
              </div>
            </div>
          </div>

          {/* Main title section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Newspaper className="h-12 w-12 text-primary relative" />
              </div>
              <h1 className="text-4xl font-bold">
                News Analysis
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              AI-powered news verification and credibility analysis
            </p>
          </motion.div>

          <div className="flex flex-col items-center gap-8 mb-8">
            <div className="w-full max-w-4xl mx-auto">
              {/* Filter and search controls */}
              <div className="bg-background/95 border border-border/20 rounded-xl p-6 shadow-lg backdrop-blur-md">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="col-span-1 sm:col-span-3">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/10 rounded-xl blur transition-all duration-300 group-focus-within:bg-primary/20" />
                      <div className="relative flex items-center">
                        <Search className="absolute left-4 h-5 w-5 text-primary/70 z-10 transition-colors group-focus-within:text-primary" />
                        <input
                          type="search"
                          placeholder="Search articles by title or content..."
                          className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-primary/20 bg-background/95 backdrop-blur-md shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/70 text-base"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          aria-label="Search articles"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <ModernSelect
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      options={categoryOptions}
                      placeholder="All Categories"
                      ariaLabel="Select news category"
                    />
                  </div>
                  <div className="col-span-1">
                    <ModernSelect
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      options={sourceOptions}
                      placeholder="All Sources"
                      ariaLabel="Select news source"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-3 flex justify-end">
                    <Button
                      variant="outline"
                      onClick={fetchNews}
                      disabled={isRefreshing}
                      className="h-12 px-6 rounded-xl shadow-md relative overflow-hidden group transition-all duration-300 hover:bg-primary/10"
                      aria-label="Refresh news"
                    >
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <motion.div
                        animate={{ rotate: isRefreshing ? 360 : 0 }}
                        transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
                        className="mr-2"
                      >
                        {isRefreshing ? (
                          <Loader2 className="h-5 w-5 text-primary" />
                        ) : (
                          <RefreshCw className="h-5 w-5" />
                        )}
                      </motion.div>
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Display warning for failed sources */}
            {failedSources.length > 0 && (
              <div className="mb-6 rounded-lg border bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-medium">Unable to fetch news from: {failedSources.join(', ')}</p>
                </div>
              </div>
            )}

            {/* News cards with loading and error states */}
            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {Array(8).fill(0).map((_, index) => (
                  <NewsCardSkeleton key={index} />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-destructive">
                <AlertTriangle className="h-6 w-6 mr-2" />
                {error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {paginatedNews.map((item, index) => (
                    <Dialog key={`${item.link}-${index}`}>
                      <DialogTrigger asChild>
                        <motion.div
                          variants={cardVariants}
                          initial="initial"
                          animate="animate"
                          whileHover="hover"
                          transition={{ delay: index * 0.1 }}
                          className="group relative cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg shadow-md" />
                          <div className="relative bg-background/95 border border-border/20 rounded-lg p-6 h-full shadow-lg hover:shadow-xl transition-all duration-300">
                            {analyzingArticles.has(item.link) && (
                              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">{item.source}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={`h-8 w-8 ${
                                    speechState.isPlaying && speechState.currentArticleId === item.link
                                      ? 'text-primary'
                                      : 'text-foreground/70 hover:text-primary'
                                  }`}
                                  aria-label={
                                    speechState.isPlaying && speechState.currentArticleId === item.link
                                      ? 'Stop reading'
                                      : 'Read article'
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speak(
                                      `${item.title}. ${item.contentSnippet}`,
                                      item.link
                                    );
                                  }}
                                >
                                  {speechState.isPlaying && speechState.currentArticleId === item.link ? (
                                    <VolumeX className="h-4 w-4" />
                                  ) : (
                                    <Volume2 className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-foreground/70 hover:text-primary" 
                                  aria-label="Share article"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    shareArticle(item);
                                  }}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-8 w-8 text-foreground/70 hover:text-primary",
                                    savedArticles.has(item.link) && "text-primary"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveArticle(item);
                                  }}
                                  aria-label={savedArticles.has(item.link) ? "Unsave article" : "Save article"}
                                >
                                  {savedArticles.has(item.link) ? (
                                    <BookmarkCheck className="h-4 w-4" />
                                  ) : (
                                    <Bookmark className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {item.thumbnail ? (
                              <div className="mb-4">
                                <img
                                  src={item.thumbnail}
                                  alt={`Thumbnail for ${item.title}`}
                                  className="w-full h-40 object-cover rounded-md"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden w-full h-40 bg-gray-200 dark:bg-gray-700 rounded-md items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-gray-400" />
                                </div>
                              </div>
                            ) : null}

                            <div className="flex items-center gap-2 mb-2">
                              <Tag className="h-4 w-4 text-primary" />
                              <span className="text-sm text-primary font-medium">{item.category}</span>
                            </div>

                            <h3 className="mb-2 line-clamp-2 text-xl font-semibold text-foreground">
                              {item.title}
                            </h3>

                            <div className="mb-4">
                              <p className="text-base text-muted-foreground line-clamp-3">
                                {item.contentSnippet}
                              </p>
                            </div>

                            <div className="flex items-center justify-between border-t border-border/20 pt-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {format(new Date(item.pubDate), 'MMM d, yyyy')}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1 text-primary hover:text-primary/80"
                                aria-label="Read more about this article"
                              >
                                Read More
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      </DialogTrigger>

                      {/* Dialog for expanded article view */}
                      <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-2xl mb-4">{item.title}</DialogTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              {item.source}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {format(new Date(item.pubDate), 'MMMM d, yyyy')}
                            </div>
                          </div>
                        </DialogHeader>

                        <div className="space-y-6">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className={`${
                                    speechState.isPlaying && speechState.currentArticleId === item.link
                                      ? 'text-primary'
                                      : 'text-foreground/70 hover:text-primary'
                                  }`}
                                  aria-label={
                                    speechState.isPlaying && speechState.currentArticleId === item.link
                                      ? 'Stop reading'
                                      : 'Read article'
                                  }
                                  onClick={() => {
                                    speak(
                                      `${item.title}. ${item.contentSnippet}`,
                                      item.link
                                    );
                                  }}
                                >
                                  {speechState.isPlaying && speechState.currentArticleId === item.link ? (
                                    <VolumeX className="h-4 w-4 mr-2" />
                                  ) : (
                                    <Volume2 className="h-4 w-4 mr-2" />
                                  )}
                                  {speechState.isPlaying && speechState.currentArticleId === item.link ? 'Stop Reading' : 'Read Aloud'}
                                </Button>
                              </div>
                            </div>
                            {item.contentSnippet}
                          </div>

                          {/* Display analysis results if available */}
                          {item.credibilityScore !== undefined ? (
                            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Analysis Results</h4>
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                                  item.isFactual 
                                    ? 'bg-success/10 text-success' 
                                    : 'bg-warning/10 text-warning'
                                }`}>
                                  {item.isFactual ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4" />
                                  )}
                                  Credibility Score: {item.credibilityScore}%
                                </span>
                              </div>

                              {item.warnings && item.warnings.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="font-medium text-sm">Warnings</h5>
                                  {item.warnings.map((warning, i) => (
                                    <p key={i} className="flex items-start gap-2 text-sm text-warning">
                                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                      {warning}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Button
                              className="w-full bg-primary/10 hover:bg-primary/20 text-primary"
                              onClick={() => analyzeArticle(item)}
                              disabled={analyzingArticles.has(item.link)}
                            >
                              {analyzingArticles.has(item.link) ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <Brain className="mr-2 h-4 w-4" />
                                  Analyze Article
                                </>
                              )}
                            </Button>
                          )}

                          <div className="flex justify-between items-center pt-4 border-t border-border">
                            <Button variant="outline" size="sm" asChild>
                              <a 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                Visit Source
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => shareArticle(item)}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                </div>

                {/* Load more button for pagination */}
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <Button
                      onClick={() => setPage(prev => prev + 1)}
                      className="bg-primary text-white hover:bg-primary/90"
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { NewsPage };