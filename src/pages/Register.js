import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { doc, setDoc } from "firebase/firestore";

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("applicant");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const userCredential = await register(email, password);
            const userId = userCredential.user.uid;

            // Save user info in Firestore
            await setDoc(doc(db, "users", userId), {
                name,
                email,
                role,
                createdAt: new Date(),
            });

            if (role === "applicant") navigate("/applicant/dashboard");
            else if (role === "recruiter") navigate("/recruiter/dashboard");
        } catch (err) {
            console.error("Registration error:", err);

            // Handle specific Firebase error codes
            if (err.code === "auth/email-already-in-use") {
                setError("This email is already registered. Please use a different email or try logging in.");
            } else if (err.code === "auth/weak-password") {
                setError("Password is too weak. Please use at least 6 characters.");
            } else if (err.code === "auth/invalid-email") {
                setError("Please enter a valid email address.");
            } else {
                setError("Failed to register. Please try again.");
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
                <h2 className="text-3xl font-bold mb-6 text-indigo-700 text-center">Register</h2>

                {error && (
                    <p className="mb-4 text-red-600 font-medium text-center">{error}</p>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
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
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="applicant">Applicant</option>
                        <option value="recruiter">Recruiter</option>
                    </select>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 transition"
                    >
                        Register
                    </button>
                </form>

                <p className="mt-6 text-center text-gray-600">
                    Already have an account?{" "}
                    <a href="/login" className="text-indigo-600 hover:underline">
                        Login
                    </a>
                </p>
            </div>
        </div>
    );
};

export default Register;
