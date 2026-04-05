import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisResult } from './types';
import i18n from '../i18n';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Helper function to get localized sentiment labels
const getLocalizedSentimentLabel = (label: string): string => {
  switch (i18n.language) {
    case 'gu':
      switch (label.toLowerCase()) {
        case 'positive': return 'હકારાત્મક';
        case 'negative': return 'નકારાત્મક';
        case 'neutral': return 'તટસ્થ';
        default: return label;
      }
    case 'hi':
      switch (label.toLowerCase()) {
        case 'positive': return 'सकारात्मक';
        case 'negative': return 'नकारात्मक';
        case 'neutral': return 'तटस्थ';
        default: return label;
      }
    case 'mr':
      switch (label.toLowerCase()) {
        case 'positive': return 'सकारात्मक';
        case 'negative': return 'नकारात्मक';
        case 'neutral': return 'तटस्थ';
        default: return label;
      }
    default:
      return label;
  }
};

// Helper function to get localized readability levels
const getLocalizedReadabilityLevel = (level: string): string => {
  switch (i18n.language) {
    case 'gu':
      switch (level) {
        case 'Easy': return 'સરળ';
        case 'Medium': return 'મધ્યમ';
        case 'Hard': return 'મુશ્કેલ';
        default: return level;
      }
    case 'hi':
      switch (level) {
        case 'Easy': return 'आसान';
        case 'Medium': return 'मध्यम';
        case 'Hard': return 'कठिन';
        default: return level;
      }
    case 'mr':
      switch (level) {
        case 'Easy': return 'सोपे';
        case 'Medium': return 'मध्यम';
        case 'Hard': return 'कठीण';
        default: return level;
      }
    default:
      return level;
  }
};

export const analyzeImage = async (imageData: string): Promise<AnalysisResult> => {
  try {
    // Convert base64 to Uint8Array
    const base64Data = imageData.split(',')[1];
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Prepare the image data
    const imageFile = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    };

    // First, extract text from the image with improved formatting
    const extractionPrompt = `Extract all readable text from this image. Format the text with these rules:
    1. Preserve all paragraphs and line breaks
    2. Maintain proper spacing between sections
    3. Keep any headings or titles on separate lines
    4. Preserve any lists or bullet points
    5. Keep numbers, dates, and special characters intact
    6. Only include the actual text content, no descriptions or explanations
    7. Use proper punctuation and formatting`;

    const extractionResult = await model.generateContent([extractionPrompt, imageFile]);
    let extractedText = extractionResult.response.text();

    // If language is not English, translate the extracted text
    if (i18n.language !== 'en') {
      const translationPrompt = `Translate the following English text to ${i18n.language === 'hi' ? 'Hindi' :
          i18n.language === 'gu' ? 'Gujarati' :
            i18n.language === 'mr' ? 'Marathi' : 'English'
        }. Follow these rules:
      1. Maintain all paragraph breaks and formatting
      2. Keep numbers, dates, and proper nouns as is
      3. Use proper punctuation
      4. Preserve any headings or section breaks
      5. Keep the same text structure and layout
      
Here's the text to translate:

${extractedText}`;

      const translationResult = await model.generateContent(translationPrompt);
      extractedText = translationResult.response.text();
    }

    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    // Now analyze the text in the selected language
    const analysisPrompt = `Analyze this article text in ${i18n.language === 'hi' ? 'Hindi' :
        i18n.language === 'gu' ? 'Gujarati' :
          i18n.language === 'mr' ? 'Marathi' :
            'English'
      } language. ${i18n.language !== 'en' ? `Provide all analysis output in ${i18n.language === 'hi' ? 'Hindi' :
          i18n.language === 'gu' ? 'Gujarati' :
            i18n.language === 'mr' ? 'Marathi' :
              'English'
        }.` : ''
      } Provide a detailed analysis including credibility assessment, fact-checking, and content evaluation.

Your response must be a valid JSON object with this exact structure:
{
  "credibilityScore": number between 0 and 100,
  "isFactual": boolean,
  "explanation": string explaining the factual assessment,
  "warnings": string[] of potential issues,
  "suggestions": string[] of improvements,
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

Text to analyze: "${extractedText}"`;

    const analysisResult = await model.generateContent(analysisPrompt);
    const analysisText = analysisResult.response.text();

    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : analysisText;
      const analysis = JSON.parse(jsonString);

      // Calculate basic statistics
      const words = extractedText.trim().split(/\s+/);
      const sentences = extractedText.split(/[.!?।|॥]+/).filter(Boolean);
      const paragraphs = extractedText.split(/\n\s*\n/).filter(Boolean);

      const statistics = {
        wordCount: words.length,
        averageSentenceLength: Math.round(words.length / sentences.length),
        paragraphCount: paragraphs.length,
        complexWords: words.filter(word => word.length > 6).length,
        readingTimeMinutes: Math.ceil(words.length / 200),
        topKeywords: extractKeywords(extractedText),
        emotionalTone: {
          positive: countEmotionalWords(extractedText, 'positive'),
          negative: countEmotionalWords(extractedText, 'negative'),
          urgent: countEmotionalWords(extractedText, 'urgent')
        },
        uniqueWords: new Set(words.map(w => w.toLowerCase())).size,
        averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length
      };

      // Localize sentiment label and readability level
      const sentiment = {
        ...analysis.sentiment,
        label: getLocalizedSentimentLabel(analysis.sentiment.label)
      };

      const readability = {
        ...analysis.readability,
        level: getLocalizedReadabilityLevel(analysis.readability.level)
      };

      return {
        credibilityScore: analysis.credibilityScore,
        warnings: analysis.warnings,
        suggestions: analysis.suggestions,
        factCheck: {
          isFactual: analysis.isFactual,
          explanation: analysis.explanation
        },
        sentiment,
        readability,
        bias: analysis.bias,
        statistics,
        extractedText
      };
    } catch (parseError) {
      console.error('Failed to parse analysis:', parseError);
      throw new Error('Failed to parse analysis results');
    }
  } catch (error) {
    console.error('Image analysis failed:', error);
    throw error;
  }
};

