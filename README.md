# Verifai - AI-Powered Content Verification Platform 🔍

<div align="center">
  <img src="/public/Thumbnail 1.png" alt="Verifai Thumbnail" width="400" />
  <p align="center">
    <strong>Combat misinformation with advanced AI-powered content verification</strong>
  </p>
</div>

## 🌟 Features

### Core Functionality
- 🤖 **Advanced AI Analysis**
  - Real-time content credibility assessment
  - Multi-language support (English, Hindi, Gujarati, Marathi)
  - Sentiment and bias detection
  - Readability scoring

- 🔍 **Comprehensive Verification**
  - Cross-reference with trusted news sources
  - Citation analysis and validation
  - Timeline consistency checking
  - Source credibility scoring

- 📊 **Detailed Analytics**
  - Content statistics and metrics
  - Emotional tone analysis
  - Keyword extraction
  - Reading time estimation

### User Experience
- 🎨 **Modern Interface**
  - Clean, intuitive design
  - Responsive layout for all devices
  - Dark/light mode support
  - Smooth animations

- 🗣️ **Accessibility**
  - Voice input support
  - Text-to-speech capabilities
  - Multi-language interface
  - Screen reader compatibility

### Content Analysis Tools
- 📰 **Article Analysis**
  - Image-based text extraction
  - Article credibility scoring
  - Source verification
  - Fact-checking

- 📱 **Social Media Integration**
  - Community feed
  - Post analysis
  - Collaborative verification
  - Share analysis results

- 📈 **News Monitoring**
  - Real-time news analysis
  - Source credibility tracking
  - Save and bookmark articles
  - Trending topics analysis

## 📱 UI/UX Design

### Dashboard
![Dashboard Design](/public/dashboard.png)
*Intuitive dashboard for content analysis*

### Article Analysis
![Article Analysis Design](/public/article-analysis.png)
*Comprehensive article analysis interface*

### News Feed
![News Feed Design](/public/news-page.png)
*Real-time news monitoring and analysis*

### Community
![Community Design](/public/community-feed.png)
*Social features for collaborative verification*

## Architecture Diagram

![Architecture Diagram](public/Verifai%20Flowchart.png)

## 🛠️ Tech Stack

### Frontend
- ⚛️ React 18.3.1
- 📘 TypeScript
- ⚡ Vite
- 🎨 Tailwind CSS
- 🎪 Radix UI Components
- 🎬 Framer Motion

### AI & ML
- 🧠 Google Gemini AI
- 🔍 OCR Capabilities

### Authentication & Database
- 🔥 Firebase Authentication
- 🗄️ Firestore Database
- 🔐 Secure Data Storage

### State Management & Utilities
- 🌐 i18next
- 📝 React Markdown
- 📊 Various Data Processing Libraries

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm 9+
- Google Gemini API key
- Serper API key (for live search)
- Firebase project

### Installation

1. **Clone the Repository**
```bash
git clone https://github.com/panduthegang/Verifai-News_Detection-System.git
cd Verifai-News_Detection-System
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_SERPER_API_KEY=your_serper_api_key
```

### Firebase Setup

#### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Follow the setup wizard
4. Enable Google Analytics (optional)

#### 2. Enable Authentication
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider
3. Enable **Google** provider (optional)
4. Configure authorized domains if needed

#### 3. Create Firestore Database
1. Go to **Firestore Database** in Firebase Console
2. Click "Create database"
3. Choose **Start in production mode**
4. Select your preferred location

