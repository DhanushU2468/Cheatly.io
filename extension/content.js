// Content script for handling Zoom meeting capture
let isCapturing = false;
let popupWindow = null;
let transcriptContainer = null;
let statusIndicator = null;
let retryCount = 0;
const MAX_RETRIES = 3;

// Function to check if we're in a Zoom meeting
function isInZoomMeeting() {
  return window.location.hostname.includes('zoom.us') && 
         (window.location.pathname.includes('/j/') || window.location.pathname.includes('/meeting/'));
}

// Create floating popup window
function createFloatingPopup() {
  if (document.getElementById('ai-assistant-popup')) {
    return document.getElementById('ai-assistant-popup');
  }

  const popup = document.createElement('div');
  popup.id = 'ai-assistant-popup';
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 380px;
    background: #1a1a1a;
    color: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
    resize: both;
    min-height: 200px;
    max-height: 600px;
  `;

  // Add drag functionality
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px;
    background: #2d2d2d;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3d3d3d;
  `;
  
  const title = document.createElement('div');
  title.textContent = 'AI Interview Assistant';
  title.style.cssText = `
    font-weight: bold;
    font-size: 14px;
  `;

  // Add status indicator
  statusIndicator = document.createElement('div');
  statusIndicator.style.cssText = `
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #666;
    margin-left: 8px;
  `;
  title.appendChild(statusIndicator);

  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  const minimizeBtn = document.createElement('button');
  minimizeBtn.textContent = '−';
  minimizeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: calc(100% - 45px);
    overflow-y: auto;
  `;

  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Start Capture';
  toggleButton.style.cssText = `
    background: #2D8CFF;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    width: 100%;
    transition: background-color 0.2s;
  `;

  // Create transcript container
  transcriptContainer = document.createElement('div');
  transcriptContainer.style.cssText = `
    margin-top: 10px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-size: 14px;
    min-height: 40px;
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  `;
  transcriptContainer.textContent = 'Waiting for speech...';

  const qaContainer = document.createElement('div');
  qaContainer.id = 'qa-container';
  qaContainer.style.cssText = `
    margin-top: 10px;
    flex-grow: 1;
    overflow-y: auto;
    font-size: 14px;
    padding-right: 8px;
  `;

  // Event listeners for dragging
  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    initialX = e.clientX - popup.offsetLeft;
    initialY = e.clientY - popup.offsetTop;
    if (e.target === header) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      currentX = Math.min(Math.max(currentX, 0), window.innerWidth - popup.offsetWidth);
      currentY = Math.min(Math.max(currentY, 0), window.innerHeight - popup.offsetHeight);
      
      popup.style.left = currentX + "px";
      popup.style.top = currentY + "px";
    }
  }

  function dragEnd() {
    isDragging = false;
  }

  async function startCapture() {
    try {
      chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
      toggleButton.textContent = 'Stop Capture';
      toggleButton.style.background = '#dc3545';
      isCapturing = true;
      retryCount = 0;
    } catch (error) {
      console.error('Error starting capture:', error);
      handleCaptureError(error);
    }
  }

  async function stopCapture() {
    try {
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
      toggleButton.textContent = 'Start Capture';
      toggleButton.style.background = '#2D8CFF';
      isCapturing = false;
      transcriptContainer.textContent = 'Waiting for speech...';
      setStatus('inactive');
    } catch (error) {
      console.error('Error stopping capture:', error);
    }
  }

  toggleButton.addEventListener('click', () => {
    if (!isCapturing) {
      startCapture();
    } else {
      stopCapture();
    }
  });

  minimizeBtn.addEventListener('click', () => {
    content.style.display = content.style.display === 'none' ? 'flex' : 'none';
    popup.style.height = content.style.display === 'none' ? 'auto' : '400px';
  });

  closeBtn.addEventListener('click', () => {
    if (isCapturing) {
      stopCapture();
    }
    popup.remove();
    popupWindow = null;
  });

  controls.appendChild(minimizeBtn);
  controls.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(controls);
  content.appendChild(toggleButton);
  content.appendChild(transcriptContainer);
  content.appendChild(qaContainer);
  popup.appendChild(header);
  popup.appendChild(content);

  return popup;
}

function setStatus(status) {
  if (statusIndicator) {
    switch (status) {
      case 'active':
        statusIndicator.style.background = '#4CAF50';
        break;
      case 'error':
        statusIndicator.style.background = '#dc3545';
        break;
      case 'inactive':
        statusIndicator.style.background = '#666';
        break;
    }
  }
}

function handleCaptureError(error) {
  setStatus('error');
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    console.log(`Retrying capture (attempt ${retryCount}/${MAX_RETRIES})...`);
    setTimeout(() => {
      if (isCapturing) {
        chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
      }
    }, 2000);
  } else {
    transcriptContainer.textContent = `Error: ${error.message || 'Failed to start capture'}. Please try again.`;
  }
}

// Function to display Q&A
function displayQA(question, answer) {
  const qaContainer = document.getElementById('qa-container');
  if (!qaContainer) return;

  const qaElement = document.createElement('div');
  qaElement.style.cssText = `
    margin-bottom: 15px;
    padding: 10px;
    background: rgba(45, 140, 255, 0.1);
    border-radius: 4px;
  `;

  const questionElement = document.createElement('div');
  questionElement.style.cssText = `
    font-weight: bold;
    margin-bottom: 5px;
    color: #2D8CFF;
  `;
  questionElement.textContent = `Q: ${question}`;

  const answerElement = document.createElement('div');
  answerElement.style.cssText = `
    color: #FFFFFF;
    white-space: pre-wrap;
    word-break: break-word;
  `;
  answerElement.textContent = `A: ${answer}`;

  qaElement.appendChild(questionElement);
  qaElement.appendChild(answerElement);
  qaContainer.appendChild(qaElement);
  qaContainer.scrollTop = qaContainer.scrollHeight;
}

// Update transcript display
function updateTranscript(text, isFinal) {
  if (transcriptContainer) {
    transcriptContainer.textContent = text;
    transcriptContainer.style.color = isFinal ? '#fff' : '#aaa';
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  try {
    switch (message.type) {
      case 'SHOW_QA':
        displayQA(message.data.question, message.data.answer);
        break;
      case 'TRANSCRIPT':
        updateTranscript(message.text, message.isFinal);
        break;
      case 'SPEECH_STATUS':
        if (message.status === 'active') {
          setStatus('active');
        }
        break;
      case 'SPEECH_ERROR':
        setStatus('error');
        handleCaptureError(new Error(message.error));
        break;
      case 'CAPTURE_ERROR':
        handleCaptureError(new Error(message.error));
        break;
      case 'CAPTURE_STATUS':
        if (message.status === 'stopped') {
          setStatus('inactive');
        }
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Initialize popup when in a Zoom meeting
function initializePopup() {
  if (!isInZoomMeeting()) return;
  
  if (!popupWindow) {
    popupWindow = createFloatingPopup();
    document.body.appendChild(popupWindow);
  }
}

// Initialize when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

// Listen for navigation changes (for single-page apps)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    initializePopup();
  }
}).observe(document, { subtree: true, childList: true }); 