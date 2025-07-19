import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            console.log("Attempting login...");
            const userCredential = await login(email, password);
            console.log("Login successful, user:", userCredential.user.uid);

            // Try to fetch user role
            try {
                console.log("Fetching user role from Firestore...");
                const userRef = doc(db, "users", userCredential.user.uid);
                const userSnap = await getDoc(userRef);

                console.log("Firestore document exists:", userSnap.exists());

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    console.log("User data:", userData);
                    const userRole = userData.role;
                    console.log("User role:", userRole);

                    if (userRole === "applicant") {
                        console.log("Navigating to applicant dashboard");
                        navigate("/applicant/dashboard");
                    } else if (userRole === "recruiter") {
                        console.log("Navigating to recruiter dashboard");
                        navigate("/recruiter/dashboard");
                    } else {
                        setError("Invalid user role. Please contact support.");
                    }
                } else {
                    console.log("User document does not exist in Firestore");
                    setError("User profile not found. Please contact support.");
                }
            } catch (firestoreError) {
                console.error("Firestore error details:", firestoreError);
                setError(`Unable to load profile: ${firestoreError.message}`);
            }
        } catch (err) {
            console.error("Login error:", err);
            setError("Failed to log in. Please check your credentials.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
                <h2 className="text-3xl font-bold mb-6 text-indigo-700 text-center">Login</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 transition"
                    >
                        Login
                    </button>
                </form>

                <p className="mt-6 text-center text-gray-600">
                    Don't have an account?{" "}
                    <a href="/register" className="text-indigo-600 hover:underline">
                        Register
                    </a>
                </p>
            </div>
        </div>
    );
};

export default Login;
