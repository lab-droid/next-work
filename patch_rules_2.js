import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newHelpers = `
    function isValidNotice(data) {
      return data.keys().hasAll(['userId', 'title', 'content', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.title is string && data.title.size() <= 200 &&
        data.content is string && data.content.size() <= 1000 &&
        data.createdAt is number;
    }

    function isValidAttendance(data) {
      return data.keys().hasAll(['userId', 'date', 'checkIn', 'checkOut', 'status', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.date is string && data.date.size() <= 50 &&
        data.checkIn is string && data.checkIn.size() <= 50 &&
        data.checkOut is string && data.checkOut.size() <= 50 &&
        data.status is string && data.status.size() <= 50 &&
        data.createdAt is number;
    }

    function isValidApproval(data) {
      return data.keys().hasAll(['userId', 'title', 'content', 'status', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.title is string && data.title.size() <= 200 &&
        data.content is string && data.content.size() <= 1000 &&
        data.status is string && data.status.size() <= 50 &&
        data.createdAt is number;
    }
`;

const matchBlocks = `
    match /notices/{noticeId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(noticeId) && isValidNotice(incoming());
      allow update: if isSignedIn() && existing().userId == request.auth.uid &&
        incoming().userId == existing().userId &&
        incoming().diff(existing()).affectedKeys().hasOnly(['title', 'content']) &&
        incoming().title is string && incoming().title.size() <= 200 &&
        incoming().content is string && incoming().content.size() <= 1000;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /attendances/{attendanceId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(attendanceId) && isValidAttendance(incoming());
      allow update: if isSignedIn() && existing().userId == request.auth.uid &&
        incoming().userId == existing().userId &&
        incoming().diff(existing()).affectedKeys().hasOnly(['checkOut', 'status']) &&
        incoming().checkOut is string && incoming().checkOut.size() <= 50 &&
        incoming().status is string && incoming().status.size() <= 50;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /approvals/{approvalId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(approvalId) && isValidApproval(incoming());
      allow update: if isSignedIn() && existing().userId == request.auth.uid &&
        incoming().userId == existing().userId &&
        incoming().diff(existing()).affectedKeys().hasOnly(['status']) &&
        incoming().status is string && incoming().status.size() <= 50;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
`;

rules = rules.replace('    match /users', newHelpers + '\n\n    match /users');
const lastIndex = rules.lastIndexOf('  }\n}');
rules = rules.substring(0, lastIndex) + matchBlocks + rules.substring(lastIndex);

fs.writeFileSync('firestore.rules', rules);
