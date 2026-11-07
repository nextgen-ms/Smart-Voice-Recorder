/* =========================================
   SMART VOICE RECORDER
   Arabic Speech Recognition Only
========================================= */

// =========================================
// 1. DOM ELEMENTS
// =========================================

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const finishBtn = document.getElementById("finishBtn");

const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

const transcript = document.getElementById("transcript");
const timer = document.getElementById("timer");

const recordingTitle = document.getElementById("recordingTitle");
const recordingDescription = document.getElementById("recordingDescription");
const systemStatus = document.getElementById("systemStatus");

const recordingAnimation = document.getElementById("recordingAnimation");
const waveContainer = document.getElementById("waveContainer");

const recordingLabel = document.getElementById("recordingLabel");
const recordingLabelText = document.getElementById("recordingLabelText");
const liveIndicator = document.getElementById("liveIndicator");

const wordCount = document.getElementById("wordCount");
const characterCount = document.getElementById("characterCount");

const pdfModal = document.getElementById("pdfModal");
const fileName = document.getElementById("fileName");

const cancelModalBtn = document.getElementById("cancelModalBtn");
const confirmExportBtn = document.getElementById("confirmExportBtn");

const toast = document.getElementById("toast");


// =========================================
// 2. VARIABLES
// =========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

const APP_TIME_ZONE = "Africa/Cairo";

let isRecording = false;
let isPaused = false;
let isFinished = false;

let elapsedSeconds = 0;
let timerInterval = null;

let recognition = null;
let engineRetryTimer = null;

let engineInterim = "";

let exporting = false;
let toastTimeout = null;


// =========================================
// 3. LOCAL STORAGE
// =========================================

const STORAGE_KEY = "smartVoiceTranscript";

function saveTranscript() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            transcript.value
        );
    } catch (error) {
        console.warn(
            "Unable to save the transcript:",
            error
        );
    }
}

function loadTranscript() {
    try {
        const savedText = localStorage.getItem(STORAGE_KEY);

        if (savedText !== null) {
            transcript.value = savedText;
            updateStatistics();
        }
    } catch (error) {
        console.warn(
            "Unable to load the saved transcript:",
            error
        );
    }
}


// =========================================
// 4. TOAST NOTIFICATIONS
// =========================================

function showToast(message) {
    clearTimeout(toastTimeout);

    toast.textContent = message;
    toast.classList.add("show");

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


// =========================================
// 5. TRANSCRIPT STATISTICS
// =========================================

function updateStatistics() {
    const text = transcript.value.trim();

    const words = text
        ? text.split(/\s+/u).length
        : 0;

    const characters = transcript.value.length;

    wordCount.textContent = words;
    characterCount.textContent = characters;

    exportBtn.disabled = !text;

    saveTranscript();
}

transcript.addEventListener(
    "input",
    updateStatistics
);


// =========================================
// 6. RECORDING TIMER
// =========================================

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);

    const minutes = Math.floor(
        (seconds % 3600) / 60
    );

    const remainingSeconds = seconds % 60;

    return [
        hours,
        minutes,
        remainingSeconds
    ]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}

function updateTimer() {
    timer.textContent = formatTime(elapsedSeconds);
}

function startTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        elapsedSeconds++;
        updateTimer();
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}


// =========================================
// 7. INTERFACE STATES
// =========================================

function setRecordingUI() {
    recordingAnimation.classList.add("active");
    waveContainer.classList.add("active");
    recordingLabel.classList.add("active");
    liveIndicator.classList.add("active");

    recordingTitle.textContent = "Listening...";

    recordingDescription.textContent =
        "Speak naturally. Your words will appear below.";

    recordingLabelText.textContent = "RECORDING";

    systemStatus.textContent = "Recording in progress";
}

function setPausedUI() {
    recordingAnimation.classList.remove("active");
    waveContainer.classList.remove("active");
    recordingLabel.classList.remove("active");
    liveIndicator.classList.remove("active");

    recordingTitle.textContent = "Recording Paused";

    recordingDescription.textContent =
        "Your transcript has been saved. Resume whenever you are ready.";

    recordingLabelText.textContent = "PAUSED";

    systemStatus.textContent = "Recording paused";
}

