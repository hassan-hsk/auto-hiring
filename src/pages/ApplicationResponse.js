import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../context/AuthContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement
);

const ApplicationResponse = () => {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [application, setApplication] = useState(null);
    const [jobData, setJobData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [skillsAnalysis, setSkillsAnalysis] = useState(null);

    useEffect(() => {
        const fetchApplicationAndJob = async () => {
            try {
                if (!applicationId || !user) {
                    setError('Invalid application or user not authenticated');
                    setLoading(false);
                    return;
                }

                // Fetch application
                const appRef = doc(db, 'applications', applicationId);
                const appSnap = await getDoc(appRef);

                if (!appSnap.exists()) {
                    setError('Application not found');
                    setLoading(false);
                    return;
                }

                const appData = appSnap.data();

                // Verify this application belongs to the current user
                if (appData.applicantId !== user.uid) {
                    setError('Unauthorized access to this application');
                    setLoading(false);
                    return;
                }

                setApplication({ id: appSnap.id, ...appData });

                // Fetch job details
                if (appData.jobId) {
                    const jobRef = doc(db, 'jobsPosts', appData.jobId);
                    const jobSnap = await getDoc(jobRef);

                    if (jobSnap.exists()) {
                        const jobInfo = jobSnap.data();
                        setJobData(jobInfo);

                        // Analyze skills match
                        analyzeSkillsMatch(appData.extractedData, jobInfo);
                    }
                }

            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load application details');
            } finally {
                setLoading(false);
            }
        };

        fetchApplicationAndJob();
    }, [applicationId, user]);

    const analyzeSkillsMatch = (resumeData, jobInfo) => {
        if (!resumeData?.skills || !jobInfo?.skills) {
            setSkillsAnalysis({
                matchedSkills: [],
                missingSkills: jobInfo?.skills || [],
                extraSkills: resumeData?.skills || [],
                matchPercentage: 0
            });
            return;
        }

        const candidateSkills = resumeData.skills.map(skill => skill.toLowerCase().trim());
        const jobSkills = jobInfo.skills.map(skill => skill.toLowerCase().trim());

        const matchedSkills = jobSkills.filter(skill =>
            candidateSkills.some(candidateSkill =>
                candidateSkill.includes(skill) || skill.includes(candidateSkill)
            )
        );

        const missingSkills = jobSkills.filter(skill =>
            !candidateSkills.some(candidateSkill =>
                candidateSkill.includes(skill) || skill.includes(candidateSkill)
            )
        );

        const extraSkills = candidateSkills.filter(skill =>
            !jobSkills.some(jobSkill =>
                skill.includes(jobSkill) || jobSkill.includes(skill)
            )
        );

        const matchPercentage = Math.round((matchedSkills.length / jobSkills.length) * 100);

        setSkillsAnalysis({
            matchedSkills,
            missingSkills,
            extraSkills,
            matchPercentage,
            totalRequired: jobSkills.length,
            totalMatched: matchedSkills.length
        });
    };

    const getExperienceAnalysis = () => {
        if (!application?.extractedData?.experience || !jobData?.experience) {
            return { status: 'unknown', message: 'Experience requirements not specified' };
        }

        const candidateYears = application.extractedData.experience.length;
        const requiredExp = jobData.experience.toLowerCase();

        if (requiredExp.includes('entry') || requiredExp.includes('0-1') || requiredExp.includes('fresher')) {
            return {
                status: candidateYears >= 0 ? 'match' : 'below',
                message: candidateYears >= 1 ? 'Exceeds entry-level requirements' : 'Meets entry-level requirements'
            };
        } else if (requiredExp.includes('2-3') || requiredExp.includes('junior')) {
            return {
                status: candidateYears >= 2 ? 'match' : 'below',
                message: candidateYears >= 2 ? 'Meets junior-level requirements' : 'Below junior-level requirements'
            };
        } else if (requiredExp.includes('3-5') || requiredExp.includes('mid')) {
            return {
                status: candidateYears >= 3 ? 'match' : 'below',
                message: candidateYears >= 3 ? 'Meets mid-level requirements' : 'Below mid-level requirements'
            };
        } else if (requiredExp.includes('5+') || requiredExp.includes('senior')) {
            return {
                status: candidateYears >= 5 ? 'match' : 'below',
                message: candidateYears >= 5 ? 'Meets senior-level requirements' : 'Below senior-level requirements'
            };
        }

        return { status: 'unknown', message: 'Experience level assessment needed' };
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-indigo-600 font-semibold">Loading Application Analysis...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-red-700">{error}</p>
                    <button
                        onClick={() => navigate('/applicant/dashboard')}
                        className="mt-4 bg-red-100 px-3 py-2 text-sm text-red-800 rounded-md hover:bg-red-200"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!application) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-yellow-700">Application not found</p>
                </div>
            </div>
        );
    }

    const experienceAnalysis = getExperienceAnalysis();

    // Fixed chart configurations
    const skillsMatchData = skillsAnalysis ? {
        labels: ['Matched Skills', 'Missing Skills', 'Extra Skills'],
        datasets: [
            {
                label: 'Skills Analysis',
                data: [
                    skillsAnalysis.matchedSkills.length,
                    skillsAnalysis.missingSkills.length,
                    skillsAnalysis.extraSkills.length
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(79, 70, 229, 0.8)',
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(79, 70, 229, 1)',
                ],
                borderWidth: 1,
            },
        ],
    } : null;

    const jobFitData = {
        labels: ['Skills Match', 'Experience Fit', 'Resume Quality', 'Overall Match'],
        datasets: [
            {
                label: 'Job Compatibility',
                data: [
                    skillsAnalysis?.matchPercentage || 0,
                    experienceAnalysis.status === 'match' ? 85 : experienceAnalysis.status === 'below' ? 40 : 60,
                    application.resumeQualityScore || 0,
                    application.jobMatchScore || 0,
                ],
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(79, 70, 229, 1)',
            },
        ],
    };

    // Fixed chart options
    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
            },
        },
    };

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
        },
        scales: {
            r: {
                beginAtZero: true,
                max: 100,
                min: 0,
                ticks: {
                    stepSize: 20,
                    callback: function (value) {
                        return value + '%';
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                },
                angleLines: {
                    color: 'rgba(0, 0, 0, 0.1)',
                },
                pointLabels: {
                    font: {
                        size: 12,
                    },
                },
            },
        },
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/applicant/dashboard')}
                    className="mb-4 text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>

                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <h1 className="text-3xl font-bold mb-2">Job-Specific Analysis</h1>
                    <p className="text-indigo-100">{application.jobTitle} at {application.companyName}</p>
                    <div className="flex items-center mt-4 space-x-6">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{application.jobMatchScore || 0}%</div>
                            <div className="text-sm text-indigo-200">Overall Match</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{skillsAnalysis?.matchPercentage || 0}%</div>
                            <div className="text-sm text-indigo-200">Skills Match</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{application.resumeQualityScore || 0}%</div>
                            <div className="text-sm text-indigo-200">Resume Quality</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Skills Match Chart */}
                {skillsMatchData && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Skills Match Analysis</h3>
                        <div className="h-64">
                            <Doughnut
                                key={`doughnut-${applicationId}`}
                                data={skillsMatchData}
                                options={doughnutOptions}
                            />
                        </div>
                        <div className="mt-4 text-center">
                            <p className="text-sm text-gray-600">
                                {skillsAnalysis.totalMatched} of {skillsAnalysis.totalRequired} required skills matched
                            </p>
                        </div>
                    </div>
                )}

                {/* Job Fit Radar Chart */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Job Compatibility Score</h3>
                    <div className="h-64">
                        <Radar
                            key={`radar-${applicationId}`}
                            data={jobFitData}
                            options={radarOptions}
                        />
                    </div>
                </div>
            </div>

            {/* Skills Analysis Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Matched Skills */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Skills You Have ({skillsAnalysis?.matchedSkills.length || 0})
                    </h3>
                    <ul className="space-y-2">
                        {skillsAnalysis?.matchedSkills.length > 0 ? (
                            skillsAnalysis.matchedSkills.map((skill, index) => (
                                <li key={index} className="text-green-700 text-sm flex items-center">
                                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {skill}
                                </li>
                            ))
                        ) : (
                            <li className="text-green-600 text-sm">No matching skills found</li>
                        )}
                    </ul>
                </div>

                {/* Missing Skills */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Skills to Learn ({skillsAnalysis?.missingSkills.length || 0})
                    </h3>
                    <ul className="space-y-2">
                        {skillsAnalysis?.missingSkills.length > 0 ? (
                            skillsAnalysis.missingSkills.map((skill, index) => (
                                <li key={index} className="text-red-700 text-sm flex items-center">
                                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    {skill}
                                </li>
                            ))
                        ) : (
                            <li className="text-red-600 text-sm">All required skills are present!</li>
                        )}
                    </ul>
                </div>

                {/* Additional Skills */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Bonus Skills ({skillsAnalysis?.extraSkills.length || 0})
                    </h3>
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {skillsAnalysis?.extraSkills.length > 0 ? (
                            skillsAnalysis.extraSkills.slice(0, 8).map((skill, index) => (
                                <li key={index} className="text-blue-700 text-sm flex items-center">
                                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    {skill}
                                </li>
                            ))
                        ) : (
                            <li className="text-blue-600 text-sm">No additional skills beyond requirements</li>
                        )}
                        {skillsAnalysis?.extraSkills.length > 8 && (
                            <li className="text-blue-500 text-xs">And {skillsAnalysis.extraSkills.length - 8} more...</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Experience & Requirements Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Experience Analysis */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Experience Analysis</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Required Experience:</span>
                            <span className="font-medium">{jobData?.experience || 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Your Experience:</span>
                            <span className="font-medium">
                                {application?.extractedData?.experience?.length || 0} positions
                            </span>
                        </div>
                        <div className={`p-3 rounded-lg ${experienceAnalysis.status === 'match' ? 'bg-green-50 border border-green-200' :
                                experienceAnalysis.status === 'below' ? 'bg-red-50 border border-red-200' :
                                    'bg-yellow-50 border border-yellow-200'
                            }`}>
                            <p className={`text-sm ${experienceAnalysis.status === 'match' ? 'text-green-700' :
                                    experienceAnalysis.status === 'below' ? 'text-red-700' :
                                        'text-yellow-700'
                                }`}>
                                {experienceAnalysis.message}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Job Requirements */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Job Requirements</h3>
                    <div className="space-y-3">
                        {jobData?.location && (
                            <div>
                                <span className="font-medium text-gray-700">Location: </span>
                                <span className="text-gray-600">{jobData.location}</span>
                            </div>
                        )}
                        {jobData?.salary && (
                            <div>
                                <span className="font-medium text-gray-700">Salary: </span>
                                <span className="text-gray-600">{jobData.salary}</span>
                            </div>
                        )}
                        {jobData?.description && (
                            <div>
                                <span className="font-medium text-gray-700">Description: </span>
                                <p className="text-gray-600 text-sm mt-1">{jobData.description.slice(0, 200)}...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Personalized Recommendations
                </h3>
                <div className="space-y-3">
                    {skillsAnalysis?.missingSkills.length > 0 && (
                        <div className="p-3 bg-white rounded border border-purple-200">
                            <p className="text-purple-700 font-medium">Priority Skills to Develop:</p>
                            <p className="text-purple-600 text-sm mt-1">
                                Focus on learning {skillsAnalysis.missingSkills.slice(0, 3).join(', ')}
                                to increase your job match score.
                            </p>
                        </div>
                    )}

                    {experienceAnalysis.status === 'below' && (
                        <div className="p-3 bg-white rounded border border-purple-200">
                            <p className="text-purple-700 font-medium">Experience Enhancement:</p>
                            <p className="text-purple-600 text-sm mt-1">
                                Consider taking on projects or internships to gain relevant experience for this role.
                            </p>
                        </div>
                    )}

                    {application.jobMatchScore < 70 && (
                        <div className="p-3 bg-white rounded border border-purple-200">
                            <p className="text-purple-700 font-medium">Resume Optimization:</p>
                            <p className="text-purple-600 text-sm mt-1">
                                Highlight your {skillsAnalysis?.matchedSkills.slice(0, 2).join(' and ')} skills more prominently
                                and add specific examples of your achievements.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApplicationResponse;