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

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    formStatus.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
        const formData = new FormData(form);
        const data = new URLSearchParams();

        data.append("name", formData.get("name") || "");
        data.append("email", formData.get("email") || "");
        data.append("organization", formData.get("organization") || "");
        data.append("event", formData.get("event") || "");
        data.append("date", formData.get("date") || "");
        data.append("time", formData.get("time") || "");
        data.append("location", formData.get("location") || "");
        data.append("message", formData.get("message") || "");

        const coverage = formData.getAll("coverage");

        coverage.forEach(function (item) {
            data.append("coverage", item);
        });

        const response = await fetch(API_URL, {
            method: "POST",
            body: data
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Submission failed.");
        }

        formStatus.textContent =
            "Request submitted successfully!";

        form.reset();

    } catch (error) {
        console.error("Submission error:", error);

        formStatus.textContent =
            "Error: " + error.message;
    }

    submitButton.disabled = false;
    submitButton.textContent = "Send request";
});
