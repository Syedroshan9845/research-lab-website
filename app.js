// 🔴 REPLACE WITH YOUR FIREBASE CONFIG
var firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();
var storage = firebase.storage();

/* ---------------- AUTH ---------------- */

function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  auth.signInWithEmailAndPassword(email, password)
    .then(() => loadDashboard(email))
    .catch(err => alert(err.message));
}

function logout() {
  auth.signOut().then(() => location.reload());
}

/* ---------------- DASHBOARD ---------------- */

function loadDashboard(email) {
  db.collection("users").doc(email).get().then(doc => {
    if (!doc.exists || !doc.data().active) {
      alert("User not allowed");
      logout();
      return;
    }

    loginBox.classList.add("hidden");

    if (doc.data().role === "ADMIN") {
      adminDashboard.classList.remove("hidden");
      loadAllLeaves();
    } else {
      userDashboard.classList.remove("hidden");
      loadLeaveBalance(email);
    }
  });
}

/* ---------------- LEAVE LOGIC ---------------- */

function calculateDays(from, to) {
  const s = new Date(from);
  const e = new Date(to);
  const diff = e - s;
  return diff >= 0 ? diff / (1000 * 60 * 60 * 24) + 1 : 0;
}

function applyLeave() {
  const from = fromDate.value;
  const to = toDate.value;
  const reason = leaveReason.value.trim();
  const file = document.getElementById("leaveFile").files[0];
  const email = auth.currentUser.email;

  if (!from || !to) {
    alert("Select From and To dates");
    return;
  }

  if (reason.length < 10) {
    alert("Reason must be at least 10 characters");
    return;
  }

  const days = calculateDays(from, to);
  totalDays.innerText = days;

  db.collection("users").doc(email).get().then(userDoc => {
    const remaining =
      userDoc.data().totalLeaves - userDoc.data().usedLeaves;

    if (days > remaining) {
      alert("Not enough remaining CL");
      return;
    }

    function saveLeave(documentURL = "") {
      db.collection("leaves").add({
        email,
        fromDate: from,
        toDate: to,
        days,
        reason,
        documentURL,
        status: "Pending",
        createdAt: new Date().toISOString()
      }).then(() => {
        alert("Leave applied");
        leaveFile.value = "";
      });
    }

    if (file) {
      const ref = storage.ref(
        `leave-documents/${email}/${Date.now()}_${file.name}`
      );

      ref.put(file).then(snap => {
        snap.ref.getDownloadURL().then(url => {
          saveLeave(url);
        });
      }).catch(() => alert("File upload failed"));
    } else {
      saveLeave();
    }
  });
}

/* ---------------- BALANCE ---------------- */

function loadLeaveBalance(email) {
  db.collection("users").doc(email).get().then(doc => {
    totalLeaves.innerText = doc.data().totalLeaves;
    usedLeaves.innerText = doc.data().usedLeaves;
    remainingLeaves.innerText =
      doc.data().totalLeaves - doc.data().usedLeaves;
  });
}

/* ---------------- ADMIN ---------------- */

function loadAllLeaves() {
  db.collection("leaves")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      allLeaves.innerHTML = "";
      snapshot.forEach(doc => {
        const d = doc.data();
        allLeaves.innerHTML += `
          <li>
            <b>${d.email}</b><br>
            ${d.fromDate} → ${d.toDate} (${d.days} days)<br>
            Status: ${d.status}<br>
            ${
              d.documentURL
                ? `<a href="${d.documentURL}" target="_blank">View Document</a>`
                : "<i>No document uploaded</i>"
            }
          </li>
        `;
      });
    });
}
