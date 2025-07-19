import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const JobList = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                console.log("Fetching jobs from collection: jobsPosts");

                // Try to get all jobs without ordering first
                const jobsCollection = collection(db, "jobsPosts");
                const querySnapshot = await getDocs(jobsCollection);

                console.log("Found jobs:", querySnapshot.docs.length);

                const jobData = querySnapshot.docs.map((doc) => {
                    const data = doc.data();
                    console.log("Job data:", { id: doc.id, ...data });
                    return {
                        id: doc.id,
                        ...data,
                    };
                });

                // Sort manually by createdAt if needed
                jobData.sort((a, b) => {
                    if (a.createdAt && b.createdAt) {
                        return b.createdAt.toDate() - a.createdAt.toDate();
                    }
                    return 0;
                });

                setJobs(jobData);
                setError(null);
            } catch (error) {
                console.error("Error fetching jobs:", error);
                setError("Failed to load jobs. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

    const handleApply = (jobId) => {
        if (!user) {
            navigate("/login");
            return;
        }
        navigate(`/applicant/apply/${jobId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="mt-2 text-indigo-600 font-semibold">Loading Jobs...</p>
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
                    <h3 className="text-lg font-medium text-red-900 mb-2">Error loading jobs</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-indigo-700 mb-2">Available Jobs</h1>
                <p className="text-gray-600">Find your perfect job opportunity ({jobs.length} jobs found)</p>
            </div>

            {jobs.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-gray-400 mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H6a2 2 0 00-2-2V6" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs available</h3>
                    <p className="text-gray-600">Check back later for new opportunities.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6"
                        >
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">{job.title || "Untitled Position"}</h2>
                                <p className="text-gray-600 text-sm mb-3 line-clamp-3">{job.description || "No description available"}</p>
                            </div>

                            <div className="space-y-2 mb-4">
                                {job.skills && Array.isArray(job.skills) && job.skills.length > 0 && (
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Skills:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {job.skills.slice(0, 3).map((skill, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
                                                >
                                                    {typeof skill === 'string' ? skill.trim() : skill}
                                                </span>
                                            ))}
                                            {job.skills.length > 3 && (
                                                <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                                    +{job.skills.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {job.location && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {job.location}
                                    </div>
                                )}

                                {job.experience && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H6a2 2 0 00-2-2V6" />
                                        </svg>
                                        {job.experience}
                                    </div>
                                )}

                                {job.createdAt && (
                                    <div className="flex items-center text-sm text-gray-500">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Posted {job.createdAt?.toDate
                                            ? job.createdAt.toDate().toLocaleDateString()
                                            : "N/A"}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleApply(job.id)}
                                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition font-medium"
                            >
                                Apply Now
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JobList;
