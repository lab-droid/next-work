import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  "data.keys().size() == 7 &&",
  "(data.keys().size() == 7 || data.keys().size() == 8) &&"
);

rules = rules.replace(
  "data.status is string && data.status.size() <= 50 &&",
  "data.status is string && data.status.size() <= 50 &&\n        (data.keys().hasAll(['campaignId']) ? (data.campaignId is string || data.campaignId == null) : true) &&"
);

rules = rules.replace(
  "incoming().diff(existing()).affectedKeys().hasOnly(['name', 'email', 'phone', 'company', 'status'])",
  "incoming().diff(existing()).affectedKeys().hasOnly(['name', 'email', 'phone', 'company', 'status', 'campaignId'])"
);

fs.writeFileSync('firestore.rules', rules);
