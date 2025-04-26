import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { MicrophoneIcon, MicrophoneOffIcon } from '@heroicons/react/24/solid';
import './App.css';

function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const webcamRef = useRef(null);
  const recognitionRef = useRef(null);

  const questions = [
    "How would you describe your ideal weekend?",
    "What colors make you feel most comfortable?",
    "How do you usually react in a crowded party?",
    "What's your idea of a perfect day?",
    "How do you handle stress?"
  ];

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setTranscript(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsListening(!isListening);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setTranscript('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Video Call Interface */}
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <Webcam
              ref={webcamRef}
              audio={false}
              className="w-full h-full object-cover"
              mirrored={true}
            />
            <div className="absolute bottom-4 right-4">
              <button
                onClick={toggleListening}
                className={`p-3 rounded-full ${
                  isListening ? 'bg-red-500' : 'bg-blue-500'
                } hover:opacity-80 transition-opacity`}
              >
                {isListening ? (
                  <MicrophoneOffIcon className="h-6 w-6" />
                ) : (
                  <MicrophoneIcon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Interview Interface */}
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Current Question:</h2>
              <p className="text-gray-300">{questions[currentQuestion]}</p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Your Response:</h2>
              <p className="text-gray-300">{transcript || "Start speaking..."}</p>
            </div>

            <button
              onClick={handleNextQuestion}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              disabled={currentQuestion === questions.length - 1}
            >
              {currentQuestion === questions.length - 1 ? 'Interview Complete' : 'Next Question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
