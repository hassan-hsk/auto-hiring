// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import ApplicantDashboard from "./pages/ApplicantDashboard";
import JobPost from "./pages/JobPost";
import ApplyJob from "./pages/ApplyJob";
import JobList from "./pages/Joblist";
import InterviewFeedback from "./pages/InterviewFeedback";
import InterviewPage from "./pages/interview"; // Add the interview page import
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ApplicationResponse from "./pages/ApplicationResponse";

// 🔁 Role-based redirect after login
const RoleBasedRedirect = () => {
  const { user, role, loading } = useAuth();

  // Show loading while Firebase is connecting
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-indigo-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If user exists but role is null (offline), show a message
  if (user && role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Unable to load user profile</h2>
          <p className="text-gray-600 mt-2">Please check your internet connection and try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (role === "recruiter") return <Navigate to="/recruiter/dashboard" replace />;
  if (role === "applicant") return <Navigate to="/applicant/dashboard" replace />;

  return <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/redirect" element={<RoleBasedRedirect />} />
            <Route path="/jobs" element={<JobList />} />
            <Route path="/post-job" element={<JobPost />} />

            {/* Applicant Routes */}
            <Route
              path="/applicant/dashboard"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <ApplicantDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applicant/browse-jobs"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <JobList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applicant/resume-upload"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <div className="max-w-4xl mx-auto p-6">
                    <h1 className="text-2xl font-bold mb-4">Resume Upload</h1>
                    <p className="text-gray-600">Upload and manage your resume here. (Coming Soon)</p>
                  </div>
                </ProtectedRoute>
              }
            />
            {/* AI Interview Routes */}
            <Route
              path="/applicant/ai-interview"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <InterviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applicant/my-applications"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <ApplicantDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applicant/apply/:jobId"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <ApplyJob />
                </ProtectedRoute>
              }
            />
            <Route
              path="/apply/:jobId"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <ApplyJob />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applicant/application/:applicationId"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <ApplicationResponse />
                </ProtectedRoute>
              }
            />

            {/* Recruiter Routes */}
            <Route
              path="/recruiter/dashboard"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <RecruiterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/post-job"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <JobPost />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/manage-jobs"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <div className="max-w-6xl mx-auto p-6">
                    <h1 className="text-2xl font-bold mb-4">Manage Jobs</h1>
                    <p className="text-gray-600">Manage your posted jobs here. (Coming Soon)</p>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/view-applicants"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <div className="max-w-6xl mx-auto p-6">
                    <h1 className="text-2xl font-bold mb-4">View Applicants</h1>
                    <p className="text-gray-600">View and manage applicants here. (Coming Soon)</p>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/analytics"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <div className="max-w-6xl mx-auto p-6">
                    <h1 className="text-2xl font-bold mb-4">Analytics</h1>
                    <p className="text-gray-600">View analytics and insights here. (Coming Soon)</p>
                  </div>
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="/recruiter/view-applicant/:applicationId"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <ViewApplicant />
                </ProtectedRoute>
              }
            /> */}

            {/* Additional Routes */}
            <Route
              path="/notifications"
              element={
                <div className="max-w-4xl mx-auto p-6">
                  <h1 className="text-2xl font-bold mb-4">Notifications</h1>
                  <p className="text-gray-600">All notifications will appear here. (Coming Soon)</p>
                </div>
              }
            />
            <Route
              path="/help"
              element={
                <div className="max-w-4xl mx-auto p-6">
                  <h1 className="text-2xl font-bold mb-4">Help & Support</h1>
                  <p className="text-gray-600">Get help and support here. (Coming Soon)</p>
                </div>
              }
            />
            <Route path="/interview-feedback" element={<InterviewFeedback />} />
            <Route
              path="/interview"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <InterviewPage />
                </ProtectedRoute>
              }
            />

            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