// Helper function to extract keywords - Updated for multilingual support
function extractKeywords(text: string): string[] {
  const language = i18n.language;

  // Stop words for different languages
  const stopWords = {
    en: new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
      'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
      'will', 'with'
    ]),
    hi: new Set([
      'का', 'की', 'के', 'एक', 'में', 'है', 'हैं', 'को', 'पर', 'इस', 'से', 'और',
      'या', 'हो', 'था', 'थी', 'थे', 'कि', 'जो', 'कर', 'यह', 'वह', 'ने', 'बहुत',
      'सभी', 'कुछ', 'अब', 'जब', 'तक', 'तब', 'या', 'एवं', 'यदि', 'भी'
    ]),
    gu: new Set([
      'છે', 'અને', 'તે', 'એક', 'માં', 'ના', 'ની', 'નું', 'થી', 'પર', 'જે', 'કે',
      'હતું', 'હતી', 'હતા', 'છું', 'છો', 'આ', 'તો', 'પણ', 'જો', 'શું', 'હવે',
      'કોઈ', 'કયું', 'રહ્યો', 'રહી', 'સાથે', 'હોય', 'કરી'
    ]),
    mr: new Set([
      'आहे', 'आणि', 'ते', 'एक', 'मध्ये', 'चा', 'ची', 'चे', 'ने', 'वर', 'जो', 'की',
      'होता', 'होती', 'होते', 'आहे', 'आहेस', 'हा', 'तर', 'पण', 'जर', 'काय', 'आता',
      'कोणी', 'केला', 'राहतो', 'राहते', 'सोबत', 'असेल', 'केले'
    ])
  };

  const currentStopWords = stopWords[language] || stopWords.en;

  // Split text into words - handle all scripts
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

// Helper function to count emotional words - Updated for multilingual support
function countEmotionalWords(text: string, type: 'positive' | 'negative' | 'urgent'): number {
  const language = i18n.language;

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
      mr: ['वाईट', 'भयंकर', 'वाईट', 'खराब', 'नकारात्मक', 'अपयश', 'संकट', 'समस्या']
    },
    urgent: {
      en: ['breaking', 'urgent', 'emergency', 'crisis', 'immediately', 'critical', 'vital', 'crucial'],
      hi: ['तत्काल', 'जरूरी', 'आपातकालीन', 'संकट', 'तुरंत', 'महत्वपूर्ण', 'आवश्यक', 'गंभीर'],
      gu: ['તાત્કાલિક', 'તાકીદનું', 'કટોકટી', 'સંકટ', 'તરત', 'મહત્વપૂર્ણ', 'આવશ્યક', 'ગંભીર'],
      mr: ['ताबडतोब', 'तातडीचे', 'आणीबाणी', 'संकट', 'त्वरित', 'महत्त्वाचे', 'आवश्यक', 'गंभीर']
    }
  };

  const words = text.toLowerCase().split(/[\s,।|॥]+/);
  return words.filter(word => emotionalWords[type][language].includes(word)).length;
}