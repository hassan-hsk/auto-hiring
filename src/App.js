// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import ApplicantDashboard from "./pages/ApplicantDashboard";
import JobPost from "./pages/JobPost"; // Fixed: Changed from PostJob to JobPost
import ApplyJob from "./pages/ApplyJob";
import JobList from "./pages/Joblist";
import InterviewFeedback from "./pages/InterviewFeedback";
// import ViewApplicant from "./pages/ViewApplicant"; // Comment out until created
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
              path="/interview-feedback"
              element={
                <ProtectedRoute allowedRoles={["applicant"]}>
                  <InterviewFeedback />
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
            {/* Temporarily comment out ViewApplicant route until file is created
            <Route
              path="/recruiter/view-applicant/:applicationId"
              element={
                <ProtectedRoute allowedRoles={["recruiter"]}>
                  <ViewApplicant />
                </ProtectedRoute>
              }
            />
            */}

            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
