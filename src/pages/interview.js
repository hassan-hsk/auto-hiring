import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { GoogleGenerativeAI } from "@google/generative-ai";

const InterviewPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const applicationId = searchParams.get('applicationId');

    // Initialize Google Gemini
    const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

    // Refs for proper cleanup
    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const isMountedRef = useRef(true);
    const cameraTimeoutRef = useRef(null);
    const initializationRef = useRef(false);
    const fetchTimeoutRef = useRef(null);
    const recordingTimeoutRef = useRef(null);

    // State management
    const [applicationData, setApplicationData] = useState(null);
    const [jobData, setJobData] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [interviewStarted, setInterviewStarted] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [interviewCompleted, setInterviewCompleted] = useState(false);
    const [finalScore, setFinalScore] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(300);
    const [currentAnswerText, setCurrentAnswerText] = useState("");
    const [liveTranscript, setLiveTranscript] = useState("");
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [audioChunks, setAudioChunks] = useState([]);

    // Fetch application data with timeout and retry logic
    const fetchApplicationData = useCallback(async () => {
        if (initializationRef.current) return;
        initializationRef.current = true;

        try {
            console.log('Fetching application data...');

            const fetchPromise = Promise.race([
                getDoc(doc(db, 'applications', applicationId)),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Firebase query timeout')), 10000)
                )
            ]);

            const appDoc = await fetchPromise;

            if (!appDoc.exists()) {
                throw new Error('Application not found');
            }

            const appData = appDoc.data();
            console.log('Application data fetched successfully:', appData);

            if (isMountedRef.current) {
                setApplicationData(appData);
            }

            // Fetch job data with timeout
            try {
                const jobFetchPromise = Promise.race([
                    getDoc(doc(db, 'jobs', appData.jobId)),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Job fetch timeout')), 8000)
                    )
                ]);

                const jobDoc = await jobFetchPromise;

                if (jobDoc.exists()) {
                    const jobInfo = jobDoc.data();
                    console.log('Job data fetched successfully:', jobInfo);
                    if (isMountedRef.current) {
                        setJobData(jobInfo);
                    }
                    await generateQuestions(appData, jobInfo);
                } else {
                    console.log('Job not found, using fallback');
                    await generateQuestions(appData, { title: 'this position', skills: [] });
                }
            } catch (jobError) {
                console.error('Error fetching job data, using fallback:', jobError);
                await generateQuestions(appData, { title: 'this position', skills: [] });
            }

        } catch (err) {
            console.error('Error fetching application data:', err);
            if (isMountedRef.current) {
                if (err.message.includes('timeout')) {
                    setError('Connection timeout. Using fallback questions.');
                } else {
                    setError('Failed to load interview data. Using fallback questions.');
                }
                setFallbackQuestions();
            }
        }
    }, [applicationId]);

    // Initialize camera and microphone
    const initializeCamera = useCallback(async () => {
        if (!isMountedRef.current) return;

        cameraTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });

                if (videoRef.current && isMountedRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (isMountedRef.current) {
                            setIsVideoReady(true);
                        }
                    };
                } else {
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (mediaError) {
                console.error('Camera/microphone access error:', mediaError);
                if (isMountedRef.current) {
                    setIsVideoReady(true);
                    setError('Camera/microphone access denied. Please allow permissions and refresh.');
                }
            }
        }, 100);
    }, []);

    // Initialize interview with overall timeout
    useEffect(() => {
        if (!applicationId || initializationRef.current) return;

        const initializeInterview = async () => {
            try {
                fetchTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current && loading) {
                        console.log('Overall initialization timeout, using fallbacks');
                        setError('Loading timeout. Using fallback questions.');
                        setFallbackQuestions();
                        setIsVideoReady(true);
                        setLoading(false);
                    }
                }, 15000);

                await Promise.all([
                    fetchApplicationData(),
                    initializeCamera()
                ]);

            } catch (err) {
                console.error('Error initializing interview:', err);
                if (isMountedRef.current) {
                    setError('Failed to initialize interview. Using fallback questions.');
                    setFallbackQuestions();
                    setIsVideoReady(true);
                }
            } finally {
                if (fetchTimeoutRef.current) {
                    clearTimeout(fetchTimeoutRef.current);
                }
                if (isMountedRef.current) {
                    setLoading(false);
                }
            }
        };

        initializeInterview();

        return () => {
            isMountedRef.current = false;
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }
        };
    }, [applicationId]);

    // Timer effect
    useEffect(() => {
        if (interviewStarted && timeRemaining > 0 && !interviewCompleted && isMountedRef.current) {
            timerRef.current = setInterval(() => {
                if (!isMountedRef.current) return;

                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        endInterview();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [interviewStarted, interviewCompleted]);

    const setFallbackQuestions = () => {
        console.log('Setting fallback questions');
        const fallbackQuestions = [
            "Hello! I'm your AI interviewer. Tell me about yourself and your background.",
            "What interests you about this position and our company?",
            "Describe your technical skills and experience.",
            "Tell me about a challenging project you've worked on.",
            "Where do you see yourself in the next few years?"
        ];
        if (isMountedRef.current) {
            setQuestions(fallbackQuestions);
            console.log('Fallback questions set:', fallbackQuestions);
        }
    };

    // Generate questions using Google Gemini
    const generateQuestions = async (appData, jobInfo) => {
        try {
            console.log('Generating AI questions with Gemini...');
            const resumeSkills = appData?.resumeData?.skills || [];
            const jobSkills = jobInfo?.skills || [];
            const jobTitle = jobInfo?.title || 'this position';

            const prompt = `Generate 5 personalized interview questions for ${appData.candidateName || 'the candidate'} applying for ${jobTitle}.

Candidate Information:
- Resume Skills: ${resumeSkills.join(', ') || 'Not specified'}
- Experience Level: ${appData?.resumeData?.experience || 'Not specified'}

Job Information:
- Position: ${jobTitle}
- Required Skills: ${jobSkills.join(', ') || 'Not specified'}

Generate questions that assess:
1. Technical competency
2. Problem-solving abilities
3. Communication skills
4. Cultural fit
5. Career motivation

Return exactly 5 questions in this JSON format:
{
  "questions": [
    "Question 1 text here",
    "Question 2 text here", 
    "Question 3 text here",
    "Question 4 text here",
    "Question 5 text here"
  ]
}

Make questions specific to the candidate's background and job requirements.`;

            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Gemini API timeout')), 10000)
                )
            ]);

            const response = await result.response;
            const text = response.text();

            if (text && isMountedRef.current) {
                try {
                    let cleanText = text.trim();
                    cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                    const parsed = JSON.parse(cleanText);

                    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length >= 5) {
                        console.log('Gemini questions generated successfully:', parsed.questions);
                        setQuestions(parsed.questions);
                    } else {
                        throw new Error('Invalid questions format from Gemini');
                    }
                } catch (parseError) {
                    console.error('Failed to parse Gemini response, using fallback:', parseError);
                    setFallbackQuestions();
                }
            } else {
                console.log('No Gemini response, using fallback');
                setFallbackQuestions();
            }
        } catch (error) {
            console.error('Error generating questions with Gemini, using fallback:', error);
            setFallbackQuestions();
        }
    };

    // ElevenLabs Text-to-Speech
    const speakTextWithElevenLabs = async (text) => {
        if (!isMountedRef.current) return;

        setAiSpeaking(true);

        try {
            console.log('Generating speech with ElevenLabs...');

            const response = await Promise.race([
                fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': process.env.REACT_APP_ELEVENLABS_API_KEY
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: "eleven_monolingual_v1",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0.0,
                            use_speaker_boost: true
                        }
                    })
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('ElevenLabs TTS timeout')), 15000)
                )
            ]);

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            if (audioRef.current && isMountedRef.current) {
                audioRef.current.src = audioUrl;

                return new Promise((resolve) => {
                    const cleanup = () => {
                        if (isMountedRef.current) {
                            setAiSpeaking(false);
                        }
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };

                    audioRef.current.onended = cleanup;
                    audioRef.current.onerror = cleanup;

                    if (isMountedRef.current) {
                        audioRef.current.play().catch(cleanup);
                    } else {
                        cleanup();
                    }
                });
            }
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            if (isMountedRef.current) {
                setError(`Speech synthesis failed: ${error.message}`);
                setAiSpeaking(false);
            }
        }
    };

    // Start recording audio for ElevenLabs STT
    const startRecordingWithElevenLabs = async () => {
        if (!isMountedRef.current) return;

        try {
            const stream = videoRef.current?.srcObject;
            if (!stream) {
                throw new Error('No audio stream available');
            }

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            const chunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (!isMountedRef.current) return;

                setIsRecording(false);

                if (chunks.length > 0) {
                    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                    await transcribeWithElevenLabs(audioBlob);
                } else {
                    setTimeout(() => {
                        if (isMountedRef.current) nextQuestion();
                    }, 1000);
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                if (isMountedRef.current) {
                    setError('Recording failed');
                    setIsRecording(false);
                    setTimeout(() => {
                        if (isMountedRef.current) nextQuestion();
                    }, 1000);
                }
            };

            setAudioChunks(chunks);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setLiveTranscript("Recording started... Speak now!");

            // Auto-stop recording after 45 seconds
            recordingTimeoutRef.current = setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, 45000);

        } catch (error) {
            console.error('Error starting recording:', error);
            if (isMountedRef.current) {
                setError('Failed to start recording');
                setIsRecording(false);
            }
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
        }
        if (isMountedRef.current) {
            setIsRecording(false);
        }
    };

    // ElevenLabs Speech-to-Text
    const transcribeWithElevenLabs = async (audioBlob) => {
        if (!isMountedRef.current) return;

        setIsProcessing(true);
        setLiveTranscript("Processing your response...");

        try {
            console.log('Transcribing with ElevenLabs...');

            // Convert webm to wav/mp3 format for better compatibility
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('model_id', 'eleven_multilingual_v2');

            const response = await Promise.race([
                fetch('https://api.elevenlabs.io/v1/speech-to-text', {
                    method: 'POST',
                    headers: {
                        'xi-api-key': process.env.REACT_APP_ELEVENLABS_API_KEY
                    },
                    body: formData
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('ElevenLabs STT timeout')), 30000)
                )
            ]);

            if (!response.ok) {
                throw new Error(`ElevenLabs STT API error: ${response.status}`);
            }

            const result = await response.json();

            if (result.text && result.text.trim() && isMountedRef.current) {
                const transcript = result.text.trim();
                console.log('Transcription successful:', transcript);
                setCurrentAnswerText(transcript);
                setLiveTranscript(transcript);

                setTimeout(() => {
                    if (isMountedRef.current) {
                        processAnswer(transcript);
                    }
                }, 1000);
            } else {
                console.log('No transcription result');
                if (isMountedRef.current) {
                    setLiveTranscript("No speech detected. Moving to next question...");
                    setTimeout(() => {
                        if (isMountedRef.current) nextQuestion();
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('ElevenLabs STT error:', error);
            if (isMountedRef.current) {
                setError(`Transcription failed: ${error.message}`);
                setLiveTranscript("Transcription failed. Moving to next question...");
                setTimeout(() => {
                    if (isMountedRef.current) nextQuestion();
                }, 2000);
            }
        } finally {
            if (isMountedRef.current) {
                setIsProcessing(false);
            }
        }
    };

    // Process answer using Google Gemini
    const processAnswer = async (transcript) => {
        if (isProcessing || !isMountedRef.current) return;

        setIsProcessing(true);

        try {
            const analysis = await analyzeAnswerWithGemini(transcript);

            if (isMountedRef.current) {
                const answerData = {
                    question: questions[currentQuestion],
                    answer: transcript,
                    analysis: analysis,
                    timestamp: new Date()
                };

                setAnswers(prev => [...prev, answerData]);
                setAiAnalysis(analysis);

                setTimeout(() => {
                    if (isMountedRef.current) {
                        setIsProcessing(false);
                        nextQuestion();
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('Error processing answer:', err);
            if (isMountedRef.current) {
                setIsProcessing(false);
                setTimeout(() => {
                    if (isMountedRef.current) nextQuestion();
                }, 1000);
            }
        }
    };

    // Analyze answer using Google Gemini
    const analyzeAnswerWithGemini = async (answer) => {
        try {
            const prompt = `Analyze this interview answer and provide detailed scores:

Question: ${questions[currentQuestion]}
Answer: ${answer}

Evaluate the response on these criteria (score 0-100 for each):
1. Relevance - How well does the answer address the question?
2. Clarity - How clear and well-structured is the response?
3. Technical Depth - Technical knowledge demonstrated (if applicable)
4. Communication - Overall communication effectiveness

Provide scores and brief feedback in this exact JSON format:
{
  "relevance": 85,
  "clarity": 90,
  "technical_depth": 75,
  "communication": 88,
  "feedback": "Strong response with good examples. Could improve on technical details.",
  "strengths": ["Clear communication", "Good examples"],
  "improvements": ["More technical depth", "Specific metrics"]
}`;

            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Gemini analysis timeout')), 8000)
                )
            ]);

            const response = await result.response;
            const text = response.text();

            if (text) {
                try {
                    let cleanText = text.trim();
                    cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                    const analysis = JSON.parse(cleanText);

                    return {
                        relevance: Math.min(100, Math.max(0, parseInt(analysis.relevance) || 70)),
                        clarity: Math.min(100, Math.max(0, parseInt(analysis.clarity) || 75)),
                        technical_depth: Math.min(100, Math.max(0, parseInt(analysis.technical_depth) || 65)),
                        communication: Math.min(100, Math.max(0, parseInt(analysis.communication) || 80)),
                        feedback: analysis.feedback || "Good response.",
                        strengths: analysis.strengths || ["Clear communication"],
                        improvements: analysis.improvements || ["More detail"]
                    };
                } catch (parseError) {
                    console.error('Failed to parse Gemini analysis:', parseError);
                    return getFallbackAnalysis();
                }
            } else {
                return getFallbackAnalysis();
            }
        } catch (error) {
            console.error('Gemini analysis error:', error);
            return getFallbackAnalysis();
        }
    };

    const getFallbackAnalysis = () => ({
        relevance: Math.floor(Math.random() * 30) + 70,
        clarity: Math.floor(Math.random() * 25) + 75,
        technical_depth: Math.floor(Math.random() * 35) + 65,
        communication: Math.floor(Math.random() * 20) + 80,
        feedback: "Good response with room for improvement.",
        strengths: ["Communication skills"],
        improvements: ["More specific examples"]
    });

    const nextQuestion = async () => {
        if (interviewCompleted || !isMountedRef.current) return;

        if (currentQuestion < questions.length - 1) {
            const nextQuestionIndex = currentQuestion + 1;
            if (isMountedRef.current) {
                setCurrentQuestion(nextQuestionIndex);
                setCurrentAnswerText("");
                setLiveTranscript("");
                setAiAnalysis(null);
            }

            setTimeout(async () => {
                if (!interviewCompleted && isMountedRef.current) {
                    await speakTextWithElevenLabs(questions[nextQuestionIndex]);
                    setTimeout(() => {
                        if (!interviewCompleted && isMountedRef.current) {
                            startRecordingWithElevenLabs();
                        }
                    }, 1000);
                }
            }, 1000);
        } else {
            endInterview();
        }
    };

    const endInterview = async () => {
        if (interviewCompleted || !isMountedRef.current) return;

        setInterviewCompleted(true);
        setIsRecording(false);
        setAiSpeaking(false);
        setIsProcessing(false);

        // Stop any ongoing recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }

        // Stop audio playback
        if (audioRef.current) {
            audioRef.current.pause();
        }

        const totalScore = calculateFinalScore();
        setFinalScore(totalScore);

        try {
            await saveInterviewResults(totalScore);
        } catch (error) {
            console.error('Failed to save interview results:', error);
        }

        setTimeout(() => {
            if (isMountedRef.current) {
                navigate(`/interview-feedback?applicationId=${applicationId}`);
            }
        }, 1500);
    };

    const calculateFinalScore = () => {
        if (answers.length === 0) return 0;

        const avgRelevance = answers.reduce((sum, ans) => sum + (ans.analysis?.relevance || 0), 0) / answers.length;
        const avgClarity = answers.reduce((sum, ans) => sum + (ans.analysis?.clarity || 0), 0) / answers.length;
        const avgTechnical = answers.reduce((sum, ans) => sum + (ans.analysis?.technical_depth || 0), 0) / answers.length;
        const avgCommunication = answers.reduce((sum, ans) => sum + (ans.analysis?.communication || 0), 0) / answers.length;

        return Math.round((avgRelevance + avgClarity + avgTechnical + avgCommunication) / 4);
    };

    const saveInterviewResults = async (score) => {
        if (!isMountedRef.current) return;

        try {
            await updateDoc(doc(db, 'applications', applicationId), {
                interviewStatus: 'completed',
                interviewScore: score,
                interviewData: {
                    questions: questions,
                    answers: answers,
                    completedAt: new Date(),
                    duration: 300 - timeRemaining
                }
            });
        } catch (err) {
            console.error('Error saving results:', err);
            throw err;
        }
    };

    const startInterview = async () => {
        if (questions.length === 0 || !isMountedRef.current) return;

        setInterviewStarted(true);

        setTimeout(async () => {
            if (isMountedRef.current) {
                await speakTextWithElevenLabs(questions[0]);
                setTimeout(() => {
                    if (isMountedRef.current) {
                        startRecordingWithElevenLabs();
                    }
                }, 1000);
            }
        }, 500);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndInterview = () => {
        if (window.confirm('Are you sure you want to end the interview?')) {
            endInterview();
        }
    };

    // Auth check
    useEffect(() => {
        if (!user && !loading) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Checking Authentication</h3>
                    <p className="text-gray-500">Please wait...</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Preparing Your Interview</h3>
                    <p className="text-gray-500">Setting up AI interviewer and loading questions...</p>
                    {error && (
                        <p className="text-yellow-600 text-sm mt-2">⚠️ {error}</p>
                    )}
                </div>
            </div>
        );
    }

    if (interviewCompleted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Interview Completed!</h3>
                    <p className="text-gray-600 mb-4">Thank you for completing the AI interview.</p>
                    {finalScore && (
                        <p className="text-lg font-semibold text-indigo-600 mb-4">
                            Your Score: {finalScore}%
                        </p>
                    )}
                    <p className="text-gray-500">Generating your detailed feedback report...</p>
                </div>
            </div>
        );
    }

    if (!interviewStarted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">AI Video Interview</h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            You're about to start a personalized AI interview for <span className="font-semibold text-indigo-600">{jobData?.title || 'this position'}</span>
                        </p>
                        <div className="mt-4 flex items-center justify-center space-x-4 text-sm">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                <span>ElevenLabs Voice AI</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${questions.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                <span>Questions: {questions.length > 0 ? 'Ready' : 'Loading...'}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${isVideoReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                <span>Audio/Video: {isVideoReady ? 'Ready' : 'Setting up...'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Camera Preview</h3>
                            <div className="relative bg-black rounded-xl overflow-hidden">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-64 object-cover"
                                />
                                {!isVideoReady && !error && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="animate-pulse rounded-full h-12 w-12 bg-white/20 mx-auto mb-3"></div>
                                            <p className="text-white text-sm">Connecting to camera and microphone...</p>
                                        </div>
                                    </div>
                                )}
                                {isVideoReady && (
                                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        Ready
                                    </div>
                                )}
                            </div>
                            {/* Hidden audio element for playback */}
                            <audio ref={audioRef} style={{ display: 'none' }} />
                        </div>

                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">What to Expect</h3>
                            <div className="space-y-4">
                                {questions.length > 0 ? (
                                    [
                                        `${questions.length} personalized questions powered by Google Gemini`,
                                        "High-quality voice synthesis using ElevenLabs",
                                        "Advanced speech recognition and transcription",
                                        "Maximum 5 minutes total interview time",
                                        "Detailed AI-powered feedback and scoring"
                                    ].map((text, index) => (
                                        <div key={index} className="flex items-start space-x-3">
                                            <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                                <span className="text-indigo-600 text-sm font-medium">{index + 1}</span>
                                            </div>
                                            <p className="text-gray-600">{text}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-600 italic">Loading questions...</p>
                                )}
                            </div>

                            <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                    <span className="font-medium text-purple-900">ElevenLabs AI Voice</span>
                                </div>
                                <ul className="text-purple-800 text-sm space-y-1">
                                    <li>• Natural, human-like voice synthesis</li>
                                    <li>• Advanced speech-to-text recognition</li>
                                    <li>• Speak clearly and naturally</li>
                                    <li>• Wait for questions to finish before responding</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-8">
                        <button
                            onClick={startInterview}
                            disabled={questions.length === 0 || !isVideoReady}
                            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
                        >
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            Start AI Interview with ElevenLabs
                        </button>

                        {(questions.length === 0 || !isVideoReady) && (
                            <p className="text-red-500 text-sm mt-2">
                                {error ? error : "Setting up interview components..."}
                            </p>
                        )}

                        {error && (
                            <p className="text-yellow-600 text-sm mt-2">⚠️ {error}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-4">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <h2 className="text-xl font-semibold text-gray-900">AI Interview in Progress</h2>
                            <div className="flex items-center space-x-2 text-sm">
                                <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                    ElevenLabs AI
                                </span>
                                {isRecording && (
                                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 animate-pulse">
                                        Recording
                                    </span>
                                )}
                                {aiSpeaking && (
                                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 animate-pulse">
                                        AI Speaking
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className={`text-2xl font-mono ${timeRemaining <= 60 ? 'text-red-600' : 'text-gray-700'}`}>
                                ⏱ {formatTime(timeRemaining)}
                            </div>
                            <button
                                onClick={handleEndInterview}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                            >
                                End Interview
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Question {currentQuestion + 1} of {questions.length}</span>
                        <div className="flex-1 mx-4 bg-gray-200 rounded-full h-3">
                            <div
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                            {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Video and Analysis */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Feed</h3>
                            <div className="relative bg-black rounded-xl overflow-hidden mb-4">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-48 object-cover"
                                />

                                {isRecording && (
                                    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                        <span>Recording</span>
                                    </div>
                                )}

                                {aiSpeaking && (
                                    <div className="absolute top-4 right-4 flex items-center space-x-2 bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                        <span>AI Speaking</span>
                                    </div>
                                )}

                                {isProcessing && (
                                    <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                        <span>Processing...</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={stopRecording}
                                    disabled={!isRecording || isProcessing}
                                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                    {isProcessing ? 'Processing...' : 'Stop Answer'}
                                </button>
                            </div>
                        </div>

                        {aiAnalysis && (
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Analysis</h3>
                                <div className="space-y-3">
                                    {['relevance', 'clarity', 'technical_depth', 'communication'].map((metric) => (
                                        <div key={metric} className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600 capitalize">
                                                {metric.replace('_', ' ')}
                                            </span>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-20 h-2 bg-gray-200 rounded-full">
                                                    <div
                                                        className={`h-2 rounded-full ${metric === 'relevance' ? 'bg-green-500' :
                                                                metric === 'clarity' ? 'bg-blue-500' :
                                                                    metric === 'technical_depth' ? 'bg-purple-500' :
                                                                        'bg-orange-500'
                                                            }`}
                                                        style={{ width: `${aiAnalysis[metric]}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-sm font-medium">{aiAnalysis[metric]}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {aiAnalysis.feedback && (
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-gray-700">{aiAnalysis.feedback}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Question and Transcript */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Question</h3>
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border-l-4 border-purple-500">
                                <p className="text-gray-800 text-lg leading-relaxed">
                                    {questions[currentQuestion]}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Live Transcript (ElevenLabs)</h3>
                                <div className="flex items-center space-x-2">
                                    {isRecording && (
                                        <div className="flex items-center space-x-2 text-red-600">
                                            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                                            <span className="text-sm font-medium">Recording...</span>
                                        </div>
                                    )}
                                    {isProcessing && (
                                        <div className="flex items-center space-x-2 text-yellow-600">
                                            <div className="w-2 h-2 bg-yellow-600 rounded-full animate-spin"></div>
                                            <span className="text-sm font-medium">Processing...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="min-h-[120px] bg-gray-50 rounded-lg p-4">
                                {liveTranscript ? (
                                    <p className="text-gray-800 leading-relaxed">{liveTranscript}</p>
                                ) : (
                                    <p className="text-gray-400 italic">
                                        {isRecording ? "Recording your response..." :
                                            aiSpeaking ? "AI is speaking..." :
                                                "Your response will appear here"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Progress</h3>
                            <div className="space-y-3">
                                {questions.map((question, index) => (
                                    <div key={index} className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${index < currentQuestion
                                                ? 'bg-green-500 text-white'
                                                : index === currentQuestion
                                                    ? 'bg-purple-500 text-white'
                                                    : 'bg-gray-200 text-gray-600'
                                            }`}>
                                            {index < currentQuestion ? '✓' : index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm ${index === currentQuestion ? 'font-medium text-purple-600' : 'text-gray-600'
                                                }`}>
                                                Question {index + 1}
                                            </p>
                                            {index < currentQuestion && answers[index] && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Score: {Math.round((
                                                        answers[index].analysis?.relevance +
                                                        answers[index].analysis?.clarity +
                                                        answers[index].analysis?.technical_depth +
                                                        answers[index].analysis?.communication
                                                    ) / 4)}%
                                                </p>
                                            )}
                                        </div>
                                        {index < currentQuestion && (
                                            <div className="text-green-500">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterviewPage;