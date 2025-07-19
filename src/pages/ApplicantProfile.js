import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useNavigate } from 'react-router-dom';

const ApplicantProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState({
        fullName: '',
        email: user?.email || '',
        phone: '',
        location: '',
        bio: '',
        skills: [],
        experience: '',
        education: '',
        linkedIn: '',
        github: '',
        portfolio: '',
        jobTitle: '',
        yearsOfExperience: 0,
        salaryRange: '',
        availability: 'immediately',
        workType: 'full-time',
        remotePreference: 'hybrid'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('basic');

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.uid) return;

            try {
                const docRef = doc(db, 'user_profiles', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setProfile(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSkillsChange = (e) => {
        const skills = e.target.value.split(',').map(skill => skill.trim()).filter(skill => skill);
        setProfile(prev => ({ ...prev, skills }));
    };

    const addSkill = (skill) => {
        if (skill && !profile.skills.includes(skill)) {
            setProfile(prev => ({ ...prev, skills: [...prev.skills, skill] }));
        }
    };

    const removeSkill = (skillToRemove) => {
        setProfile(prev => ({
            ...prev,
            skills: prev.skills.filter(skill => skill !== skillToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const docRef = doc(db, 'user_profiles', user.uid);
            await setDoc(docRef, {
                ...profile,
                updatedAt: new Date().toISOString(),
                userId: user.uid
            });
            setSuccess('Profile updated successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error saving profile:', err);
            setError('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const suggestedSkills = [
        'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'TypeScript',
        'HTML/CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker',
        'Git', 'Agile', 'REST APIs', 'GraphQL', 'Vue.js', 'Angular',
        'Spring Boot', 'Django', 'Flask', 'Kubernetes', 'Jenkins',
        'Machine Learning', 'Data Analysis', 'UI/UX Design'
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-indigo-600 font-semibold">Loading Profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
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
                    <h1 className="text-3xl font-bold mb-2">My Profile</h1>
                    <p className="text-indigo-100">Manage your professional information and preferences</p>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-green-700">{success}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <nav className="space-y-2">
                            <button
                                onClick={() => setActiveTab('basic')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'basic'
                                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Basic Info
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('professional')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'professional'
                                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2h-4a2 2 0 00-2-2V6m8 0h2a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h2" />
                                    </svg>
                                    Professional
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('skills')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'skills'
                                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    Skills
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('preferences')}
                                className={`w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'preferences'
                                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Preferences
                                </div>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
                        {/* Basic Information Tab */}
                        {activeTab === 'basic' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="fullName"
                                            value={profile.fullName}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={profile.email}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 cursor-not-allowed"
                                            disabled
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={profile.phone}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Location
                                        </label>
                                        <input
                                            type="text"
                                            name="location"
                                            value={profile.location}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="City, State/Country"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Professional Bio
                                    </label>
                                    <textarea
                                        name="bio"
                                        value={profile.bio}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Tell employers about yourself, your experience, and what makes you unique..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {profile.bio.length}/500 characters
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            LinkedIn Profile
                                        </label>
                                        <input
                                            type="url"
                                            name="linkedIn"
                                            value={profile.linkedIn}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="https://linkedin.com/in/username"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            GitHub Profile
                                        </label>
                                        <input
                                            type="url"
                                            name="github"
                                            value={profile.github}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="https://github.com/username"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Portfolio Website
                                        </label>
                                        <input
                                            type="url"
                                            name="portfolio"
                                            value={profile.portfolio}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="https://yourportfolio.com"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Professional Information Tab */}
                        {activeTab === 'professional' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Professional Information</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Current/Desired Job Title
                                        </label>
                                        <input
                                            type="text"
                                            name="jobTitle"
                                            value={profile.jobTitle}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="e.g., Full Stack Developer"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Years of Experience
                                        </label>
                                        <select
                                            name="yearsOfExperience"
                                            value={profile.yearsOfExperience}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value={0}>Less than 1 year</option>
                                            <option value={1}>1 year</option>
                                            <option value={2}>2 years</option>
                                            <option value={3}>3 years</option>
                                            <option value={4}>4 years</option>
                                            <option value={5}>5+ years</option>
                                            <option value={10}>10+ years</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Professional Experience
                                    </label>
                                    <textarea
                                        name="experience"
                                        value={profile.experience}
                                        onChange={handleInputChange}
                                        rows={6}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Describe your work experience, key achievements, and notable projects..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Education
                                    </label>
                                    <textarea
                                        name="education"
                                        value={profile.education}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="List your educational background, degrees, certifications..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Salary Range (Annual)
                                    </label>
                                    <select
                                        name="salaryRange"
                                        value={profile.salaryRange}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select salary range</option>
                                        <option value="30k-50k">$30,000 - $50,000</option>
                                        <option value="50k-75k">$50,000 - $75,000</option>
                                        <option value="75k-100k">$75,000 - $100,000</option>
                                        <option value="100k-150k">$100,000 - $150,000</option>
                                        <option value="150k-200k">$150,000 - $200,000</option>
                                        <option value="200k+">$200,000+</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Skills Tab */}
                        {activeTab === 'skills' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Skills & Expertise</h2>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Your Skills
                                    </label>
                                    <input
                                        type="text"
                                        value={profile.skills.join(', ')}
                                        onChange={handleSkillsChange}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Enter skills separated by commas..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Separate skills with commas
                                    </p>
                                </div>

                                {/* Current Skills */}
                                {profile.skills.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-2">Current Skills</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.skills.map((skill, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800"
                                                >
                                                    {skill}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSkill(skill)}
                                                        className="ml-2 text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggested Skills */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Suggested Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestedSkills
                                            .filter(skill => !profile.skills.includes(skill))
                                            .slice(0, 15)
                                            .map((skill, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => addSkill(skill)}
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                                                >
                                                    {skill}
                                                    <span className="ml-1 text-gray-500">+</span>
                                                </button>
                                            ))
                                        }
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Preferences Tab */}
                        {activeTab === 'preferences' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Job Preferences</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Work Type
                                        </label>
                                        <select
                                            name="workType"
                                            value={profile.workType}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="full-time">Full-time</option>
                                            <option value="part-time">Part-time</option>
                                            <option value="contract">Contract</option>
                                            <option value="freelance">Freelance</option>
                                            <option value="internship">Internship</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Remote Work Preference
                                        </label>
                                        <select
                                            name="remotePreference"
                                            value={profile.remotePreference}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="remote">Fully Remote</option>
                                            <option value="hybrid">Hybrid</option>
                                            <option value="onsite">On-site</option>
                                            <option value="flexible">Flexible</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Availability
                                        </label>
                                        <select
                                            name="availability"
                                            value={profile.availability}
                                            onChange={handleInputChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="immediately">Available Immediately</option>
                                            <option value="2-weeks">2 weeks notice</option>
                                            <option value="1-month">1 month notice</option>
                                            <option value="2-months">2 months notice</option>
                                            <option value="3-months">3+ months</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="mt-8 flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => navigate('/applicant/dashboard')}
                                className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center transition"
                            >
                                {saving && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                )}
                                {saving ? 'Saving Profile...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplicantProfile;