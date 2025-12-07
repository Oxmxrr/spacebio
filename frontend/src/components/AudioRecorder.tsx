import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  onError: (error: string) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscription, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const { stt } = useApi();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
      const result = await stt.mutateAsync(audioFile);
      onTranscription(result.text);
    } catch (error) {
      console.error('Transcription error:', error);
      onError(error instanceof Error ? error.message : 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        // Auto-transcribe when recording stops
        transcribeAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      onError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={handleMicClick}
        disabled={isTranscribing}
        className={`p-3 rounded-full transition-all duration-200 ${
          isRecording
            ? 'bg-red-600 hover:bg-red-700 animate-pulse'
            : isTranscribing
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-space-cyan/20 hover:bg-space-cyan/30 text-space-cyan'
        }`}
        title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start recording'}
      >
        {isTranscribing ? (
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        ) : (
          <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : ''}`} />
        )}
      </button>

      {isRecording && (
        <div className="flex items-center space-x-2 text-space-cyan">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
        </div>
      )}

      {isTranscribing && (
        <span className="text-sm text-gray-400">Transcribing...</span>
      )}
    </div>
  );
};
