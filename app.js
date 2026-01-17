// 🔴 REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// LOGIN
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => loadDashboard(email))
    .catch(() => alert("Access denied"));
}

// LOAD DASHBOARD
function loadDashboard(email) {
  db.collection("users").doc(email).get().then(doc => {
    if (!doc.exists || !doc.data().active) {
      alert("User not allowed");
      logout();
      return;
    }

    document.getElementById("loginBox").classList.add("hidden");

    if (doc.data().role === "ADMIN") {
      document.getElementById("adminDashboard").classList.remove("hidden");
      loadAllLeaves();
    } else {
      document.getElementById("userDashboard").classList.remove("hidden");
      loadUserLeaves(email);
    }
  });
}

// APPLY LEAVE (USER)
function applyLeave() {
  const user = auth.currentUser.email;

  db.collection("leaves").add({
    email: user,
    date: leaveDate.value,
    days: leaveDays.value,
    reason: leaveReason.value,
    status: "Pending"
  }).then(() => {
    alert("Leave submitted");
    loadUserLeaves(user);
  });
}

// LOAD USER LEAVES
function loadUserLeaves(email) {
  userLeaves.innerHTML = "";
  db.collection("leaves").where("email", "==", email).get().then(snapshot => {
    snapshot.forEach(doc => {
      userLeaves.innerHTML += `<li>${doc.data().date} - ${doc.data().status}</li>`;
    });
  });
}

// LOAD ALL LEAVES (ADMIN)
function loadAllLeaves() {
  allLeaves.innerHTML = "";
  db.collection("leaves").get().then(snapshot => {
    snapshot.forEach(doc => {
      const d = doc.data();
      allLeaves.innerHTML += `
        <li>
          ${d.email} | ${d.date} | ${d.status}
          <button class="small" onclick="updateLeave('${doc.id}','Approved')">Approve</button>
          <button class="small" onclick="updateLeave('${doc.id}','Rejected')">Reject</button>
        </li>`;
    });
  });
}

// UPDATE LEAVE STATUS
function updateLeave(id, status) {
  db.collection("leaves").doc(id).update({ status }).then(loadAllLeaves);
}

// LOGOUT
function logout() {
  auth.signOut().then(() => location.reload());
}

