// Handle audio capture from Zoom meetings
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_CAPTURE') {
    startAudioCapture();
  } else if (request.type === 'STOP_CAPTURE') {
    stopAudioCapture();
  }
});

let mediaRecorder = null;
let audioChunks = [];

async function startAudioCapture() {
  try {
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        // Process audio chunk for speech recognition
        processAudioChunk(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      // Process final audio if needed
    };

    mediaRecorder.start(1000); // Capture in 1-second intervals
  } catch (error) {
    console.error('Error starting audio capture:', error);
  }
}

function stopAudioCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

async function processAudioChunk(audioChunk) {
  // Convert audio chunk to text using Web Speech API
  const audioUrl = URL.createObjectURL(new Blob([audioChunk], { type: 'audio/webm' }));
  
  // Send the transcribed text to the content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'TRANSCRIPTION',
      text: audioUrl
    });
  });
} 