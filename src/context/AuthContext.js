import { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase/firebase";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            // Role will be set by onAuthStateChanged listener
            return result;
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    };

    const register = async (email, password) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            return result;
        } catch (error) {
            console.error("Register error:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            // Clear user and role state
            setUser(null);
            setRole(null);
        } catch (error) {
            console.error("Logout error:", error);
            throw error;
        }
    };

    useEffect(() => {
        console.log("Setting up auth listener...");

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth state changed:", currentUser);

            try {
                setUser(currentUser);

                if (currentUser) {
                    // Fetch user role from Firestore
                    const userRef = doc(db, "users", currentUser.uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        console.log("User role fetched:", userData.role);
                        setRole(userData.role);
                    } else {
                        console.log("No user document found");
                        setRole(null);
                    }
                } else {
                    console.log("No user logged in");
                    setRole(null);
                }
            } catch (error) {
                console.error("Error in auth state listener:", error);
                setRole(null);
            } finally {
                setLoading(false);
            }
        });

        // Fallback timeout to stop loading after 10 seconds
        const timeout = setTimeout(() => {
            console.log("Auth timeout reached");
            setLoading(false);
        }, 10000);

        return () => {
            console.log("Cleaning up auth listener");
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    // Debug logging
    useEffect(() => {
        console.log("Auth state:", { user: !!user, role, loading });
    }, [user, role, loading]);

    return (
        <AuthContext.Provider value={{ user, role, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
