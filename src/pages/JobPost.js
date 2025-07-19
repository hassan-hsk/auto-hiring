import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const JobPost = () => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [skills, setSkills] = useState("");
    const [location, setLocation] = useState("");
    const [experience, setExperience] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { user } = useAuth();
    const navigate = useNavigate();

    const handlePostJob = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            console.log("Posting job for user:", user.uid);
            const jobData = {
                title,
                description,
                skills: skills.split(",").map((s) => s.trim()),
                location,
                experience,
                postedBy: user.uid,
                createdAt: serverTimestamp(),
            };

            console.log("Job data to be posted:", jobData);

            const docRef = await addDoc(collection(db, "jobsPosts"), jobData);
            console.log("Job posted with ID:", docRef.id);

            alert("Job posted successfully!");

            // Clear form
            setTitle("");
            setDescription("");
            setSkills("");
            setLocation("");
            setExperience("");

            // Navigate back to dashboard
            navigate("/recruiter/dashboard");
        } catch (error) {
            console.error("Error posting job:", error);
            setError("Failed to post job. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto mt-12 px-4">
            <div className="flex items-center mb-6">
                <button
                    onClick={() => navigate("/recruiter/dashboard")}
                    className="mr-4 text-indigo-600 hover:text-indigo-800"
                >
                    ← Back to Dashboard
                </button>
                <h2 className="text-3xl font-bold text-indigo-700">Post a New Job</h2>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            <form onSubmit={handlePostJob} className="space-y-6 bg-white p-6 rounded-xl shadow-md">
                <input
                    type="text"
                    placeholder="Job Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={loading}
                />
                <textarea
                    placeholder="Job Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border rounded-lg p-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={loading}
                />
                <input
                    type="text"
                    placeholder="Skills (comma separated)"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={loading}
                />
                <input
                    type="text"
                    placeholder="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={loading}
                />
                <input
                    type="text"
                    placeholder="Experience Required (e.g. 2+ years)"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Posting Job..." : "Post Job"}
                </button>
            </form>
        </div>
    );
};

export default JobPost;
