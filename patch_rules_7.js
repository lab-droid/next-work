import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  "data.keys().hasAll(['companyName', 'updatedAt']) &&",
  "data.keys().hasAll(['companyName', 'companyCode', 'updatedAt']) &&"
);

rules = rules.replace(
  "data.companyName is string && data.companyName.size() <= 100 &&\\n        data.updatedAt is number;",
  "data.companyName is string && data.companyName.size() <= 100 &&\\n        data.companyCode is string && data.companyCode.size() <= 50 &&\\n        data.updatedAt is number;"
);

rules = rules.replace(
  "match /settings/{docId} {\\n      allow read: if isSignedIn();",
  "match /settings/{docId} {\\n      allow read: if true;"
);

fs.writeFileSync('firestore.rules', rules);
