import { db } from "./firebase"; // assumes you exported db in firebase.js
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    doc,
    query,
    where
} from "firebase/firestore";

// Post a job
export const postJob = async (jobData) => {
    const docRef = await addDoc(collection(db, "jobs"), jobData);
    return docRef.id;
};

// Get all jobs
export const getAllJobs = async () => {
    const querySnapshot = await getDocs(collection(db, "jobs"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Apply to a job
export const applyToJob = async (jobId, applicantId, applicationData) => {
    const docRef = doc(db, "applications", `${jobId}_${applicantId}`);
    await setDoc(docRef, {
        jobId,
        applicantId,
        ...applicationData,
        status: "pending",
        timestamp: new Date()
    });
};

// Get applications for a job (recruiter view)
export const getApplicantsForJob = async (jobId) => {
    const q = query(collection(db, "applications"), where("jobId", "==", jobId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Save AI analysis (interview transcript, score, feedback)
export const saveAIAnalysis = async (applicantId, jobId, analysisData) => {
    const docRef = doc(db, "ai_analysis", `${jobId}_${applicantId}`);
    await setDoc(docRef, analysisData);
};

// Get AI analysis
export const getAIAnalysis = async (jobId, applicantId) => {
    const docRef = doc(db, "ai_analysis", `${jobId}_${applicantId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
};
