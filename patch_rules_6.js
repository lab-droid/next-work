import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  "data.keys().hasAll(['companyName', 'updatedAt']) &&",
  "data.keys().hasAll(['companyName', 'companyCode', 'updatedAt']) &&"
);

rules = rules.replace(
  "data.companyName is string && data.companyName.size() <= 100 &&",
  "data.companyName is string && data.companyName.size() <= 100 &&\\n        data.companyCode is string && data.companyCode.size() <= 50 &&"
);

rules = rules.replace(
  "match /settings/{docId} {\\n      allow read: if isSignedIn();",
  "match /settings/{docId} {\\n      allow read: if true;"
);

// We should also allow the user to read user data if signed in or something.
// Oh wait, users are created by the admin or sign up. They are already in DB.
// Let's just write the changes.
fs.writeFileSync('firestore.rules', rules);
