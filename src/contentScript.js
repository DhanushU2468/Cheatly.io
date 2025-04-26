// Initialize speech recognition
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

let isCapturing = false;
let currentTranscript = '';

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSCRIPTION') {
    processTranscription(message.text);
  }
});

// Process transcribed text and detect questions
async function processTranscription(text) {
  currentTranscript += ' ' + text;
  
  // Detect if the text contains a question
  if (isQuestion(text)) {
    const response = await generateResponse(text);
    displayResponse(response);
  }
}

// Simple question detection
function isQuestion(text) {
  const questionPatterns = [
    /\?$/,
    /^(what|who|where|when|why|how|can|could|would|will|should)/i,
    /tell me about/i
  ];
  
  return questionPatterns.some(pattern => pattern.test(text));
}

// Generate response using OpenAI API
async function generateResponse(question) {
  try {
    const response = await fetch('YOUR_API_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful interview assistant. Provide concise and professional responses."
          },
          {
            role: "user",
            content: question
          }
        ]
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating response:', error);
    return 'Sorry, I could not generate a response at this time.';
  }
}

// Create and display the response UI
function displayResponse(response) {
  let assistantContainer = document.getElementById('ai-assistant-container');
  
  if (!assistantContainer) {
    assistantContainer = document.createElement('div');
    assistantContainer.id = 'ai-assistant-container';
    assistantContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: 400px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 9999;
      overflow-y: auto;
      padding: 16px;
    `;
    document.body.appendChild(assistantContainer);
  }

  const responseElement = document.createElement('div');
  responseElement.style.cssText = `
    margin-bottom: 12px;
    padding: 8px;
    background-color: #f0f9ff;
    border-radius: 4px;
  `;
  responseElement.textContent = response;

  assistantContainer.appendChild(responseElement);
} 