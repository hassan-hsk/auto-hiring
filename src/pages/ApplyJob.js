// File: src/pages/ApplyJob.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import {
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { processResumeForJob } from "./ResumeExtractor";

const ApplyJob = () => {
    const { jobId } = useParams();
    const { user } = useAuth();
    const [job, setJob] = useState(null);
    const [resume, setResume] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alreadyApplied, setAlreadyApplied] = useState(false);
    const [applicationId, setApplicationId] = useState(null);
    const [aiResults, setAiResults] = useState(null);
    const [activeTab, setActiveTab] = useState('details');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobAndCheckApplication = async () => {
            try {
                console.log("Fetching job with ID:", jobId);

                // Fetch job from correct collection
                const docRef = doc(db, "jobsPosts", jobId);
                const jobSnap = await getDoc(docRef);

                if (jobSnap.exists()) {
                    const jobData = { id: jobSnap.id, ...jobSnap.data() };
                    setJob(jobData);
                    console.log("Job found:", jobData);

                    // Check if user already applied
                    if (user) {
                        const q = query(
                            collection(db, "applications"),
                            where("applicantId", "==", user.uid),
                            where("jobId", "==", jobId)
                        );
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            setAlreadyApplied(true);
                            const application = querySnapshot.docs[0];
                            setApplicationId(application.id);
                            // Get the AI results from the existing application
                            const appData = application.data();
                            if (appData.extractedData) {
                                setAiResults({
                                    jobMatchScore: appData.jobMatchScore || 0,
                                    resumeQualityScore: appData.resumeQualityScore || 0,
                                    extractedData: appData.extractedData
                                });
                            }
                        }
                    }
                } else {
                    setError("Job not found");
                }
            } catch (error) {
                console.error("Error fetching job:", error);
                setError("Failed to load job details");
            } finally {
                setLoading(false);
            }
        };

        if (jobId) {
            fetchJobAndCheckApplication();
        }
    }, [jobId, user]);

    const handleApply = async (e) => {
        e.preventDefault();
        if (!resume || !user || !job) {
            alert("Please select a resume file");
            return;
        }

        if (alreadyApplied) {
            alert("You have already applied for this job");
            return;
        }

        try {
            setProcessing(true);
            console.log("Starting AI-powered application process...");

            // Use ResumeExtractor to process the resume
            const resumeAnalysis = await processResumeForJob(resume, job);
            setAiResults(resumeAnalysis);

            console.log("Resume analysis completed:", resumeAnalysis);

            // Create application with AI analysis
            const applicationData = {
                applicantId: user.uid,
                jobId: job.id,
                jobTitle: job.title,
                status: "pending",
                appliedAt: serverTimestamp(),
                applicantEmail: user.email,
                companyName: job.company || "N/A",

                // Resume data (no file storage)
                resumeFileName: resume.name,
                resumeSize: resume.size,
                resumeType: resume.type,
                resumeText: resumeAnalysis.resumeText,

                // AI analysis results
                extractedData: resumeAnalysis.extractedData,
                resumeQualityScore: resumeAnalysis.resumeQualityScore,
                jobMatchScore: resumeAnalysis.jobMatchScore,
                analysis: resumeAnalysis.analysis,

                // Interview readiness
                interviewEligible: resumeAnalysis.jobMatchScore >= 60,
                interviewStatus: "not_started",

                // Metadata
                processedAt: serverTimestamp(),
                extractionMethod: "ai_powered_extractor"
            };

            console.log("Saving application to database...");
            const docRef = await addDoc(collection(db, "applications"), applicationData);
            setApplicationId(docRef.id);
            setAlreadyApplied(true);
            console.log("Application saved with ID:", docRef.id);

            alert(`Application submitted successfully! 
AI Match Score: ${resumeAnalysis.jobMatchScore}% 
Resume Quality: ${resumeAnalysis.resumeQualityScore}%
${resumeAnalysis.jobMatchScore >= 60 ? '\n✅ You are eligible for an interview!' : ''}`);

        } catch (error) {
            console.error("Error processing application:", error);
            alert(`Failed to submit application: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleStartInterview = () => {
        if (applicationId) {
            navigate(`/applicant/ai-interview?applicationId=${applicationId}`);
        } else {
            alert("Please apply first to access the interview");
        }
    };

    const formatSalary = (salary) => {
        if (!salary) return "Competitive";
        if (typeof salary === 'string') return salary;
        if (typeof salary === 'number') return `$${salary.toLocaleString()}`;
        return "Competitive";
    };

    const formatDate = (date) => {
        if (!date) return "Recently";
        const jobDate = date?.toDate ? date.toDate() : new Date(date);
        return jobDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-indigo-600 font-semibold">Loading Job Details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-400 mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-red-900 mb-2">Error</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => navigate("/jobs")}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                        Back to Jobs
                    </button>
                </div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Job not found</h3>
                    <button
                        onClick={() => navigate("/jobs")}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                        Back to Jobs
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate("/jobs")}
                        className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center group"
                    >
                        <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Jobs
                    </button>

                    {/* Job Header */}
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mr-4">
                                        <span className="text-white font-bold text-lg">
                                            {(job.company || 'C').charAt(0).toUpperCase()
                                            }</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-indigo-600">{job.company || 'Company Name'}</h2>
                                        <div className="flex items-center text-gray-600 mt-1">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {job.location || 'Location not specified'}
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="flex flex-wrap gap-4 text-sm">
                                    <div className="flex items-center bg-green-50 px-3 py-1 rounded-full">
                                        <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        <span className="text-green-700 font-medium">{formatSalary(job.salary)}</span>
                                    </div>

                                    {job.jobType && (
                                        <div className="flex items-center bg-blue-50 px-3 py-1 rounded-full">
                                            <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H6a2 2 0 00-2-2V6" />
                                            </svg>
                                            <span className="text-blue-700 font-medium capitalize">{job.jobType}</span>
                                        </div>
                                    )}

                                    {job.experience && (
                                        <div className="flex items-center bg-purple-50 px-3 py-1 rounded-full">
                                            <svg className="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            <span className="text-purple-700 font-medium">{job.experience}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center bg-gray-50 px-3 py-1 rounded-full">
                                        <svg className="w-4 h-4 mr-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-gray-700">Posted {formatDate(job.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Application Status Badge */}
                            {alreadyApplied && (
                                <div className="ml-6 flex flex-col items-end">
                                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-2">
                                        ✅ Applied
                                    </div>
                                    {aiResults && (
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-indigo-600">{aiResults.jobMatchScore}%</div>
                                            <div className="text-xs text-gray-500">Match Score</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Tab Navigation */}
                        <div className="bg-white rounded-lg shadow-md mb-6">
                            <div className="border-b border-gray-200">
                                <nav className="-mb-px flex">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'details'
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        Job Details
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('company')}
                                        className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'company'
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        Company
                                    </button>
                                    {alreadyApplied && aiResults && (
                                        <button
                                            onClick={() => setActiveTab('analysis')}
                                            className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'analysis'
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                }`}
                                        >
                                            AI Analysis
                                        </button>
                                    )}
                                </nav>
                            </div>

                            <div className="p-6">
                                {/* Job Details Tab */}
                                {activeTab === 'details' && (
                                    <div className="space-y-6">
                                        {/* Job Description */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
                                            <div className="prose max-w-none">
                                                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                                    {job.description || 'No description provided.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Required Skills */}
                                        {job.skills && job.skills.length > 0 && (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Skills & Technologies</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {job.skills.map((skill, index) => (
                                                        <span
                                                            key={index}
                                                            className="px-4 py-2 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-lg hover:bg-indigo-200 transition-colors"
                                                        >
                                                            {typeof skill === 'string' ? skill.trim() : skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Requirements */}
                                        {(job.requirements || job.experience) && (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
                                                <ul className="space-y-2">
                                                    {job.experience && (
                                                        <li className="flex items-start">
                                                            <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="text-gray-700">{job.experience} experience required</span>
                                                        </li>
                                                    )}
                                                    {job.requirements && typeof job.requirements === 'string' && (
                                                        <li className="flex items-start">
                                                            <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="text-gray-700">{job.requirements}</span>
                                                        </li>
                                                    )}
                                                    {Array.isArray(job.requirements) && job.requirements.map((req, index) => (
                                                        <li key={index} className="flex items-start">
                                                            <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="text-gray-700">{req}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Benefits */}
                                        {job.benefits && (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Benefits & Perks</h3>
                                                <div className="text-gray-700">
                                                    {typeof job.benefits === 'string' ? (
                                                        <p>{job.benefits}</p>
                                                    ) : Array.isArray(job.benefits) ? (
                                                        <ul className="space-y-1">
                                                            {job.benefits.map((benefit, index) => (
                                                                <li key={index} className="flex items-center">
                                                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    {benefit}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : null}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Company Tab */}
                                {activeTab === 'company' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-3">About {job.company}</h3>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-gray-700">
                                                    {job.companyDescription || job.companyOverview ||
                                                        `${job.company} is a leading company in their industry, committed to innovation and excellence. Join our team to be part of exciting projects and career growth opportunities.`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Company Stats */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-blue-600">500+</div>
                                                <div className="text-sm text-blue-700">Employees</div>
                                            </div>
                                            <div className="bg-green-50 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-green-600">2019</div>
                                                <div className="text-sm text-green-700">Founded</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-purple-600">Global</div>
                                                <div className="text-sm text-purple-700">Presence</div>
                                            </div>
                                            <div className="bg-orange-50 rounded-lg p-4 text-center">
                                                <div className="text-2xl font-bold text-orange-600">A+</div>
                                                <div className="text-sm text-orange-700">Rating</div>
                                            </div>
                                        </div>

                                        {/* Company Culture */}
                                        <div>
                                            <h4 className="font-semibold text-gray-900 mb-2">Company Culture</h4>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Innovation</span>
                                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Work-Life Balance</span>
                                                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">Remote Friendly</span>
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">Growth Opportunities</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* AI Analysis Tab */}
                                {activeTab === 'analysis' && alreadyApplied && aiResults && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Resume Analysis</h3>

                                            {/* Scores */}
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div className="bg-indigo-50 rounded-lg p-4">
                                                    <div className="text-2xl font-bold text-indigo-600">{aiResults.jobMatchScore}%</div>
                                                    <div className="text-sm text-indigo-700">Job Match Score</div>
                                                </div>
                                                <div className="bg-green-50 rounded-lg p-4">
                                                    <div className="text-2xl font-bold text-green-600">{aiResults.resumeQualityScore}%</div>
                                                    <div className="text-sm text-green-700">Resume Quality</div>
                                                </div>
                                            </div>

                                            {/* Analysis Details */}
                                            {aiResults.analysis && (
                                                <div className="bg-gray-50 rounded-lg p-4">
                                                    <h4 className="font-semibold text-gray-900 mb-2">Detailed Analysis</h4>
                                                    <p className="text-gray-700 text-sm">{aiResults.analysis}</p>
                                                </div>
                                            )}

                                            {/* Extracted Data Preview */}
                                            {aiResults.extractedData && (
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 mb-2">Extracted Information</h4>
                                                    <div className="bg-white border rounded-lg p-4">
                                                        {aiResults.extractedData.personalInfo?.name && (
                                                            <p><strong>Name:</strong> {aiResults.extractedData.personalInfo.name}</p>
                                                        )}
                                                        {aiResults.extractedData.personalInfo?.email && (
                                                            <p><strong>Email:</strong> {aiResults.extractedData.personalInfo.email}</p>
                                                        )}
                                                        {aiResults.extractedData.skills && (
                                                            <div className="mt-2">
                                                                <strong>Skills:</strong>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {aiResults.extractedData.skills.slice(0, 10).map((skill, index) => (
                                                                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                                            {skill}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Application Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Apply for this Job</h2>

                            {alreadyApplied ? (
                                <div className="text-center py-4">
                                    <div className="text-green-400 mb-4">
                                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Application Submitted!</h3>
                                    <p className="text-gray-600 mb-4">You have successfully applied for this job.</p>

                                    {/* Show match score if available */}
                                    {aiResults && (
                                        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                                            <div className="text-sm text-blue-700 mb-1">Your Scores</div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div>
                                                    <div className="text-xl font-bold text-blue-600">{aiResults.jobMatchScore}%</div>
                                                    <div className="text-xs text-blue-600">Job Match</div>
                                                </div>
                                                <div>
                                                    <div className="text-xl font-bold text-green-600">{aiResults.resumeQualityScore}%</div>
                                                    <div className="text-xs text-green-600">Resume Quality</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {/* Interview Button - Show if eligible */}
                                        {aiResults?.jobMatchScore >= 60 && (
                                            <button
                                                onClick={handleStartInterview}
                                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center font-medium"
                                            >
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Start AI Interview
                                            </button>
                                        )}

                                        <button
                                            onClick={() => navigate("/applicant/dashboard")}
                                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                                        >
                                            View My Applications
                                        </button>

                                        <button
                                            onClick={() => navigate("/jobs")}
                                            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                                        >
                                            Browse More Jobs
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleApply} className="space-y-4">
                                    {/* Resume Upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Upload Resume
                                        </label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-indigo-400 transition-colors">
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx"
                                                onChange={(e) => setResume(e.target.files[0])}
                                                required
                                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                            />
                                            <p className="text-xs text-gray-500 mt-2">
                                                📄 Supported: PDF, DOC, DOCX (Max 10MB)
                                            </p>
                                        </div>
                                        <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                                            <p className="text-xs text-blue-700">
                                                🤖 <strong>AI-Powered Analysis:</strong> Our AI will analyze your resume, extract key information, and calculate your job match score automatically.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Processing Status */}
                                    {processing && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                                                <div>
                                                    <div className="text-sm font-medium text-blue-700">Processing your application...</div>
                                                    <div className="text-xs text-blue-600">AI is analyzing your resume and calculating match scores</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={processing || !resume}
                                        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center transition-colors"
                                    >
                                        {processing ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                AI Processing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Submit Application
                                            </>
                                        )}
                                    </button>

                                    <div className="text-center">
                                        <p className="text-xs text-gray-500">
                                            By submitting, you agree to our terms and privacy policy. Your resume will be processed with AI to enhance your application.
                                        </p>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Additional Info Card */}
                        <div className="bg-gray-50 rounded-lg p-4 mt-6">
                            <h3 className="font-semibold text-gray-900 mb-2">💡 Application Tips</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Ensure your resume highlights relevant skills</li>
                                <li>• Include specific achievements and metrics</li>
                                <li>• Match keywords from the job description</li>
                                <li>• A 60%+ match score makes you interview eligible</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplyJob;
