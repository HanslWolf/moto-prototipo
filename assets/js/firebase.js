import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqv3fxTDBy16Y_eYAqwjG0n7xh5TJaExE",
  authDomain: "motos-c9e5c.firebaseapp.com",
  databaseURL: "https://motos-c9e5c-default-rtdb.firebaseio.com",
  projectId: "motos-c9e5c",
  storageBucket: "motos-c9e5c.firebasestorage.app",
  messagingSenderId: "458774749250",
  appId: "1:458774749250:web:5f3c45d45a9fc9b242cddb"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
