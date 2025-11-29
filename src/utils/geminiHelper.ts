import { GoogleGenerativeAI } from '@google/generative-ai';
import i18n from '../i18n';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const improveText = async (text: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `You are a helpful writing assistant. Please improve the following text by:
1. Fixing any grammar or spelling errors
2. Improving clarity and readability
3. Making the tone more professional and engaging
4. Maintaining the original meaning and intent
5. Keeping the length similar to the original

${i18n.language !== 'en' ? `Provide the response in ${
  i18n.language === 'hi' ? 'Hindi' :
  i18n.language === 'gu' ? 'Gujarati' :
  i18n.language === 'mr' ? 'Marathi' :
  'English'
} language.` : ''}

Original text:
"${text}"

Provide ONLY the improved text without any explanations or additional comments.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Text improvement failed:', error);
    throw new Error('Failed to improve text.');
  }
};

export const suggestReply = async (originalPost: string, previousComments: string[] = []): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `You are a helpful AI assistant. Please suggest a thoughtful and engaging reply to the following social media post. The reply should be:
1. Relevant to the original post
2. Constructive and positive in tone
3. Encouraging further discussion
4. Natural and conversational
5. Appropriate for social media

${i18n.language !== 'en' ? `Provide the response in ${
  i18n.language === 'hi' ? 'Hindi' :
  i18n.language === 'gu' ? 'Gujarati' :
  i18n.language === 'mr' ? 'Marathi' :
  'English'
} language.` : ''}

Original post:
"${originalPost}"

${previousComments.length > 0 ? `
Previous comments:
${previousComments.map(comment => `- "${comment}"`).join('\n')}
` : ''}

Provide ONLY the suggested reply without any explanations or additional comments.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Reply suggestion failed:', error);
    throw new Error('Failed to suggest reply.');
  }
};

export const moderateContent = async (text: string): Promise<{
  isAppropriate: boolean;
  reason?: string;
  suggestedRevision?: string;
}> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `You are a content moderator. Please analyze the following text for appropriateness and provide a JSON response with these fields:
- isAppropriate: boolean indicating if the content is suitable for a professional social platform
- reason: string explaining why the content is inappropriate (if applicable)
- suggestedRevision: string with a revised version that maintains the core message while removing inappropriate content (if applicable)

${i18n.language !== 'en' ? `Provide the response in ${
  i18n.language === 'hi' ? 'Hindi' :
  i18n.language === 'gu' ? 'Gujarati' :
  i18n.language === 'mr' ? 'Marathi' :
  'English'
} language.` : ''}

Text to analyze:
"${text}"

Response format:
{
  "isAppropriate": boolean,
  "reason": string (optional),
  "suggestedRevision": string (optional)
}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Clean markdown code blocks and backticks
    responseText = responseText
      .replace(/```json\n|```/g, '')
      .replace(/`/g, '')
      .trim();

    // Validate JSON
    if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
      throw new Error('Response is not valid JSON');
    }

    const parsedResponse = JSON.parse(responseText);

    // Validate response structure
    if (!parsedResponse.hasOwnProperty('isAppropriate')) {
      throw new Error('Invalid response structure');
    }

    return {
      isAppropriate: parsedResponse.isAppropriate,
      reason: parsedResponse.reason || '',
      suggestedRevision: parsedResponse.suggestedRevision || '',
    };
  } catch (error) {
    console.error('Content moderation failed:', error);
    throw new Error('Content moderation failed. Please try again.');
  }
};
