import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { useNavigate, Link } from "react-router-dom";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "firebase/firestore";

const RecruiterDashboard = () => {
    const { user, role } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState("applications");
    const [jobPosts, setJobPosts] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    // Redirect if not a recruiter
    useEffect(() => {
        if (!user) {
            navigate("/login");
            return;
        }
        if (role && role !== "recruiter") {
            navigate("/");
            return;
        }
    }, [user, role, navigate]);

    useEffect(() => {
        if (!user) return;

        const fetchJobsAndApplications = async () => {
            setLoading(true);
            try {
                console.log("Fetching jobs for user:", user.uid);

                // Fetch jobs posted by the current recruiter
                // Try both field names for compatibility
                const jobQuery1 = query(
                    collection(db, "jobsPosts"),
                    where("postedBy", "==", user.uid)
                );

                const jobQuery2 = query(
                    collection(db, "jobsPosts"),
                    where("recruiterId", "==", user.uid)
                );

                const [jobSnap1, jobSnap2] = await Promise.all([
                    getDocs(jobQuery1),
                    getDocs(jobQuery2)
                ]);

                // Combine results and remove duplicates
                const allJobs = [];
                const seenIds = new Set();

                [...jobSnap1.docs, ...jobSnap2.docs].forEach(doc => {
                    if (!seenIds.has(doc.id)) {
                        seenIds.add(doc.id);
                        allJobs.push({ id: doc.id, ...doc.data() });
                    }
                });

                // Sort manually by createdAt
                allJobs.sort((a, b) => {
                    if (a.createdAt && b.createdAt) {
                        return b.createdAt.toDate() - a.createdAt.toDate();
                    }
                    return 0;
                });

                console.log("Jobs found:", allJobs.length);
                setJobPosts(allJobs);

                // Fetch applications for these jobs
                if (allJobs.length > 0) {
                    const jobIds = allJobs.map(job => job.id);

                    try {
                        const appQuery = query(
                            collection(db, "applications"),
                            where("jobId", "in", jobIds)
                        );
                        const appSnap = await getDocs(appQuery);
                        const apps = appSnap.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        // Sort by application date (newest first)
                        apps.sort((a, b) => {
                            const dateA = a.appliedAt?.toDate ? a.appliedAt.toDate() : new Date(a.appliedAt || 0);
                            const dateB = b.appliedAt?.toDate ? b.appliedAt.toDate() : new Date(b.appliedAt || 0);
                            return dateB - dateA;
                        });

                        console.log("Applications found:", apps.length);
                        setApplications(apps);
                    } catch (appError) {
                        console.error("Error fetching applications:", appError);
                        setApplications([]);
                    }
                } else {
                    setApplications([]);
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchJobsAndApplications();
    }, [user]);

    const formatDate = (timestamp) => {
        if (!timestamp) return "N/A";
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString();
        } catch {
            return "Invalid date";
        }
    };

    const getStatusBadge = (status) => {
        const baseClasses = "inline-flex px-2 py-1 text-xs font-semibold rounded-full";
        switch (status) {
            case 'accepted':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'rejected':
                return `${baseClasses} bg-red-100 text-red-800`;
            case 'pending':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return "text-green-600 font-semibold";
        if (score >= 60) return "text-yellow-600 font-semibold";
        return "text-red-600 font-semibold";
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-indigo-600 font-semibold">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-indigo-700">Recruiter Dashboard</h1>
                    <p className="text-gray-600 mt-1">Manage your job postings and review applications</p>
                </div>
                <Link
                    to="/recruiter/post-job"
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-medium shadow-md flex items-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Post New Job
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <div className="text-2xl font-bold text-gray-900">{jobPosts.length}</div>
                            <div className="text-sm text-gray-600">Posted Jobs</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <div className="text-2xl font-bold text-gray-900">
                                {applications.filter(app => app.status === 'pending' || !app.status).length}
                            </div>
                            <div className="text-sm text-gray-600">Pending</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <div className="text-2xl font-bold text-gray-900">
                                {applications.filter(app => app.status === 'accepted').length}
                            </div>
                            <div className="text-sm text-gray-600">Accepted</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
                            <div className="text-sm text-gray-600">Total Applications</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex space-x-4 border-b">
                <button
                    onClick={() => setTab("applications")}
                    className={`px-4 py-2 border-b-2 transition ${tab === "applications"
                        ? "border-indigo-600 text-indigo-600 font-semibold"
                        : "border-transparent text-gray-600 hover:text-indigo-600"
                        }`}
                >
                    Applications ({applications.length})
                </button>
                <button
                    onClick={() => setTab("jobs")}
                    className={`px-4 py-2 border-b-2 transition ${tab === "jobs"
                        ? "border-indigo-600 text-indigo-600 font-semibold"
                        : "border-transparent text-gray-600 hover:text-indigo-600"
                        }`}
                >
                    My Jobs ({jobPosts.length})
                </button>
            </div>

            {/* Applications Tab */}
            {tab === "applications" && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {applications.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-gray-400 mb-4">
                                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h3>
                            <p className="text-gray-600">
                                {jobPosts.length === 0
                                    ? "Post your first job to start receiving applications."
                                    : "Applications will appear here once candidates apply to your jobs."
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Scores</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {applications.map((app, index) => (
                                        <tr key={app.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {app.extractedData?.personalInfo?.name || "Unknown Applicant"}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {app.applicantEmail}
                                                    </div>
                                                    {app.extractedData?.personalInfo?.phone && (
                                                        <div className="text-xs text-gray-400">
                                                            {app.extractedData.personalInfo.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {app.jobTitle}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={getStatusBadge(app.status)}>
                                                    {app.status?.charAt(0).toUpperCase() + app.status?.slice(1) || "Pending"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(app.appliedAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="space-y-1">
                                                    {app.jobMatchScore ? (
                                                        <div className={getScoreColor(app.jobMatchScore)}>
                                                            Match: {app.jobMatchScore}%
                                                        </div>
                                                    ) : null}
                                                    {app.resumeQualityScore ? (
                                                        <div className="text-blue-600 font-medium">
                                                            Quality: {app.resumeQualityScore}%
                                                        </div>
                                                    ) : null}
                                                    {!app.jobMatchScore && !app.resumeQualityScore && (
                                                        <div className="text-gray-400">No AI scores</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <Link
                                                    to={`/recruiter/view-applicant/${app.id}`}
                                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                                >
                                                    View Details →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* My Jobs Tab */}
            {tab === "jobs" && (
                <div className="space-y-4">
                    {jobPosts.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center">
                            <div className="text-gray-400 mb-4">
                                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs posted yet</h3>
                            <p className="text-gray-600 mb-4">Start by posting your first job to attract candidates.</p>
                            <Link
                                to="/recruiter/post-job"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                Post Your First Job
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {jobPosts.map((job) => (
                                <div key={job.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-semibold text-indigo-700">{job.title}</h3>
                                        <span className="text-sm text-gray-500">
                                            {formatDate(job.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-gray-700 mb-3 line-clamp-3">{job.description}</p>

                                    {/* Job Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-4">
                                        <div>
                                            <span className="font-medium">Skills:</span>
                                            <span className="ml-1">
                                                {job.skills?.length > 0 ? job.skills.slice(0, 3).join(", ") : "N/A"}
                                                {job.skills?.length > 3 && ` +${job.skills.length - 3} more`}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-medium">Location:</span>
                                            <span className="ml-1">{job.location || "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium">Experience:</span>
                                            <span className="ml-1">{job.experience || "N/A"}</span>
                                        </div>
                                    </div>

                                    {/* Applications Count and Actions */}
                                    <div className="flex justify-between items-center pt-4 border-t">
                                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                                            <span>
                                                <span className="font-medium text-indigo-600">
                                                    {applications.filter(app => app.jobId === job.id).length}
                                                </span> applications
                                            </span>
                                            <span>
                                                <span className="font-medium text-green-600">
                                                    {applications.filter(app => app.jobId === job.id && app.status === 'accepted').length}
                                                </span> accepted
                                            </span>
                                        </div>
                                        <div className="flex space-x-3">
                                            <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                                                Edit
                                            </button>
                                            <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RecruiterDashboard;
