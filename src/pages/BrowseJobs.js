import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const BrowseJobs = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [locationFilter, setLocationFilter] = useState("");

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const jobsQuery = query(
                    collection(db, "jobs"),
                    orderBy("postedAt", "desc"),
                    limit(20)
                );
                const snapshot = await getDocs(jobsQuery);
                const jobsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setJobs(jobsData);
            } catch (error) {
                console.error("Error fetching jobs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

    const filteredJobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
    );

    const handleApply = (jobId) => {
        navigate(`/apply/${jobId}`);
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-indigo-600">Loading jobs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse Jobs</h1>

                {/* Search Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Search job titles..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                        type="text"
                        placeholder="Filter by location..."
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Jobs List */}
            <div className="space-y-6">
                {filteredJobs.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No jobs found matching your criteria.</p>
                    </div>
                ) : (
                    filteredJobs.map((job) => (
                        <div key={job.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{job.title}</h3>
                                    <p className="text-gray-600 mb-2">{job.company}</p>
                                    <div className="flex items-center space-x-4 mb-4">
                                        <span className="text-sm text-gray-500">📍 {job.location}</span>
                                        <span className="text-sm text-gray-500">💰 {job.salary}</span>
                                        <span className="text-sm text-gray-500">⏰ {job.jobType}</span>
                                    </div>
                                    <p className="text-gray-700 mb-4">{job.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {job.requirements?.slice(0, 3).map((req, index) => (
                                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                {req}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <button
                                        onClick={() => handleApply(job.id)}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium"
                                    >
                                        Apply Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BrowseJobs;