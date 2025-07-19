import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
    const { user, role, loading, logout } = useAuth();
    const [showNotifications, setShowNotifications] = useState(false);
    const location = useLocation();
    const isLandingPage = location.pathname === '/';

    // Smooth scroll function for landing page sections
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    // Show loading state while auth is initializing
    if (loading) {
        return (
            <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                <Link to="/" className="font-bold text-xl">
                    AI Hiring
                </Link>
                <div className="space-x-4">
                    <span className="text-indigo-200">Loading...</span>
                </div>
            </nav>
        );
    }

    return (
        <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center relative">
            {/* Left Side - Logo/App Name */}
            <Link to="/" className="font-bold text-xl hover:text-indigo-200 transition">
                AI Hiring
            </Link>

            {/* Center - Main Navigation */}
            <div className="flex-1 flex justify-center">
                {user ? (
                    <>
                        {/* Applicant Navigation */}
                        {role === "applicant" && (
                            <div className="flex space-x-6">
                                <Link
                                    to="/applicant/dashboard"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to="/applicant/browse-jobs"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Browse Jobs
                                </Link>
                                <Link
                                    to="/applicant/resume-upload"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Resume Upload
                                </Link>
                                <Link
                                    to="/applicant/ai-interview"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    AI Interview
                                </Link>
                                <Link
                                    to="/applicant/my-applications"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    My Applications
                                </Link>
                            </div>
                        )}

                        {/* Recruiter Navigation */}
                        {role === "recruiter" && (
                            <div className="flex space-x-6">
                                <Link
                                    to="/recruiter/dashboard"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to="/recruiter/post-job"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Post Job
                                </Link>
                                <Link
                                    to="/recruiter/manage-jobs"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Manage Jobs
                                </Link>
                                <Link
                                    to="/recruiter/view-applicants"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    View Applicants
                                </Link>
                                <Link
                                    to="/recruiter/analytics"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Analytics
                                </Link>
                            </div>
                        )}
                    </>
                ) : (
                    /* Public Navigation */
                    <div className="flex space-x-6">
                        {isLandingPage ? (
                            /* Landing Page - Scroll to sections */
                            <>
                                <button
                                    onClick={() => scrollToSection('home')}
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Home
                                </button>
                                <button
                                    onClick={() => scrollToSection('how-it-works')}
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    How It Works
                                </button>
                                <button
                                    onClick={() => scrollToSection('features')}
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Features
                                </button>
                            </>
                        ) : (
                            /* Other pages - Use regular links */
                            <>
                                <Link
                                    to="/"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Home
                                </Link>
                                <Link
                                    to="/#how-it-works"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    How It Works
                                </Link>
                                <Link
                                    to="/#features"
                                    className="hover:underline hover:text-indigo-200 transition font-medium"
                                >
                                    Features
                                </Link>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center space-x-3">
                {user ? (
                    /* Logged In - Show user actions */
                    <>
                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 hover:bg-indigo-700 rounded transition relative"
                                title="Notifications"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3.001 3.001 0 11-6 0m6 0H9" />
                                </svg>
                                {/* Notification badge */}
                                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full h-4 w-4 flex items-center justify-center text-white">
                                    3
                                </span>
                            </button>

                            {/* Notifications dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white text-gray-800 rounded-lg shadow-lg border z-50">
                                    <div className="p-4 border-b">
                                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        <div className="p-3 border-b hover:bg-gray-50">
                                            <p className="text-sm font-medium">New job match found!</p>
                                            <p className="text-xs text-gray-500">2 hours ago</p>
                                        </div>
                                        <div className="p-3 border-b hover:bg-gray-50">
                                            <p className="text-sm font-medium">Application status updated</p>
                                            <p className="text-xs text-gray-500">1 day ago</p>
                                        </div>
                                        <div className="p-3 hover:bg-gray-50">
                                            <p className="text-sm font-medium">Interview scheduled</p>
                                            <p className="text-xs text-gray-500">2 days ago</p>
                                        </div>
                                    </div>
                                    <div className="p-3 border-t">
                                        <Link
                                            to="/notifications"
                                            className="text-sm text-indigo-600 hover:text-indigo-800"
                                            onClick={() => setShowNotifications(false)}
                                        >
                                            View all notifications
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Help */}
                        <Link
                            to="/help"
                            className="p-2 hover:bg-indigo-700 rounded transition"
                            title="Help"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={logout}
                            className="flex items-center space-x-1 hover:bg-indigo-700 bg-indigo-800 px-4 py-2 rounded transition font-medium"
                            title="Logout"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Logout</span>
                        </button>
                    </>
                ) : (
                    /* Not Logged In - Show auth actions */
                    <>
                        <Link
                            to="/login"
                            className="hover:bg-indigo-700 px-4 py-2 rounded transition font-medium"
                        >
                            Login
                        </Link>
                        <Link
                            to="/register"
                            className="hover:bg-indigo-700 px-4 py-2 rounded transition font-medium"
                        >
                            Register
                        </Link>
                        <Link
                            to="/post-job"
                            className="bg-yellow-500 hover:bg-yellow-600 text-indigo-900 px-4 py-2 rounded transition font-medium"
                        >
                            Post Job
                        </Link>
                    </>
                )}
            </div>

            {/* Click outside to close notifications */}
            {showNotifications && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                />
            )}
        </nav>
    );
};

export default Navbar;