function setReadyUI() {
    recordingAnimation.classList.remove("active");
    waveContainer.classList.remove("active");
    recordingLabel.classList.remove("active");
    liveIndicator.classList.remove("active");

    recordingTitle.textContent = "Ready to Listen";

    recordingDescription.textContent =
        "Press the microphone button to start recording.";

    recordingLabelText.textContent = "NOT RECORDING";

    systemStatus.textContent = "Ready to record";
}


// =========================================
// 8. TEXT DIRECTION DETECTION
// =========================================

function isArabicText(text) {
    return /[\u0600-\u06FF]/u.test(text);
}


// =========================================
// 9. ADD FINAL TRANSCRIPT TEXT
// =========================================

function appendTranscript(text) {
    const cleanText = text.trim();

    if (!cleanText) return;

    const currentText = transcript.value.trimEnd();

    transcript.value = currentText
        ? `${currentText} ${cleanText}`
        : cleanText;

    transcript.scrollTop = transcript.scrollHeight;

    updateStatistics();
}


// =========================================
// 10. INTERIM RECOGNITION TEXT
// =========================================

function updateInterimText() {
    transcript.placeholder = engineInterim
        ? `Recognizing: ${engineInterim}`
        : "Your speech will appear here...";
}


// =========================================
// 11. SPEECH RECOGNITION ENGINE
// =========================================

function startEngine() {
    if (!SpeechRecognition) return;

    if (
        !isRecording ||
        isPaused ||
        isFinished ||
        recognition
    ) {
        return;
    }

    const currentRecognition = new SpeechRecognition();

    currentRecognition.continuous = true;
    currentRecognition.interimResults = true;
    currentRecognition.maxAlternatives = 1;

    // Arabic recognition only
    currentRecognition.lang = "ar-EG";

    recognition = currentRecognition;

    currentRecognition.onstart = () => {
        console.log("Arabic speech recognition started.");
    };

    currentRecognition.onresult = event => {
        let temporaryText = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {
            const result = event.results[i];

            const recognizedText =
                result[0]?.transcript?.trim();

            if (!recognizedText) continue;

            if (result.isFinal) {
                appendTranscript(recognizedText);
            } else {
                temporaryText +=
                    `${temporaryText ? " " : ""}${recognizedText}`;
            }
        }

        engineInterim = temporaryText;

        updateInterimText();
    };

    currentRecognition.onerror = event => {
        const error = event.error;

        console.warn(
            "Speech recognition error:",
            error
        );

        if (
            error === "not-allowed" ||
            error === "service-not-allowed"
        ) {
            isRecording = false;
            isPaused = false;
            isFinished = false;

            pauseTimer();
            stopAllEngines();

            setReadyUI();

            startBtn.disabled = false;
            pauseBtn.disabled = true;
            resumeBtn.disabled = true;
            finishBtn.disabled = true;

            showToast(
                "Microphone or speech recognition permission was denied."
            );

            return;
        }

        if (error === "audio-capture") {
            showToast(
                "The microphone is not available."
            );
        }

        else if (error === "network") {
            showToast(
                "A network error interrupted speech recognition. Check your internet connection."
            );
        }

        else if (error === "no-speech") {
            console.log("No speech was detected.");
        }

        else if (error === "language-not-supported") {
            showToast(
                "Arabic speech recognition is not supported by this browser."
            );

            finishRecording();
        }
    };

    currentRecognition.onend = () => {
        if (recognition === currentRecognition) {
            recognition = null;
        }

        if (
            isRecording &&
            !isPaused &&
            !isFinished
        ) {
            clearTimeout(engineRetryTimer);

            engineRetryTimer = setTimeout(() => {
                startEngine();
            }, 350);
        }
    };

    try {
        currentRecognition.start();

    } catch (error) {
        console.warn(
            "Unable to start speech recognition:",
            error
        );

        if (recognition === currentRecognition) {
            recognition = null;
        }

        if (
            isRecording &&
            !isPaused &&
            !isFinished
        ) {
            clearTimeout(engineRetryTimer);

            engineRetryTimer = setTimeout(
                startEngine,
                700
            );
        }
    }
}


// =========================================
// 12. START RECOGNITION
// =========================================

function startAllEngines() {
    engineInterim = "";

    updateInterimText();

    startEngine();
}


// =========================================
// 13. STOP RECOGNITION
// =========================================

