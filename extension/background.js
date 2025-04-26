// State management
const state = {
  mediaStream: null,
  speechRecognition: null,
  isListening: false,
  currentTabId: null,
  audioContext: null
};

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  resetState();
});

function resetState() {
  stopCapture();
  state.mediaStream = null;
  state.speechRecognition = null;
  state.isListening = false;
  state.currentTabId = null;
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type, 'from:', sender.tab ? 'tab' : 'popup');
  
  // Handle messages that don't need tab ID first
  if (request.type === 'CHECK_STATUS') {
    sendResponse({ isCapturing: state.isListening });
    return true;
  }

  // For tab-specific operations, get the tab ID
  const tabId = sender.tab?.id;
  
  // If we don't have a tab ID and need one, try to get the current active tab
  if (!tabId && (request.type === 'START_CAPTURE' || request.type === 'STOP_CAPTURE')) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs[0]) {
        console.error('No active tab found');
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      try {
        switch (request.type) {
          case 'START_CAPTURE':
            await handleStartCapture(tabs[0].id);
            sendResponse({ success: true });
            break;
          case 'STOP_CAPTURE':
            handleStopCapture(tabs[0].id);
            sendResponse({ success: true });
            break;
        }
      } catch (error) {
        console.error('Error handling capture:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep the message channel open for async response
  }

  // For messages from tabs, process normally
  if (tabId) {
    try {
      switch (request.type) {
        case 'START_CAPTURE':
          handleStartCapture(tabId);
          sendResponse({ success: true });
          break;
        case 'STOP_CAPTURE':
          handleStopCapture(tabId);
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true;
});

// Handle tab closing
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === state.currentTabId) {
    resetState();
  }
});

async function handleStartCapture(tabId) {
  try {
    state.currentTabId = tabId;
    
    // First get desktop audio using chrome.tabCapture
    const tabStream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({
        audio: true,
        video: false
      }, (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!stream) {
          reject(new Error('Failed to capture tab audio'));
        } else {
          resolve(stream);
        }
      });
    });

    console.log('Tab audio stream obtained');

    // Initialize audio context
    state.audioContext = new AudioContext();
    
    // Create audio source from tab audio
    const tabSource = state.audioContext.createMediaStreamSource(tabStream);
    
    // Create audio processing node to boost volume
    const gainNode = state.audioContext.createGain();
    gainNode.gain.value = 2.0; // Boost volume
    
    // Create destination for processed audio
    const destination = state.audioContext.createMediaStreamDestination();
    
    // Connect the audio nodes
    tabSource.connect(gainNode);
    gainNode.connect(destination);
    
    // Store the processed stream
    state.mediaStream = destination.stream;
    
    // Initialize speech recognition with the processed stream
    await initializeSpeechRecognition(tabId);
    
    notifyContentScript(tabId, {
      type: 'CAPTURE_STATUS',
      status: 'started',
      message: 'Capture started successfully'
    });

  } catch (error) {
    console.error('Error starting capture:', error);
    notifyContentScript(tabId, {
      type: 'CAPTURE_ERROR',
      error: error.message
    });
    resetState();
  }
}

function handleStopCapture(tabId) {
  stopCapture();
  notifyContentScript(tabId, {
    type: 'CAPTURE_STATUS',
    status: 'stopped',
    message: 'Capture stopped'
  });
}

function stopCapture() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
  }
  
  if (state.speechRecognition) {
    state.speechRecognition.stop();
    state.speechRecognition = null;
  }

  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  
  state.isListening = false;
}

async function initializeSpeechRecognition(tabId) {
  try {
    if (!state.speechRecognition) {
      state.speechRecognition = new webkitSpeechRecognition();
      state.speechRecognition.continuous = true;
      state.speechRecognition.interimResults = true;
      state.speechRecognition.lang = 'en-US';

      // Configure speech recognition handlers
      state.speechRecognition.onstart = () => {
        console.log('Speech recognition started');
        state.isListening = true;
        notifyContentScript(tabId, {
          type: 'SPEECH_STATUS',
          status: 'active'
        });
      };

      state.speechRecognition.onresult = async (event) => {
        handleSpeechResult(event, tabId);
      };

      state.speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        notifyContentScript(tabId, {
          type: 'SPEECH_ERROR',
          error: event.error
        });

        // Restart speech recognition on error (except for no-speech)
        if (event.error !== 'no-speech' && state.isListening) {
          console.log('Restarting speech recognition after error...');
          setTimeout(() => {
            if (state.isListening) {
              state.speechRecognition.start();
            }
          }, 1000);
        }
      };

      state.speechRecognition.onend = () => {
        console.log('Speech recognition ended');
        if (state.isListening) {
          console.log('Restarting speech recognition...');
          state.speechRecognition.start();
        }
      };

      // Start recognition with the media stream
      state.speechRecognition.start();
    }
  } catch (error) {
    console.error('Error initializing speech recognition:', error);
    notifyContentScript(tabId, {
      type: 'SPEECH_ERROR',
      error: error.message
    });
  }
}

async function handleSpeechResult(event, tabId) {
  try {
    const results = Array.from(event.results);
    for (let result of results) {
      const transcript = result[0].transcript.trim();
      console.log('Transcript:', transcript, 'Final:', result.isFinal);
      
      // Send transcript to content script
      notifyContentScript(tabId, {
        type: 'TRANSCRIPT',
        text: transcript,
        isFinal: result.isFinal
      });

      // If final result and it's a question, generate answer
      if (result.isFinal && isQuestion(transcript)) {
        const answer = await generateAnswer(transcript);
        notifyContentScript(tabId, {
          type: 'SHOW_QA',
          data: {
            question: transcript,
            answer: answer
          }
        });
      }
    }
  } catch (error) {
    console.error('Error handling speech result:', error);
  }
}

function isQuestion(text) {
  const questionPatterns = [
    /\?$/,
    /^(what|who|where|when|why|how|can|could|would|will|should|do|does|did|is|are|was|were)/i,
    /tell me about/i,
    /explain|describe|elaborate/i,
    /difference between/i
  ];
  return questionPatterns.some(pattern => pattern.test(text.trim()));
}

async function generateAnswer(question) {
  try {
    const response = await fetch('https://api.cheatly.io/generate-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        context: 'interview'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate answer');
    }

    const data = await response.json();
    return data.answer;
  } catch (error) {
    console.error('Error generating answer:', error);
    return "I apologize, but I couldn't generate an answer at this moment. Please try again.";
  }
}

function notifyContentScript(tabId, message) {
  if (!tabId) return;
  
  chrome.tabs.sendMessage(tabId, message).catch(error => {
    console.error('Error sending message to content script:', error);
  });
} 