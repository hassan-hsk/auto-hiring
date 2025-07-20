import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const InterviewPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const applicationId = searchParams.get('applicationId');

    // Video and Audio refs
    const videoRef = useRef(null);
    const recognitionRef = useRef(null);

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
    const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
    const [currentAnswerText, setCurrentAnswerText] = useState("");
    const [liveTranscript, setLiveTranscript] = useState("");
    const [aiAnalysis, setAiAnalysis] = useState(null);

    // Initialize camera and fetch data
    useEffect(() => {
        const initializeInterview = async () => {
            if (!applicationId) {
                setError('No application ID provided');
                setLoading(false);
                return;
            }

            try {
                await fetchApplicationData();
                setTimeout(async () => {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                            audio: true
                        });

                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                            videoRef.current.onloadedmetadata = () => setIsVideoReady(true);
                        }
                    } catch (mediaError) {
                        console.error('Camera access error:', mediaError);
                        setIsVideoReady(true);
                        setError('Camera access denied. Continuing with audio-only interview.');
                    }
                }, 100);
            } catch (err) {
                console.error('Error initializing interview:', err);
                setError('Failed to load interview data');
            } finally {
                setLoading(false);
            }
        };

        initializeInterview();

        return () => {
            cleanupResources();
        };
    }, [applicationId]);

    // Cleanup function
    const cleanupResources = () => {
        if (videoRef.current?.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
    };

    // Timer for 5-minute interview
    useEffect(() => {
        let timer;
        if (interviewStarted && timeRemaining > 0 && !interviewCompleted) {
            timer = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        endInterview();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [interviewStarted, timeRemaining, interviewCompleted]);

    const fetchApplicationData = async () => {
        try {
            console.log('Fetching application data...');
            const appDoc = await getDoc(doc(db, 'applications', applicationId));
            if (!appDoc.exists()) throw new Error('Application not found');

            const appData = appDoc.data();
            console.log('Application data:', appData);
            setApplicationData(appData);

            const jobDoc = await getDoc(doc(db, 'jobs', appData.jobId));
            if (jobDoc.exists()) {
                const jobInfo = jobDoc.data();
                console.log('Job data:', jobInfo);
                setJobData(jobInfo);
                await generateQuestions(appData, jobInfo);
            } else {
                console.log('Job not found, using basic questions');
                await generateQuestions(appData, { title: 'this position', skills: [] });
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load interview data');
            setFallbackQuestions();
        }
    };

    const setFallbackQuestions = () => {
        const fallbackQuestions = [
            "Hello! I'm your AI interviewer. Tell me about yourself and your background.",
            "What interests you about this position and our company?",
            "Describe your technical skills and experience.",
            "Tell me about a challenging project you've worked on.",
            "Where do you see yourself in the next few years?"
        ];
        console.log('Using fallback questions');
        setQuestions(fallbackQuestions);
    };

    const generateQuestions = async (appData, jobInfo) => {
        try {
            console.log('Generating questions with OpenRouter...');

            const resumeSkills = appData?.resumeData?.skills || [];
            const jobSkills = jobInfo?.skills || [];
            const jobTitle = jobInfo?.title || 'this position';

            const prompt = `Generate 5 personalized interview questions for ${appData.candidateName || 'the candidate'} applying for ${jobTitle}.

Resume Skills: ${resumeSkills.join(', ') || 'Not specified'}
Job Requirements: ${jobSkills.join(', ') || 'Not specified'}
Experience Level: ${appData?.resumeData?.experience || 'Not specified'}

Make questions relevant to their background and the job role. Return ONLY a JSON array of strings with no additional text.

Example format:
["Question 1 here", "Question 2 here", "Question 3 here", "Question 4 here", "Question 5 here"]`;

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'AI Interview System'
                },
                body: JSON.stringify({
                    model: 'google/gemma-7b-it:free',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert AI interviewer. Generate relevant, professional interview questions. Respond with ONLY a JSON array of strings, no additional text or formatting.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            console.log('OpenRouter response:', data);

            if (data.choices && data.choices[0] && data.choices[0].message) {
                try {
                    let content = data.choices[0].message.content.trim();
                    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                    const questions = JSON.parse(content);

                    if (Array.isArray(questions) && questions.length > 0) {
                        console.log('Questions generated by AI:', questions);
                        setQuestions(questions);
                    } else {
                        throw new Error('Invalid questions format');
                    }
                } catch (parseError) {
                    console.error('Failed to parse AI response:', parseError);
                    setFallbackQuestions();
                }
            } else {
                console.error('Invalid response structure from OpenRouter:', data);
                setFallbackQuestions();
            }
        } catch (error) {
            console.error('Error calling OpenRouter:', error);
            setFallbackQuestions();
        }
    };

    // Updated speakText function with better error handling
    const speakText = async (text) => {
        setAiSpeaking(true);

        try {
            console.log('Attempting ElevenLabs TTS...');

            const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
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
                        similarity_boost: 0.75
                    }
                })
            });

            if (response.ok) {
                console.log('ElevenLabs TTS successful');
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                return new Promise((resolve) => {
                    audio.onended = () => {
                        setAiSpeaking(false);
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };

                    audio.onerror = () => {
                        console.error('Audio playback failed');
                        setAiSpeaking(false);
                        URL.revokeObjectURL(audioUrl);
                        fallbackSpeech(text);
                        resolve();
                    };

                    audio.play().catch(err => {
                        console.error('Failed to play audio:', err);
                        fallbackSpeech(text);
                        resolve();
                    });
                });
            } else {
                const errorText = await response.text();
                console.error(`ElevenLabs API failed: ${response.status} - ${errorText}`);

                // If unauthorized, log the API key issue
                if (response.status === 401) {
                    console.error('ElevenLabs API Key Error - Check your API key');
                    console.log('Current API Key:', process.env.REACT_APP_ELEVENLABS_API_KEY ? 'Present' : 'Missing');
                }

                throw new Error(`ElevenLabs API failed: ${response.status}`);
            }
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            fallbackSpeech(text);
        }
    };

    const fallbackSpeech = (text) => {
        console.log('Using fallback browser TTS');
        return new Promise((resolve) => {
            if ('speechSynthesis' in window) {
                // Cancel any ongoing speech
                speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);

                // Wait for voices to load
                const setVoiceAndSpeak = () => {
                    const voices = speechSynthesis.getVoices();
                    const preferredVoice = voices.find(voice =>
                        voice.name.includes('Google') ||
                        voice.name.includes('Microsoft') ||
                        voice.lang.startsWith('en')
                    ) || voices[0];

                    if (preferredVoice) {
                        utterance.voice = preferredVoice;
                    }

                    utterance.onstart = () => setAiSpeaking(true);
                    utterance.onend = () => {
                        setAiSpeaking(false);
                        resolve();
                    };
                    utterance.onerror = () => {
                        setAiSpeaking(false);
                        resolve();
                    };
                    utterance.rate = 0.9;
                    utterance.pitch = 1;

                    speechSynthesis.speak(utterance);
                };

                if (speechSynthesis.getVoices().length === 0) {
                    speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
                } else {
                    setVoiceAndSpeak();
                }
            } else {
                setAiSpeaking(false);
                resolve();
            }
        });
    };

    const startRecording = async () => {
        try {
            console.log('Starting speech recognition...');

            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                throw new Error('Speech recognition not supported in this browser');
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            let finalTranscript = '';
            let speechTimeout;

            recognition.onresult = (event) => {
                let interimTranscript = '';
                finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const fullTranscript = finalTranscript + interimTranscript;
                setLiveTranscript(fullTranscript);

                if (finalTranscript.trim()) {
                    setCurrentAnswerText(finalTranscript.trim());

                    // Auto-stop if user pauses for 3 seconds
                    clearTimeout(speechTimeout);
                    speechTimeout = setTimeout(() => {
                        if (recognitionRef.current) {
                            recognitionRef.current.stop();
                        }
                    }, 3000);
                }
            };

            recognition.onstart = () => {
                console.log('Speech recognition started');
                setIsRecording(true);
            };

            recognition.onend = () => {
                console.log('Speech recognition ended');
                setIsRecording(false);
                clearTimeout(speechTimeout);

                if (finalTranscript.trim()) {
                    processAnswer(finalTranscript.trim());
                } else if (currentAnswerText.trim()) {
                    processAnswer(currentAnswerText.trim());
                } else {
                    console.log('No speech detected, moving to next question');
                    setTimeout(() => nextQuestion(), 1000);
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsRecording(false);
                clearTimeout(speechTimeout);

                // Don't show error for common issues, just move on
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    setError(`Speech recognition error: ${event.error}`);
                }

                setTimeout(() => nextQuestion(), 1000);
            };

            recognitionRef.current = recognition;
            recognition.start();

            // Auto-stop after 45 seconds
            setTimeout(() => {
                if (recognitionRef.current && isRecording) {
                    recognitionRef.current.stop();
                }
            }, 45000);

        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Speech recognition failed. Please check microphone permissions.');
            setIsRecording(false);
            setTimeout(() => nextQuestion(), 2000);
        }
    };

    const stopRecording = () => {
        console.log('Manual stop recording');
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsRecording(false);
    };

    const processAnswer = async (transcript) => {
        if (isProcessing) return; // Prevent double processing

        setIsProcessing(true);
        setLiveTranscript("");

        console.log('Processing answer:', transcript);

        try {
            const analysis = await analyzeAnswer(transcript);

            const answerData = {
                question: questions[currentQuestion],
                answer: transcript,
                analysis: analysis,
                timestamp: new Date()
            };

            setAnswers(prev => [...prev, answerData]);
            setAiAnalysis(analysis);

            console.log('Answer processed, analysis:', analysis);

            // Move to next question after 2 seconds
            setTimeout(() => {
                setIsProcessing(false);
                nextQuestion();
            }, 2000);

        } catch (err) {
            console.error('Error processing answer:', err);
            setIsProcessing(false);
            setTimeout(() => nextQuestion(), 1000);
        }
    };

    const analyzeAnswer = async (answer) => {
        try {
            console.log('Analyzing answer with OpenRouter...');

            const prompt = `Analyze this interview answer and provide scores (0-100) and feedback:

Question: ${questions[currentQuestion]}
Answer: ${answer}
Job Title: ${jobData?.title || 'Unknown'}
Job Skills Required: ${jobData?.skills?.join(', ') || 'Not specified'}
Candidate Skills: ${applicationData?.resumeData?.skills?.join(', ') || 'Not specified'}

Evaluate on:
1. Relevance to the question and job role (0-100)
2. Clarity and communication skills (0-100)
3. Technical depth and knowledge (0-100)
4. Overall professionalism (0-100)

Respond with ONLY a JSON object in this exact format:
{
  "relevance": 85,
  "clarity": 90,
  "technical_depth": 75,
  "communication": 88,
  "feedback": "Strong answer demonstrating good understanding..."
}`;

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'AI Interview System'
                },
                body: JSON.stringify({
                    model: 'mistralai/mistral-7b-instruct:free',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert interview analyst. Provide fair, constructive evaluation. Respond with ONLY valid JSON, no additional text.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            const data = await response.json();

            if (data.choices && data.choices[0] && data.choices[0].message) {
                try {
                    let content = data.choices[0].message.content.trim();
                    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                    const analysis = JSON.parse(content);

                    const validAnalysis = {
                        relevance: Math.min(100, Math.max(0, parseInt(analysis.relevance) || 70)),
                        clarity: Math.min(100, Math.max(0, parseInt(analysis.clarity) || 75)),
                        technical_depth: Math.min(100, Math.max(0, parseInt(analysis.technical_depth) || 65)),
                        communication: Math.min(100, Math.max(0, parseInt(analysis.communication) || 80)),
                        feedback: analysis.feedback || "Good response with room for improvement."
                    };

                    return validAnalysis;
                } catch (parseError) {
                    console.error('Failed to parse analysis:', parseError);
                    return getFallbackAnalysis();
                }
            } else {
                throw new Error('Invalid response from OpenRouter');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            return getFallbackAnalysis();
        }
    };

    const getFallbackAnalysis = () => {
        return {
            relevance: Math.floor(Math.random() * 30) + 70,
            clarity: Math.floor(Math.random() * 25) + 75,
            technical_depth: Math.floor(Math.random() * 35) + 65,
            communication: Math.floor(Math.random() * 20) + 80,
            feedback: "Your answer shows understanding. Consider providing more specific examples."
        };
    };

    const nextQuestion = async () => {
        if (interviewCompleted) return;

        console.log(`Moving to next question. Current: ${currentQuestion}, Total: ${questions.length}`);

        if (currentQuestion < questions.length - 1) {
            const nextQuestionIndex = currentQuestion + 1;
            setCurrentQuestion(nextQuestionIndex);
            setCurrentAnswerText("");
            setLiveTranscript("");
            setAiAnalysis(null);

            // Small delay then speak next question
            setTimeout(async () => {
                if (!interviewCompleted) {
                    await speakText(questions[nextQuestionIndex]);
                    // Start recording after speech ends
                    setTimeout(() => {
                        if (!interviewCompleted) {
                            startRecording();
                        }
                    }, 500);
                }
            }, 1000);
        } else {
            console.log('All questions completed, ending interview');
            endInterview();
        }
    };

    const endInterview = async () => {
        if (interviewCompleted) return; // Prevent multiple calls

        console.log('Ending interview...');
        setInterviewCompleted(true);
        setIsRecording(false);
        setAiSpeaking(false);
        setIsProcessing(false);

        // Clean up resources
        cleanupResources();

        const totalScore = calculateFinalScore();
        setFinalScore(totalScore);

        try {
            await saveInterviewResults(totalScore);
            console.log('Interview results saved successfully');
        } catch (error) {
            console.error('Failed to save interview results:', error);
        }

        // Navigate to feedback page
        setTimeout(() => {
            navigate(`/interview-feedback?applicationId=${applicationId}`);
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
        if (questions.length === 0) {
            setError('No questions available');
            return;
        }

        console.log('Starting interview with questions:', questions);
        setInterviewStarted(true);

        setTimeout(async () => {
            await speakText(questions[0]);
            setTimeout(() => {
                startRecording();
            }, 500);
        }, 500);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndInterview = () => {
        if (window.confirm('Are you sure you want to end the interview? This action cannot be undone.')) {
            endInterview();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Preparing Your Interview</h3>
                    <p className="text-gray-500">Setting up AI interviewer and loading questions...</p>
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
                    {/* Header */}
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
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Video Preview */}
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
                                            <p className="text-white text-sm">Connecting to camera...</p>
                                        </div>
                                    </div>
                                )}
                                {isVideoReady && (
                                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        Camera Ready
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Interview Information */}
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">What to Expect</h3>
                            <div className="space-y-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="text-indigo-600 text-sm font-medium">1</span>
                                    </div>
                                    <p className="text-gray-600">{questions.length} personalized questions based on your resume</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="text-indigo-600 text-sm font-medium">2</span>
                                    </div>
                                    <p className="text-gray-600">AI will speak questions with natural voice</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="text-indigo-600 text-sm font-medium">3</span>
                                    </div>
                                    <p className="text-gray-600">Live transcription of your responses</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="text-indigo-600 text-sm font-medium">4</span>
                                    </div>
                                    <p className="text-gray-600">Maximum 5 minutes total interview time</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="text-indigo-600 text-sm font-medium">5</span>
                                    </div>
                                    <p className="text-gray-600">Real-time AI analysis and feedback</p>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium text-blue-900">Pro Tips</span>
                                </div>
                                <ul className="text-blue-800 text-sm space-y-1">
                                    <li>• Speak clearly and at a moderate pace</li>
                                    <li>• Look at the camera when responding</li>
                                    <li>• Ensure good lighting and minimal background noise</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Start Button */}
                    <div className="text-center mt-8">
                        <button
                            onClick={startInterview}
                            disabled={questions.length === 0}
                            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
                        >
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Start AI Interview
                        </button>

                        {questions.length === 0 && (
                            <p className="text-red-500 text-sm mt-2">Loading questions...</p>
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
                {/* Header with timer and progress */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-4">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <h2 className="text-xl font-semibold text-gray-900">AI Interview in Progress</h2>
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
                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                            {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Video and AI Status */}
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

                                {/* Status indicators */}
                                {isRecording && (
                                    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                        <span>Recording</span>
                                    </div>
                                )}

                                {aiSpeaking && (
                                    <div className="absolute top-4 right-4 flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                        <span>AI Speaking</span>
                                    </div>
                                )}

                                {isProcessing && (
                                    <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                        <span>Analyzing...</span>
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
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

                        {/* AI Analysis */}
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
                            </div>
                        )}
                    </div>

                    {/* Question and Transcript */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Question</h3>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-l-4 border-indigo-500">
                                <p className="text-gray-800 text-lg leading-relaxed">
                                    {questions[currentQuestion]}
                                </p>
                            </div>
                        </div>

                        {/* Live Transcript */}
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Live Transcript</h3>
                                {isRecording && (
                                    <div className="flex items-center space-x-2 text-red-600">
                                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                                        <span className="text-sm font-medium">Listening...</span>
                                    </div>
                                )}
                            </div>
                            <div className="min-h-[120px] bg-gray-50 rounded-lg p-4">
                                {liveTranscript ? (
                                    <p className="text-gray-800 leading-relaxed">{liveTranscript}</p>
                                ) : (
                                    <p className="text-gray-400 italic">
                                        {isRecording ? "Start speaking..." : "Your response will appear here"}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Interview Progress */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Progress</h3>
                            <div className="space-y-3">
                                {questions.map((question, index) => (
                                    <div key={index} className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${index < currentQuestion
                                                ? 'bg-green-500 text-white'
                                                : index === currentQuestion
                                                    ? 'bg-indigo-500 text-white'
                                                    : 'bg-gray-200 text-gray-600'
                                            }`}>
                                            {index < currentQuestion ? '✓' : index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm ${index === currentQuestion ? 'font-medium text-indigo-600' : 'text-gray-600'
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