import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const InterviewFeedback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const applicationId = searchParams.get('applicationId');

    const [feedbackData, setFeedbackData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                const appDoc = await getDoc(doc(db, 'applications', applicationId));
                if (appDoc.exists()) {
                    const data = appDoc.data();
                    setFeedbackData(data.interviewData);
                }
            } catch (error) {
                console.error('Error fetching feedback:', error);
            } finally {
                setLoading(false);
            }
        };

        if (applicationId) {
            fetchFeedback();
        }
    }, [applicationId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-gray-700">Generating Your Interview Report...</h3>
                </div>
            </div>
        );
    }

    const calculateOverallScore = () => {
        if (!feedbackData?.answers?.length) return 0;

        const totalScore = feedbackData.answers.reduce((sum, answer) => {
            const analysis = answer.analysis;
            return sum + (analysis.relevance + analysis.clarity + analysis.technical_depth + analysis.communication) / 4;
        }, 0);

        return Math.round(totalScore / feedbackData.answers.length);
    };

    const getScoreColor = (score) => {
        if (score >= 85) return 'text-green-600';
        if (score >= 70) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getScoreBg = (score) => {
        if (score >= 85) return 'bg-green-500';
        if (score >= 70) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const overallScore = calculateOverallScore();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Interview Complete!</h1>
                    <p className="text-xl text-gray-600">Here's your comprehensive performance analysis</p>
                </div>

                {/* Overall Score */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Overall Performance</h2>
                    <div className="relative inline-block">
                        <div className="w-32 h-32 rounded-full border-8 border-gray-200 flex items-center justify-center">
                            <div className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
                                {overallScore}%
                            </div>
                        </div>
                        <div
                            className={`absolute inset-0 rounded-full border-8 ${getScoreBg(overallScore)} opacity-20`}
                            style={{
                                background: `conic-gradient(from 0deg, ${overallScore >= 85 ? '#10b981' : overallScore >= 70 ? '#f59e0b' : '#ef4444'} ${overallScore * 3.6}deg, transparent 0deg)`
                            }}
                        ></div>
                    </div>
                    <p className="text-gray-600 mt-4">
                        {overallScore >= 85 ? 'Excellent Performance!' : overallScore >= 70 ? 'Good Performance!' : 'Room for Improvement'}
                    </p>
                </div>

                {/* Detailed Scores */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {['relevance', 'clarity', 'technical_depth', 'communication'].map((metric, index) => {
                        const avgScore = feedbackData?.answers?.length > 0
                            ? Math.round(feedbackData.answers.reduce((sum, answer) => sum + answer.analysis[metric], 0) / feedbackData.answers.length)
                            : 0;

                        const metricNames = {
                            relevance: 'Relevance',
                            clarity: 'Clarity',
                            technical_depth: 'Technical Depth',
                            communication: 'Communication'
                        };

                        return (
                            <div key={metric} className="bg-white rounded-xl shadow-lg p-6 text-center">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">{metricNames[metric]}</h3>
                                <div className="relative w-20 h-20 mx-auto mb-4">
                                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                                        <path
                                            className="text-gray-200"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            fill="none"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path
                                            className={getScoreColor(avgScore).replace('text-', 'text-')}
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            fill="none"
                                            strokeDasharray={`${avgScore}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}%</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Question by Question Analysis */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Question-by-Question Analysis</h2>
                    <div className="space-y-6">
                        {feedbackData?.answers?.map((answer, index) => (
                            <div key={index} className="border-l-4 border-indigo-500 pl-6 py-4 bg-gray-50 rounded-r-lg">
                                <h3 className="font-semibold text-gray-900 mb-2">Question {index + 1}</h3>
                                <p className="text-gray-700 mb-3">{answer.question}</p>

                                <div className="bg-white p-4 rounded-lg mb-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Your Answer:</h4>
                                    <p className="text-gray-600 italic">"{answer.answer}"</p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div className="text-center">
                                        <div className={`text-lg font-bold ${getScoreColor(answer.analysis.relevance)}`}>
                                            {answer.analysis.relevance}%
                                        </div>
                                        <div className="text-xs text-gray-500">Relevance</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-lg font-bold ${getScoreColor(answer.analysis.clarity)}`}>
                                            {answer.analysis.clarity}%
                                        </div>
                                        <div className="text-xs text-gray-500">Clarity</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-lg font-bold ${getScoreColor(answer.analysis.technical_depth)}`}>
                                            {answer.analysis.technical_depth}%
                                        </div>
                                        <div className="text-xs text-gray-500">Technical</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-lg font-bold ${getScoreColor(answer.analysis.communication)}`}>
                                            {answer.analysis.communication}%
                                        </div>
                                        <div className="text-xs text-gray-500">Communication</div>
                                    </div>
                                </div>

                                {answer.analysis.feedback && (
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <h4 className="font-medium text-blue-900 mb-2">AI Feedback:</h4>
                                        <p className="text-blue-800">{answer.analysis.feedback}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Interview Statistics */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Interview Statistics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-indigo-600">
                                {Math.floor((feedbackData?.duration || 0) / 60)}:{String((feedbackData?.duration || 0) % 60).padStart(2, '0')}
                            </div>
                            <div className="text-gray-600">Total Duration</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-indigo-600">{feedbackData?.answers?.length || 0}</div>
                            <div className="text-gray-600">Questions Answered</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-indigo-600">
                                {feedbackData?.answers?.reduce((sum, answer) => sum + (answer.answer?.split(' ').length || 0), 0) || 0}
                            </div>
                            <div className="text-gray-600">Total Words</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="text-center">
                    <button
                        onClick={() => navigate('/applicant/dashboard')}
                        className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg mr-4"
                    >
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center px-8 py-3 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 border border-gray-300 transform hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Download Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InterviewFeedback;
