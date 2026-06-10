import fs from 'fs';
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newHelpers = `
    function isValidTask(data) {
      return data.keys().hasAll(['userId', 'content', 'tag', 'tagColor', 'status', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.content is string && data.content.size() <= 200 &&
        data.tag is string &&
        data.tagColor is string &&
        data.status is string &&
        data.createdAt is number;
    }

    function isValidTransaction(data) {
      return data.keys().hasAll(['userId', 'type', 'amount', 'date', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.type is string &&
        data.amount is number &&
        data.date is string &&
        data.createdAt is number;
    }

    function isValidDocument(data) {
      return data.keys().hasAll(['userId', 'name', 'type', 'size', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.name is string && data.name.size() <= 200 &&
        data.type is string &&
        data.size is string &&
        data.createdAt is number;
    }

    function isValidChat(data) {
      return data.keys().hasAll(['userId', 'name', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.name is string && data.name.size() <= 100 &&
        data.createdAt is number;
    }

    function isValidMessage(data) {
      return data.keys().hasAll(['userId', 'chatId', 'text', 'sender', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.chatId is string &&
        data.text is string && data.text.size() <= 1000 &&
        data.sender is string &&
        data.createdAt is number;
    }

    function isValidAnalytics(data) {
      return data.keys().hasAll(['userId', 'name', 'visitors', 'newUsers', 'createdAt']) &&
        data.userId == request.auth.uid &&
        data.name is string && data.name.size() <= 100 &&
        data.visitors is number &&
        data.newUsers is number &&
        data.createdAt is number;
    }`;

const matchBlocks = `
    match /tasks/{taskId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(taskId) && isValidTask(incoming());
      allow update: if isSignedIn() && existing().userId == request.auth.uid &&
        incoming().userId == existing().userId &&
        incoming().diff(existing()).affectedKeys().hasOnly(['status']) &&
        incoming().status is string;
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /transactions/{txnId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(txnId) && isValidTransaction(incoming());
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /documents/{docId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(docId) && isValidDocument(incoming());
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /chats/{chatId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(chatId) && isValidChat(incoming());
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /messages/{messageId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(messageId) && isValidMessage(incoming());
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }

    match /analyticsRecords/{recordId} {
      allow get: if isSignedIn() && existing().userId == request.auth.uid;
      allow list: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && isValidId(recordId) && isValidAnalytics(incoming());
      allow delete: if isSignedIn() && existing().userId == request.auth.uid;
    }
`;

rules = rules.replace('    match /users', newHelpers + '\n\n    match /users');
const lastIndex = rules.lastIndexOf('  }\n}');
rules = rules.substring(0, lastIndex) + matchBlocks + rules.substring(lastIndex);

fs.writeFileSync('firestore.rules', rules);
