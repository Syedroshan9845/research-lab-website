// 🔥 FIREBASE CONFIG (REPLACE WITH YOUR OWN)
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app",
  messagingSenderId: "149246738052",
  appId: "G-YGTTEM0KXS"
};

// INIT
firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();
var storage = firebase.storage();

// SHOW / HIDE PASSWORD
function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

// LOGIN FUNCTION (FINAL & CORRECT)
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

      // CHECK ADMIN FIRST
      db.collection("admins").doc(uid).get()
        .then((adminDoc) => {
          if (adminDoc.exists && adminDoc.data().active === true) {
            window.location.href = "admin-dashboard.html";
          } else {
            // CHECK USER
            db.collection("users").doc(uid).get()
              .then((userDoc) => {
                if (userDoc.exists && userDoc.data().active === true) {
                  window.location.href = "user-dashboard.html";
                } else {
                  alert("Access denied");
                  auth.signOut();
                }
              });
          }
        });
    })
    .catch((error) => {
      alert(error.message);
    });
}
