import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newHelpers = `
    function isValidCompanyInfo(data) {
      return data.keys().hasAll(['companyName', 'updatedAt']) &&
        data.companyName is string && data.companyName.size() <= 100 &&
        data.updatedAt is number;
    }
`;

const matchBlocks = `
    match /settings/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin() && docId == 'company_info' && isValidCompanyInfo(incoming());
    }
`;

rules = rules.replace('    match /users', newHelpers + '\n\n    match /users');
const lastIndex = rules.lastIndexOf('  }\n}');
rules = rules.substring(0, lastIndex) + matchBlocks + rules.substring(lastIndex);

fs.writeFileSync('firestore.rules', rules);
