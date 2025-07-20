import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";

const JobList = () => {
    const [jobs, setJobs] = useState([]);
    const [filteredJobs, setFilteredJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filters, setFilters] = useState({
        location: "",
        jobType: "",
        experience: "",
        skills: ""
    });
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState("grid"); // grid or list

    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                console.log("Fetching jobs from collection: jobsPosts");

                // Try to get all jobs without ordering first
                const jobsCollection = collection(db, "jobsPosts");
                let jobsQuery;

                try {
                    // Try with orderBy first
                    jobsQuery = query(jobsCollection, orderBy("createdAt", "desc"));
                } catch (indexError) {
                    // Fallback without orderBy
                    console.warn("Index not available, using simple query");
                    jobsQuery = jobsCollection;
                }

                const querySnapshot = await getDocs(jobsQuery);
                console.log("Found jobs:", querySnapshot.docs.length);

                const jobData = querySnapshot.docs.map((doc) => {
                    const data = doc.data();
                    console.log("Job data:", { id: doc.id, ...data });
                    return {
                        id: doc.id,
                        ...data,
                        // Ensure required fields have defaults
                        title: data.title || "Untitled Position",
                        company: data.company || data.companyName || "Company",
                        description: data.description || "No description available",
                        location: data.location || "Location not specified",
                        jobType: data.jobType || data.type || "Full-time",
                        experience: data.experience || data.experienceLevel || "Not specified",
                        salary: data.salary || "Competitive",
                        skills: Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : []),
                        createdAt: data.createdAt || new Date()
                    };
                });

                // Sort manually by createdAt if needed
                jobData.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                    return dateB - dateA;
                });

                setJobs(jobData);
                setFilteredJobs(jobData);
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

    // Filter and search jobs
    useEffect(() => {
        let filtered = jobs;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(job =>
                job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Location filter
        if (filters.location) {
            filtered = filtered.filter(job =>
                job.location.toLowerCase().includes(filters.location.toLowerCase())
            );
        }

        // Job type filter
        if (filters.jobType) {
            filtered = filtered.filter(job =>
                job.jobType.toLowerCase() === filters.jobType.toLowerCase()
            );
        }

        // Experience filter
        if (filters.experience) {
            filtered = filtered.filter(job =>
                job.experience.toLowerCase().includes(filters.experience.toLowerCase())
            );
        }

        // Skills filter
        if (filters.skills) {
            filtered = filtered.filter(job =>
                job.skills.some(skill =>
                    skill.toLowerCase().includes(filters.skills.toLowerCase())
                )
            );
        }

        setFilteredJobs(filtered);
    }, [jobs, searchTerm, filters]);

    const handleApply = (jobId) => {
        if (!user) {
            navigate("/login");
            return;
        }
        navigate(`/applicant/apply/${jobId}`);
    };

    const handleViewDetails = (jobId) => {
        navigate(`/job/${jobId}`);
    };

    const clearFilters = () => {
        setFilters({
            location: "",
            jobType: "",
            experience: "",
            skills: ""
        });
        setSearchTerm("");
    };

    const formatDate = (date) => {
        if (!date) return "Recently";
        const jobDate = date?.toDate ? date.toDate() : new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - jobDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
        return jobDate.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
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
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-indigo-700 mb-2">Browse Jobs</h1>
                <p className="text-gray-600">Find your perfect job opportunity</p>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by job title, company, or location..."
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                            </svg>
                            Filters
                        </button>

                        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`px-3 py-3 ${viewMode === "grid" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`px-3 py-3 ${viewMode === "list" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                                <input
                                    type="text"
                                    placeholder="Enter location"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={filters.location}
                                    onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={filters.jobType}
                                    onChange={(e) => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
                                >
                                    <option value="">All Types</option>
                                    <option value="full-time">Full-time</option>
                                    <option value="part-time">Part-time</option>
                                    <option value="contract">Contract</option>
                                    <option value="remote">Remote</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={filters.experience}
                                    onChange={(e) => setFilters(prev => ({ ...prev, experience: e.target.value }))}
                                >
                                    <option value="">All Levels</option>
                                    <option value="entry">Entry Level</option>
                                    <option value="junior">Junior</option>
                                    <option value="mid">Mid Level</option>
                                    <option value="senior">Senior</option>
                                    <option value="lead">Lead</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                                <input
                                    type="text"
                                    placeholder="Enter skill"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    value={filters.skills}
                                    onChange={(e) => setFilters(prev => ({ ...prev, skills: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Summary */}
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-600">
                    Showing {filteredJobs.length} of {jobs.length} jobs
                </p>
            </div>

            {/* Jobs Display */}
            {filteredJobs.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-gray-400 mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H6a2 2 0 00-2-2V6" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                    <p className="text-gray-600">Try adjusting your search criteria or check back later for new opportunities.</p>
                </div>
            ) : viewMode === "grid" ? (
                // Grid View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border border-gray-200"
                        >
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">{job.title}</h2>
                                <p className="text-indigo-600 font-medium text-sm mb-1">{job.company}</p>
                                <p className="text-gray-600 text-sm mb-3 line-clamp-3">{job.description}</p>
                            </div>

                            <div className="space-y-2 mb-4">
                                {job.location && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {job.location}
                                    </div>
                                )}

                                {job.jobType && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H6a2 2 0 00-2-2V6" />
                                        </svg>
                                        {job.jobType}
                                    </div>
                                )}

                                {job.salary && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        {job.salary}
                                    </div>
                                )}

                                <div className="flex items-center text-sm text-gray-500">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatDate(job.createdAt)}
                                </div>
                            </div>

                            {job.skills && job.skills.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex flex-wrap gap-1">
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

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleViewDetails(job.id)}
                                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
                                >
                                    View Details
                                </button>
                                <button
                                    onClick={() => handleApply(job.id)}
                                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
                                >
                                    Apply Now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // List View
                <div className="space-y-4">
                    {filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border border-gray-200"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-800 mb-1">{job.title}</h2>
                                            <p className="text-indigo-600 font-medium">{job.company}</p>
                                        </div>
                                        <span className="text-sm text-gray-500">{formatDate(job.createdAt)}</span>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{job.description}</p>

                                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                                        {job.location && (
                                            <div className="flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                {job.location}
                                            </div>
                                        )}
                                        {job.jobType && (
                                            <div className="flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H6a2 2 0 00-2-2V6" />
                                                </svg>
                                                {job.jobType}
                                            </div>
                                        )}
                                        {job.salary && (
                                            <div className="flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                {job.salary}
                                            </div>
                                        )}
                                    </div>

                                    {job.skills && job.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {job.skills.slice(0, 5).map((skill, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
                                                >
                                                    {typeof skill === 'string' ? skill.trim() : skill}
                                                </span>
                                            ))}
                                            {job.skills.length > 5 && (
                                                <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                                    +{job.skills.length - 5} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="ml-6 flex flex-col gap-2">
                                    <button
                                        onClick={() => handleViewDetails(job.id)}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm whitespace-nowrap"
                                    >
                                        View Details
                                    </button>
                                    <button
                                        onClick={() => handleApply(job.id)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm whitespace-nowrap"
                                    >
                                        Apply Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JobList;
