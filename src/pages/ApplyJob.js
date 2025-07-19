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
    setDoc
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

    const handleInterview = () => {
        if (applicationId) {
            navigate(`/applicant/interview/${applicationId}`);
        } else {
            alert("Please apply first to access the interview");
        }
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
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <button
                    onClick={() => navigate("/jobs")}
                    className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                    ← Back to Jobs
                </button>
                <h1 className="text-3xl font-bold text-indigo-700 mb-2">Apply for {job.title}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Job Details */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Job Details</h2>

                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-gray-700">Company</h3>
                                <p className="text-gray-600 mt-1">{job.company || 'Company Name'}</p>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-700">Description</h3>
                                <p className="text-gray-600 mt-1">{job.description}</p>
                            </div>

                            {job.skills && job.skills.length > 0 && (
                                <div>
                                    <h3 className="font-medium text-gray-700">Required Skills</h3>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {job.skills.map((skill, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full"
                                            >
                                                {typeof skill === 'string' ? skill.trim() : skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {job.experience && (
                                <div>
                                    <h3 className="font-medium text-gray-700">Experience Required</h3>
                                    <p className="text-gray-600 mt-1">{job.experience}</p>
                                </div>
                            )}

                            {job.location && (
                                <div>
                                    <h3 className="font-medium text-gray-700">Location</h3>
                                    <p className="text-gray-600 mt-1">{job.location}</p>
                                </div>
                            )}

                            {job.salary && (
                                <div>
                                    <h3 className="font-medium text-gray-700">Salary</h3>
                                    <p className="text-gray-600 mt-1">{job.salary}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Application Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Submit Application</h2>

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
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                        <div className="text-sm text-blue-700 mb-1">Your Match Score</div>
                                        <div className="text-2xl font-bold text-blue-600">{aiResults.jobMatchScore}%</div>
                                        <div className="text-xs text-blue-600">Resume Quality: {aiResults.resumeQualityScore}%</div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <button
                                        onClick={() => navigate("/applicant/dashboard")}
                                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                                    >
                                        View My Applications
                                    </button>

                                    {/* Interview Button - Show if eligible */}
                                    {aiResults?.jobMatchScore >= 60 && (
                                        <button
                                            onClick={handleInterview}
                                            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center justify-center"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Start Interview
                                        </button>
                                    )}

                                    <button
                                        onClick={() => navigate(`/applicant/profile`)}
                                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
                                    >
                                        View Your Profile
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleApply} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Upload Resume (PDF only)
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setResume(e.target.files[0])}
                                        required
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        🤖 AI will analyze your resume and auto-update your profile
                                    </p>
                                </div>

                                {/* Processing Status */}
                                {processing && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                        <div className="flex items-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                            <span className="text-sm text-blue-700">
                                                AI is analyzing your resume and updating your profile...
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={processing || !resume}
                                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
                                >
                                    {processing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            AI Processing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Apply with AI Analysis
                                        </>
                                    )}
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    Your resume will be analyzed and your profile automatically updated with extracted information.
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplyJob;
