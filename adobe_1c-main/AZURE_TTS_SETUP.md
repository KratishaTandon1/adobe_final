# Azure Text-to-Speech Setup Instructions

## 🚀 Quick Setup

### 1. Create Azure Speech Service
1. Go to [Azure Portal](https://portal.azure.com/)
2. Create a new **Speech Service** resource
3. Choose your subscription and resource group
4. Select a region (e.g., `eastus`, `westus2`)
5. Choose pricing tier (F0 for free tier)

### 2. Get Your Credentials
1. In your Speech Service resource, go to **Keys and Endpoint**
2. Copy **Key 1** (your API key)
3. Note the **Region** (e.g., `eastus`)

### 3. Configure Environment Variables
Update your `.env` file in the backend folder:

```env
# Azure Text-to-Speech Configuration
AZURE_SPEECH_KEY=your_actual_azure_speech_key_here
AZURE_SPEECH_REGION=eastus  # Replace with your region
```

### 4. Supported Voices
The application includes these voice options:
- **Jenny** (US English - Female) - Default
- **Guy** (US English - Male) 
- **Aria** (US English - Female)
- **Davis** (US English - Male)
- **Sonia** (British English - Female)
- **Ryan** (British English - Male)

### 5. Features
- ✅ **Speech Generation**: Convert AI summaries to speech
- ✅ **Voice Selection**: Choose from multiple neural voices
- ✅ **Speed Control**: Slow, Medium, Fast playback speeds
- ✅ **Play/Stop Controls**: Start and stop audio playback
- ✅ **Auto-Integration**: Works with both document and text summaries

### 6. Pricing (Approximate)
- **Free Tier**: 5M characters/month for neural voices
- **Standard**: ~$16 per 1M characters for neural voices
- **Pay-as-you-go**: Only pay for what you use

### 7. Fallback Behavior
- If Azure SDK is not installed, uses REST API
- If no API key configured, shows helpful error message
- Graceful degradation - PDF viewer works without TTS

## 🎯 Usage in App
1. **Select text** or **generate AI summary**
2. Click the **🔊 Listen** button
3. Adjust **voice** and **speed** in settings panel
4. Use **⏹️ Stop** to halt playback

## 🔧 Troubleshooting
- Ensure Azure key is valid and not expired
- Check region matches your Azure resource
- Verify internet connectivity
- Test with shorter text if having issues

---
🎉 **Ready to use!** Your PDF viewer now has AI-powered text-to-speech capabilities!
