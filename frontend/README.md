# Space Biology Knowledge Engine - Frontend

A production-ready, beautiful NASA Space Apps hackathon frontend that connects to a FastAPI backend for space biology research discovery.

## 🚀 Features

- **AI-Powered Search**: Natural language queries to find relevant research
- **Voice Interface**: Record questions and get instant transcriptions
- **Audio Responses**: Listen to AI-generated audio responses
- **Research Discovery**: Browse through categorized research data
- **History & Bookmarks**: Save and revisit previous searches
- **Real-time Status**: Live backend connection monitoring

## 🛠 Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **TanStack Query** for API state management
- **React Router** for navigation
- **Lucide React** for icons

## 🎨 Design

- **NASA-inspired dark theme** with starfield background
- **Glass morphism** panels and components
- **Responsive design** for all screen sizes
- **Smooth animations** and micro-interactions
- **Accessible** color schemes and typography

## 📦 Installation

1. **Clone and navigate to the frontend directory:**
   ```bash
   cd spacebio/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # Create .env file with:
   VITE_API_BASE=http://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5173`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE=http://localhost:8000
```

### Backend Requirements

Ensure your FastAPI backend is running with these endpoints:

- `GET /ping` - Server status
- `GET /stats` - Dashboard statistics
- `GET /search?q=...&top_k=10` - Search results
- `POST /ask-simple` - AI question answering
- `POST /tts` - Text-to-speech
- `POST /stt` - Speech-to-text

## 📱 Pages & Features

### Dashboard (`/`)
- **Hero section** with NASA branding
- **Live statistics** from backend
- **Top organisms, stressors, and platforms**
- **Feature highlights** and capabilities

### Search (`/search`)
- **Natural language search** with AI responses
- **Voice recording** with transcription
- **Audio playback** for responses
- **Source citations** with metadata
- **Search results** with relevance scoring
- **Facet suggestions** for query refinement

### History (`/history`)
- **Saved searches** and answers
- **Audio replay** for previous responses
- **Re-ask functionality**
- **Local storage** persistence

## 🎯 Usage

1. **Start with the Dashboard** to see system status and statistics
2. **Navigate to Search** to ask questions about space biology
3. **Use voice recording** for hands-free interaction
4. **Save interesting answers** to your history
5. **Browse search results** for additional context

## 🔍 API Integration

The frontend integrates with the following backend endpoints:

### Status & Stats
- `GET /ping` - Server health check
- `GET /stats` - Research database statistics

### Search & AI
- `GET /search` - Text-based search with results
- `POST /ask-simple` - AI-powered question answering

### Audio Features
- `POST /tts` - Convert text to speech
- `POST /stt` - Convert speech to text

## 🎨 Styling

The application uses a custom NASA-inspired design system:

- **Colors**: NASA blue (#0B3D91), space navy, cyan accents
- **Typography**: Orbitron for headings, Inter for body text
- **Effects**: Glass morphism, subtle animations, starfield background
- **Components**: Custom button styles, card layouts, responsive grids

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Environment Setup
Make sure to set the correct `VITE_API_BASE` environment variable for your backend URL.

## 🐛 Troubleshooting

### Common Issues

1. **Backend Connection Failed**
   - Check if backend is running on the correct port
   - Verify `VITE_API_BASE` environment variable
   - Check browser console for CORS errors

2. **Audio Recording Not Working**
   - Ensure microphone permissions are granted
   - Check browser compatibility (Chrome/Firefox recommended)
   - Verify HTTPS for production deployments

3. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check TypeScript errors in console
   - Verify all dependencies are installed

## 📄 License

Built for NASA Space Apps Hackathon - Demo purposes only.

## 🤝 Contributing

This is a hackathon project. For production use, consider:
- Adding comprehensive error boundaries
- Implementing proper authentication
- Adding unit and integration tests
- Setting up CI/CD pipelines
- Adding accessibility improvements

---

**Built with ❤️ for NASA Space Apps Hackathon**
