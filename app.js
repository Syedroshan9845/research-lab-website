// ================= FIREBASE CONFIG =================
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};

// ================= INIT =================
firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();

console.log("Firebase initialized");

// ================= LOGIN =================
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Enter email and password");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then((cred) => {
      const uid = cred.user.uid;
      console.log("Logged in UID:", uid);

      // CHECK ADMIN COLLECTION
      db.collection("admins").doc(uid).get()
        .then((adminDoc) => {
          if (adminDoc.exists && adminDoc.data().active === true) {
            window.location.href = "admin-dashboard.html";
          } else {
            // CHECK USER COLLECTION
            db.collection("users").doc(uid).get()
              .then((userDoc) => {
                if (userDoc.exists && userDoc.data().active === true) {
                  window.location.href = "user-dashboard.html";
                } else {
                  alert("No role assigned in Firestore");
                  auth.signOut();
                }
              });
          }
        });
    })
    .catch((error) => {
      alert(error.message);
      console.error(error);
    });
}

// ================= LOGOUT =================
function logout() {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
}
