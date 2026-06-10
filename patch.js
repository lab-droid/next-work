import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'src/components');
const files = [
  'AdminView.tsx',
  'AnalyticsView.tsx',
  'ApprovalView.tsx',
  'CRMView.tsx',
  'CalendarView.tsx',
  'DocumentsView.tsx',
  'FinanceView.tsx',
  'HRView.tsx',
  'KanbanBoard.tsx',
  'MarketingView.tsx',
  'NoticeView.tsx'
];

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Impor modal
  if (!content.includes("useModal")) {
    const lines = content.split('\n');
    const lastImportIndex = lines.findLastIndex(l => l.startsWith('import '));
    lines.splice(lastImportIndex + 1, 0, "import { useModal } from '../lib/ModalContext';");
    content = lines.join('\n');
  }

  // Inject hook
  if (!content.includes('const { confirm, alert } = useModal();') && !content.includes('const { confirm } = useModal();')) {
    content = content.replace(/export default function ([A-Za-z0-9_]+)\(.*\)\s*\{/, "$&\n  const { confirm, alert } = useModal();");
  }

  // Replace alert
  content = content.replace(/alert\(([^)]+)\)/g, 'alert({ title: "알림", message: $1 })');
  content = content.replace(/window\.alert\(([^)]+)\)/g, 'alert({ title: "알림", message: $1 })');

  // Replace confirm
  // We matched line by line or we can just replace the block. Let's do simple regex for confirm block
  // Pattern: if \s*\(\s*window\.confirm\('([^']+)'\)\)\s*return;
  content = content.replace(/if\s*\(\s*!window\.confirm\('([^']+)'\)\)\s*return;([\s\S]*?)try\s*\{\s*await deleteDoc\(doc\(db, '([A-Za-z]+)', ([A-Za-z]+)\)\);([\s\S]*?)\}\s*catch\s*\(([^)]+)\)\s*\{([\s\S]*?)\}/, 
    "confirm({\n      title: '확인',\n      message: '$1',\n      onConfirm: async () => {\n        try {\n          await deleteDoc(doc(db, '$3', $4));$5} catch ($6) {$7}\n      }\n    });"
  );
  
  content = content.replace(/if\s*\(\s*confirm\('([^']+)'\)\s*\)\s*\{([\s\S]*?try\s*\{\s*await deleteDoc\(doc\(db, '([A-Za-z]+)', ([A-Za-z]+)\)\);[\s\S]*?\}\s*catch\s*\(([^)]+)\)\s*\{[\s\S]*?\}\s*)\}/g,
    "confirm({\n      title: '확인',\n      message: '$1',\n      onConfirm: async () => {$2}\n    });"
  );

  fs.writeFileSync(filePath, content);
}
console.log('Done');
