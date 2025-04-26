import React, { useState, useEffect } from 'react';
import './App.css';

const DEBUG = true;
const logger = {
  log: function(...args) {
    if (DEBUG && window.console && typeof console.log === 'function') {
      console.log('[App]', ...args);
    }
  },
  error: function(...args) {
    if (DEBUG && window.console && typeof console.error === 'function') {
      console.error('[App Error]', ...args);
    }
  }
};

function App() {
  const [isActive, setIsActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [suggestedAnswer, setSuggestedAnswer] = useState('');
  const [error, setError] = useState('');

  const toggleCapture = () => {
    if (!isActive) {
      // Start capturing
      try {
        chrome.runtime.sendMessage({ type: 'START_CAPTURE' }, (response) => {
          if (chrome.runtime.lastError) {
            logger.error('Start capture error:', chrome.runtime.lastError);
            setError(chrome.runtime.lastError.message);
            return;
          }
          
          if (response?.success) {
            setIsActive(true);
            setError('');
          } else {
            setError(response?.error || 'Failed to start capture');
          }
        });
      } catch (error) {
        logger.error('Failed to send start message:', error);
        setError('Failed to start capture');
      }
    } else {
      // Stop capturing
      try {
        chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }, (response) => {
          if (chrome.runtime.lastError) {
            logger.error('Stop capture error:', chrome.runtime.lastError);
            setError(chrome.runtime.lastError.message);
            return;
          }
          
          if (response?.success) {
            setIsActive(false);
            setError('');
          } else {
            setError(response?.error || 'Failed to stop capture');
          }
        });
      } catch (error) {
        logger.error('Failed to send stop message:', error);
        setError('Failed to stop capture');
      }
    }
  };

  // Listen for messages from content script
  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      try {
        if (!message || !message.type) {
          logger.error('Invalid message received:', message);
          return;
        }

        const tabId = sender.tab?.id;

        switch (message.type) {
          case 'QUESTION_DETECTED':
            if (message.question) {
              setCurrentQuestion(message.question);
              setSuggestedAnswer(message.answer || '');
            }
            break;
          case 'CAPTURE_ERROR':
            setError(message.error || 'An error occurred during capture');
            setIsActive(false);
            break;
          case 'CAPTURE_STATUS':
            setIsActive(message.isActive || false);
            if (!message.isActive) {
              setCurrentQuestion('');
              setSuggestedAnswer('');
            }
            break;
        }

        if (!tabId && (message.type === 'START_CAPTURE' || message.type === 'STOP_CAPTURE')) {
          chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            // ... handle the message using the active tab ID
          });
        }

        console.log('Background received message:', message.type, 'from:', sender.tab ? 'tab' : 'popup');

        // Send response to prevent port closure warning
        sendResponse({ success: true });
      } catch (error) {
        logger.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  return (
    <div className="w-96 bg-gray-900 text-white p-4 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">AI Interview Assistant</h1>
        <button
          onClick={toggleCapture}
          className={`px-4 py-2 rounded-full ${
            isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          } transition-colors`}
        >
          {isActive ? 'Stop' : 'Start'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {currentQuestion && (
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">Current Question:</h2>
            <p className="text-white">{currentQuestion}</p>
          </div>
        )}

        {suggestedAnswer && (
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">Suggested Answer:</h2>
            <p className="text-white">{suggestedAnswer}</p>
          </div>
        )}

        {!isActive && !currentQuestion && !error && (
          <div className="text-center text-gray-400 py-8">
            Click "Start" to begin analyzing the Zoom meeting
          </div>
        )}

        {isActive && !currentQuestion && !error && (
          <div className="text-center text-gray-400 py-8">
            Listening for questions...
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Works with Zoom meetings • Powered by OpenAI
      </div>
    </div>
  );
}

export default App;
