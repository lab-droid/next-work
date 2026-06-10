import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  "allow update: if isSignedIn() && request.auth.uid == userId &&",
  "allow delete: if isAdmin();\n      allow update: if isSignedIn() && request.auth.uid == userId &&"
);

fs.writeFileSync('firestore.rules', rules);
