
const API_ROOT = "https://api.jsonstorage.net/v1/json";
const TEACHER_USERNAME = "Teacher448";
const TEACHER_PASSWORD = "TITVB448";
const POLL_INTERVAL_MS = 8000;
const MAX_ATTEMPTS = 3;
const $ = (id) => document.getElementById(id);
let classUrl = "";
let classData = { bellRingers: [] };
let currentStudent = "";
let isTeacher = false;
let pollTimer = null;
let saving = false;
function showOnly(id) {
["roleCard", "studentLogin", "teacherLogin", "studentArea", "teacherArea"]
.forEach((sectionId) => $(sectionId).classList.add("hidden"));
if (id) $(id).classList.remove("hidden");
}
function message(container, text, isError = false) {
container.replaceChildren();
const box = document.createElement("div");
box.className = "notice" + (isError ? " error" : "");
box.textContent = text;
container.appendChild(box);
}
function setStatus(text, isError = false) {
const el = $("connectionStatus");
el.className = "card notice" + (isError ? " error" : "");
el.textContent = text;
}
function createJoinCode() {
const bytes = new Uint8Array(24);
crypto.getRandomValues(bytes);
return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function normalizeJoinCode(value) {
const code = value.trim();
if (/^https://api.jsonstorage.net/v1/json/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$/.test(code)) {
return code;
}
if (/^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$/.test(code)) {
return API_ROOT + "/" + code;
}
return "";
}
async function request(url, options = {}) {
const response = await fetch(url, {
...options,
headers: {
"Content-Type": "application/json",
...(options.headers || {})
},
cache: "no-store"
});
if (!response.ok) {
const detail = await response.text().catch(() => "");
throw new Error(Storage service returned ${response.status}${detail ? ": " + detail.slice(0, 160) : ""});
}
if (response.status === 204) return null;
const text = await response.text();
return text ? JSON.parse(text) : null;
}
async function createClass() {
const initialData = {
app: "ms-intro-to-program-bell-ringers",
createdAt: new Date().toISOString(),
bellRingers: []
};
const result = await request(API_ROOT, {
method: "POST",
body: JSON.stringify(initialData)
});
if (!result || typeof result.uri !== "string") {
throw new Error("The storage service did not return a class link.");
}
return { url: result.uri, data: initialData };
}
async function fetchClass(url) {
const data = await request(url);
if (!data || data.app !== "ms-intro-to-program-bell-ringers" || !Array.isArray(data.bellRingers)) {
throw new Error("That join code does not contain a valid bell-ringer class.");
}
return data;
}
async function saveClass() {
if (!classUrl || saving) throw new Error("The class is not ready to save.");
saving = true;
try {
await request(classUrl, {
method: "PUT",
body: JSON.stringify(classData)
});
} finally {
saving = false;
}
}
function startPolling() {
clearInterval(pollTimer);
pollTimer = setInterval(async () => {
if (!classUrl || saving) return;
try {
const latest = await fetchClass(classUrl);
classData = latest;
renderAll();
setStatus("Connected — shared class data is refreshing across devices.");
} catch (error) {
console.error(error);
setStatus("Could not refresh the shared class. Check your connection and join code.", true);
}
}, POLL_INTERVAL_MS);
}
function dateLabel(value) {
const date = new Date(value);
return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
function renderStudentBellRingers() {
const root = $("studentBellRingers");
root.replaceChildren();
if (!classData.bellRingers.length) {
const empty = document.createElement("p");
empty.className = "muted";
empty.textContent = "There are no bell ringers yet.";
root.appendChild(empty);
return;
}
[...classData.bellRingers].reverse().forEach((item) => {
const section = document.createElement("section");
section.className = "bell";
const title = document.createElement("h3");
title.textContent = item.title || "Bell Ringer";
const question = document.createElement("p");
question.textContent = item.question;
section.append(title, question);

const prior = (item.answers || []).find(
  (answer) => answer.student.toLowerCase() === currentStudent.toLowerCase()
);

if (prior) {
  const note = document.createElement("p");
  note.className = "notice";
  note.textContent = "You have already answered. You can update your answer below.";
  section.appendChild(note);
}

const form = document.createElement("form");
const label = document.createElement("label");
label.textContent = "Your answer";
const textarea = document.createElement("textarea");
textarea.required = true;
textarea.value = prior ? prior.text : "";
textarea.placeholder = "Type your answer…";
label.appendChild(textarea);

const submit = document.createElement("button");
submit.type = "submit";
submit.textContent = prior ? "Update answer" : "Submit answer";
form.append(label, submit);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = textarea.value.trim();
  if (!text) return;

  const answers = [...(item.answers || [])];
  const existingIndex = answers.findIndex(
    (answer) => answer.student.toLowerCase() === currentStudent.toLowerCase()
  );
  const record = { student: currentStudent, text, submittedAt: new Date().toISOString() };

  if (existingIndex >= 0) answers[existingIndex] = record;
  else answers.push(record);

  item.answers = answers;
  try {
    await saveClass();
    renderAll();
    setStatus("Answer saved and synced.");
  } catch (error) {
    console.error(error);
    setStatus("Could not save your answer. Please try again.", true);
  }
});

section.appendChild(form);
root.appendChild(section);

});
}
function renderTeacherBellRingers() {
const root = $("teacherBellRingers");
root.replaceChildren();
if (!classData.bellRingers.length) {
const empty = document.createElement("p");
empty.className = "muted";
empty.textContent = "No bell ringers have been added yet.";
root.appendChild(empty);
return;
}
[...classData.bellRingers].reverse().forEach((item) => {
const section = document.createElement("section");
section.className = "bell";
const title = document.createElement("h3");
title.textContent = item.title || "Bell Ringer";
const question = document.createElement("p");
question.textContent = item.question;
const date = document.createElement("p");
date.className = "meta";
date.textContent = "Added " + dateLabel(item.createdAt);
const answerHeading = document.createElement("h3");
answerHeading.textContent = `Student answers (${(item.answers || []).length})`;
section.append(title, question, date, answerHeading);

if (!item.answers?.length) {
  const empty = document.createElement("p");
  empty.className = "muted";
  empty.textContent = "No answers submitted yet.";
  section.appendChild(empty);
} else {
  item.answers.forEach((answer) => {
    const box = document.createElement("div");
    box.className = "answer";
    const student = document.createElement("strong");
    student.textContent = answer.student;
    const body = document.createElement("p");
    body.textContent = answer.text;
    const submitted = document.createElement("small");
    submitted.className = "meta";
    submitted.textContent = "Submitted " + dateLabel(answer.submittedAt);
    box.append(student, body, submitted);
    section.appendChild(box);
  });
}

const remove = document.createElement("button");
remove.type = "button";
remove.className = "danger";
remove.textContent = "Delete this bell ringer";
remove.addEventListener("click", async () => {
  if (!confirm("Delete this bell ringer and its answers?")) return;
  const previous = classData;
  classData = {
    ...classData,
    bellRingers: classData.bellRingers.filter((entry) => entry.id !== item.id)
  };
  try {
    await saveClass();
    renderAll();
  } catch (error) {
    classData = previous;
    renderAll();
    setStatus("Could not delete the bell ringer.", true);
  }
});
section.appendChild(remove);
root.appendChild(section);

});
}
function renderAll() {
if (currentStudent) renderStudentBellRingers();
if (isTeacher) renderTeacherBellRingers();
}
$("studentRole").addEventListener("click", () => showOnly("studentLogin"));
$("teacherRole").addEventListener("click", () => showOnly("teacherLogin"));
document.querySelectorAll(".backButton").forEach((button) => {
button.addEventListener("click", () => showOnly("roleCard"));
});
$("studentContinue").addEventListener("click", async () => {
const name = $("studentName").value.trim();
const url = normalizeJoinCode($("studentJoinCode").value);
if (!name || !url) {
message($("studentLoginMessage"), "Enter your name and a valid class join code.", true);
return;
}
try {
classUrl = url;
classData = await fetchClass(classUrl);
currentStudent = name;
isTeacher = false;
$("studentWelcome").textContent = "Hello, " + name;
showOnly("studentArea");
renderAll();
setStatus("Connected — shared class data is loaded.");
startPolling();
} catch (error) {
console.error(error);
message($("studentLoginMessage"), "Could not open that class. Check the join code and try again.", true);
}
});
$("teacherContinue").addEventListener("click", async () => {
if ($("teacherUsername").value !== TEACHER_USERNAME ||
$("teacherPassword").value !== TEACHER_PASSWORD) {
message($("teacherLoginMessage"), "Incorrect username or password.", true);
return;
}
try {
const existing = localStorage.getItem("bellRingerTeacherClassUrl");
let result;
if (existing) {
  try {
    const existingData = await fetchClass(existing);
    result = { url: existing, data: existingData };
  } catch {
    result = await createClass();
    localStorage.setItem("bellRingerTeacherClassUrl", result.url);
  }
} else {
  result = await createClass();
  localStorage.setItem("bellRingerTeacherClassUrl", result.url);
}

classUrl = result.url;
classData = result.data;
isTeacher = true;
currentStudent = "";
$("teacherJoinCode").textContent = classUrl;
showOnly("teacherArea");
renderAll();
setStatus("Connected — share the join code above with students.");
startPolling();

} catch (error) {
console.error(error);
message(
$("teacherLoginMessage"),
"Could not connect to the hosted storage service. Try again later.",
true
);
}
});
$("copyJoinCode").addEventListener("click", async () => {
try {
await navigator.clipboard.writeText(classUrl);
$("copyJoinCode").textContent = "Copied!";
setTimeout(() => $("copyJoinCode").textContent = "Copy join code", 1500);
} catch {
alert("Copy this class join code: " + classUrl);
}
});
$("addBellRinger").addEventListener("click", async () => {
const question = $("bellQuestion").value.trim();
if (!question) {
message($("createMessage"), "Enter a question before adding it.", true);
return;
}
const newItem = {
id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
title: $("bellTitle").value.trim(),
question,
createdAt: new Date().toISOString(),
answers: []
};
classData.bellRingers.push(newItem);
try {
await saveClass();
$("bellTitle").value = "";
$("bellQuestion").value = "";
$("createMessage").replaceChildren();
renderAll();
setStatus("Bell ringer added and synced.");
} catch (error) {
classData.bellRingers = classData.bellRingers.filter((item) => item.id !== newItem.id);
console.error(error);
message($("createMessage"), "Could not save the bell ringer. Try again.", true);
}
});
document.querySelectorAll(".logoutButton").forEach((button) => {
button.addEventListener("click", () => {
clearInterval(pollTimer);
currentStudent = "";
isTeacher = false;
classUrl = "";
classData = { bellRingers: [] };
showOnly("roleCard");
setStatus("Signed out.");
});
});
window.addEventListener("storage", (event) => {
if (event.key === "bellRingerTeacherClassUrl" && !classUrl) {
setStatus("A class is available on this browser. Sign in as teacher to open it.");
}
});
setStatus("Ready. Choose a role to continue.");
