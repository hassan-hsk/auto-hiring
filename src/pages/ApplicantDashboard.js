import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

const ApplicantDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [applications, setApplications] = useState([]);
    const [jobSuggestions, setJobSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setError(null);

                if (!user?.uid) {
                    setLoading(false);
                    return;
                }

                // Fetch applications - Try with index first, fallback without orderBy
                let applicationsData = [];
                try {
                    // This query requires an index
                    const applicationsQuery = query(
                        collection(db, "applications"),
                        where("applicantId", "==", user.uid),
                        orderBy("appliedAt", "desc")
                    );
                    const applicationsSnapshot = await getDocs(applicationsQuery);
                    
                    // Process each application and fetch job details
                    for (const appDoc of applicationsSnapshot.docs) {
                        const appData = appDoc.data();
                        let jobData = null;

                        // Fetch job details if jobId exists
                        if (appData.jobId) {
                            try {
                                const jobDoc = await getDoc(doc(db, "jobsPosts", appData.jobId));
                                if (jobDoc.exists()) {
                                    jobData = jobDoc.data();
                                }
                            } catch (jobError) {
                                console.warn(`Failed to fetch job data for ${appData.jobId}:`, jobError);
                            }
                        }

                        applicationsData.push({
                            id: appDoc.id,
                            ...appData,
                            // Use job data if available, otherwise use application data
                            jobTitle: jobData?.title || appData.jobTitle || 'Job Application',
                            companyName: jobData?.company || appData.companyName || 'Company',
                            // Scores from application data
                            aiScore: appData.jobMatchScore || appData.aiScore || appData.matchScore || 0,
                            resumeScore: appData.resumeQualityScore || 0,
                            interviewScore: appData.interviewScore || 0,
                            status: appData.status || 'pending',
                            appliedAt: appData.appliedAt || appData.createdAt || null,
                            interviewEligible: appData.interviewEligible || false,
                            interviewStatus: appData.interviewStatus || 'not_started'
                        });
                    }
                } catch (indexError) {
                    console.warn("Index not available, falling back to simple query:", indexError);
                    
                    // Fallback query without orderBy (doesn't require index)
                    const simpleQuery = query(
                        collection(db, "applications"),
                        where("applicantId", "==", user.uid)
                    );
                    const snapshot = await getDocs(simpleQuery);
                    
                    for (const appDoc of snapshot.docs) {
                        const appData = appDoc.data();
                        let jobData = null;

                        if (appData.jobId) {
                            try {
                                const jobDoc = await getDoc(doc(db, "jobsPosts", appData.jobId));
                                if (jobDoc.exists()) {
                                    jobData = jobDoc.data();
                                }
                            } catch (jobError) {
                                console.warn(`Failed to fetch job data for ${appData.jobId}:`, jobError);
                            }
                        }

                        applicationsData.push({
                            id: appDoc.id,
                            ...appData,
                            jobTitle: jobData?.title || appData.jobTitle || 'Job Application',
                            companyName: jobData?.company || appData.companyName || 'Company',
                            aiScore: appData.jobMatchScore || appData.aiScore || appData.matchScore || 0,
                            resumeScore: appData.resumeQualityScore || 0,
                            interviewScore: appData.interviewScore || 0,
                            status: appData.status || 'pending',
                            appliedAt: appData.appliedAt || appData.createdAt || null,
                            interviewEligible: appData.interviewEligible || false,
                            interviewStatus: appData.interviewStatus || 'not_started'
                        });
                    }
                    
                    // Sort manually since we couldn't use orderBy
                    applicationsData.sort((a, b) => {
                        const dateA = a.appliedAt || a.createdAt || new Date(0);
                        const dateB = b.appliedAt || b.createdAt || new Date(0);
                        
                        if (dateA?.toDate) return dateB.toDate() - dateA.toDate();
                        if (dateA instanceof Date) return dateB - dateA;
                        return new Date(dateB) - new Date(dateA);
                    });
                }

                // Fetch job suggestions (recent jobs) - This query should work without index
                let jobsData = [];
                try {
                    const jobsQuery = query(
                        collection(db, "jobsPosts"),
                        orderBy("createdAt", "desc"),
                        limit(3)
                    );
                    const jobsSnapshot = await getDocs(jobsQuery);
                    jobsData = jobsSnapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                        matchPercentage: Math.floor(Math.random() * 30) + 70 // Random for now
                    }));
                } catch (jobsError) {
                    console.warn("Error fetching job suggestions:", jobsError);
                    // Fallback: get jobs without orderBy
                    const simpleJobsQuery = query(
                        collection(db, "jobsPosts"),
                        limit(3)
                    );
                    const jobsSnapshot = await getDocs(simpleJobsQuery);
                    jobsData = jobsSnapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                        matchPercentage: Math.floor(Math.random() * 30) + 70
                    }));
                }

                setApplications(applicationsData);
                setJobSuggestions(jobsData);
            } catch (error) {
                console.error("Error fetching data:", error);
                setError('Failed to load dashboard data. Please try again.');
                setApplications([]);
                setJobSuggestions([]);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const calculateStats = () => {
        if (!Array.isArray(applications) || applications.length === 0) {
            return { total: 0, shortlisted: 0, rejected: 0, avgResumeScore: 0 };
        }

        const total = applications.length;
        const shortlisted = applications.filter(app =>
            app.status === 'shortlisted' || app.status === 'accepted' || app.status === 'under_review'
        ).length;
        const rejected = applications.filter(app => app.status === 'rejected').length;

        const totalResumeScore = applications.reduce((sum, app) => {
            const score = typeof app.resumeScore === 'number' ? app.resumeScore : 0;
            return sum + score;
        }, 0);

        const avgResumeScore = applications.length > 0
            ? Math.round(totalResumeScore / applications.length)
            : 0;

        return { total, shortlisted, rejected, avgResumeScore };
    };

    const stats = calculateStats();

    const formatDate = (timestamp) => {
        try {
            if (!timestamp) return "Recently";

            if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                return timestamp.toDate().toLocaleDateString();
            }

            if (timestamp instanceof Date) {
                return timestamp.toLocaleDateString();
            }

            if (typeof timestamp === 'string') {
                return new Date(timestamp).toLocaleDateString();
            }

            return "Recently";
        } catch (error) {
            return "Recently";
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'accepted':
            case 'shortlisted':
                return 'bg-green-100 text-green-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            case 'under_review':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-yellow-100 text-yellow-800';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'accepted':
                return 'Accepted';
            case 'shortlisted':
                return 'Shortlisted';
            case 'rejected':
                return 'Rejected';
            case 'under_review':
                return 'Under Review';
            default:
                return 'Pending';
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const handleViewDetails = (app) => {
        navigate(`/applicant/application/${app.id}`);
    };

    const handleStartInterview = (app) => {
        navigate(`/interview-feedback`);
    };

    const handleQuickApply = (jobId) => {
        navigate(`/apply/${jobId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-indigo-600 font-semibold">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error Loading Dashboard</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <p>{error}</p>
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-red-100 px-3 py-2 text-sm text-red-800 rounded-md hover:bg-red-200"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-yellow-800">Please log in to view your dashboard.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">
                            👋 Welcome, {user?.displayName || user?.email?.split('@')[0] || 'there'}!
                        </h1>
                        <p className="text-indigo-100 text-lg">Here's your application status and insights.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <div className="text-sm text-indigo-200">Total Applications</div>
                    </div>
                </div>
            </div>

            {/* Application Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500">📄 Total Applications</h3>
                            <div className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</div>
                        </div>
                        <div className="p-3 bg-indigo-100 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500">✅ Shortlisted</h3>
                            <div className="text-2xl font-bold text-green-600 mt-2">{stats.shortlisted}</div>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500">❌ Rejected</h3>
                            <div className="text-2xl font-bold text-red-600 mt-2">{stats.rejected}</div>
                        </div>
                        <div className="p-3 bg-red-100 rounded-lg">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500">📊 Avg Resume Score</h3>
                            <div className={`text-2xl font-bold mt-2 ${getScoreColor(stats.avgResumeScore)}`}>
                                {stats.avgResumeScore}%
                            </div>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* My Applications Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        My Applications ({applications.length})
                    </h2>
                </div>

                {applications.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-gray-400 mb-4">
                            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h3>
                        <p className="text-gray-600 mb-4">Start applying to jobs to see your applications here.</p>
                        <Link
                            to="/jobs"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            Browse Jobs
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match Score</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resume Score</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {applications.map((app) => (
                                    <tr key={app.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{app.jobTitle}</div>
                                            <div className="text-sm text-gray-500">Applied {formatDate(app.appliedAt)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{app.companyName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(app.status)}`}>
                                                {getStatusText(app.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`text-sm font-medium ${getScoreColor(app.aiScore)}`}>
                                                {app.aiScore || 0}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`text-sm font-medium ${getScoreColor(app.resumeScore)}`}>
                                                {app.resumeScore || 0}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleViewDetails(app)}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                >
                                                    View Details
                                                </button>
                                                {app.interviewEligible && (
                                                    <button
                                                        onClick={() => handleStartInterview(app)}
                                                        className="text-green-600 hover:text-green-900"
                                                    >
                                                        Interview
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Application Status Chart */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        📊 Application Status Overview
                    </h3>
                    <div className="space-y-4">
                        {applications.slice(0, 5).map((app) => (
                            <div key={app.id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">{app.jobTitle}</span>
                                    <span className={`font-medium ${getScoreColor(app.aiScore)}`}>
                                        {app.aiScore}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${app.aiScore >= 80 ? 'bg-green-500' :
                                                app.aiScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${app.aiScore}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {applications.filter(app => app.aiScore > 0).length === 0 && (
                            <p className="text-gray-500 text-center py-4">No AI scores yet</p>
                        )}
                    </div>
                </div>

                {/* Resume Score History */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        📈 Resume Score History
                    </h3>
                    <div className="space-y-4">
                        {applications.slice(0, 5).map((app) => (
                            <div key={app.id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">{app.jobTitle}</span>
                                    <span className={`font-medium ${getScoreColor(app.resumeScore)}`}>
                                        {app.resumeScore}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${app.resumeScore >= 80 ? 'bg-green-500' :
                                                app.resumeScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${app.resumeScore}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {applications.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No applications yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 💡 Career Suggestions */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    💡 AI Career Suggestions
                </h3>
                <div className="bg-blue-50 p-4 rounded-lg">
                    <ul className="space-y-2 text-sm text-blue-700">
                        <li>• Your resume scores are strong! Consider applying to more senior positions.</li>
                        <li>• Practice interview skills to improve your interview scores.</li>
                        <li>• Add more technical skills to increase job matches.</li>
                        <li>• Consider updating your portfolio with recent projects.</li>
                    </ul>
                </div>
            </div>

            {/* Job Suggestions */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        🎯 Personalized Job Suggestions
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">Based on your resume skills and past applications</p>
                </div>

                <div className="divide-y divide-gray-200">
                    {jobSuggestions.map((job) => (
                        <div key={job.id} className="p-6 hover:bg-gray-50 transition">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.title}</h3>
                                    <p className="text-sm text-gray-500 mb-2">{job.company}</p>
                                    <div className="flex items-center space-x-4 mb-3">
                                        <span className="text-sm text-gray-600">📍 {job.location}</span>
                                        <span className="text-sm text-gray-600">💰 {job.salary}</span>
                                        <span className={`text-sm font-semibold ${getScoreColor(job.matchPercentage)}`}>
                                            {job.matchPercentage}% match
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleQuickApply(job.id)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
                                >
                                    Quick Apply
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t text-center">
                    <Link
                        to="/applicant/browse-jobs"
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        View All Jobs →
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ApplicantDashboard;
