import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisResult } from './types';
import i18n from '../i18n';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Helper function to extract frames from video
const extractVideoFrames = async (videoFile: File, frameCount: number = 5): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const duration = video.duration;
      const interval = duration / frameCount;
      let currentFrame = 0;

      const extractFrame = () => {
        if (currentFrame >= frameCount) {
          resolve(frames);
          return;
        }

        video.currentTime = currentFrame * interval;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.8));
        currentFrame++;
        extractFrame();
      };

      extractFrame();
    };

    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = URL.createObjectURL(videoFile);
  });
};

// Analyze video for deepfakes and content verification
export const analyzeVideo = async (videoFile: File): Promise<AnalysisResult & {
  deepfakeAnalysis: {
    isDeepfake: boolean;
    confidence: number;
    indicators: string[];
    technicalAnalysis: string[];
  };
  videoMetadata: {
    duration: number;
    resolution: string;
    frameRate: number;
    fileSize: number;
  };
}> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    const message = i18n.language === 'gu' ?
      'API કી કન્ફિગર કરેલી નથી. કૃપા કરીને તમારી Gemini API કી .env ફાઈલમાં ઉમેરો.' :
      i18n.language === 'hi' ?
        'API कुंजी कॉन्फ़िगर नहीं की गई है। कृपया अपनी Gemini API कुंजी .env फ़ाइल में जोड़ें।' :
        i18n.language === 'mr' ?
          'API की कॉन्फिगर केलेली नाही. कृपया तुमची Gemini API की .env फाइलमध्ये जोडा.' :
          'API key not configured. Please add your Gemini API key to the .env file.';

    throw new Error(message);
  }

  try {
    // Extract video metadata
    const videoElement = document.createElement('video');
    const videoMetadata = await new Promise<{
      duration: number;
      resolution: string;
      frameRate: number;
      fileSize: number;
    }>((resolve, reject) => {
      videoElement.onloadedmetadata = () => {
        resolve({
          duration: videoElement.duration,
          resolution: `${videoElement.videoWidth}x${videoElement.videoHeight}`,
          frameRate: 30, // Default, as actual frame rate is hard to detect
          fileSize: videoFile.size
        });
      };
      videoElement.onerror = () => reject(new Error('Failed to load video metadata'));
      videoElement.src = URL.createObjectURL(videoFile);
    });

    // Extract frames for analysis
    const frames = await extractVideoFrames(videoFile, 8);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare frames for Gemini analysis
    const imageFiles = frames.map(frame => ({
      inlineData: {
        data: frame.split(',')[1],
        mimeType: 'image/jpeg'
      }
    }));

    // Analyze for deepfakes and content
    const deepfakePrompt = `Analyze these video frames for potential deepfake indicators and content authenticity. ${i18n.language !== 'en' ? `Provide all responses in ${i18n.language === 'hi' ? 'Hindi' :
          i18n.language === 'gu' ? 'Gujarati' :
            i18n.language === 'mr' ? 'Marathi' :
              'English'
        }.` : ''
      }

Your response must be a valid JSON object with this exact structure:
{
  "isDeepfake": boolean,
  "confidence": number between 0 and 100,
  "indicators": string[] of deepfake indicators found,
  "technicalAnalysis": string[] of technical observations,
  "credibilityScore": number between 0 and 100,
  "isFactual": boolean,
  "explanation": string explaining the assessment,
  "warnings": string[] of potential issues,
  "suggestions": string[] of recommendations,
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
  },
  "extractedText": string of any text visible in the video frames
}

Look for these deepfake indicators:
- Facial inconsistencies or unnatural movements
- Lighting and shadow anomalies
- Temporal inconsistencies between frames
- Artifacts around facial features
- Unnatural eye movements or blinking patterns
- Audio-visual synchronization issues (if applicable)
- Digital artifacts or compression anomalies`;

    const result = await model.generateContent([deepfakePrompt, ...imageFiles]);
    const responseText = result.response.text().trim();

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      const analysis = JSON.parse(jsonString);

      // Calculate basic statistics from extracted text
      const extractedText = analysis.extractedText || '';
      const words = extractedText.trim().split(/\s+/).filter(word => word.length > 0);
      const sentences = extractedText.split(/[.!?।|॥]+/).filter(Boolean);
      const paragraphs = extractedText.split(/\n\s*\n/).filter(Boolean);

      const statistics = {
        wordCount: words.length,
        averageSentenceLength: words.length > 0 ? Math.round(words.length / Math.max(sentences.length, 1)) : 0,
        paragraphCount: paragraphs.length,
        complexWords: words.filter(word => word.length > 6).length,
        readingTimeMinutes: Math.ceil(words.length / 200),
        topKeywords: extractKeywords(extractedText),
        emotionalTone: {
          positive: 0,
          negative: 0,
          urgent: 0
        },
        uniqueWords: new Set(words.map(w => w.toLowerCase())).size,
        averageWordLength: words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0
      };

      return {
        credibilityScore: Math.min(100, Math.max(0, analysis.credibilityScore)),
        warnings: analysis.warnings || [],
        suggestions: analysis.suggestions || [],
        factCheck: {
          isFactual: analysis.isFactual,
          explanation: analysis.explanation
        },
        sentiment: analysis.sentiment,
        readability: analysis.readability,
        bias: analysis.bias,
        statistics,
        extractedText: analysis.extractedText,
        deepfakeAnalysis: {
          isDeepfake: analysis.isDeepfake,
          confidence: analysis.confidence,
          indicators: analysis.indicators || [],
          technicalAnalysis: analysis.technicalAnalysis || []
        },
        videoMetadata
      };
    } catch (parseError) {
      console.error('Failed to parse video analysis:', parseError);
      throw new Error('Failed to parse analysis results');
    }
  } catch (error) {
    console.error('Video analysis failed:', error);
    throw error;
  }
};

// Helper function to extract keywords
function extractKeywords(text: string): string[] {
  if (!text) return [];

  const language = i18n.language;

  const stopWords = {
    en: new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
      'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
      'will', 'with'
    ]),
    hi: new Set([
      'का', 'की', 'के', 'एक', 'में', 'है', 'हैं', 'को', 'पर', 'इस', 'से', 'और',
      'या', 'हो', 'था', 'थी', 'थे', 'कि', 'जो', 'कर', 'यह', 'वह', 'ने', 'बहुत'
    ]),
    gu: new Set([
      'છે', 'અને', 'તે', 'એક', 'માં', 'ના', 'ની', 'નું', 'થી', 'પર', 'જે', 'કે',
      'હતું', 'હતી', 'હતા', 'છું', 'છો', 'આ', 'તો', 'પણ', 'જો', 'શું', 'હવે'
    ]),
    mr: new Set([
      'आहे', 'आणि', 'ते', 'एक', 'मध्ये', 'चा', 'ची', 'चे', 'ने', 'वर', 'जो', 'की',
      'होता', 'होती', 'होते', 'आहे', 'आहेस', 'हा', 'तर', 'पण', 'जर', 'काय', 'आता'
    ])
  };

  const currentStopWords = stopWords[language] || stopWords.en;

  const words = text.split(/[\s,।|॥]+/);
  const wordFreq: Record<string, number> = {};

  words.forEach(word => {
    const cleanWord = word.toLowerCase().trim();
    if (cleanWord.length > 1 && !currentStopWords.has(cleanWord)) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
  });

  return Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}