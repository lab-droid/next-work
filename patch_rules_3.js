import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newHelpers = `
    function isValidCampaign(data) {
      return data.keys().hasAll(['userId', 'name', 'status', 'budget', 'spent', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.name is string && data.name.size() <= 200 &&
        data.status is string && data.status.size() <= 50 &&
        data.budget is number &&
        data.spent is number &&
        data.createdAt is number;
    }
`;

const matchBlocks = `
    match /campaigns/{campaignId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(campaignId) && isValidCampaign(incoming());
      allow update: if isSignedIn() && existing().userId == request.auth.uid &&
        incoming().userId == existing().userId &&
        incoming().diff(existing()).affectedKeys().hasOnly(['status', 'spent']) &&
        incoming().status is string && incoming().status.size() <= 50 &&
        incoming().spent is number;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
`;

rules = rules.replace('    match /users', newHelpers + '\n\n    match /users');
const lastIndex = rules.lastIndexOf('  }\n}');
rules = rules.substring(0, lastIndex) + matchBlocks + rules.substring(lastIndex);

fs.writeFileSync('firestore.rules', rules);
