// 🔴 YOU WILL REPLACE THESE VALUES FROM FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  firebase.auth()
    .signInWithEmailAndPassword(email, password)
    .then(() => {
      alert("Login successful");
    })
    .catch(() => {
      alert("Access denied");
    });
}