function stopAllEngines() {
    clearTimeout(engineRetryTimer);

    engineRetryTimer = null;

    if (recognition) {
        const activeRecognition = recognition;

        recognition = null;

        try {
            activeRecognition.onend = null;

            activeRecognition.stop();

        } catch (error) {
            console.warn(
                "Unable to stop speech recognition:",
                error
            );
        }
    }

    engineInterim = "";

    updateInterimText();
}


// =========================================
// 14. START RECORDING
// =========================================

function startRecording() {
    if (!SpeechRecognition) {
        showToast(
            "Your browser does not support speech recognition. Please use Google Chrome."
        );

        return;
    }

    if (isRecording) return;

    isRecording = true;
    isPaused = false;
    isFinished = false;

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    finishBtn.disabled = false;

    setRecordingUI();

    startTimer();

    startAllEngines();

    showToast("Recording started successfully.");
}

startBtn.addEventListener(
    "click",
    startRecording
);


// =========================================
// 15. PAUSE RECORDING
// =========================================

function pauseRecording() {
    if (!isRecording || isPaused) return;

    isPaused = true;

    pauseTimer();

    stopAllEngines();

    pauseBtn.disabled = true;
    resumeBtn.disabled = false;

    setPausedUI();

    showToast("Recording paused.");
}

pauseBtn.addEventListener(
    "click",
    pauseRecording
);


// =========================================
// 16. RESUME RECORDING
// =========================================

function resumeRecording() {
    if (!isRecording || !isPaused) return;

    isPaused = false;

    resumeBtn.disabled = true;
    pauseBtn.disabled = false;

    setRecordingUI();

    startTimer();

    startAllEngines();

    showToast("Recording resumed.");
}

resumeBtn.addEventListener(
    "click",
    resumeRecording
);


// =========================================
// 17. FINISH RECORDING
// =========================================

function finishRecording() {
    if (!isRecording) return;

    isFinished = true;
    isRecording = false;
    isPaused = false;

    pauseTimer();

    stopAllEngines();

    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    finishBtn.disabled = true;

    setReadyUI();

    recordingTitle.textContent = "Recording Completed";

    recordingDescription.textContent =
        "Your transcript is ready to export.";

    systemStatus.textContent = "Recording completed";

    updateStatistics();

    if (transcript.value.trim()) {
        showToast(
            "Recording completed successfully."
        );

        openPDFModal();

    } else {
        showToast("No speech was recognized.");
    }
}

finishBtn.addEventListener(
    "click",
    finishRecording
);


// =========================================
// 18. CLEAR TRANSCRIPT
// =========================================

clearBtn.addEventListener("click", () => {
    if (isRecording) {
        showToast(
            "Pause or finish recording before clearing the transcript."
        );

        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete the entire transcript?"
    );

    if (!confirmed) return;

    transcript.value = "";

    elapsedSeconds = 0;

    isFinished = false;

    updateTimer();

    updateStatistics();

    recordingTitle.textContent = "Ready to Listen";

    recordingDescription.textContent =
        "Press the microphone button to start recording.";

    showToast("Transcript cleared successfully.");
});


// =========================================
// 19. PDF EXPORT MODAL
// =========================================

function getFileDateStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const values = Object.fromEntries(
        parts
            .filter(part => part.type !== "literal")
            .map(part => [
                part.type,
                part.value
            ])
    );

    const timeParts = new Intl.DateTimeFormat("en-US", {
        timeZone: APP_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);

    const timeValues = Object.fromEntries(
        timeParts
            .filter(part => part.type !== "literal")
            .map(part => [
                part.type,
                part.value
            ])
    );

    return `${values.year}-${values.month}-${values.day}_${timeValues.hour}-${timeValues.minute}`;
}


