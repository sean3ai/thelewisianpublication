// form.js is to submit data through in the google sheets while simultaniously sending a  email

// Automation (Backend via Google Apps Script)
// When the user clicks the "Confirm" or "Submit" button, the webpage must send the form data to a Google Apps Script.
// The Google Apps Script must generate a document containing the receipt or booking details (this can be a PDF, Google Doc, or a similar format).
// The script must automatically send this generated document to the email address the user provided in the form.
// form.js is to submit data through Google Sheets
// while simultaneously sending an email and PDF.

const form = document.getElementById("coverage-form");
const submitButton = document.getElementById("submit-btn");
const formStatus = document.getElementById("form-status");

// Fields that must be filled in.
// The keys must match the "name" attributes in your HTML form.
const REQUIRED_FIELDS = {
    name: "Your name",
    email: "Email address",
    event: "Event name",
    date: "Event date",
    time: "Start time",
    location: "Location"
};

const OPTIONAL_FIELDS = ["organization", "message"];

function showStatus(text, isError) {
    formStatus.textContent = text;
    formStatus.style.color = isError ? "#b00020" : "#1b7f3b";
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Today's date as YYYY-MM-DD in the user's local time
function todayString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
}

// Returns { message, field } for the first problem found, or null if all is well
function validate(values, coverage) {
    for (const key in REQUIRED_FIELDS) {
        if (!values[key]) {
            return { message: REQUIRED_FIELDS[key] + " is required.", field: key };
        }
    }

    if (!isValidEmail(values.email)) {
        return {
            message: "Please enter a valid email address (example: name@gmail.com).",
            field: "email"
        };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
        return { message: "Please choose a valid event date.", field: "date" };
    }

    // Remove this check if you also want to accept past dates
    if (values.date < todayString()) {
        return { message: "The event date cannot be in the past.", field: "date" };
    }

    if (coverage.length === 0) {
        return {
            message: "Please select at least one type of coverage.",
            field: "coverage"
        };
    }

    if (values.message.length > 2000) {
        return { message: "Message is too long (2000 characters max).", field: "message" };
    }

    return null;
}

form.addEventListener("submit", async function (submitEvent) {
    submitEvent.preventDefault();

    // Prevents double submissions
    if (submitButton.disabled) return;

    showStatus("", false);

    if (typeof API_URL === "undefined" || !API_URL) {
        showStatus("Form is not configured yet (missing API_URL).", true);
        return;
    }

    // Read and trim every value
    const formData = new FormData(form);
    const values = {};

    Object.keys(REQUIRED_FIELDS).concat(OPTIONAL_FIELDS).forEach(function (key) {
        values[key] = String(formData.get(key) || "").trim();
    });

    const coverage = formData
        .getAll("coverage")
        .map(function (item) { return String(item).trim(); })
        .filter(Boolean);

    // Stop here if anything is missing or invalid
    const problem = validate(values, coverage);

    if (problem) {
        showStatus(problem.message, true);

        const fieldEl = form.querySelector('[name="' + problem.field + '"]');
        if (fieldEl) fieldEl.focus();
        else console.warn('No input found with name="' + problem.field + '"');

        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
        const data = new URLSearchParams();

        Object.keys(values).forEach(function (key) {
            data.append(key, values[key]);
        });

        coverage.forEach(function (item) {
            data.append("coverage", item);
        });

        const response = await fetch(API_URL, {
            method: "POST",
            body: data
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            throw new Error("The server returned an unexpected response.");
        }

        if (!result.success) {
            throw new Error(result.error || "Submission failed.");
        }

        showStatus("Request submitted successfully!", false);
        form.reset();

    } catch (error) {
        console.error("Submission error:", error);
        showStatus("Error: " + error.message, true);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send request";
    }
});