#### 4. Configure Firestore Security Rules
Replace the default rules with the content from `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/savedArticles/{articleId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    match /users/{userId}/history/{analysisId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        (resource.data.authorId == request.auth.uid) ||
        (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likes', 'dislikes']))
      );
      allow delete: if request.auth != null && resource.data.authorId == request.auth.uid;
      
      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow delete: if request.auth != null && (
          resource.data.authorId == request.auth.uid || 
          get(/databases/$(database)/documents/posts/$(postId)).data.authorId == request.auth.uid
        );
      }
    }
    
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.authorId == request.auth.uid;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

#### 5. Set Up Firestore Indexes
Create the following composite indexes in Firestore Console or use the `firestore.indexes.json` file:

**Required Indexes:**
1. **Collection Group: `savedArticles`**
   - Fields: `userId` (Ascending), `savedAt` (Descending)

2. **Collection Group: `history`**
   - Fields: `userId` (Ascending), `timestamp` (Descending)

3. **Collection Group: `posts`**
   - Fields: `authorId` (Ascending), `createdAt` (Descending)
   - Fields: `tags` (Array-contains), `createdAt` (Descending)

4. **Collection Group: `comments`**
   - Fields: `postId` (Ascending), `createdAt` (Descending)

**To create indexes automatically:**
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Deploy indexes: `firebase deploy --only firestore:indexes`

#### 6. Configure Firebase Hosting (Optional)
1. In Firebase Console, go to **Hosting**
2. Click "Get started"
3. Install Firebase CLI if not already installed
4. Run `firebase init hosting` in your project directory
5. Configure build settings:
   - Public directory: `dist`
   - Single-page app: `Yes`
   - Automatic builds: Configure as needed

### API Keys Setup

#### Google Gemini AI
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `VITE_GEMINI_API_KEY`

#### Serper API (for live search)
1. Visit [Serper.dev](https://serper.dev/)
2. Sign up and get your API key
3. Add it to your `.env` file as `VITE_SERPER_API_KEY`

4. **Start Development Server**
```bash
npm run dev
```

5. **Build for Production**
```bash
npm run build
```

6. **Deploy to Firebase Hosting**
```bash
firebase deploy
```

## 📁 Project Structure

```
Verifai-News_Detection-System/
├── public/                     # Static assets and public files
│   ├── locales/                # Translation files for i18n
│   │   ├── en/                 # English translations
│   │   ├── hi/                 # Hindi translations
│   │   ├── gu/                 # Gujarati translations
│   │   └── mr/                 # Marathi translations
│   └── ...                     # Other public assets (images, etc.)
│
├── src/                        # Source code
│   ├── components/             # Reusable UI components
│   │   └── ui/                 # Base UI components
│   ├── pages/                  # Page components (routes)
│   ├── lib/                    # Firebase and third-party library configurations
│   ├── i18n/                   # Internationalization setup
│   └── utils/                  # Helper functions and utilities
│
├── .firebaserc                 # Firebase project configuration
├── firebase.json              # Firebase deployment configuration
├── firestore.indexes.json      # Firestore database indexes
├── firestore.rules            # Firestore security rules
├── package.json               # Project dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── ...                        # Other configuration files
```

### Key Directories Explained

- **`public/`**: Contains static assets and translation files for internationalization
  - `locales/`: JSON files for different language translations
  - Other static assets like images and icons

- **`src/`**: Main source code of the application
  - `components/`: Reusable UI components
  - `pages/`: Page components that represent different routes in the application
  - `lib/`: Configuration for Firebase and other third-party libraries
  - `i18n/`: Internationalization setup and configuration
  - `utils/`: Helper functions and utilities used throughout the app

- **Configuration Files**:
  - `.firebaserc`: Firebase project configuration
  - `firebase.json`: Firebase deployment settings
  - `firestore.*`: Firestore database configurations
  - `tsconfig.json`: TypeScript compiler options

## 🔧 Configuration Files

### Firestore Rules (`firestore.rules`)
Defines security rules for database access, ensuring users can only access their own data and appropriate public content.

### Firestore Indexes (`firestore.indexes.json`)
Configures composite indexes for efficient querying of user history, saved articles, and community posts.

### Firebase Config (`firebase.json`)
Sets up hosting configuration with proper routing for single-page application.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 👥 Team

### Meet Our Team
The passionate minds behind Verifai:

**Harsh Rathod** - *Team Lead and Developer*
- Leads the Verifai project with expertise in full-stack development
- Architects frontend and backend systems for seamless integration
- Contact: panduthegang@gmail.com
- GitHub: [panduthegang](https://github.com/panduthegang)
- LinkedIn: [Harsh Rathod](https://www.linkedin.com/in/harsh-rathod-2591b0292/)

**Durvesh Shelar** - *UI/UX Designer*
- Crafts intuitive and engaging interfaces
- Combines visual aesthetics with user-centered design
- Enhances overall product experience through thoughtful design
- Contact: durveshshelar@gmail.com
- GitHub: [DURVXSH](https://github.com/DURVXSH)
- LinkedIn: [Durvesh Shelar](https://www.linkedin.com/in/durvesh-shelar-334b02291/)

## 🙏 Acknowledgments

- Google Gemini AI for powering content analysis
- The React and Vite communities
- Open source libraries and tools used in this project

## 📬 Contact

- Website: [verifai.vercel.app](https://verifai-by-house-stark.vercel.app/)
- Demo: [Demo.Video](https://youtu.be/2XG4Oeyt6A8)
- Email: panduthegang@gmail.com

---

<div align="center">
  <p>Built with ❤️ by House Stark</p>
</div>
