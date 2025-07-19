import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source once at module level
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// Extract text from PDF file using PDF.js
export const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                let textContent = '';

                // Extract text from all pages
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const pageText = content.items.map(item => item.str).join(' ');
                    textContent += pageText + '\n';
                }

                if (!textContent.trim()) {
                    reject(new Error('No text content found in PDF'));
                    return;
                }

                resolve(textContent.trim());
            } catch (error) {
                console.error('PDF extraction error:', error);
                reject(new Error('Failed to extract text from PDF: ' + error.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
};

// Call OpenRouter API with working models
export const callOpenRouterAPI = async (prompt) => {
    const API_KEY = process.env.REACT_APP_OPENROUTER_API_KEY;

    if (!API_KEY) {
        throw new Error('OpenRouter API key not found. Please add REACT_APP_OPENROUTER_API_KEY to your environment variables.');
    }

    // Updated list of actually working free models (as of 2024)
    const models = [
        'openai/gpt-3.5-turbo',
        'anthropic/claude-3-haiku:beta',
        'google/gemma-7b-it:free',
        'mistralai/mistral-7b-instruct:free'
    ];

    for (let i = 0; i < models.length; i++) {
        try {
            console.log(`Trying model ${i + 1}/${models.length}: ${models[i]}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // Reduced to 15 seconds

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'AI Hiring App'
                },
                body: JSON.stringify({
                    model: models[i],
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1500,
                    top_p: 0.9
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Model ${models[i]} failed with status ${response.status}:`, errorText);
                continue; // Try next model
            }

            const data = await response.json();

            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                const content = data.choices[0].message.content.trim();
                if (content && content.length > 10) { // Ensure we got actual content
                    console.log(`Success with model: ${models[i]}`);
                    return content;
                }
            }

            console.error(`Model ${models[i]} returned empty or invalid content`);
            continue; // Try next model

        } catch (error) {
            console.error(`Error with model ${models[i]}:`, error);

            if (error.name === 'AbortError') {
                console.error(`Model ${models[i]} timed out after 15 seconds`);
            }

            // If this is the last model, continue to fallback
            if (i === models.length - 1) {
                console.log('All AI models failed, will use fallback parsing');
            }
        }
    }

    throw new Error('All AI models failed or returned invalid responses');
};

// Fallback: Parse resume without AI
export const parseResumeManually = (resumeText) => {
    console.log('Using manual parsing fallback...');

    const text = resumeText.toLowerCase();
    const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line);

    // Basic parsing logic
    const result = {
        personalInfo: { name: '', email: '', phone: '', location: '' },
        summary: '',
        skills: [],
        experience: [],
        education: [],
        projects: []
    };

    // Extract email
    const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
        result.personalInfo.email = emailMatch[0];
    }

    // Extract phone
    const phoneMatch = resumeText.match(/(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
        result.personalInfo.phone = phoneMatch[0];
    }

    // Extract name (assume first line with letters is the name)
    for (const line of lines) {
        if (line.length > 2 && line.length < 50 && /^[a-zA-Z\s]+$/.test(line) && !line.includes('@')) {
            result.personalInfo.name = line;
            break;
        }
    }

    // Extract common skills
    const commonSkills = [
        'javascript', 'python', 'java', 'react', 'node.js', 'html', 'css', 'sql',
        'git', 'docker', 'aws', 'mongodb', 'postgresql', 'typescript', 'angular',
        'vue', 'express', 'django', 'flask', 'spring', 'bootstrap', 'tailwind',
        'firebase', 'mysql', 'redis', 'kubernetes', 'jenkins', 'azure', 'gcp'
    ];

    commonSkills.forEach(skill => {
        if (text.includes(skill)) {
            result.skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
        }
    });

    // Simple experience extraction
    const experienceKeywords = ['experience', 'work history', 'employment', 'professional experience'];
    const educationKeywords = ['education', 'academic', 'university', 'college', 'degree'];

    let currentSection = 'general';
    let experienceCount = 0;
    let educationCount = 0;

    for (const line of lines) {
        const lowerLine = line.toLowerCase();

        if (experienceKeywords.some(keyword => lowerLine.includes(keyword))) {
            currentSection = 'experience';
            continue;
        }

        if (educationKeywords.some(keyword => lowerLine.includes(keyword))) {
            currentSection = 'education';
            continue;
        }

        // Look for company names or job titles
        if (currentSection === 'experience' && line.length > 10 && experienceCount < 3) {
            result.experience.push({
                company: line,
                position: 'Position not specified',
                duration: 'Duration not specified',
                description: 'Description not available',
                technologies: []
            });
            experienceCount++;
        }

        // Look for education
        if (currentSection === 'education' && line.length > 10 && educationCount < 2) {
            result.education.push({
                institution: line,
                degree: 'Degree not specified',
                duration: 'Duration not specified',
                details: ''
            });
            educationCount++;
        }
    }

    return result;
};

// Extract structured data from resume text using AI or fallback
export const extractResumeWithAI = async (resumeText) => {
    if (!resumeText || resumeText.trim().length < 50) {
        throw new Error('Resume text is too short or empty. Please provide a valid resume.');
    }

    // First try AI extraction
    try {
        console.log('Attempting AI extraction...');

        const prompt = `Extract information from this resume and return only a JSON object with this exact structure:

{
    "personalInfo": {
        "name": "full name",
        "email": "email address",
        "phone": "phone number",
        "location": "location"
    },
    "summary": "professional summary",
    "skills": ["skill1", "skill2", "skill3"],
    "experience": [
        {
            "company": "company name",
            "position": "job title",
            "duration": "time period",
            "description": "job description",
            "technologies": ["tech1", "tech2"]
        }
    ],
    "education": [
        {
            "institution": "school name",
            "degree": "degree type",
            "duration": "time period",
            "details": "additional details"
        }
    ],
    "projects": [
        {
            "name": "project name",
            "description": "project description",
            "technologies": ["tech1", "tech2"],
            "url": "project url"
        }
    ]
}

Resume text:
${resumeText.substring(0, 1500)}

Return only the JSON object, no other text.`;

        const response = await callOpenRouterAPI(prompt);
        console.log('AI response received, length:', response.length);

        // Clean and parse response
        let cleanedResponse = response.trim();

        // Remove markdown code blocks
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        cleanedResponse = cleanedResponse.replace(/```/g, '');

        // Find JSON object
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;

        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd);

            try {
                const extractedData = JSON.parse(cleanedResponse);
                console.log('AI extraction successful');

                // Ensure all required fields exist
                const result = {
                    personalInfo: extractedData.personalInfo || { name: '', email: '', phone: '', location: '' },
                    summary: extractedData.summary || '',
                    skills: Array.isArray(extractedData.skills) ? extractedData.skills : [],
                    experience: Array.isArray(extractedData.experience) ? extractedData.experience : [],
                    education: Array.isArray(extractedData.education) ? extractedData.education : [],
                    projects: Array.isArray(extractedData.projects) ? extractedData.projects : []
                };

                return result;
            } catch (parseError) {
                console.error('Failed to parse AI response as JSON:', parseError);
                throw new Error('AI returned invalid JSON');
            }
        } else {
            throw new Error('No valid JSON found in AI response');
        }

    } catch (error) {
        console.error('AI extraction failed:', error);
        console.log('Falling back to manual parsing...');

        // Fallback to manual parsing
        return parseResumeManually(resumeText);
    }
};

// Calculate resume quality score
export const calculateResumeScore = (extractedData) => {
    let score = 0;

    // Personal info completeness (20 points)
    if (extractedData.personalInfo?.name && extractedData.personalInfo.name.trim()) score += 5;
    if (extractedData.personalInfo?.email && extractedData.personalInfo.email.includes('@')) score += 5;
    if (extractedData.personalInfo?.phone && extractedData.personalInfo.phone.trim()) score += 5;
    if (extractedData.personalInfo?.location && extractedData.personalInfo.location.trim()) score += 5;

    // Skills (25 points)
    if (extractedData.skills && extractedData.skills.length > 0) {
        const validSkills = extractedData.skills.filter(skill => skill && skill.trim());
        score += Math.min(25, validSkills.length * 2.5);
    }

    // Experience (30 points)
    if (extractedData.experience && extractedData.experience.length > 0) {
        const validExperience = extractedData.experience.filter(exp =>
            exp.company && exp.company.trim() && exp.position && exp.position.trim()
        );
        score += Math.min(30, validExperience.length * 10);
    }

    // Education (15 points)
    if (extractedData.education && extractedData.education.length > 0) {
        const validEducation = extractedData.education.filter(edu =>
            edu.institution && edu.institution.trim() && edu.degree && edu.degree.trim()
        );
        score += Math.min(15, validEducation.length * 7.5);
    }

    // Projects (10 points)
    if (extractedData.projects && extractedData.projects.length > 0) {
        const validProjects = extractedData.projects.filter(proj =>
            proj.name && proj.name.trim() && proj.description && proj.description.trim()
        );
        score += Math.min(10, validProjects.length * 5);
    }

    return Math.min(100, Math.round(score));
};

// Calculate job matching score
export const calculateJobMatchScore = (extractedData, jobData) => {
    let score = 0;

    if (!extractedData || !jobData) {
        return 0;
    }

    // Skills matching (40 points)
    if (extractedData.skills && jobData.skills &&
        extractedData.skills.length > 0 && jobData.skills.length > 0) {
        const candidateSkills = extractedData.skills
            .filter(skill => skill && skill.trim())
            .map(s => s.toLowerCase().trim());
        const requiredSkills = jobData.skills
            .filter(skill => skill && skill.trim())
            .map(s => s.toLowerCase().trim());

        const matchingSkills = candidateSkills.filter(skill =>
            requiredSkills.some(req =>
                req.includes(skill) || skill.includes(req) ||
                req === skill
            )
        );

        if (requiredSkills.length > 0) {
            score += (matchingSkills.length / requiredSkills.length) * 40;
        }
    }

    // Experience relevance (30 points)
    if (extractedData.experience && extractedData.experience.length > 0) {
        const validExperience = extractedData.experience.filter(exp =>
            exp.company && exp.company.trim() && exp.position && exp.position.trim()
        );
        score += Math.min(30, validExperience.length * 10);
    }

    // Education (20 points)
    if (extractedData.education && extractedData.education.length > 0) {
        const validEducation = extractedData.education.filter(edu =>
            edu.institution && edu.institution.trim() && edu.degree && edu.degree.trim()
        );
        if (validEducation.length > 0) {
            score += 20;
        }
    }

    // Personal info completeness (10 points)
    if (extractedData.personalInfo) {
        const fields = ['name', 'email', 'phone'];
        const completedFields = fields.filter(field =>
            extractedData.personalInfo[field] && extractedData.personalInfo[field].trim()
        );
        score += (completedFields.length / fields.length) * 10;
    }

    return Math.min(100, Math.round(score));
};

// Main processing function for job applications
export const processResumeForJob = async (resumeFile, jobData) => {
    try {
        console.log('Processing resume for job application...');

        if (!resumeFile) {
            throw new Error('No resume file provided');
        }

        if (!jobData) {
            throw new Error('No job data provided');
        }

        // Step 1: Extract text from PDF
        console.log('Extracting text from PDF...');
        const resumeText = await extractTextFromPDF(resumeFile);

        if (!resumeText || resumeText.trim().length < 50) {
            throw new Error('Extracted text is too short or empty');
        }

        // Step 2: Extract structured data with AI (with fallback)
        console.log('Extracting structured data...');
        const extractedData = await extractResumeWithAI(resumeText);

        // Step 3: Calculate scores
        console.log('Calculating scores...');
        const resumeQualityScore = calculateResumeScore(extractedData);
        const jobMatchScore = calculateJobMatchScore(extractedData, jobData);

        // Step 4: Simple analysis
        const analysis = generateSimpleAnalysis(extractedData, jobData, jobMatchScore);

        return {
            resumeText,
            extractedData,
            resumeQualityScore,
            jobMatchScore,
            analysis
        };
    } catch (error) {
        console.error('Error processing resume for job:', error);
        throw new Error(`Resume processing failed: ${error.message}`);
    }
};

// Generate simple analysis without AI
const generateSimpleAnalysis = (extractedData, jobData, jobMatchScore) => {
    const analysis = {
        strengths: [],
        weaknesses: [],
        recommendations: []
    };

    // Add strengths based on data
    if (extractedData.skills && extractedData.skills.length > 5) {
        analysis.strengths.push("Strong technical skill set with diverse technologies");
    }
    if (extractedData.experience && extractedData.experience.length > 1) {
        analysis.strengths.push("Relevant professional experience across multiple roles");
    }
    if (extractedData.personalInfo?.email && extractedData.personalInfo?.phone) {
        analysis.strengths.push("Complete contact information provided");
    }

    // Add weaknesses based on score
    if (jobMatchScore < 50) {
        analysis.weaknesses.push("Limited alignment with required job skills");
        analysis.weaknesses.push("May need additional relevant experience");
    } else if (jobMatchScore < 70) {
        analysis.weaknesses.push("Some gaps in required technical skills");
    }

    // Add recommendations
    analysis.recommendations.push("Highlight specific achievements with quantifiable results");
    analysis.recommendations.push("Tailor resume content to match job requirements");
    analysis.recommendations.push("Consider adding relevant certifications or training");

    return analysis;
};

// React Component (existing UI code remains the same)
const ResumeExtractor = () => {
    const { user } = useAuth();
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeText, setResumeText] = useState('');
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extracted, setExtracted] = useState(null);
    const [error, setError] = useState('');
    const [aiScore, setAiScore] = useState(null);

    const handleFileUpload = async (file) => {
        if (!file) return;

        setExtracting(true);
        setError('');
        setResumeText('');

        try {
            console.log('Extracting text from PDF:', file.name);
            const text = await extractTextFromPDF(file);
            setResumeText(text);
            console.log('Text extracted successfully, length:', text.length);
        } catch (err) {
            console.error('Error extracting text:', err);
            setError(`Failed to extract text from PDF: ${err.message}`);
        } finally {
            setExtracting(false);
        }
    };

    const handleExtractWithAI = async () => {
        if (!resumeText.trim()) {
            setError('Please upload a resume or enter text first.');
            return;
        }

        if (resumeText.trim().length < 50) {
            setError('Resume text is too short. Please provide a complete resume.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('Starting resume extraction...');
            const extractedData = await extractResumeWithAI(resumeText);
            const score = calculateResumeScore(extractedData);

            setAiScore(score);
            setExtracted(extractedData);

            // Save to Firestore if user is logged in
            if (user) {
                await setDoc(doc(db, 'parsed_resumes', user.uid), {
                    ...extractedData,
                    extractedAt: new Date().toISOString(),
                    userId: user.uid,
                    aiScore: score,
                    rawText: resumeText,
                    fileName: resumeFile?.name || 'manual_input',
                    model: 'ai_with_fallback'
                });
                console.log('Resume data saved to Firestore');
            }

            console.log('Resume extraction completed successfully');
        } catch (err) {
            console.error('Extraction error:', err);
            setError(`Extraction failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    AI Resume Extractor
                    <span className="text-sm font-normal text-gray-500 ml-2">
                        (AI + Fallback Parsing)
                    </span>
                </h2>

                {/* File Upload */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Resume (PDF)
                    </label>
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            setResumeFile(file);
                            setExtracted(null);
                            setAiScore(null);
                            if (file) {
                                handleFileUpload(file);
                            }
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {extracting && (
                        <div className="mt-2 flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                            <p className="text-sm text-blue-600">Extracting text from PDF...</p>
                        </div>
                    )}
                </div>

                {/* Text Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resume Text (or paste text directly)
                    </label>
                    <textarea
                        rows={15}
                        value={resumeText}
                        onChange={(e) => {
                            setResumeText(e.target.value);
                            setExtracted(null);
                            setAiScore(null);
                        }}
                        placeholder="Paste your resume text here or upload a PDF above..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Characters: {resumeText.length} (minimum 50 required)
                    </p>
                </div>

                {/* Extract Button */}
                <div className="mb-6">
                    <button
                        onClick={handleExtractWithAI}
                        disabled={loading || !resumeText.trim() || resumeText.trim().length < 50}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center"
                    >
                        {loading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        )}
                        {loading ? 'Processing Resume...' : 'Extract Resume Data'}
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Results */}
                {extracted && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2 text-green-800">✓ Extraction Complete!</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{aiScore}%</p>
                                <p className="text-sm text-gray-600">Resume Quality Score</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">{extracted.skills?.length || 0}</p>
                                <p className="text-sm text-gray-600">Skills Extracted</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-purple-600">{extracted.experience?.length || 0}</p>
                                <p className="text-sm text-gray-600">Experience Entries</p>
                            </div>
                        </div>

                        <details className="mt-4">
                            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                                View Extracted Data
                            </summary>
                            <div className="mt-2 p-3 bg-white rounded border max-h-96 overflow-auto">
                                <pre className="text-sm text-gray-700">
                                    {JSON.stringify(extracted, null, 2)}
                                </pre>
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResumeExtractor;