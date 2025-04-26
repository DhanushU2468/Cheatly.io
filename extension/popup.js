// Debug logging
const DEBUG = true;

// Create a safer logging function that checks for console availability
const logger = {
  log: function(...args) {
    if (DEBUG && window.console && typeof console.log === 'function') {
      console.log('[Popup]', ...args);
    }
  },
  error: function(...args) {
    if (DEBUG && window.console && typeof console.error === 'function') {
      console.error('[Popup Error]', ...args);
    }
  }
};

// State management
let isCapturing = false;

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Initialize UI elements with error checking
    const elements = {
      toggleButton: document.getElementById('toggleButton'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusLabel: document.getElementById('statusLabel'),
      statusText: document.getElementById('statusText'),
      transcript: document.getElementById('transcript'),
      errorContainer: document.getElementById('errorContainer'),
      errorMessage: document.getElementById('errorMessage'),
      spinner: document.querySelector('.spinner')
    };

    // Verify all elements exist
    Object.entries(elements).forEach(([key, element]) => {
      if (!element) {
        throw new Error(`Required element not found: ${key}`);
      }
    });

    // Check current state with error handling
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      try {
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        if (response?.isCapturing) {
          updateUI(true);
        }
      } catch (error) {
        logger.error('Failed to get initial state:', error);
        showError('Failed to initialize extension state');
      }
    });

    // Listen for status updates from background
    const messageListener = (message, sender, sendResponse) => {
      try {
        logger.log('Received message:', message);
        
        // Early return if message is undefined or doesn't have a type
        if (!message || !message.type) {
          logger.error('Invalid message received:', message);
          return false;
        }

        switch (message.type) {
          case 'TRANSCRIPT_UPDATE':
            if (typeof message.text !== 'undefined') {
              updateTranscript(message.text, Boolean(message.isFinal));
            }
            break;
          case 'STATUS_UPDATE':
            if (typeof message.status !== 'undefined') {
              updateStatus(message.status, message.error);
            }
            break;
          case 'CAPTURE_STOPPED':
            updateUI(false);
            break;
          default:
            logger.log('Unknown message type:', message.type);
        }
      } catch (error) {
        logger.error('Error handling message:', error);
        showError('Failed to process extension message');
      }
      // Return false to indicate we're not sending an async response
      return false;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Toggle button click handler
    elements.toggleButton.addEventListener('click', async () => {
      try {
        elements.toggleButton.disabled = true;
        elements.spinner.style.display = 'block';
        logger.log('Toggle button clicked, current state:', isCapturing);
        
        if (!isCapturing) {
          chrome.runtime.sendMessage({ type: 'START_CAPTURE' }, (response) => {
            try {
              if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
              }
              if (response?.success) {
                updateUI(true);
              } else {
                throw new Error(response?.error || 'Failed to start capture');
              }
            } catch (error) {
              logger.error('Start capture error:', error);
              showError(error.message);
            } finally {
              elements.toggleButton.disabled = false;
              elements.spinner.style.display = 'none';
            }
          });
        } else {
          chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }, (response) => {
            try {
              if (chrome.runtime.lastError) {
                throw new Error(chrome.runtime.lastError.message);
              }
              if (response?.success) {
                updateUI(false);
              } else {
                throw new Error(response?.error || 'Failed to stop capture');
              }
            } catch (error) {
              logger.error('Stop capture error:', error);
              showError(error.message);
            } finally {
              elements.toggleButton.disabled = false;
              elements.spinner.style.display = 'none';
            }
          });
        }
      } catch (error) {
        logger.error('Toggle error:', error);
        showError(error.message);
        elements.toggleButton.disabled = false;
        elements.spinner.style.display = 'none';
      }
    });

    function updateUI(capturing) {
      try {
        logger.log('Updating UI state:', capturing);
        isCapturing = capturing;
        elements.toggleButton.textContent = capturing ? 'Stop Listening' : 'Start Listening';
        elements.toggleButton.className = `button ${capturing ? 'stop' : 'primary'}`;
        elements.statusIndicator.className = `status-indicator ${capturing ? 'active' : ''}`;
        elements.statusLabel.textContent = capturing ? 'Active' : 'Inactive';
        elements.statusText.textContent = capturing ? 'Listening for speech...' : 'Ready to assist...';
        if (!capturing) {
          elements.transcript.textContent = 'Waiting for speech...';
          elements.transcript.className = 'transcript';
        }
        hideError();
      } catch (error) {
        logger.error('Error updating UI:', error);
        showError('Failed to update extension state');
      }
    }

    function updateTranscript(text, isFinal) {
      try {
        elements.transcript.textContent = text || 'Waiting for speech...';
        elements.transcript.className = `transcript ${isFinal ? '' : 'interim'}`;
      } catch (error) {
        logger.error('Error updating transcript:', error);
      }
    }

    function updateStatus(status, error) {
      try {
        // Guard against undefined status
        if (typeof status === 'undefined') {
          logger.error('Received undefined status');
          return;
        }

        switch (status) {
          case 'active':
            elements.statusIndicator.className = 'status-indicator active';
            elements.statusLabel.textContent = 'Active';
            hideError();
            break;
          case 'error':
            elements.statusIndicator.className = 'status-indicator error';
            elements.statusLabel.textContent = 'Error';
            if (error) showError(error);
            break;
          case 'inactive':
            elements.statusIndicator.className = 'status-indicator';
            elements.statusLabel.textContent = 'Inactive';
            hideError();
            break;
          default:
            logger.error('Unknown status:', status);
            break;
        }
      } catch (error) {
        logger.error('Error updating status:', error);
      }
    }

    function showError(message) {
      try {
        elements.errorMessage.textContent = message || 'An unknown error occurred';
        elements.errorContainer.style.display = 'block';
        logger.error('Error displayed:', message);
      } catch (error) {
        logger.error('Failed to show error:', error);
      }
    }

    function hideError() {
      try {
        elements.errorContainer.style.display = 'none';
        elements.errorMessage.textContent = '';
      } catch (error) {
        logger.error('Failed to hide error:', error);
      }
    }

  } catch (error) {
    logger.error('Failed to initialize popup:', error);
    // Try to show error even if normal initialization failed
    try {
      const errorContainer = document.getElementById('errorContainer');
      const errorMessage = document.getElementById('errorMessage');
      if (errorContainer && errorMessage) {
        errorMessage.textContent = 'Failed to initialize extension';
        errorContainer.style.display = 'block';
      }
    } catch (e) {
      // At this point we can't do much else
      console.error('Critical initialization error:', error);
    }
  }
});