function formatExportDateTime(date = new Date()) {
    const dateText = new Intl.DateTimeFormat("en-US", {
        timeZone: APP_TIME_ZONE,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);

    const timeText = new Intl.DateTimeFormat("en-US", {
        timeZone: APP_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(date);

    return `${dateText} at ${timeText} (Cairo time)`;
}


function openPDFModal() {
    if (!transcript.value.trim()) {
        showToast("There is no text to export.");

        return;
    }

    fileName.value =
        `Voice_Transcript_${getFileDateStamp()}`;

    pdfModal.classList.add("show");

    setTimeout(() => {
        fileName.focus();
        fileName.select();
    }, 100);
}


function closePDFModal() {
    pdfModal.classList.remove("show");
}


exportBtn.addEventListener(
    "click",
    openPDFModal
);

cancelModalBtn.addEventListener(
    "click",
    closePDFModal
);

pdfModal.addEventListener("click", event => {
    if (event.target === pdfModal) {
        closePDFModal();
    }
});


// =========================================
// 20. GENERATE PDF
// =========================================

async function generatePDF() {
    if (exporting) return;

    const text = transcript.value.trim();

    if (!text) {
        showToast("There is no text to export.");

        return;
    }

    if (typeof html2pdf === "undefined") {
        showToast("The PDF library could not be loaded.");

        return;
    }

    let documentName = fileName.value.trim();

    if (!documentName) {
        showToast("Please enter a file name.");

        fileName.focus();

        return;
    }

    documentName = documentName
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();

    if (!documentName) {
        showToast("Please enter a valid file name.");

        return;
    }

    exporting = true;

    confirmExportBtn.disabled = true;

    confirmExportBtn.textContent = "Generating PDF...";

    let pdfContent = null;

    try {
        const exportDate = new Date();

        const exportDateTime =
            formatExportDateTime(exportDate);

        const isArabicTranscript =
            isArabicText(text);

        pdfContent = document.createElement("div");

        pdfContent.style.cssText = `
            width: 100%;
            padding: 35px;
            background: #ffffff;
            color: #222222;
            font-family: Arial, Tahoma, sans-serif;
            box-sizing: border-box;
            overflow-wrap: break-word;
            direction: ltr;
            text-align: left;
        `;

        const heading = document.createElement("h1");

        heading.textContent =
            documentName.replace(/_/g, " ");

        heading.dir = "ltr";

        heading.style.cssText = `
            font-size: 25px;
            margin: 0 0 12px;
            color: #123c49;
            text-align: center;
            direction: ltr;
        `;

        const date = document.createElement("p");

        date.textContent =
            `Created on: ${exportDateTime}`;

        date.dir = "ltr";

        date.style.cssText = `
            font-size: 11px;
            color: #777777;
            text-align: center;
            direction: ltr;
            margin: 0 0 25px;
        `;

        const divider = document.createElement("hr");

        divider.style.cssText = `
            border: none;
            border-top: 2px solid #16c6b0;
            margin: 0 0 25px;
        `;

        const content = document.createElement("div");

        content.textContent = text;

        content.dir = isArabicTranscript
            ? "rtl"
            : "ltr";

        content.style.cssText = `
            font-family: Tahoma, Arial, sans-serif;
            font-size: 14px;
            line-height: 2;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            unicode-bidi: plaintext;
            color: #222222;
            text-align: ${isArabicTranscript ? "right" : "left"};
            direction: ${isArabicTranscript ? "rtl" : "ltr"};
        `;

        pdfContent.appendChild(heading);
        pdfContent.appendChild(date);
        pdfContent.appendChild(divider);
        pdfContent.appendChild(content);

        document.body.appendChild(pdfContent);

        const options = {
            margin: [10, 10, 10, 10],

            filename: `${documentName}.pdf`,

            image: {
                type: "jpeg",
                quality: 0.98
            },

            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                scrollY: 0
            },

            jsPDF: {
                unit: "mm",
                format: "a4",
                orientation: "portrait",
                compress: true
            },

            pagebreak: {
                mode: ["css", "legacy"]
            }
        };

        await html2pdf()
            .set(options)
            .from(pdfContent)
            .save();

        closePDFModal();

        showToast(
            "PDF exported and downloaded successfully."
        );

    } catch (error) {
        console.error(
            "PDF generation error:",
            error
        );

        showToast(
            "Something went wrong while creating the PDF."
        );

    } finally {
        if (pdfContent) {
            pdfContent.remove();
        }

        exporting = false;

        confirmExportBtn.disabled = false;

        confirmExportBtn.textContent = "Download PDF";
    }
}


confirmExportBtn.addEventListener(
    "click",
    generatePDF
);


// =========================================
// 21. KEYBOARD SHORTCUTS
// =========================================

fileName.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        generatePDF();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closePDFModal();
    }
});


// =========================================
// 22. INITIALIZATION
// =========================================

loadTranscript();

updateStatistics();

updateTimer();

setReadyUI();

console.log(
    "Smart Voice Recorder initialized successfully."
);