import * as tf from '@tensorflow/tfjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisResult, ContentStatistics, ImageAnalysis } from './types';
import i18n from '../i18n';
import { searchSerper } from './serperApi';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Define trusted news sources with their search URLs
const TRUSTED_SOURCES = {
  reuters: {
    domain: 'reuters.com',
    searchUrl: 'https://www.reuters.com/site-search/?query=',
    reliability: 95
  },
  ap: {
    domain: 'apnews.com',
    searchUrl: 'https://apnews.com/search?q=',
    reliability: 95
  },
  bbc: {
    domain: 'bbc.com',
    searchUrl: 'https://www.bbc.co.uk/search?q=',
    reliability: 90
  },
  nature: {
    domain: 'nature.com',
    searchUrl: 'https://www.nature.com/search?q=',
    reliability: 98
  },
  who: {
    domain: 'who.int',
    searchUrl: 'https://www.who.int/home/search?indexCatalogue=genericsearchindex1&searchQuery=',
    reliability: 95
  },
  aljazeera: {
    domain: 'aljazeera.com',
    searchUrl: 'https://www.aljazeera.com/search/',
    reliability: 85
  },
  dw: {
    domain: 'dw.com',
    searchUrl: 'https://www.dw.com/search/',
    reliability: 88
  },
  france24: {
    domain: 'france24.com',
    searchUrl: 'https://www.france24.com/en/search/',
    reliability: 87
  },
  thehindu: {
    domain: 'thehindu.com',
    searchUrl: 'https://www.thehindu.com/search/?q=',
    reliability: 88
  },
  indianexpress: {
    domain: 'indianexpress.com',
    searchUrl: 'https://indianexpress.com/?s=',
    reliability: 87
  },
  timesOfIndia: {
    domain: 'timesofindia.indiatimes.com',
    searchUrl: 'https://timesofindia.indiatimes.com/topic/',
    reliability: 85
  },
  divyabhaskar: {
    domain: 'divyabhaskar.co.in',
    searchUrl: 'https://www.divyabhaskar.co.in/search?q=',
    reliability: 85
  },
  sandesh: {
    domain: 'sandesh.com',
    searchUrl: 'https://www.sandesh.com/search?q=',
    reliability: 85
  },
  gujaratsamachar: {
    domain: 'gujaratsamachar.com',
    searchUrl: 'https://www.gujaratsamachar.com/search/',
    reliability: 85
  },
  lokmat: {
    domain: 'lokmat.com',
    searchUrl: 'https://www.lokmat.com/search/?q=',
    reliability: 85
  },
  maharashtratimes: {
    domain: 'maharashtratimes.com',
    searchUrl: 'https://maharashtratimes.com/topics/',
    reliability: 85
  },
  loksatta: {
    domain: 'loksatta.com',
    searchUrl: 'https://www.loksatta.com/search/',
    reliability: 85
  }
};

// Emotional words with multilingual support
const emotionalWords = {
  positive: {
    en: ['good', 'great', 'excellent', 'amazing', 'wonderful', 'positive', 'success', 'breakthrough'],
    hi: ['अच्छा', 'बेहतर', 'उत्कृष्ट', 'अद्भुत', 'शानदार', 'सकारात्मक', 'सफलता', 'प्रगति'],
    gu: ['સારું', 'શ્રેષ્ઠ', 'ઉત્તમ', 'અદ્ભુત', 'શાનદાર', 'સકારાત્મક', 'સફળતા', 'પ્રગતિ'],
    mr: ['चांगले', 'उत्तम', 'उत्कृष्ट', 'अद्भुत', 'शानदार', 'सकारात्मक', 'यशस्वी', 'प्रगती']
  },
  negative: {
    en: ['bad', 'terrible', 'awful', 'horrible', 'poor', 'negative', 'failure', 'crisis'],
    hi: ['बुरा', 'खराब', 'भयानक', 'घटिया', 'नकारात्मक', 'असफलता', 'संकट', 'समस्या'],
    gu: ['ખરાબ', 'નબળું', 'ભયાનક', 'નિરાશાજનક', 'નકારાત્મક', 'નિષ્ફળતા', 'સંકટ', 'સમસ્યા'],
    mr: ['वाईट', 'भयंकर', 'खराब', 'नकारात्मक', 'अपयश', 'संकट', 'समस्या']
  },
  urgent: {
    en: ['breaking', 'urgent', 'emergency', 'crisis', 'immediately', 'critical', 'vital', 'crucial'],
    hi: ['तत्काल', 'जरूरी', 'आपातकालीन', 'संकट', 'तुरंत', 'महत्वपूर्ण', 'आवश्यक', 'गंभीर'],
    gu: ['તાત્કાલિક', 'તાકીદનું', 'કટોકટી', 'સંકટ', 'તરત', 'મહત્વપૂર્ણ', 'આવશ્યક', 'ગંભીર'],
    mr: ['ताबडतोब', 'तातडीचे', 'आणीबाणी', 'संकट', 'त्वरित', 'महत्त्वाचे', 'आवश्यक', 'गंभीर']
  }
};

// Enhanced content statistics with Gemini-powered keyword extraction
const calculateContentStatistics = async (text: string): Promise<ContentStatistics> => {
  const words = text.trim().split(/\s+/);
  const sentences = text.split(/[.!?।|॥]+/).filter(Boolean);
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const readingTimeMinutes = Math.ceil(words.length / 200);

  // Use Gemini to extract keywords with language support
  let topKeywords: string[] = [];
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Analyze this text and extract the 5 most important keywords or key phrases that best represent its main topics and themes. ${i18n.language === 'gu' ? 'Provide the response in Gujarati.' :
        i18n.language === 'hi' ? 'Provide the response in Hindi.' :
          i18n.language === 'mr' ? 'Provide the response in Marathi.' :
            'Provide the response in English.'
      }

Text to analyze: "${text}"

Response format example:
["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      topKeywords = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse Gemini keywords response:', parseError);
      topKeywords = extractKeywords(text);
    }
  } catch (error) {
    console.error('Gemini keyword extraction failed:', error);
    topKeywords = extractKeywords(text);
  }

  // Calculate emotional tone indicators with multilingual support
  const lang = i18n.language as keyof typeof emotionalWords['positive'];
  const emotionalTone = Object.entries(emotionalWords).reduce((acc, [tone, langs]) => {
    const words = langs[lang] || langs.en;
    const count = words.reduce((sum, word) =>
      sum + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'gi'))?.length || 0), 0);
    return { ...acc, [tone]: count };
  }, {} as Record<string, number>);

  return {
    wordCount: words.length,
    averageSentenceLength: Math.round(words.length / sentences.length) || 0,
    paragraphCount: paragraphs.length,
    complexWords: words.filter(word => word.length > 6).length,
    readingTimeMinutes,
    topKeywords,
    emotionalTone,
    uniqueWords: new Set(words.map(w => w.toLowerCase())).size,
    averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length || 0
  };
};

// Keyword extraction function with language support
const extractKeywords = (text: string): string[] => {
  const STOP_WORDS = new Set(
    i18n.language === 'mr' ? [
      'आहे', 'आणि', 'ते', 'एक', 'मध्ये', 'चा', 'ची', 'चे', 'ने', 'वर', 'जो', 'की',
      'होता', 'होती', 'होते', 'आहे', 'आहेस', 'हा', 'तर', 'पण', 'जर', 'काय', 'आता',
      'कोणी', 'केला', 'राहतो', 'राहते', 'सोबत', 'असेल', 'केले'
    ] : i18n.language === 'gu' ? [
      'છે', 'અને', 'તે', 'એક', 'માં', 'ના', 'ની', 'નું', 'થી', 'પર', 'જે', 'કે',
      'હતું', 'હતી', 'હતા', 'છું', 'છો', 'આ', 'તો', 'પણ', 'જો', 'શું', 'હવે',
      'કોઈ', 'કયું', 'રહ્યો', 'રહી', 'સાથે', 'હોય', 'કરી'
    ] : i18n.language === 'hi' ? [
      'का', 'की', 'के', 'एक', 'में', 'है', 'हैं', 'को', 'पर', 'इस', 'से', 'और',
      'या', 'हो', 'था', 'थी', 'थे', 'कि', 'जो', 'कर', 'यह', 'वह', 'ने', 'बहुत',
      'सभी', 'कुछ', 'अब', 'जब', 'तक', 'तब', 'या', 'एवं', 'यदि', 'भी'
    ] : [
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
      'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
      'will', 'with'
    ]
  );

  const words = text.toLowerCase().split(/\s+/);
  const wordFrequency: Record<string, number> = {};

  words.forEach((word, index) => {
    const cleanWord = word.replace(/[^\p{L}\p{N}']/gu, '');
    if (cleanWord && cleanWord.length > 2 && !STOP_WORDS.has(cleanWord)) {
      wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;

      if (index < words.length - 1) {
        const nextWord = words[index + 1].replace(/[^\p{L}\p{N}']/gu, '');
        if (nextWord && !STOP_WORDS.has(nextWord)) {
          const bigram = `${cleanWord} ${nextWord}`;
          wordFrequency[bigram] = (wordFrequency[bigram] || 0) + 1;
        }
      }
    }
  });

  return Object.entries(wordFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
};

// Analyze timeline for dates and inconsistencies
const analyzeTimeline = (text: string) => {
  const datePattern = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{4}\b/gi;
  const dates = text.match(datePattern) || [];

  return {
    datesFound: dates,
    hasInconsistencies: dates.length > 1 && new Set(dates).size !== dates.length,
    timespan: dates.length > 0 ? {
      earliest: new Date(dates[0]),
      latest: new Date(dates[dates.length - 1])
    } : null
  };
};

// Analyze citations in the text
const analyzeCitations = (text: string) => {
  const citations = {
    academic: text.match(/\b(?:doi:|10\.\d{4,}\/[-._;()\/:A-Z0-9]+)\b/gi) || [],
    quotes: text.match(/"([^"]*)"|\u201C([^\u201D]*)\u201D/g) || [],
    urls: text.match(/https?:\/\/[^\s<>)"]+/g) || []
  };

  return {
    hasCitations: Object.values(citations).some(arr => arr.length > 0),
    citationCount: Object.values(citations).reduce((sum, arr) => sum + arr.length, 0),
    citations
  };
};

// Get relevant article searches based on keywords
const getRelevantArticleSearches = (keywords: string[]) => {
  const searchQuery = encodeURIComponent(keywords.slice(0, 3).join(' '));
  return [
    {
      url: `${TRUSTED_SOURCES.reuters.searchUrl}${searchQuery}`,
      title: i18n.language === 'gu' ? 'સંબંધિત લેખો માટે Reuters શોધો' :
        i18n.language === 'hi' ? 'संबंधित लेखों के लिए Reuters खोजें' :
          i18n.language === 'mr' ? 'संबंधित लेखांसाठी Reuters शोधा' :
            'Search Reuters for related articles',
      reliability: TRUSTED_SOURCES.reuters.reliability
    },
    {
      url: `${TRUSTED_SOURCES.ap.searchUrl}${searchQuery}`,
      title: i18n.language === 'gu' ? 'સંબંધિત કવરેજ માટે AP News શોધો' :
        i18n.language === 'hi' ? 'संबंधित कवरेज के लिए AP News खोजें' :
          i18n.language === 'mr' ? 'संबंधित कव्हरेजसाठी AP News शोधा' :
            'Find related AP News coverage',
      reliability: TRUSTED_SOURCES.ap.reliability
    },
    {
      url: `${TRUSTED_SOURCES.bbc.searchUrl}${searchQuery}`,
      title: i18n.language === 'gu' ? 'સમાન વાર્તાઓ માટે BBC News શોધો' :
        i18n.language === 'hi' ? 'समान कहानियों के लिए BBC News खोजें' :
          i18n.language === 'mr' ? 'समान कथांसाठी BBC News शोधा' :
            'Search BBC News for similar stories',
      reliability: TRUSTED_SOURCES.bbc.reliability
    }
  ];
};

// Main text analysis function
export const analyzeText = async (text: string): Promise<AnalysisResult> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    const message = i18n.language === 'gu' ?
      'API કી કન્ફિગર કરેલી નથી. કૃપા કરીને તમારી Gemini API કી .env ફાઈલમાં ઉમેરો.' :
      i18n.language === 'hi' ?
        'API कुंजी कॉन्फ़िगर नहीं की गई है। कृपया अपनी Gemini API कुंजी .env फ़ाइल में जोड़ें।' :
        i18n.language === 'mr' ?
          'API की कॉन्फिगर केलेली नाही. कृपया तुमची Gemini API की .env फाइलमध्ये जोडा.' :
          'API key not configured. Please add your Gemini API key to the .env file.';

    const suggestion = i18n.language === 'gu' ?
      'Google AI Studio (https://makersuite.google.com/app/apikey) માંથી API કી મેળવો' :
      i18n.language === 'hi' ?
        'Google AI Studio (https://makersuite.google.com/app/apikey) से API कुंजी प्राप्त करें' :
        i18n.language === 'mr' ?
          'Google AI Studio (https://makersuite.google.com/app/apikey) वरून API की मिळवा' :
          'Get an API key from Google AI Studio (https://makersuite.google.com/app/apikey)';

    return {
      credibilityScore: 0,
      warnings: [message],
      suggestions: [suggestion],
      factCheck: {
        isFactual: false,
        explanation: i18n.language === 'gu' ?
          'વિશ્લેષણ કરી શકાતું નથી: API કી ગુમ છે' :
          i18n.language === 'hi' ?
            'विश्लेषण नहीं किया जा सकता: API कुंजी गायब है' :
            i18n.language === 'mr' ?
              'विश्लेषण करता येत नाही: API की गहाळ आहे' :
              'Unable to perform analysis: Missing API key'
      },
      statistics: await calculateContentStatistics(text)
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // First, calculate statistics to get keywords for Serper search
    const statistics = await calculateContentStatistics(text);
    const keywordsForSearch = statistics.topKeywords.join(' ');

    let serperResultsContent = '';
    let serperSources: any[] = [];

    if (keywordsForSearch) {
      const serperResults = await searchSerper(keywordsForSearch);
      if (serperResults.length > 0) {
        serperResultsContent = "\n\n--- Live Search Results ---\n";
        serperResults.slice(0, 5).forEach((result, index) => {
          serperResultsContent += `Result ${index + 1}:\nTitle: ${result.title}\nURL: ${result.link}\nSnippet: ${result.snippet}\n\n`;
          serperSources.push({
            url: result.link,
            title: result.title,
            snippet: result.snippet,
            reliability: 70,
            verificationDetails: [
              i18n.language === 'gu' ? 'આ લાઇવ શોધ પરિણામમાંથી માહિતી' :
                i18n.language === 'hi' ? 'इस लाइव खोज परिणाम से जानकारी' :
                  i18n.language === 'mr' ? 'या थेट शोध परिणामातून माहिती' :
                    'Information from this live search result'
            ]
          });
        });
        serperResultsContent += "---------------------------\n\n";
      }
    }

    const prompt = `You are a fact-checking system that ONLY responds with valid JSON. Analyze the following content and provide the response in ${i18n.language === 'gu' ? 'Gujarati' :
        i18n.language === 'hi' ? 'Hindi' :
          i18n.language === 'mr' ? 'Marathi' :
            'English'
      } language.

CRITICAL: Use the provided "Live Search Results" to inform your factual assessment and credibility score. Prioritize information from these live results if it directly contradicts or supports claims in the main text.

Your task is to analyze the following text for credibility and misinformation.

CRITICAL: Your response MUST be a single JSON object with EXACTLY this structure:
{
  "isFactual": boolean,
  "credibilityScore": number between 0 and 100,
  "warnings": string[],
  "explanation": string,
  "suggestions": string[],
  "sentiment": {
    "score": number between -1 and 1,
    "label": "negative" | "neutral" | "positive"
  },
  "readability": {
    "score": number between 0 and 100,
    "level": "Easy" | "Medium" | "Hard",
    "suggestions": string[]
  },
  "bias": {
    "score": number between 0 and 100,
    "type": string,
    "explanation": string
  }
}

Text to analyze: "${text}"
${serperResultsContent}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      analysis = JSON.parse(jsonString);

      const timelineAnalysis = analyzeTimeline(text);
      const citationAnalysis = analyzeCitations(text);

      const relevantSources = getRelevantArticleSearches(statistics.topKeywords);

      const combinedSources = [...serperSources, ...relevantSources].map(source => ({
        ...source,
        verificationDetails: source.verificationDetails || (i18n.language === 'gu' ? [
          'આ વિશ્વસનીય સ્રોતમાંથી સંબંધિત લેખો શોધવા માટે ક્લિક કરો',
          'ચકાસાયેલા સમાચાર કવરેજ સાથે સામગ્રીની સરખામણી કરો',
          'ચોકસાઈ માટે તારીખો અને વિગતોની તપાસ કરો',
          'બહુવિધ સ્રોતો સામે દાવાઓની ચકાસણી કરો'
        ] : i18n.language === 'hi' ? [
          'इस विश्वसनीय स्रोत से संबंधित लेखों की खोज के लिए क्लिक करें',
          'सत्यापित समाचार कवरेज के साथ सामग्री की तुलना करें',
          'सटीकता के लिए तिथियों और विवरणों की जांच करें',
          'कई स्रोतों के खिलाफ दावों की पुष्टि करें'
        ] : i18n.language === 'mr' ? [
          'या विश्वासार्ह स्त्रोतामधून संबंधित लेख शोधण्यासाठी क्लिक करा',
          'सत्यापित बातम्यांच्या कव्हरेजशी सामग्रीची तुलना करा',
          'अचूकतेसाठी तारखा आणि तपशील तपासा',
          'अनेक स्त्रोतांविरुद्ध दाव्यांची पडताळणी करा'
        ] : [
          'Click to search for related articles from this trusted source',
          'Compare the content with verified news coverage',
          'Check dates and details for accuracy',
          'Verify claims against multiple sources'
        ])
      }));

      return {
        credibilityScore: Math.min(100, Math.max(0, analysis.credibilityScore)),
        warnings: analysis.warnings,
        suggestions: analysis.suggestions,
        factCheck: {
          isFactual: analysis.isFactual,
          explanation: analysis.explanation,
          sources: combinedSources
        },
        sentiment: analysis.sentiment,
        readability: analysis.readability,
        bias: analysis.bias,
        statistics,
        timeline: timelineAnalysis,
        citations: citationAnalysis
      };
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      throw new Error(i18n.language === 'gu' ?
        `અમાન્ય પ્રતિસાદ ફોર્મેટ: ${parseError.message}` :
        i18n.language === 'hi' ?
          `अमान्य प्रतिक्रिया प्रारूप: ${parseError.message}` :
          i18n.language === 'mr' ?
            `अवैध प्रतिसाद स्वरूप: ${parseError.message}` :
            `Invalid response format: ${parseError.message}`
      );
    }
  } catch (error) {
    console.error('Gemini API Error:', error);

    const apiError = i18n.language === 'gu' ?
      'API ભૂલને કારણે વિશ્લેષણ કરી શકાતું નથી.' :
      i18n.language === 'hi' ?
        'API त्रुटि के कारण विश्लेषण नहीं किया जा सकता.' :
        i18n.language === 'mr' ?
          'API त्रुटीमुळे विश्लेषण करता येत नाही.' :
          'Unable to perform analysis due to an API error.';

    const keyCheck = i18n.language === 'gu' ?
      'કૃપા કરીને ખાતરી કરો કે તમારી API કી માન્ય છે અને પૂરતો કોટા છે.' :
      i18n.language === 'hi' ?
        'कृपया सुनिश्चित करें कि आपकी API कुंजी मान्य है और पर्याप्त कोटा है।' :
        i18n.language === 'mr' ?
          'कृपया खात्री करा की तुमची API की वैध आहे आणि पुरेसा कोटा आहे.' :
          'Please ensure your API key is valid and has sufficient quota.';

    const statistics = await calculateContentStatistics(text);
    const timelineAnalysis = analyzeTimeline(text);
    const citationAnalysis = analyzeCitations(text);

    return {
      credibilityScore: 0,
      warnings: [apiError, keyCheck],
      suggestions: [
        i18n.language === 'gu' ? [
          'તમારી API કી કન્ફિગરેશન તપાસો',
          'થોડી ક્ષણો પછી ફરી પ્રયાસ કરો',
          'જો સમસ્યા ચાલુ રહે, તો તમારી API કી અહીં ચકાસો: https://makersuite.google.com/app/apikey'
        ] : i18n.language === 'hi' ? [
          'अपनी API कुंजी कॉन्फ़िगरेशन की जाँच करें',
          'कुछ क्षणों में पुनः प्रयास करें',
          'यदि समस्या बनी रहती है, तो अपनी API कुंजी यहां सत्यापित करें: https://makersuite.google.com/app/apikey'
        ] : i18n.language === 'mr' ? [
          'तुमची API की कॉन्फिगरेशन तपासा',
          'काही क्षणांनंतर पुन्हा प्रयत्न करा',
          'जर समस्या कायम राहिली, तर तुमची API की येथे सत्यापित करा: https://makersuite.google.com/app/apikey'
        ] : [
          'Check your API key configuration',
          'Try again in a few moments',
          'If the problem persists, verify your API key at https://makersuite.google.com/app/apikey'
        ]
      ].flat(),
      factCheck: {
        isFactual: false,
        explanation: i18n.language === 'gu' ?
          'વિશ્લેષણ ઉપલબ્ધ નથી: ' + (error.message || 'API ભૂલ') :
          i18n.language === 'hi' ?
            'विश्लेषण उपलब्ध नहीं: ' + (error.message || 'API त्रुटि') :
            i18n.language === 'mr' ?
              'विश्लेषण उपलब्ध नाही: ' + (error.message || 'API त्रुटी') :
              'Analysis unavailable: ' + (error.message || 'API Error')
      },
      statistics,
      timeline: timelineAnalysis,
      citations: citationAnalysis
    };
  }
};