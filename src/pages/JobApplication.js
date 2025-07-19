import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";

const JobApplication = () => {
    const { jobId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [coverLetter, setCoverLetter] = useState("");

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const jobDoc = await getDoc(doc(db, "jobs", jobId));
                if (jobDoc.exists()) {
                    setJob({ id: jobDoc.id, ...jobDoc.data() });
                }
            } catch (error) {
                console.error("Error fetching job:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchJob();
    }, [jobId]);

    const handleApply = async () => {
        if (!user || !job) return;

        setApplying(true);
        try {
            const applicationRef = doc(collection(db, "applications"));
            await setDoc(applicationRef, {
                applicantId: user.uid,
                jobId: job.id,
                jobTitle: job.title,
                companyName: job.company,
                coverLetter: coverLetter,
                appliedAt: new Date(),
                status: "pending",
                resumeScore: Math.floor(Math.random() * 30) + 70, // Mock score
                interviewScore: 0,
                interviewEligible: false
            });

            navigate("/applicant/dashboard");
        } catch (error) {
            console.error("Error submitting application:", error);
        } finally {
            setApplying(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-indigo-600">Loading job details...</p>
                </div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center">
                    <p className="text-red-600">Job not found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
                <p className="text-xl text-gray-600 mb-6">{job.company}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center">
                        <span className="text-gray-500">📍 {job.location}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-gray-500">💰 {job.salary}</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-gray-500">⏰ {job.jobType}</span>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">Job Description</h3>
                    <p className="text-gray-700">{job.description}</p>
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">Requirements</h3>
                    <ul className="list-disc list-inside text-gray-700">
                        {job.requirements?.map((req, index) => (
                            <li key={index}>{req}</li>
                        ))}
                    </ul>
                </div>

                <div className="mb-6">
                    <label htmlFor="coverLetter" className="block text-lg font-semibold mb-2">
                        Cover Letter
                    </label>
                    <textarea
                        id="coverLetter"
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Write a brief cover letter explaining why you're interested in this position..."
                        className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex space-x-4">
                    <button
                        onClick={handleApply}
                        disabled={applying || !coverLetter.trim()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {applying ? "Submitting..." : "Submit Application"}
                    </button>
                    <button
                        onClick={() => navigate("/applicant/browse-jobs")}
                        className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                        Back to Jobs
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobApplication;