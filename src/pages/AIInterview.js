import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const AIInterview = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [interviewStarted, setInterviewStarted] = useState(false);

    const questions = [
        "Tell me about yourself and your background.",
        "Why are you interested in this position?",
        "What are your greatest strengths?",
        "Describe a challenging project you've worked on.",
        "Where do you see yourself in 5 years?"
    ];

    const startInterview = () => {
        setInterviewStarted(true);
    };

    const nextQuestion = () => {
        setAnswers([...answers, currentAnswer]);
        setCurrentAnswer("");

        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            // Interview complete
            navigate("/applicant/dashboard");
        }
    };

    const skipQuestion = () => {
        setAnswers([...answers, ""]);
        setCurrentAnswer("");

        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            navigate("/applicant/dashboard");
        }
    };

    if (!interviewStarted) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Interview</h2>
                    <p className="text-gray-600 mb-6">
                        You'll be asked {questions.length} questions. Take your time to provide thoughtful answers.
                        This interview will help us assess your communication skills and experience.
                    </p>
                    <button
                        onClick={startInterview}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
                    >
                        Start Interview
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-8">
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Question {currentQuestion + 1} of {questions.length}</h2>
                        <div className="text-sm text-gray-500">
                            Progress: {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {questions[currentQuestion]}
                    </h3>

                    <textarea
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div className="flex space-x-4">
                    <button
                        onClick={nextQuestion}
                        disabled={!currentAnswer.trim()}
                        className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {currentQuestion === questions.length - 1 ? "Finish Interview" : "Next Question"}
                    </button>
                    <button
                        onClick={skipQuestion}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIInterview;