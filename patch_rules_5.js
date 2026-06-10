import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  "allow create: if isSignedIn() && request.auth.uid == userId && isValidId(userId) && isValidUser(incoming());",
  "allow create: if isSignedIn() && (request.auth.uid == userId || isAdmin()) && isValidId(userId) && isValidUser(incoming());"
);

fs.writeFileSync('firestore.rules', rules);
